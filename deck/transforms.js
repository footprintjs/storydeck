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
// A wire written between two isometric pieces with no bend is a cable instead (cable.js): it lies on the floor, from
// the foot of one block to the foot of the other, a curve with a handle at each end. It is the same wire in every
// other way — its ends, its head, its packets, its options — but its label stands on it, not beside it. WHY: a line
// through the air from one block's outline to another's reads as floating over a floor it has nothing to do with,
// and beside the middle of a wire between blocks there is a block's face. A bend, 0 too ("a to b 0"), keeps a wire
// between blocks the straight run it was.
//
// A wire's options (deck.css draws them from the theme's tokens; a ">" or "<" in a value is written &gt; or &lt;, as a
// tag ends at its first ">"):
//   data-label="InvokeAgentRuntime"   its name, at its middle, on its left (a request's above it, its answer's below);
//                                     on a cable, on the cable itself, where no block is over it (cable.js · labelPlace)
//   class "halo"                      a soft glow around it (--wire-halo)
//   data-packets="2" data-speed="5"   packets that keep running along it while its slide is shown, 5 s a run, evenly
//                                     spaced (--packet, --packet-glow): loops (deck-stage.js USAGE (i)), so they stop
//                                     under reduced motion, in print and with motion off, where one rests at its middle

import {stripComments} from './html.js';
import {readAttributes} from '../pieceRules.js';
import {boxFinder, exit, exitOutline} from './boxes.js';
import {callouts} from './callouts.js';
import {isoDrawn} from './iso.js';
import {cables, cableWalk, labelPlace} from './cable.js';

const fixed = (v) => +v.toFixed(1);
/** A wire written by the pieces it joins: "from to to [bend]". */
const BETWEEN = /^\s*(\S+)\s+to\s+(\S+)(?:\s+(-?\d+(?:\.\d+)?))?\s*$/;
/** The pieces a wire's data-arrow joins, [from, to] — or null for a wire written in numbers. */
export const wireEnds = (spec) => { const m = BETWEEN.exec(spec); return m ? [m[1], m[2]] : null; };
const LANE = 80;   // px between two wires joining the same pieces, at most (less when a box is too small to hold them)
const GAP = 6;     // px between a wire's end and the box it leaves or reaches

const MOST_PACKETS = 6;
const SPEEDS = [0.5, 60];   // seconds a packet takes to run the wire
const LABEL = {size: 18, char: 12, clear: 8};   // deck.css's label: its px size, a generous width per letter, px clear of the wire

/** A wire's options, read as a browser reads its tag (the first of two with one name counts) and checked: {label, packets, speed}. */
function wireOptions(attrs, spec) {
  const where = `wire data-arrow="${spec}"`, read = readAttributes(attrs);
  if (!read) throw new Error(`${where}: a quote in its tag is never closed — write a ">" or "<" inside a value as &gt; or &lt;`);
  const value = (name) => read.find((a) => a.name === name)?.value;
  const label = value('data-label')?.trim() || null, packets = value('data-packets'), speed = value('data-speed');
  if (packets !== undefined && !/^[1-9]\d*$/.test(packets.trim())) throw new Error(`${where}: data-packets="${packets}" — the packets that run along it are a whole number, 1 to ${MOST_PACKETS}`);
  const n = packets === undefined ? 0 : Number(packets);
  if (n > MOST_PACKETS) throw new Error(`${where}: data-packets="${packets}" — at most ${MOST_PACKETS} packets run along one wire`);
  if (speed !== undefined && !n) throw new Error(`${where}: data-speed sets how fast its packets run — give it data-packets too`);
  const s = speed === undefined ? 3 : /^\s*\d+(?:\.\d+)?s?\s*$/.test(speed) ? parseFloat(speed) : NaN;
  if (!(s >= SPEEDS[0] && s <= SPEEDS[1])) throw new Error(`${where}: data-speed="${speed}" — the seconds a packet takes to run the wire, ${SPEEDS[0]} to ${SPEEDS[1]}`);
  return {label, packets: n, speed: s};
}

/**
 * One wire's SVG: the element's own attributes kept, a box that holds the curve (and its label), the curve, the head,
 * its packets and its label. `spec` is its run, "x1 y1 x2 y2 [bend]": one curve with one control point, beside the
 * middle of the run. `cable`, [start, handle, handle, end] (cable.js), is a curve with a handle at each end instead:
 * the same wire in every other way, marked data-sd-cable so its packets ride it by its own formula (deck.css), and
 * its label stands on it, on a plate, where `place(cable, [half its width, half its height])` says.
 */
function wireSvg(attrs, spec, cable = null, place = null) {
  const parts = cable ? [...cable[0], ...cable[3]] : spec.trim().split(/[\s,]+/).map(Number);
  if ((parts.length !== 4 && parts.length !== 5) || parts.some((n) => !Number.isFinite(n))) {
    throw new Error(`data-arrow="${spec}": a wire is the pieces it joins, "from to to" ("client to server"), or "x1 y1 x2 y2" in slide px — either with an optional bend`);
  }
  const [x1, y1, x2, y2, bend = 0] = parts, o = wireOptions(attrs, spec);
  const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1;
  const cx = cable ? cable[1][0] : (x1 + x2) / 2 - (dy / len) * bend, cy = cable ? cable[1][1] : (y1 + y2) / 2 + (dx / len) * bend;
  const [kx, ky] = cable ? cable[2] : [cx, cy];   // the control point the curve comes into its end from: a cable's second handle
  const tl = Math.hypot(x2 - kx, y2 - ky) || 1, ux = (x2 - kx) / tl, uy = (y2 - ky) / tl, hs = 18;
  // the label: beside the curve's middle, B(½), to the left of the way it runs there (its tangent is end − start), as
  // far off as half the label measures across the wire, and LABEL.clear more: above a level wire, beside a standing one
  const half = o.label ? [(o.label.length * LABEL.char) / 2 + 4, LABEL.size / 2 + 4] : null;   // the box holds it, so a wire showing itself in shows it too
  let off = half ? (Math.abs(dy) / len) * half[0] + (Math.abs(dx) / len) * half[1] + LABEL.clear : 0;
  // a wire bent away from its label curves back towards it on either side of its middle — by 2·bend·u²/len² at u along
  // it, never past the line from end to end: the label stands clear of the curve under its whole width too
  if (half && bend > 0) off += Math.min(bend / 2, (2 * bend * ((Math.abs(dx) / len) * half[0] + (Math.abs(dy) / len) * half[1]) ** 2) / len ** 2);
  // the curve's middle, B(½): a quarter of each end and half the control point — or, with two handles, an eighth of each end and three of each handle
  const [mx, my] = cable ? [(x1 + 3 * cx + 3 * kx + x2) / 8, (y1 + 3 * cy + 3 * ky + y2) / 8] : [0.25 * x1 + 0.5 * cx + 0.25 * x2, 0.25 * y1 + 0.5 * cy + 0.25 * y2];
  // a cable's label stands on the cable instead, where no block is over it (cable.js): beside a cable there is a block's face, or its twin
  const [lx, ly] = cable && half ? place(cable, half) : [mx + (dy / len) * off, my - (dx / len) * off];
  const xs = [x1, x2, cx, ...(cable ? [kx] : []), ...(half ? [lx - half[0] + 20, lx + half[0] - 20] : [])], ys = [y1, y2, cy, ...(cable ? [ky] : []), ...(half ? [ly - half[1] + 20, ly + half[1] - 20] : [])];
  const pad = 20, X = Math.min(...xs) - pad, Y = Math.min(...ys) - pad;
  const W = Math.max(...xs) + pad - X, H = Math.max(...ys) + pad - Y, f = fixed;
  const ex = x2 - ux * hs * 0.8, ey = y2 - uy * hs * 0.8;
  const d = cable
    ? `M${f(x1 - X)} ${f(y1 - Y)} C${f(cx - X)} ${f(cy - Y)} ${f(kx - X)} ${f(ky - Y)} ${f(ex - X)} ${f(ey - Y)}`
    : `M${f(x1 - X)} ${f(y1 - Y)} Q${f(cx - X)} ${f(cy - Y)} ${f(ex - X)} ${f(ey - Y)}`;
  const tip = [x2 - X, y2 - Y], back = [tip[0] - ux * hs, tip[1] - uy * hs], nx = -uy * hs * 0.6, ny = ux * hs * 0.6;
  const head = `<path class="head" d="M${f(tip[0])} ${f(tip[1])}L${f(back[0] + nx)} ${f(back[1] + ny)}L${f(back[0] - nx)} ${f(back[1] - ny)}Z"/>`;
  let at = attrs.replace(/\sclass="([^"]*)"/, (_, c) => ` class="${/(^|\s)wire(\s|$)/.test(c) ? c : `wire ${c}`}"`);
  if (!/\sclass="/.test(at)) at += ' class="wire"';
  // the packet rides the curve itself (deck.css · sdPkt): its control point (a cable's two handles) and its end, from where it starts
  const ride = `--cdx:${f(cx - x1)}px;--cdy:${f(cy - y1)}px;${cable ? `--c2x:${f(kx - x1)}px;--c2y:${f(ky - y1)}px;` : ''}--pdx:${f(ex - x1)}px;--pdy:${f(ey - y1)}px`;
  const pkt = /\bpkt\b/.test(at)
    ? `<rect class="pkt" x="${f(x1 - X - 8)}" y="${f(y1 - Y - 6)}" width="16" height="12" rx="3" style="${ride}"/>`
    : '';
  // packets that keep running (deck.css · sdRun): loops on one clock, each its share of a run behind the one before
  const runs = Array.from({length: o.packets}, (_, k) => `<circle class="run" data-loop cx="${f(x1 - X)}" cy="${f(y1 - Y)}" r="7" style="${ride};--loop:sdRun ${o.speed}s linear ${+((-k * o.speed) / o.packets).toFixed(3) + 0}s infinite"/>`).join('');
  const label = o.label ? `<text class="label" x="${f(lx - X)}" y="${f(ly - Y)}" text-anchor="middle">${o.label}</text>` : '';
  // a label on its cable stands on a plate of the ground's colour: the line stops at it, never a dash between two
  // words, and a packet passes under it, never across the words
  const plate = cable && half ? `<rect class="plate" x="${f(lx - X - half[0])}" y="${f(ly - Y - half[1])}" width="${f(2 * half[0])}" height="${f(2 * half[1])}" rx="6"/>` : '';
  // which way it runs, start to tip, as a CSS angle (0 up, 90 right): a wire coming in shows itself that way (deck.css · sdReveal)
  const angle = f((Math.atan2(dx, -dy) * 180) / Math.PI);
  return `<svg${at}${cable ? ' data-sd-cable' : ''} style="left:${f(X)}px;top:${f(Y)}px;width:${f(W)}px;height:${f(H)}px;--sd-angle:${angle}deg" viewBox="0 0 ${f(W)} ${f(H)}" aria-hidden="true"><path d="${d}"/>${head}${pkt}${runs}${plate}${label}</svg>`;
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
 * A wire written between two isometric pieces with no bend is a cable along the floor (cable.js): its entry here is
 * its four points, [start, handle, handle, end], where every other wire's is its numbers. A bend, 0 too ("a to b 0"),
 * keeps the wire a straight run from outline to outline.
 */
function wiresBetween(html, found, shapes, floor) {
  const read = found.map((f) => BETWEEN.exec(f.m[1]));
  if (!read.some(Boolean)) return read;
  const boxOf = boxFinder(html);
  // the name is that one isometric piece alone, with no bend asked for: then the wire may lie along the floor
  const laid = floor ? cables(read.map((m) => (m && m[3] === undefined && [m[1], m[2]].every((name) => shapes.has(name) && boxOf.alone(name)) ? [m[1], m[2]] : null)), shapes, floor) : [];
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
  // left of it, then those running back — on their own left
  const pairOf = (m) => [m[1], m[2]].sort().join('\u0000'), lanes = new Map();
  read.forEach((m, i) => { if (m) lanes.set(pairOf(m), [...(lanes.get(pairOf(m)) ?? []), i]); });
  for (const [key, ids] of lanes) {
    const along = (i) => read[i][1] === key.split('\u0000')[0];
    lanes.set(key, [...ids.filter(along), ...ids.filter((i) => !along(i))]);
  }
  return read.map((m, i) => {
    if (!m) return null;
    const spec = found[i].m[1];
    if (m[1] === m[2]) throw new Error(`data-arrow="${spec}": a wire joins two pieces, not "${m[1]}" to itself`);
    if (laid[i]) return laid[i];
    // in the pair's own direction (its names in order), so the wires both ways share one set of lanes
    const [a, b] = [m[1], m[2]].sort(), A = endOf(a, `data-arrow="${spec}"`), B = endOf(b, `data-arrow="${spec}"`);
    const ca = A.middle, cb = B.middle, len = Math.hypot(cb[0] - ca[0], cb[1] - ca[1]);
    if (len === 0) throw new Error(`data-arrow="${spec}": "${a}" and "${b}" share a middle — place them apart, or give the wire numbers`);
    const u = [(cb[0] - ca[0]) / len, (cb[1] - ca[1]) / len], n = [-u[1], u[0]];
    const lane = lanes.get(pairOf(m)), k = lane.indexOf(i), most = Math.max(0, Math.min(A.across(n), B.across(n)) - 8);
    const step = lane.length > 1 ? Math.min(LANE, (2 * most) / (lane.length - 1)) : 0, off = (k - (lane.length - 1) / 2) * step;
    const pa = [ca[0] + n[0] * off, ca[1] + n[1] * off], pb = [cb[0] + n[0] * off, cb[1] + n[1] * off];
    const ta = A.exit(pa, u) + GAP, tb = B.exit(pb, [-u[0], -u[1]]) + GAP;
    if (!(len - ta - tb >= 12)) throw new Error(`data-arrow="${spec}": "${a}" and "${b}" are too close for a wire between them (they touch or overlap) — move them apart, or give the wire numbers`);
    const start = [pa[0] + u[0] * ta, pa[1] + u[1] * ta], end = [pb[0] - u[0] * tb, pb[1] - u[1] * tb];
    const [from, to] = m[1] === a ? [start, end] : [end, start];
    return [...from, ...to, Number(m[3] ?? 0)].map(fixed).join(' ');
  });
}

/**
 * Every wire as written — <i … data-arrow="x1 y1 x2 y2 [bend]" …></i>, or "from to to [bend]" — in order: [{start, end, before, m, after}], `m[1]`
 * its spec. The one rule, so what wires() draws is what an edit moves (edit.js).
 */
export const wireTags = (html) => emptyI(html, /\sdata-arrow="([^"<>]+)"/);

/**
 * Every <i data-arrow="…"></i> as its wire; one written between pieces runs between them and carries data-ends.
 * `shapes` and `floor`: what the isometric pieces draw and where the floor is (iso.js · isoDrawn) — a wire between two
 * of them is a cable along the floor, and a wire from one to a flat piece ends on its outline.
 */
export function wires(html, shapes = new Map(), floor = null) {
  const found = wireTags(html), between = wiresBetween(html, found, shapes, floor);
  // what a cable's label keeps clear of: what stands on the floor (a block is drawn over the floor's wires), each
  // label placed before it, and the other cables — so the labels of a request and its answer, lying side by side,
  // never cover each other, and neither's line runs through the other's words where there is room to avoid it
  const taken = [...shapes.values()].map((shape) => shape.outline), runs = between.map((b) => (Array.isArray(b) ? cableWalk(b) : null));
  const place = (i) => (cable, [wide, high]) => {
    const [x, y] = labelPlace(cable, [wide, high], taken, runs.filter((run, k) => run && k !== i));
    taken.push([[x - wide, y - high], [x + wide, y - high], [x + wide, y + high], [x - wide, y + high]]);
    return [x, y];
  };
  return replaceEach(html, found, ({before, m, after}, i) => {
    if (!between[i]) return wireSvg(before + after, m[1]);
    const [, from, to] = BETWEEN.exec(m[1]), named = ` data-ends="${from} ${to}"${before}${after}`;
    return typeof between[i] === 'string' ? wireSvg(named, between[i]) : wireSvg(named, m[1], between[i], place(i));   // its numbers, or a cable's four points
  });
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
  return replaceEach(html, emptyI(html, /\sdata-icon="([\w-]+)"/), ({before, m, after}) => {
    const icon = Object.hasOwn(set, m[1]) ? set[m[1]] : null;
    if (!icon) {
      const known = Object.keys(set);
      throw new Error(`no icon "${m[1]}" (${known.length ? `there are ${known.join(', ')}` : 'the deck has no icons'}) — add icons/${m[1]}.svg`);
    }
    return `<svg${before}${after} viewBox="${icon.viewBox}" aria-hidden="true">${icon.body}</svg>`;
  });
}

/** What the wires written between pieces join, in the order written: [[from, to], …] by piece name. */
export const wireLinks = (html) => wireTags(html).map(({m}) => wireEnds(m[1])).filter(Boolean);

/**
 * The built-in helpers, in the order they run: icons first (a wire never holds one, a block's words may), then the
 * isometric pieces (so a callout may stand beside one and a wire reach it), then callouts (so a wire may reach one),
 * then wires. `canvas`, [w, h]: the slide a callout is kept on, and whose middle a floor starts from. `area`, [x0, y0,
 * x1, y1]: where a picture the build fits goes. What the wires join is read before anything is drawn: a map whose
 * blocks have no place is placed from it (iso.js).
 */
export function applyTransforms(html, {icons: set = {}, canvas = null, area = null} = {}) {
  const drawn = icons(html, set), iso = isoDrawn(drawn, {canvas, area, links: wireLinks(drawn)});
  return wires(callouts(iso.html, {canvas}), iso.shapes, iso.floor ?? null);
}
