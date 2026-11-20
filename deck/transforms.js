// transforms — the drawing helpers a deck's HTML may use, applied before its pieces are read. Plain strings in,
// plain strings out; no deck code runs, so a dev server never executes what it serves.
//
//   <i data-k="wire1" class="wire pkt" data-arrow="252 352 318 352"></i>   a wire: an SVG arrow in slide pixels
//   <i data-k="req" class="wire" data-arrow="client to server"></i>         a wire between two pieces, edge to edge
//   <i class="ic" data-icon="server"></i>                                  a drawn identity: icons/server.svg inline
//   <div data-k="why" data-callout="server above">Why it waits</div>        words pinned to a piece (callouts.js)
//   <div data-k="server" data-iso="block" data-at="3 1" data-size="2 2 1.4">  a block on a floor seen from a corner (iso.js)
//
// A wire is `x1 y1 x2 y2` and an optional bend (px off the straight line, + to the left of travel), or the pieces it
// joins, `from to to` and an optional bend ("client to server 24"; words, as a ">" would end the tag): it runs from the
// edge of one's box to the edge of the other's, so a piece moved takes its wires with it, and two wires between the
// same pieces (a request and its answer) each keep a lane of their own. A wire between pieces carries
// data-ends="from to", so a click can light a piece and what it touches (focus.js · expandNames: `data-on="gw+"`).
// Either way it is a quadratic curve with an arrow head, in an <svg> placed and sized to hold it, so it is a focus
// piece like any other (its data-k and class are kept, and "wire" is added to its class). Class "pkt" adds a packet
// that rides the curve itself on a path click (hidden at rest, so print, a jump and reduced motion show the plain
// wire); a wire that comes in draws itself, start to tip.
//
// A wire written between two isometric pieces with no bend is a cable instead (cable.js): it lies on the floor, along
// the tile lines and round what stands in its way, from a foot of one block to a foot of the other, its corners
// rounded. It is the same wire in every other way — its ends, its head, its packets, its options — but its label
// stands on it, not beside it. WHY: a line through the air from one block's outline to another's reads as floating
// over a floor it has nothing to do with, and beside the middle of a wire between blocks there is a block's face.
// Where there is no way along the floor (cable.js gives the kit's reason: two heights, walled in), and with a bend,
// 0 too ("a to b 0"), a wire between blocks is the straight run it was. What the build knows of a wire's way — it
// passes behind a block, it lies on another, why it is straight — is handed on beside the page (wiresDrawn) for `check`.
//
// A wire's options (deck.css draws them from the theme's tokens; a ">" or "<" in a value is written &gt; or &lt;, as a
// tag ends at its first ">"):
//   data-label="InvokeAgentRuntime"   its name, at its middle, on its left (a request's above it, its answer's below);
//                                     on a cable, on the cable itself, where no block is over it (cable.js · labelPlace)
//   class "halo"                      a soft glow around it (--wire-halo)
//   data-packets="2" data-speed="5"   packets that keep running along it while its slide is shown, 5 s a run, evenly
//                                     spaced (--packet, --packet-glow): loops (deck-stage.js USAGE (i)), so they stop
//                                     under reduced motion, in print and with motion off, where one rests at its middle
//   data-speed="300px"                with a unit, px a second: the run takes the wire's length over that speed (the
//                                     build knows the length — a deck never measures a path)
// and how they ride (rides.js reads them and draws the CSS, ride.js has the numbers; each needs data-packets, and
// works on a cable and on a wire through the air alike, as data-packets does):
//   data-ride="ease-ends 0.15 0.2"    out of the start over the first 15% of the length, one steady speed, into the end
//                                     over the last 20% (with a px speed, that speed is the steady one)
//   data-rest="end" | "end 2s"        it stays at the end when it arrives (1 s, or as long as said), and rests there
//                                     where packets do not run
//   data-keep-size                    it keeps its size on the slide however near the camera comes (the view's zoom)
//   data-trail="3px var(--l1)"        a line that draws behind it as it rides, that width and colour
//   data-behind="fade"                where the cable runs behind a block it fades out over about three frames before
//                                     the block's edge and comes back after it (a wire through the air: nothing hides it)
// A wire that asks for any of these rides every packet on its own line by length (offset-path, as a cable's) and carries
// data-sd-ride, and the page then carries rides.js · RIDE_CSS; one that asks for none is drawn byte for byte as before.

import {stripComments} from './html.js';
import {ownAttribute, pieceTags, readAttributes} from '../pieceRules.js';
import {readPieces} from '../focusHtml.js';
import {boxFinder, exit, exitOutline} from './boxes.js';
import {callouts} from './callouts.js';
import {isoDrawn} from './iso.js';
import {NO_ROUTE, rounded} from 'footprint-story/isometric';
import {crossesBox, readKeepClear} from './keepClear.js';
import {cables, cablesOn, cableWalk, cableWay, held, labelPlace, layRoutes, reachOf, wayNote, LABEL_LOOKS} from './cable.js';
import {curveLength, leadSeen, leadSpan, piecesLength, quoted, readRide, rideMarks, rideOf, ridersSvg, SPEEDS} from './rides.js';

const fixed = (v) => +v.toFixed(1);
/** A wire written by the pieces it joins: "from to to [bend]". */
const BETWEEN = /^\s*(\S+)\s+to\s+(\S+)(?:\s+(-?\d+(?:\.\d+)?))?\s*$/;
/** The pieces a wire's data-arrow joins, [from, to] — or null for a wire written in numbers. */
export const wireEnds = (spec) => { const m = BETWEEN.exec(spec); return m ? [m[1], m[2]] : null; };

/**
 * A wire's two ends as written, each a piece's name or "piece.port" (a port of that piece): {from, to, bend}, each end
 * {name, port}; null for a wire written by numbers. `names`: the first names the map's pieces go by. A name some piece
 * goes by is that piece, dots and all: "lap.rj45" is a port only when no piece is called that.
 */
export function wireEndsOf(spec, names) {
  const m = BETWEEN.exec(spec);
  if (!m) return null;
  const end = (token) => {
    if (names.has(token)) return {name: token, port: null};
    const dot = token.lastIndexOf('.');
    return dot > 0 && dot < token.length - 1 && names.has(token.slice(0, dot)) ? {name: token.slice(0, dot), port: token.slice(dot + 1)} : {name: token, port: null};
  };
  return {from: end(m[1]), to: end(m[2]), bend: m[3]};
}
/** The first names a map's pieces go by — every piece but a wire: a wire's own name is never the end of another. One reading, for every reader of a wire's ends. */
function pieceNames(html) {
  const tags = [...pieceTags(html)];
  return new Set(readPieces(html).pieces.filter((p, i) => { const at = tags[i].before + tags[i].after; return !(/data-arrow/i.test(at) && ownAttribute(at, 'data-arrow')); }).map((p) => p.keys[0]));
}
/** A wire as the rest reads it: [spec, from, to, bend] by piece name (a port's piece), or null. */
const endsRead = (spec, names) => { const e = wireEndsOf(spec, names); return e && [spec, e.from.name, e.to.name, e.bend]; };
const LANE = 80;   // px between two wires joining the same pieces, at most (less when a box is too small to hold them)
const GAP = 6;     // px between a wire's end and the box it leaves or reaches

const MOST_PACKETS = 6;
const LABEL = {size: 18, char: 12, clear: 8};   // deck.css's label: its px size, a generous width per letter, px clear of the wire
/** The letters a label shows: one written as an entity (&amp;) is one letter, not five. */
const shown = (label) => label.replace(/&(?:#\d+|#x[\da-f]+|[a-z][a-z\d]*);/gi, '.').length;
/** Where a cable's running packets may rest when they do not run: its middle first, then further to each side by turns. */
const RESTS = [0.5, 0.35, 0.65, 0.25, 0.75, 0.15, 0.85];

/**
 * A wire's options, read as a browser reads its tag (the first of two with one name counts) and checked: {label,
 * packets, speed, head} and how its packets ride (rides.js · readRide: perSecond, ride, rest, keep, trail, behind,
 * rides). `speed` is the seconds of a run as written, null for a speed in px a second (`perSecond`, timed once the
 * wire's length is known: rides.js · rideOf); `rides`, whether it asks how its packets ride. Read once a wire.
 */
function wireOptions(attrs, spec) {
  const where = `wire data-arrow="${spec}"`, read = readAttributes(attrs);
  if (!read) throw new Error(`${where}: a quote in its tag is never closed — write a ">" or "<" inside a value as &gt; or &lt;`);
  const value = (name) => read.find((a) => a.name === name)?.value;
  const label = value('data-label')?.trim() || null, packets = value('data-packets'), speed = value('data-speed'), head = value('data-head');
  if (head !== undefined && head.trim() !== 'none') throw new Error(`${where}: data-head="${head}" — a wire has its arrow's head, or data-head="none" for a plain line that runs its whole length`);
  if (packets !== undefined && !/^[1-9]\d*$/.test(packets.trim())) throw new Error(`${where}: data-packets="${packets}" — the packets that run along it are a whole number, 1 to ${MOST_PACKETS}`);
  const n = packets === undefined ? 0 : Number(packets);
  if (n > MOST_PACKETS) throw new Error(`${where}: data-packets="${packets}" — at most ${MOST_PACKETS} packets run along one wire`);
  if (speed !== undefined && !n) throw new Error(`${where}: data-speed sets how fast its packets run — give it data-packets too`);
  const ride = readRide(value, where, n, speed);
  const s = ride.perSecond ? null : speed === undefined ? 3 : /^\s*\d+(?:\.\d+)?s?\s*$/.test(speed) ? parseFloat(speed) : NaN;
  if (!ride.perSecond && !(s >= SPEEDS[0] && s <= SPEEDS[1])) throw new Error(`${where}: data-speed=${quoted(speed)} — the seconds a packet takes to run the wire, ${SPEEDS[0]} to ${SPEEDS[1]}, or its speed in px a second ("300px")`);
  return {label, packets: n, speed: s, head: head === undefined, ...ride};
}

const HEAD = 18;   // an arrow's head, in px: its length (its line stops four fifths of that short of the tip)
/** A wire's own attributes with "wire" in its class. */
function classed(attrs) {
  const at = attrs.replace(/\sclass="([^"]*)"/, (_, c) => ` class="${/(^|\s)wire(\s|$)/.test(c) ? c : `wire ${c}`}"`);
  return /\sclass="/.test(at) ? at : `${at} class="wire"`;
}
/** An arrow's head at `tip` (in the wire's own box), pointing the way [ux, uy]. */
function headAt(tip, [ux, uy]) {
  const f = fixed, back = [tip[0] - ux * HEAD, tip[1] - uy * HEAD], nx = -uy * HEAD * 0.6, ny = ux * HEAD * 0.6;
  return `<path class="head" d="M${f(tip[0])} ${f(tip[1])}L${f(back[0] + nx)} ${f(back[1] + ny)}L${f(back[0] - nx)} ${f(back[1] - ny)}Z"/>`;
}
/** Half a label's box: the letters it shows, and 4 px round them. */
const labelBox = (label) => (label ? [(shown(label) * LABEL.char) / 2 + 4, LABEL.size / 2 + 4] : null);
/** When the k-th of a wire's running packets starts: each its share of a run behind the one before, on one clock (deck.css · sdRun). */
const loopOf = (o, k) => `--loop:sdRun ${o.speed}s linear ${+((-k * o.speed) / o.packets).toFixed(3) + 0}s infinite`;

/**
 * One wire's SVG: the element's own attributes kept, a box that holds the curve (and its label), the curve, the head,
 * its packets and its label. `spec` is its run, "x1 y1 x2 y2 [bend]": one curve with one control point, beside the
 * middle of the run. `o`: its options (wireOptions), read once.
 */
function wireSvg(attrs, spec, o) {
  const parts = spec.trim().split(/[\s,]+/).map(Number);
  if ((parts.length !== 4 && parts.length !== 5) || parts.some((n) => !Number.isFinite(n))) {
    throw new Error(`data-arrow="${spec}": a wire is the pieces it joins, "from to to" ("client to server"), or "x1 y1 x2 y2" in slide px — either with an optional bend`);
  }
  const [x1, y1, x2, y2, bend = 0] = parts;
  const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1;
  const cx = (x1 + x2) / 2 - (dy / len) * bend, cy = (y1 + y2) / 2 + (dx / len) * bend;
  const tl = Math.hypot(x2 - cx, y2 - cy) || 1, ux = (x2 - cx) / tl, uy = (y2 - cy) / tl;
  // the label: beside the curve's middle, B(½), to the left of the way it runs there (its tangent is end − start), as
  // far off as half the label measures across the wire, and LABEL.clear more: above a level wire, beside a standing one
  const half = labelBox(o.label);   // the box holds it, so a wire showing itself in shows it too
  let off = half ? (Math.abs(dy) / len) * half[0] + (Math.abs(dx) / len) * half[1] + LABEL.clear : 0;
  // a wire bent away from its label curves back towards it on either side of its middle — by 2·bend·u²/len² at u along
  // it, never past the line from end to end: the label stands clear of the curve under its whole width too
  if (half && bend > 0) off += Math.min(bend / 2, (2 * bend * ((Math.abs(dx) / len) * half[0] + (Math.abs(dy) / len) * half[1]) ** 2) / len ** 2);
  const lx = 0.25 * x1 + 0.5 * cx + 0.25 * x2 + (dy / len) * off, ly = 0.25 * y1 + 0.5 * cy + 0.25 * y2 - (dx / len) * off;
  const xs = [x1, x2, cx, ...(half ? [lx - half[0] + 20, lx + half[0] - 20] : [])], ys = [y1, y2, cy, ...(half ? [ly - half[1] + 20, ly + half[1] - 20] : [])];
  const pad = 20, X = Math.min(...xs) - pad, Y = Math.min(...ys) - pad;
  const W = Math.max(...xs) + pad - X, H = Math.max(...ys) + pad - Y, f = fixed;
  const back = o.head ? HEAD * 0.8 : 0, ex = x2 - ux * back, ey = y2 - uy * back;   // a line with no head runs its whole length
  const d = `M${f(x1 - X)} ${f(y1 - Y)} Q${f(cx - X)} ${f(cy - Y)} ${f(ex - X)} ${f(ey - Y)}`;
  const at = classed(attrs);
  // the packet rides the curve itself (deck.css · sdPkt): its control point and its end, from where it starts
  const ride = `--cdx:${f(cx - x1)}px;--cdy:${f(cy - y1)}px;--pdx:${f(ex - x1)}px;--pdy:${f(ey - y1)}px`;
  const pkt = /\bpkt\b/.test(at) ? `<rect class="pkt" x="${f(x1 - X - 8)}" y="${f(y1 - Y - 6)}" width="16" height="12" rx="3" style="${ride}"/>` : '';
  // packets that keep running (deck.css · sdRun): loops on one clock, each its share of a run behind the one before
  // — or, when it asks how they ride (rides.js), along its curve by length as a cable's do: the curve as --sd-way, its
  // length walked (nothing hides a wire through the air)
  const r = o.rides ? rideOf(o, curveLength([x1, y1], [cx, cy], [ex, ey]), spec) : null, marks = r ? rideMarks(o, r, d) : {attrs: '', style: ''};
  const runs = r ? ridersSvg(o, r, {d})
    : Array.from({length: o.packets}, (_, k) => `<circle class="run" data-loop cx="${f(x1 - X)}" cy="${f(y1 - Y)}" r="7" style="${ride};${loopOf(o, k)}"/>`).join('');
  const label = o.label ? `<text class="label" x="${f(lx - X)}" y="${f(ly - Y)}" text-anchor="middle">${o.label}</text>` : '';
  // which way it runs, start to tip, as a CSS angle (0 up, 90 right): a wire coming in shows itself that way (deck.css · sdReveal)
  const angle = f((Math.atan2(dx, -dy) * 180) / Math.PI);
  return `<svg${at}${marks.attrs} style="left:${f(X)}px;top:${f(Y)}px;width:${f(W)}px;height:${f(H)}px;--sd-angle:${angle}deg${marks.style}" viewBox="0 0 ${f(W)} ${f(H)}" aria-hidden="true"><path d="${d}"/>${o.head ? headAt([x2 - X, y2 - Y], [ux, uy]) : ''}${pkt}${runs}${label}</svg>`;
}

/** A rounded way (footprint-story · rounded) as an SVG path, in the px of a box whose corner is [X, Y]. */
const wayPath = (way, X, Y) => `M${fixed(way.start[0] - X)} ${fixed(way.start[1] - Y)}${way.pieces.map((piece) => (piece.corner ? `Q${fixed(piece.corner[0] - X)} ${fixed(piece.corner[1] - Y)} ` : 'L') + `${fixed(piece.to[0] - X)} ${fixed(piece.to[1] - Y)}`).join('')}`;

/**
 * A cable's SVG: the same wire in every other way — its own attributes, a head, its packets, its options — drawn along
 * its line on the floor (`way`: cable.js · cableWay, straight runs and rounded corners; `points`: the cable's own, its
 * last where its arrow ends).
 * It is marked data-sd-cable and carries its line as --sd-way, which its packets ride (deck.css), and that line's
 * length as --sd-length, so a deck's own CSS can time a thing to it without measuring. Its label stands on
 * it, on a plate, where `place(way, [half its width, half its height], tip)` says. `o`: its options (wireOptions); `r`:
 * how its packets ride (rides.js · rideOf), for a wire that asks.
 */
function cableSvg(attrs, spec, o, way, points, place, r = null) {
  const f = fixed, [x1, y1] = way.start, tip = points.at(-1), before = points.at(-2);   // `way` already ends where the head begins, or at the tip when the wire has none
  // the head points the way the cable's last run goes, however short that run is
  const far = Math.hypot(tip[0] - before[0], tip[1] - before[1]) || 1, heading = [(tip[0] - before[0]) / far, (tip[1] - before[1]) / far];
  const half = labelBox(o.label), [lx, ly] = half ? place(way, half, tip) : [0, 0];
  const marks = [way.start, tip, ...way.pieces.flatMap((piece) => (piece.corner ? [piece.corner, piece.to] : [piece.to]))];
  const xs = [...marks.map((p) => p[0]), ...(half ? [lx - half[0] + 20, lx + half[0] - 20] : [])], ys = [...marks.map((p) => p[1]), ...(half ? [ly - half[1] + 20, ly + half[1] - 20] : [])];
  const pad = 20, X = Math.min(...xs) - pad, Y = Math.min(...ys) - pad, W = Math.max(...xs) + pad - X, H = Math.max(...ys) + pad - Y;
  const d = wayPath(way, X, Y);
  const at = classed(attrs);
  // its packets ride the line itself (deck.css: offset-path): each is drawn at the box's corner and carried along --sd-way
  const pkt = /\bpkt\b/.test(at) ? '<rect class="pkt" x="-8" y="-6" width="16" height="12" rx="3"/>' : '';
  // Where the packets do not run (reduced motion, print, motion off) one rests at the wire's middle (deck.css). A
  // cable's label may stand there: then it rests at the nearest place along the cable that the plate is not over.
  const rest = half && o.packets ? RESTS.find((t) => { const [px, py] = way.at(t); return Math.abs(px - lx) > half[0] + 9 || Math.abs(py - ly) > half[1] + 9; }) ?? 0.5 : 0.5;
  // (and when it asks how they ride, `r`: one that rests at the end rests there)
  const tag = r ? rideMarks(o, r) : {attrs: '', style: ''};
  const runs = r ? ridersSvg(o, r, {d, restAt: r.rest ?? (rest === 0.5 ? null : rest)})
    : Array.from({length: o.packets}, (_, k) => `<circle class="run" data-loop cx="0" cy="0" r="7" style="${rest === 0.5 ? '' : `--sd-t:${rest};`}${loopOf(o, k)}"/>`).join('');
  const label = o.label ? `<text class="label" x="${f(lx - X)}" y="${f(ly - Y)}" text-anchor="middle">${o.label}</text>` : '';
  // a label on its cable stands on a plate of the ground's colour: the line stops at it, never a dash between two
  // words, and a packet passes under it, never across the words. The head is drawn over the plate: where a label is
  // longer than its cable has room for, the arrow's tip is still seen
  const plate = half ? `<rect class="plate" x="${f(lx - X - half[0])}" y="${f(ly - Y - half[1])}" width="${f(2 * half[0])}" height="${f(2 * half[1])}" rx="6"/>` : '';
  const angle = f((Math.atan2(tip[0] - x1, -(tip[1] - y1)) * 180) / Math.PI);
  return `<svg${at} data-sd-cable${tag.attrs} style="left:${f(X)}px;top:${f(Y)}px;width:${f(W)}px;height:${f(H)}px;--sd-angle:${angle}deg;--sd-way:path('${d}');--sd-length:${f(way.length)}px${tag.style}" viewBox="0 0 ${f(W)} ${f(H)}" aria-hidden="true"><path d="${d}"/>${pkt}${runs}${plate}${o.head ? headAt([tip[0] - X, tip[1] - Y], heading) : ''}${label}</svg>`;
}

/**
 * Every empty <i …></i> whose attributes hold `rule`, in order: [{start, end, before, m, after}] — `m` the rule's match.
 * One pass: an attempt ends at the next "<" or ">", so a deck of unfinished <i …> tags, or one tag repeating an
 * attribute, costs no more than its length.
 */
function emptyI(html, rule) {
  const out = [];
  for (const t of html.matchAll(/<i\b([^<>]*)><\/i>/g)) {
    const m = rule.exec(t[1]);
    if (m) out.push({start: t.index, end: t.index + t[0].length, before: t[1].slice(0, m.index), m, after: t[1].slice(m.index + m[0].length)});
  }
  return out;
}

/** The empty tags `found` in `html`, each replaced by `draw(found, index)`. */
function replaceEach(html, found, draw) {
  let out = '', from = 0;
  found.forEach((f, i) => { out += html.slice(from, f.start) + draw(f, i); from = f.end; });
  return out + html.slice(from);
}

/**
 * Each wire written between pieces as its numbers, "x1 y1 x2 y2 bend" (others: null). A piece is found as boxes.js ·
 * boxFinder finds it. Wires joining the same two pieces are spread across the line between their middles, LANE apart at
 * most and always inside both pieces, each keeping to its left (a request going right above its answer coming back,
 * whatever the pieces are called), in the order written; each then runs from the edge of one piece to the edge of the
 * other, GAP clear of both.
 *
 * An isometric piece (`shapes`: iso.js · isoDrawn) is not the box it is placed by: its edge is the outline of what it
 * draws. So a wire to a block ends on the block, not in the empty corner of its box, and two blocks that stand clear
 * of each other are never called too close because their boxes meet.
 *
 * A wire written between two isometric pieces with no bend is a cable along the floor where cable.js lays one: its
 * entry in `between` is that cable ({points, radius, route}), where every other wire's is its numbers. Where it lays
 * none, and with a bend, 0 too ("a to b 0"), the wire is a straight run from outline to outline. Gives {between,
 * laid}: `laid` is what cable.js said of each wire it was asked about, a way or the reason there is none.
 */
function wiresBetween(html, found, {shapes, floor, solids, routes}) {
  const names = pieceNames(html), read = found.map((f) => endsRead(f.m[1], names));
  if (!read.some(Boolean)) return {between: read, laid: []};
  const boxOf = boxFinder(html);
  // the wires laid along the floor before the picture was fitted (transformed · lay), put on the slide — or, for a
  // caller that laid none, laid here: the name is that one isometric piece alone, with no bend asked for
  const laid = !floor ? [] : routes ? cablesOn(routes, floor)
    : cables(read.map((m) => (m && m[3] === undefined && [m[1], m[2]].every((name) => shapes.has(name) && boxOf.alone(name)) ? [m[1], m[2]] : null)), shapes, floor, solids);
  /** One end of a wire: its middle, how far a line may stand off that middle and still cross it, and where a ray leaves it. */
  const endOf = (name, where) => {
    // an isometric piece's own outline, when the name is that piece alone: a name several pieces share is one box round them all, as ever
    const shape = boxOf.alone(name) ? shapes.get(name) : undefined;
    if (shape) return {middle: shape.middle, across: (n) => Math.min(exitOutline(shape.outline, shape.middle, n), exitOutline(shape.outline, shape.middle, [-n[0], -n[1]])), exit: (p, u) => exitOutline(shape.outline, p, u)};
    const box = boxOf(name, where);
    // half the box measured across the line: a lane closer to the middle than this, less 8 px, crosses the box, so its
    // ends are found on the box's edges (exit: from any point of such a line, as the line leaves the box)
    return {middle: [box.x + box.w / 2, box.y + box.h / 2], across: (n) => (Math.abs(n[0]) * box.w + Math.abs(n[1]) * box.h) / 2, exit: (p, u) => exit(box, p, u)};
  };
  // a pair's wires across its line, in its own direction (its names in order): those running that way first, on their
  // left of it, then those running back — on their own left. A cable is not on that line: it takes no lane.
  const pairOf = (m) => [m[1], m[2]].sort().join('\u0000'), lanes = new Map();
  read.forEach((m, i) => { if (m && !laid[i]?.points) lanes.set(pairOf(m), [...(lanes.get(pairOf(m)) ?? []), i]); });
  for (const [key, ids] of lanes) {
    const along = (i) => read[i][1] === key.split('\u0000')[0];
    lanes.set(key, [...ids.filter(along), ...ids.filter((i) => !along(i))]);
  }
  const between = read.map((m, i) => {
    if (!m) return null;
    const spec = found[i].m[1];
    if (m[1] === m[2]) throw new Error(`data-arrow="${spec}": a wire joins two pieces, not "${m[1]}" to itself`);
    if (laid[i]?.points) return laid[i];
    // in the pair's own direction (its names in order), so the wires both ways share one set of lanes
    const [a, b] = [m[1], m[2]].sort(), A = endOf(a, `data-arrow="${spec}"`), B = endOf(b, `data-arrow="${spec}"`);
    const ca = A.middle, cb = B.middle, len = Math.hypot(cb[0] - ca[0], cb[1] - ca[1]);
    if (len === 0) throw new Error(`data-arrow="${spec}": "${a}" and "${b}" share a middle — place them apart, or give the wire numbers`);
    const u = [(cb[0] - ca[0]) / len, (cb[1] - ca[1]) / len], n = [-u[1], u[0]];
    const lane = lanes.get(pairOf(m)), k = lane.indexOf(i), most = Math.max(0, Math.min(A.across(n), B.across(n)) - 8);
    const step = lane.length > 1 ? Math.min(LANE, (2 * most) / (lane.length - 1)) : 0, off = (k - (lane.length - 1) / 2) * step;
    const pa = [ca[0] + n[0] * off, ca[1] + n[1] * off], pb = [cb[0] + n[0] * off, cb[1] + n[1] * off];
    const ta = A.exit(pa, u) + GAP, tb = B.exit(pb, [-u[0], -u[1]]) + GAP;
    // a wire the floor had no way for says so: "too close" alone would name the wrong cause
    if (!(len - ta - tb >= 12)) {
      const why = laid[i]?.route.why;
      if (!why) throw new Error(`data-arrow="${spec}": "${a}" and "${b}" are too close for a wire between them (they touch or overlap) — move them apart, or give the wire numbers`);
      const cure = why === NO_ROUTE.work ? 'take wires or blocks out of this map so that every wire is laid, or ' : '';
      throw new Error(`data-arrow="${spec}": no way along the floor was laid for it (${why}), and "${a}" and "${b}" are too close for a straight wire between them — ${cure}move them apart, or give the wire numbers`);
    }
    const start = [pa[0] + u[0] * ta, pa[1] + u[1] * ta], end = [pb[0] - u[0] * tb, pb[1] - u[1] * tb];
    const [from, to] = m[1] === a ? [start, end] : [end, start];
    return [...from, ...to, Number(m[3] ?? 0)].map(fixed).join(' ');
  });
  return {between, laid};
}

/**
 * Every wire as written — <i … data-arrow="x1 y1 x2 y2 [bend]" …></i>, or "from to to [bend]" — in order: [{start, end, before, m, after}], `m[1]`
 * its spec. The one rule, so what wires() draws is what an edit moves (edit.js).
 */
export const wireTags = (html) => emptyI(html, /\sdata-arrow="([^"<>]+)"/);

/**
 * Every <i data-arrow="…"></i> as its wire; one written between pieces runs between them and carries data-ends.
 * `iso`: what iso.js · isoDrawn gave of the map's isometric pieces ({shapes, solids, floor}) — a wire between two of
 * them is a cable along the floor, and a wire from one to a flat piece ends on its outline. `looks`: {left}, what the
 * map's cable labels may spend finding their places (cable.js · LABEL_LOOKS).
 */
export const wires = (html, iso, looks) => wiresDrawn(html, iso, looks).html;

/**
 * `wires`, with what the build knows of each wire's way: {html, ways, cables, rides?} — `rides`: true when a wire asks
 * how its packets ride (the page then carries rides.js · RIDE_CSS); `cables`: each cable laid, as the
 * build's record holds it (laidRecord); `ways`: [{name, from, to, way}] for every wire
 * between two blocks there is something to say of (cable.js · wayNote: it passes behind a block, it lies on another,
 * why it is straight), by the wire's first name and the two it joins. It is handed on beside the page, never written
 * into it: what `check` says of a wire is then only ever the build's own word, never text a deck holds.
 */
export function wiresDrawn(html, {shapes = new Map(), floor = null, solids = [...shapes.values()], routes = null, levels = new Map([...shapes].map(([name, shape]) => [name, shape.level]))} = {}, looks = {left: LABEL_LOOKS}) {
  const found = wireTags(html), {between, laid: cabled} = wiresBetween(html, found, {shapes, floor, solids, routes: routes?.length === found.length ? routes : null});
  // what a cable's label keeps clear of: what stands on the floor (a block is drawn over the floor's wires), each
  // label placed before it, and the other cables — so the labels of a request and its answer, lying side by side,
  // never cover each other, and neither's line runs through the other's words where there is room to avoid it.
  // The cables are walked when the first label asks, and the map's labels share one count of looks: a map with no
  // labelled cable pays nothing, and none pays more than that count.
  const taken = solids.map((shape) => held(shape.outline));
  // each wire's options, read once; each cable's line: up to where its head begins, or its whole length when it has none (data-head="none")
  const options = found.map((f) => wireOptions(f.before + f.after, f.m[1]));
  const ways = between.map((drawn, i) => (drawn && typeof drawn === 'object' ? cableWay(drawn, options[i].head ? HEAD * 0.8 : 0) : null));
  let runs = null;
  const place = (way, [wide, high], tip) => {
    runs ??= ways.filter(Boolean).map((line) => ({...held(cableWalk(line)), of: line}));
    const [x, y] = labelPlace(way, [wide, high], taken, runs, looks, tip);
    taken.push(held([[x - wide, y - high], [x + wide, y - high], [x + wide, y + high], [x - wide, y + high]]));
    return [x, y];
  };
  const said = [], record = [], names = pieceNames(html);
  // the words a cable runs under, asked of each marked piece's own box (the router's kept floor is a little wider):
  // its way on the floor, drawn on the slide — never its risers or its leads above the floor
  let boxes = null;
  const underBoxes = (laid) => {
    if (!laid.route.under?.length || !floor) return laid.route;
    // every box of a name: two pieces may share one, and a cable under either runs under that name
    if (!boxes) { boxes = new Map(); for (const {name, box} of readKeepClear(html)) boxes.set(name, [...(boxes.get(name) ?? []), box]); }
    // (the floor it lies on is the lowest height of its way: a port's plug and the point out of its side stand above it)
    const path = laid.route.path ?? [], lift = Math.min(...path.map((p) => p[2])), way = path.filter((p) => Math.abs(p[2] - lift) < 1e-9).map(([col, row]) => floor(col, row, lift));
    return {...laid.route, under: laid.route.under.filter((name) => (boxes.get(name) ?? []).some((box) => crossesBox(way, box)))};
  };
  const rides = options.some((o) => o.rides);   // whether a wire asks how its packets ride: the page then carries RIDE_CSS
  const drawn = replaceEach(html, found, ({before, m, after}, i) => {
    const o = options[i];
    if (!between[i]) return wireSvg(before + after, m[1], o);
    const [, from, to] = endsRead(m[1], names), laid = cabled[i], note = laid ? wayNote(underBoxes(laid)) : '';
    // its first name, read as a browser reads its tag (the wire's own data-k, not those words inside another value)
    const name = laid ? readAttributes(before + after)?.find((a) => a.name === 'data-k')?.value.trim().split(/\s+/)[0] || `${from} to ${to}` : '';
    if (note) said.push({name, from, to, way: note});
    const kept = ways[i] ? laidRecord(name, laid, ways[i]) : null;
    if (kept) record.push(kept);
    const named = ` data-ends="${from} ${to}"${before}${after}`;
    if (!ways[i]) return wireSvg(named, between[i], o);   // its numbers
    // a cable's line — and, at an end that plugs into a port on a seen side, its lead over that block (leadSvg). Its
    // packets, when it asks how they ride, ride the line the record measures, past the stretches the record says are
    // hidden, and hand over to a lead's copy on the lead's stretch (the share of the line each lead holds)
    const head = o.head ? HEAD * 0.8 : 0, ends = [0, 1].map((k) => levels.get(k ? laid.route.to : laid.route.from));
    const held = [0, 1].map((k) => { const lead = o.rides && ends[k] !== undefined ? leadOf(laid, k, k === 1 ? head : 0) : null; return lead ? Math.min(1, piecesLength(lead.way.start, lead.pieces) / ways[i].length) : null; });
    const r = o.rides ? rideOf(o, ways[i].length, m[1], {unseen: kept.unseen, leads: [held[0], held[1] === null ? null : 1 - held[1]]}) : null;
    return cableSvg(named, m[1], o, ways[i], laid.points, place, r) + [0, 1].map((k) => leadSvg(named, laid, k, k === 1 ? head : 0, ends[k], r && {o, r, way: ways[i], share: held[k]})).join('');
  });
  return {html: drawn, ways: said, cables: record, ...(rides ? {rides: true} : {})};
}

/**
 * One cable as the build's record holds it: where it runs on the slide and what is true of it, so a deck (or a film)
 * can time a thing to it without measuring the page — {name, from, to, points: [[x, y], …] (its corners, in slide px),
 * length (of its drawn line, px), unseen: [[from, to], …] (the stretches a block hides, px along it), behind, crosses,
 * shared, bends}.
 */
function laidRecord(name, {points, tile, route, lead = 0}, way) {
  const f = fixed;
  return {name, from: route.from, to: route.to, ...(route.ports?.some(Boolean) ? {ports: [...route.ports]} : {}), points: points.map(([x, y]) => [f(x), f(y)]), length: f(way.length), unseen: route.unseen.map(([lo, hi]) => [f(lead + lo * tile), f(lead + hi * tile)]),
    behind: [...route.behind], crosses: route.crosses, shared: f(route.shared * tile), bends: route.bends};
}

/**
 * A cable's lead at end `k` (0 the start, 1 the end) when it plugs into a port on a seen side: {way, pieces} — the
 * cable's points from that end, rounded, and the pieces of it the lead holds (out of the port, the riser and on to the
 * end of its floor corner: the upper part of that corner can be behind the block's face too); null for no lead.
 * `back`: px the line stops short of the tip there, for its head.
 */
function leadOf({points, radius, ends}, k, back) {
  const end = ends?.[k];
  if (!end?.seen) return null;
  const run = k ? [...points].reverse() : [...points];
  if (back) { const [tip, next] = run, far = Math.hypot(next[0] - tip[0], next[1] - tip[1]) || 1, by = Math.max(0, Math.min(back, far - 1)); run[0] = [tip[0] + (next[0] - tip[0]) * by / far, tip[1] + (next[1] - tip[1]) * by / far]; }
  const way = rounded(run, radius);
  return {way, pieces: way.pieces.slice(0, 2 * (end.count - 2) + 2)};
}

/**
 * A cable's lead into a port on a seen side of its block (leadOf) drawn again over that block: the cable lies under
 * every block (they stand on the floor it runs on), so the port and its riser, in front of the block's face, would be
 * covered by it. The lead stands at the odd level just above its block's (iso.js), so a block in front of it still
 * covers it. It is the cable's own piece (its data-k, its class), so it is shown, lit and hidden with it. `k`: which end
 * (0 the start, 1 the end); `back`: px the line stops short of the tip there, for its head; '' when that end has no lead.
 *
 * `ride`: {o, r, way, share} for a cable whose packets ride (rides.js · rideOf; `way` the cable's line, `share` how much
 * of it this lead holds from its end). The lead then carries a copy of them riding the cable's own line, shown only on
 * the lead's stretch (and its trails drawn there only), under its head: a packet at a port on a seen side is seen there,
 * over its block, and the cable's own is hidden on that stretch (rides.js · seenOf), so the two never both show.
 */
function leadSvg(attrs, laid, k, back, level, ride = null) {
  const lead = leadOf(laid, k, back);
  if (!lead || level === undefined) return '';
  const {way, pieces} = lead, {points} = laid, f = fixed;
  const marks = [way.start, ...pieces.flatMap((piece) => (piece.corner ? [piece.corner, piece.to] : [piece.to])), ...(back ? [points.at(k ? -1 : 0)] : [])];
  const pad = 20, X = Math.min(...marks.map((p) => p[0])) - pad, Y = Math.min(...marks.map((p) => p[1])) - pad, W = Math.max(...marks.map((p) => p[0])) + pad - X, H = Math.max(...marks.map((p) => p[1])) + pad - Y;
  const d = wayPath({start: way.start, pieces}, X, Y);
  const tip = points.at(-1), before = points.at(-2), far = Math.hypot(tip[0] - before[0], tip[1] - before[1]) || 1;
  const head = back ? headAt([tip[0] - X, tip[1] - Y], [(tip[0] - before[0]) / far, (tip[1] - before[1]) / far]) : '';
  // the packets' copy, on the cable's own line in this box's px
  let tag = {attrs: '', style: ''}, riders = '';
  if (ride) {
    const {o, r, way: line, share} = ride, from = k ? 1 - share : share, dc = wayPath(line, X, Y);
    tag = rideMarks(o, r, dc);
    // where packets do not run, the copy rests off the lead (the cable's own packet rests where it rests), unless it rests at the end
    riders = ridersSvg(o, r, {d: dc, seen: leadSeen(k, from), span: leadSpan(k, from, line.length), restAt: r.rest ?? (k ? 0 : 1)});
  }
  // the cable's own piece (its name, its class, its ends), but not its id: an id is one element's
  return `<svg${classed(attrs.replace(/\sid=("[^"]*"|'[^']*'|\S+)/gi, ''))} data-sd-lead="${k ? 'end' : 'start'}"${tag.attrs} style="left:${f(X)}px;top:${f(Y)}px;width:${f(W)}px;height:${f(H)}px;z-index:${level + 1}${tag.style}" viewBox="0 0 ${f(W)} ${f(H)}" aria-hidden="true"><path d="${d}"/>${riders}${head}</svg>`;
}

/** An icon file's drawing: {viewBox, body} from a whole <svg …>…</svg>. */
export function readIcon(name, svg) {
  const text = stripComments(svg).replace(/^\s*<\?xml[^>]*>/, '').trim();
  // its first <svg …> and the </svg> that ends the file, each found once: a file of unfinished tags stays linear
  const start = text.search(/<svg\b/), open = start < 0 ? -1 : text.indexOf('>', start), close = text.length - '</svg>'.length;
  if (open < 0 || !text.endsWith('</svg>') || close <= open) throw new Error(`icon "${name}": an icon file is one <svg viewBox="…">…</svg>`);
  const viewBox = /\sviewBox=(["'])([^"']+)\1/.exec(text.slice(start + 4, open))?.[2];
  if (!viewBox) throw new Error(`icon "${name}": its <svg> has no viewBox — give it one (e.g. viewBox="0 0 64 64")`);
  return {viewBox, body: text.slice(open + 1, close).trim()};
}

/** Every <i … data-icon="name"></i> as that icon's SVG, keeping the element's other attributes. */
export function icons(html, set = {}) {
  // an <i> that is an isometric piece keeps its data-icon: a floor's label draws it (iso.js)
  return replaceEach(html, emptyI(html, /\sdata-icon="([\w-]+)"/).filter(({before, m, after}) => !ownAttribute(before + m[0] + after, 'data-iso')), ({before, m, after}) => {
    const icon = Object.hasOwn(set, m[1]) ? set[m[1]] : null;
    if (!icon) {
      const known = Object.keys(set);
      throw new Error(`no icon "${m[1]}" (${known.length ? `there are ${known.join(', ')}` : 'the deck has no icons'}) — add icons/${m[1]}.svg`);
    }
    return `<svg${before}${after} viewBox="${icon.viewBox}" aria-hidden="true">${icon.body}</svg>`;
  });
}

/** What the wires written between pieces join, in the order written: [[from, to], …] by piece name (a port's piece). */
export const wireLinks = (html) => { const names = pieceNames(html); return wireTags(html).map(({m}) => wireEndsOf(m[1], names)).filter(Boolean).map((e) => [e.from.name, e.to.name]); };

/**
 * The built-in helpers, in the order they run: icons first (a wire never holds one, a block's words may), then the
 * isometric pieces (so a callout may stand beside one and a wire reach it), then callouts (so a wire may reach one),
 * then wires. `canvas`, [w, h]: the slide a callout is kept on, and whose middle a floor starts from. `area`, [x0, y0,
 * x1, y1]: where a picture the build fits goes. What the wires join is read before anything is drawn: a map whose
 * blocks have no place is placed from it (iso.js).
 */
export const applyTransforms = (html, options) => transformed(html, options).html;

/**
 * The wires that may lie along the floor, before any is drawn: one entry a wire of `found` (wireTags), [from, to] when
 * it is written between two pieces with no bend and each name is one block or cylinder and nothing else, else null.
 * `solids`: the map's blocks and cylinders as they stand; `html`: the map, for the names its other pieces have.
 */
function floorLinks(html, found, solids) {
  // a name is one block alone when one piece that has a box once the map is drawn has it (boxes.js · alone, asked before the
  // drawing): an isometric piece, which the drawing gives its box; a callout, which is placed beside its piece before the wires are
  // drawn; or a piece its own style places. A wire that shares a block's name, or words placed nowhere, have no box: the block is
  // still alone.
  const tags = [...pieceTags(html)], count = new Map();
  readPieces(html).pieces.forEach((piece, i) => {
    const at = tags[i].before + tags[i].after, has = (name) => new RegExp(name, 'i').test(at) && ownAttribute(at, name);
    if (has('data-iso') || has('data-callout') || (piece.box && piece.box.w > 0 && piece.box.h > 0)) count.set(piece.keys[0], (count.get(piece.keys[0]) ?? 0) + 1);
  });
  const alone = (name) => count.get(name) === 1 && solids.some((solid) => solid.name === name), names = pieceNames(html);
  return found.map(({m}) => {
    const ends = wireEndsOf(m[1], names);
    if (!ends) return null;
    // a port is named on one block: one that has it, or the wire says which it has
    for (const end of [ends.from, ends.to]) {
      if (end.port === null) continue;
      const solid = alone(end.name) ? solids.find((s) => s.name === end.name) : null;
      if (!solid) throw new Error(`data-arrow="${m[1]}": "${end.name}.${end.port}" names a port, and a port is on one block — "${end.name}" is ${count.get(end.name) > 1 ? 'the name of more than one piece' : 'no block'}`);
      if (!solid.ports?.some((p) => p.name === end.port)) throw new Error(`data-arrow="${m[1]}": "${end.name}" has no port "${end.port}" — ${solid.ports?.length ? `its ports are ${solid.ports.map((p) => p.name).join(', ')}` : 'it names none (data-ports="p1: x y z | …")'}`);
      if (ends.bend !== undefined) throw new Error(`data-arrow="${m[1]}": a wire to a port runs along the floor, and a bend draws it straight — take the bend out`);
    }
    return ends.bend === undefined && alone(ends.from.name) && alone(ends.to.name) ? [ends.from, ends.to] : null;
  });
}

/**
 * `applyTransforms`, with what the build knows of the map it made: {html, ways, cables, tight, made, rides?} — `rides`
 * true when a wire asks how its packets ride (compile.js then has the page carry rides.js · RIDE_CSS), `ways` what
 * there is to say of a wire (wiresDrawn), `cables` each cable laid (laidRecord), `tight` the names that do not fit
 * their block, `made` how the map was made ({placed, tile, fitted}, null with no isometric piece). The build
 * compiles a map with this, and keeps them beside the page: for `check`, for the run's log, and for whoever times a
 * thing to a cable.
 *
 * A map is made in this order, each step one function: its icons drawn; its blocks placed (iso.js); its wires laid
 * along the floor between them, in tiles (cable.js · layRoutes) — before the floor and the picture are fitted, so
 * both hold the wires too; its pieces drawn; its callouts; its wires drawn on the slide.
 */
export function transformed(html, {icons: set = {}, canvas = null, area = null} = {}) {
  const drawn = icons(html, set), found = wireTags(drawn);
  let routes = null;
  const lay = (solids, keep = []) => { routes = layRoutes(floorLinks(drawn, found, solids), solids, keep); return reachOf(routes); };
  // the laid cables' paths in tiles, for a floor's label to keep clear of (iso.js)
  const lines = () => (routes ?? []).filter((r) => r?.route.path).map((r) => r.route.path.map(([col, row, high]) => [col, row, high ?? r.lift]));
  const iso = isoDrawn(drawn, {canvas, area, links: wireLinks(drawn), lay, lines, icons: set});
  return {...wiresDrawn(callouts(iso.html, {canvas}), {...iso, routes}), tight: iso.tight ?? [], made: iso.made ?? null};
}
