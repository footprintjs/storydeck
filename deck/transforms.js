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
// and how they ride (ride.js has the numbers; each needs data-packets, and works on a cable and on a wire through
// the air alike, as data-packets does):
//   data-ride="ease-ends 0.15 0.2"    out of the start over the first 15% of the length, one steady speed, into the end
//                                     over the last 20% (with a px speed, that speed is the steady one)
//   data-rest="end" | "end 2s"        it stays at the end when it arrives (1 s, or as long as said), and rests there
//                                     where packets do not run
//   data-keep-size                    it keeps its size on the slide however near the camera comes (the view's zoom)
//   data-trail="3px var(--l1)"        a line that draws behind it as it rides, that width and colour
//   data-behind="fade"                where the cable runs behind a block it fades out over about three frames before
//                                     the block's edge and comes back after it (a wire through the air: nothing hides it)
// A wire that asks for any of these carries data-sd-ride, and the page then carries RIDE_CSS; one that asks for none is
// drawn byte for byte as before.

import {stripComments} from './html.js';
import {ownAttribute, pieceTags, readAttributes} from '../pieceRules.js';
import {readPieces} from '../focusHtml.js';
import {boxFinder, exit, exitOutline} from './boxes.js';
import {callouts} from './callouts.js';
import {isoDrawn} from './iso.js';
import {NO_ROUTE, rounded} from 'footprint-story/isometric';
import {cables, cablesOn, cableWalk, cableWay, held, labelPlace, layRoutes, reachOf, wayNote, LABEL_LOOKS} from './cable.js';
import {hiddenRamps, rideProfile, rideSeconds, showStops, withHold} from './ride.js';

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
const SPEEDS = [0.5, 60];   // seconds a packet takes to run the wire
const HOLD = {plain: 1, most: 60};   // seconds a packet that rests at the end stays there: unless the wire says, and at most
const EASED = 0.5;   // the most of a line's length one eased end may take
const TRAIL = [0.5, 24];   // px a trail may be wide
const NUMBER = '(\\d+(?:\\.\\d+)?|\\.\\d+)';
/** A trail's colour, as a deck may write it in a style: a word, a #hex, a var() or a colour function — nothing that ends the declaration or reaches out. */
const COLOUR = /^[#\w\s.,%()+\-/]+$/;
const LABEL = {size: 18, char: 12, clear: 8};   // deck.css's label: its px size, a generous width per letter, px clear of the wire
/** The letters a label shows: one written as an entity (&amp;) is one letter, not five. */
const shown = (label) => label.replace(/&(?:#\d+|#x[\da-f]+|[a-z][a-z\d]*);/gi, '.').length;
/** Where a cable's running packets may rest when they do not run: its middle first, then further to each side by turns. */
const RESTS = [0.5, 0.35, 0.65, 0.25, 0.75, 0.15, 0.85];

/**
 * A wire's options, read as a browser reads its tag (the first of two with one name counts) and checked: {label,
 * packets, speed, perSecond, head, ride, rest, keep, trail, behind, fresh}. `speed` is the seconds of a run as written
 * (null for a speed in px a second: `perSecond`, timed once the wire's length is known, rideOf); `fresh`, whether it asks
 * for any of the ride options (ride.js), which draw its packets the new way.
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
  const px = speed === undefined ? null : new RegExp(`^\\s*${NUMBER}px(?:/s)?\\s*$`).exec(speed);
  const perSecond = px ? Number(px[1]) : null;
  if (px && !(perSecond > 0)) throw new Error(`${where}: data-speed="${speed}" — a speed in px a second is more than 0 ("300px")`);
  const s = px ? null : speed === undefined ? 3 : /^\s*\d+(?:\.\d+)?s?\s*$/.test(speed) ? parseFloat(speed) : NaN;
  if (!px && !(s >= SPEEDS[0] && s <= SPEEDS[1])) throw new Error(`${where}: data-speed="${speed}" — the seconds a packet takes to run the wire, ${SPEEDS[0]} to ${SPEEDS[1]}, or its speed in px a second ("300px")`);
  // how the packets ride: each an option of the packets, so a wire with none is refused it
  const ride = value('data-ride'), rest = value('data-rest'), keep = value('data-keep-size'), trail = value('data-trail'), behind = value('data-behind');
  for (const [name, v] of [['data-ride', ride], ['data-rest', rest], ['data-keep-size', keep], ['data-trail', trail], ['data-behind', behind]]) {
    if (v !== undefined && !n) throw new Error(`${where}: ${name} says how its packets ride — give it data-packets too`);
  }
  const eased = ride === undefined ? null : new RegExp(`^\\s*ease-ends\\s+${NUMBER}(?:\\s+${NUMBER})?\\s*$`).exec(ride);
  const ends = eased ? [Number(eased[1]), Number(eased[2] ?? eased[1])] : null;
  if (ride !== undefined && !(ends && ends.every((e) => e <= EASED))) throw new Error(`${where}: data-ride="${ride}" — a ride eases out of its start and into its end over shares of its length, each 0 to ${EASED}: data-ride="ease-ends 0.15 0.2" (one number for both ends)`);
  const resting = rest === undefined ? null : new RegExp(`^\\s*end(?:\\s+${NUMBER}s)?\\s*$`).exec(rest);
  const hold = resting ? Number(resting[1] ?? HOLD.plain) : null;
  if (rest !== undefined && !(resting && hold <= HOLD.most)) throw new Error(`${where}: data-rest="${rest}" — a packet rests at the end of the wire when it arrives: data-rest="end", or "end 2s" for how long it stays there (0 to ${HOLD.most} s; ${HOLD.plain} s when not said)`);
  if (keep !== undefined && keep !== '') throw new Error(`${where}: data-keep-size="${keep}" — it takes no value: write data-keep-size alone`);
  const drawn = trail === undefined ? null : new RegExp(`^\\s*${NUMBER}px\\s+(.+?)\\s*$`).exec(trail);
  if (trail !== undefined && !(drawn && COLOUR.test(drawn[2]) && !/url\s*\(|image|expression/i.test(drawn[2]) && balanced(drawn[2]))) throw new Error(`${where}: data-trail="${trail}" — a trail is its width in px and its colour: data-trail="3px var(--l1)" (a colour word, a #hex, a var() or a colour function — no ; { } quotes, & or url())`);
  if (drawn && !(Number(drawn[1]) >= TRAIL[0] && Number(drawn[1]) <= TRAIL[1])) throw new Error(`${where}: data-trail="${trail}" — a trail is ${TRAIL[0]} to ${TRAIL[1]} px wide`);
  if (behind !== undefined && behind.trim() !== 'fade') throw new Error(`${where}: data-behind="${behind}" — where its cable runs behind a block its packets fade out and come back after it: data-behind="fade"`);
  const o = {label, packets: n, speed: s, perSecond, written: speed, head: head === undefined, ride: ends, rest: resting ? {hold} : null, keep: keep !== undefined,
    trail: drawn ? {width: Number(drawn[1]), colour: drawn[2]} : null, behind: behind !== undefined};
  return {...o, fresh: Boolean(perSecond || ends || resting || o.keep || drawn || o.behind)};
}
/** Whether every "(" in a value is closed, in order. */
const balanced = (text) => { let open = 0; for (const c of text) { open += c === '(' ? 1 : c === ')' ? -1 : 0; if (open < 0) return false; } return open === 0; };

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

/** A number for a page: at most `places` decimals, no trailing zeros, never "-0". */
const short = (v, places = 4) => +v.toFixed(places) + 0;
/** Stops [[time, value], …] (ride.js) as CSS's linear() easing: `linear` itself for a steady ride. */
const easing = (stops) => (stops.length === 2 && stops[0][1] === 0 && stops[1][1] === 1 ? 'linear' : `linear(${stops.map(([t, v]) => `${short(v)} ${short(t * 100, 3)}%`).join(', ')})`);
/** Where a packet shows along its line (ride.js · hiddenRamps) as CSS on its --sd-t: 1 in the open, 0 behind a block, straight between; '' when nothing hides it. */
export function seenOf(ramps) {
  const t = 'var(--sd-t)', each = ramps.map(([outFrom, outTo, backFrom, backTo]) => {
    const terms = [...(outTo > outFrom ? [`(${short(outTo, 5)} - ${t}) * ${short(1 / (outTo - outFrom), 2)}`] : []), ...(backTo > backFrom ? [`(${t} - ${short(backFrom, 5)}) * ${short(1 / (backTo - backFrom), 2)}`] : [])];
    return terms.length ? `clamp(0, ${terms.length > 1 ? `max(${terms.join(', ')})` : terms[0]}, 1)` : '0';
  });
  return each.length > 1 ? `min(${each.join(', ')})` : each[0] ?? '';
}

/**
 * How a wire's packets ride, for a wire that asks for a ride option (wireOptions · fresh), once its line is known:
 * `length` its px, `unseen` the stretches a block hides ([[from, to], …] px along it — the build's record of a cable;
 * none for a wire through the air). Gives {period, vars, seen, rest}: the seconds of one run (the ride and its rest at
 * the end), the easings as CSS variables for the wire's SVG, where along it a packet shows (seenOf) and where it rests
 * when packets do not run (1: the end, or null for the place it rests today). A speed in px a second that would make a
 * run faster than half a second or slower than a minute is refused, naming the speeds this wire takes.
 */
function rideOf(o, length, unseen, spec) {
  const ease = o.ride ?? [0, 0], seconds = o.perSecond ? rideSeconds(length, o.perSecond, ease) : o.speed;
  if (!(seconds >= SPEEDS[0] && seconds <= SPEEDS[1])) {
    const along = length * (1 + ease[0] + ease[1]), slowest = Math.ceil((along / SPEEDS[1]) * 10) / 10, fastest = Math.floor((along / SPEEDS[0]) * 10) / 10;
    throw new Error(`wire data-arrow="${spec}": data-speed="${o.written}" — this wire is ${short(length, 0)} px long, so a run would take ${short(seconds, 2)} s, and a run takes ${SPEEDS[0]} to ${SPEEDS[1]} s — give it ${slowest}px to ${fastest}px, or its seconds (data-speed="3")`);
  }
  const hold = o.rest?.hold ?? 0, period = seconds + hold, share = seconds / period, steady = (length * (1 + ease[0] + ease[1])) / seconds;
  const vars = `--sd-ride-ease:${easing(withHold(rideProfile(ease, length), share))};--sd-show-ease:${easing(showStops(share, {end: Boolean(o.rest)}))}`;
  return {period: short(period, 3), vars, seen: o.behind ? seenOf(hiddenRamps(unseen, length, steady, ease)) : '', rest: o.rest ? 1 : null};
}

/**
 * A wire's riding packets the new way (rideOf): each a loop of two animations on one clock — sdRide carries --sd-t along
 * the line by the ride's easing, sdShow carries --sd-show, how much of it shows (RIDE_CSS) — and, with a trail, a line
 * before each that draws behind it. `d`: the line the trails draw (the wire's own path, in the box's px); `circle`: a
 * packet's place and own style (a wire through the air rides by its one handle); `seen`: where along the line it shows
 * (CSS on --sd-t, '' for everywhere); `span`: [from, to], the share of the line its trails may draw (a lead's copy draws
 * only its own stretch).
 */
function ridersSvg(o, r, {d, circle, style = '', seen = r.seen, span = [0, 1], restAt = r.rest}) {
  const loop = (k) => { const at = short((-k * r.period) / o.packets, 3); return `--loop:sdRide ${r.period}s var(--sd-ride-ease) ${at}s infinite, sdShow ${r.period}s var(--sd-show-ease) ${at}s infinite`; };
  const rests = restAt === null || restAt === undefined ? '' : `--sd-t:${restAt};`, shows = seen ? `--sd-seen:${seen};` : '';
  const stretch = span[0] > 0 || span[1] < 1 ? `--sd-from:${short(span[0], 5)};--sd-to:${short(span[1], 5)};` : '';
  const trails = o.trail ? Array.from({length: o.packets}, (_, k) => `<path class="trail" data-loop d="${d}" pathLength="1" style="stroke:${o.trail.colour};stroke-width:${o.trail.width}px;${stretch}${loop(k)}"/>`).join('') : '';
  return trails + Array.from({length: o.packets}, (_, k) => `<circle class="run" data-loop ${circle} r="7" style="${style}${rests}${shows}${loop(k)}"/>`).join('');
}
/** What a wire that rides the new way adds to its SVG's tag: the marks RIDE_CSS reads, and its easings. */
const rideMarks = (o, r) => ({attrs: ` data-sd-ride${o.keep ? ' data-sd-keep' : ''}`, style: `;${r.vars}`});

/** The length of a quadratic curve from `a` to `e` drawn towards `c`, in px: walked in so many straight runs. */
function curveLength(a, c, e, runs = 64) {
  let length = 0, at = a;
  for (let k = 1; k <= runs; k++) {
    const t = k / runs, p = [0, 1].map((i) => (1 - t) * (1 - t) * a[i] + 2 * (1 - t) * t * c[i] + t * t * e[i]);
    length += Math.hypot(p[0] - at[0], p[1] - at[1]); at = p;
  }
  return length;
}

/**
 * The stylesheet of packets that ride the new way (a wire marked data-sd-ride), which the page carries only when a
 * deck has one — so a deck that asks for no ride option is its page byte for byte. Every rule but the camera's has no
 * weight (:where), so a theme wins.
 *
 * - sdRide carries --sd-t from 0 to 1 by the ride's own easing (--sd-ride-ease: rideProfile, with its rest at the end);
 *   sdShow carries --sd-show by --sd-show-ease (showStops). Where loops run ([data-deck-loop]) a packet shows
 *   --sd-show times --sd-seen (where along the line it is not behind a block); elsewhere — reduced motion, print,
 *   motion off — it rests as deck.css rests one: the first at its middle (or at the end, data-rest="end"), the others
 *   hidden, and no trail.
 * - A trail is its own line drawn from its start up to --sd-t (pathLength 1: a dash as long as the share ridden),
 *   on the share of the line [--sd-from, --sd-to] — a lead's copy draws its own stretch only — and shows as its packet does.
 * - data-keep-size: the packet is scaled by one over the view's zoom (focus.css · .sd-stage: --sd-ts), about its own
 *   middle, before it is carried along the line. While the view moves, --sd-keep moves with it, from where the view
 *   came (--sd-ts0) in the view's own time, delay and easing, so it keeps its size through the move too.
 */
export const RIDE_CSS = `/* packets that ride a line their own way (deck/transforms.js · data-ride, data-rest, data-keep-size, data-trail, data-behind) */
@property --sd-show { syntax: '<number>'; inherits: false; initial-value: 1; }
@property --sd-keep { syntax: '<number>'; inherits: false; initial-value: 1; }
@keyframes sdRide { from { --sd-t: 0; } to { --sd-t: 1; } }
@keyframes sdShow { from { --sd-show: 0; } to { --sd-show: 1; } }
@keyframes sdKeep { from { --sd-keep: var(--sd-ts0, var(--sd-ts, 1)); } }
:where(svg.wire[data-sd-lead][data-sd-ride] .run) { transform: none; offset-path: var(--sd-way); offset-distance: calc(var(--sd-t) * 100%); offset-rotate: 0deg; opacity: var(--sd-seen, 1); }
:where(svg.wire[data-sd-ride] .run + .run) { opacity: 0; }
:where(svg.wire[data-sd-ride] path.trail) { opacity: 0; fill: none; stroke-linecap: butt; stroke-dasharray: calc(max(0, min(var(--sd-t), var(--sd-to, 1)) - var(--sd-from, 0))) 3; stroke-dashoffset: calc(-1 * var(--sd-from, 0)); }
:where([data-deck-loop]) :where(svg.wire[data-sd-ride] .run) { opacity: calc(var(--sd-show) * var(--sd-seen, 1)); }
:where([data-deck-loop]) :where(svg.wire[data-sd-ride] path.trail) { opacity: var(--sd-show); }
:where(svg.wire[data-sd-keep] .run) { --sd-keep: var(--sd-ts, 1); }
:where(svg.wire[data-sd-keep]:not([data-sd-cable], [data-sd-lead]) .run) {
  transform: translate(calc(var(--cdx) * 2 * (1 - var(--sd-t)) * var(--sd-t) + var(--pdx) * var(--sd-t) * var(--sd-t)),
    calc(var(--cdy) * 2 * (1 - var(--sd-t)) * var(--sd-t) + var(--pdy) * var(--sd-t) * var(--sd-t))) scale(calc(1 / var(--sd-keep)));
  transform-box: fill-box; transform-origin: center;
}
:where(svg.wire[data-sd-keep]:is([data-sd-cable], [data-sd-lead]) .run) { transform: scale(calc(1 / var(--sd-keep))); }
:where(.sd-stage.sd-move svg.wire[data-sd-keep] .run) { --sd-keep-time: var(--sd-move-time, 1s); --sd-keep-at: 0s; }
:where(.sd-stage.sd-stage-turn.sd-move svg.wire[data-sd-keep] .run) { --sd-keep-time: var(--sd-stage-time, 1s); --sd-keep-at: var(--sd-stage-delay, 0s); }
:where(.sd-focus-new .sd-stage.sd-stage-turn.sd-move svg.wire[data-sd-keep] .run) { --sd-keep-at: calc(var(--sd-stage-delay, 0s) + .4s); }
@media screen and (prefers-reduced-motion: no-preference) {
  :where([data-deck-active][data-deck-loop]:not([data-sd-instant]):not([data-deck-static])) .sd-stage.sd-move svg.wire[data-sd-keep] .run {
    animation: var(--loop, sdNone 0s), sdKeep var(--sd-keep-time) var(--sd-ease, cubic-bezier(.2, .7, .2, 1)) var(--sd-keep-at) both; }
  :where([data-deck-active]:not([data-deck-loop]):not([data-sd-instant]):not([data-deck-static])) .sd-stage.sd-move svg.wire[data-sd-keep] .run {
    animation: sdKeep var(--sd-keep-time) var(--sd-ease, cubic-bezier(.2, .7, .2, 1)) var(--sd-keep-at) both; }
}`;

/**
 * One wire's SVG: the element's own attributes kept, a box that holds the curve (and its label), the curve, the head,
 * its packets and its label. `spec` is its run, "x1 y1 x2 y2 [bend]": one curve with one control point, beside the
 * middle of the run.
 */
function wireSvg(attrs, spec) {
  const parts = spec.trim().split(/[\s,]+/).map(Number);
  if ((parts.length !== 4 && parts.length !== 5) || parts.some((n) => !Number.isFinite(n))) {
    throw new Error(`data-arrow="${spec}": a wire is the pieces it joins, "from to to" ("client to server"), or "x1 y1 x2 y2" in slide px — either with an optional bend`);
  }
  const [x1, y1, x2, y2, bend = 0] = parts, o = wireOptions(attrs, spec);
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
  // (or the new way, when it asks how they ride: rideOf, its line's length walked; nothing hides a wire through the air)
  const r = o.fresh ? rideOf(o, curveLength([x1, y1], [cx, cy], [ex, ey]), [], spec) : null, marks = r ? rideMarks(o, r) : {attrs: '', style: ''};
  const runs = r ? ridersSvg(o, r, {d, circle: `cx="${f(x1 - X)}" cy="${f(y1 - Y)}"`, style: `${ride};`})
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
 * it, on a plate, where `place(way, [half its width, half its height], tip)` says. `r`: how its packets ride (rideOf),
 * for a wire that asks for a ride option.
 */
function cableSvg(attrs, spec, way, points, place, r = null) {
  const o = wireOptions(attrs, spec), f = fixed, [x1, y1] = way.start, tip = points.at(-1), before = points.at(-2);   // `way` already ends where the head begins, or at the tip when the wire has none
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
  // (or the new way, when it asks how they ride: `r`, its rideOf; one that rests at the end rests there)
  const tag = r ? rideMarks(o, r) : {attrs: '', style: ''};
  const runs = r ? ridersSvg(o, r, {d, circle: 'cx="0" cy="0"', restAt: r.rest ?? (rest === 0.5 ? null : rest)})
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
 * `wires`, with what the build knows of each wire's way: {html, ways, cables} — `cables`: each cable laid, as the
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
  // each cable's line: up to where its head begins, or its whole length when it has none (data-head="none")
  const ways = between.map((drawn, i) => (drawn && typeof drawn === 'object' ? cableWay(drawn, wireOptions(found[i].before + found[i].after, found[i].m[1]).head ? HEAD * 0.8 : 0) : null));
  let runs = null;
  const place = (way, [wide, high], tip) => {
    runs ??= ways.filter(Boolean).map((line) => ({...held(cableWalk(line)), of: line}));
    const [x, y] = labelPlace(way, [wide, high], taken, runs, looks, tip);
    taken.push(held([[x - wide, y - high], [x + wide, y - high], [x + wide, y + high], [x - wide, y + high]]));
    return [x, y];
  };
  const said = [], record = [], names = pieceNames(html);
  let rides = false;   // whether a wire rides its packets the new way: the page then carries RIDE_CSS
  const drawn = replaceEach(html, found, ({before, m, after}, i) => {
    if (!between[i]) { const svg = wireSvg(before + after, m[1]); rides ||= wireOptions(before + after, m[1]).fresh; return svg; }
    const [, from, to] = endsRead(m[1], names), laid = cabled[i], note = laid ? wayNote(laid.route) : '';
    // its first name, read as a browser reads its tag (the wire's own data-k, not those words inside another value)
    const name = laid ? readAttributes(before + after)?.find((a) => a.name === 'data-k')?.value.trim().split(/\s+/)[0] || `${from} to ${to}` : '';
    if (note) said.push({name, from, to, way: note});
    const kept = ways[i] ? laidRecord(name, laid, ways[i]) : null;
    if (kept) record.push(kept);
    const named = ` data-ends="${from} ${to}"${before}${after}`;
    if (!ways[i]) { const svg = wireSvg(named, between[i]); rides ||= wireOptions(named, m[1]).fresh; return svg; }   // its numbers
    // a cable's line — and, at an end that plugs into a port on a seen side, its lead over that block (leadSvg). Its
    // packets, when it asks how they ride, ride the line the record measures, past the stretches the record says are hidden
    const o = wireOptions(before + after, m[1]), head = o.head ? HEAD * 0.8 : 0, r = o.fresh ? rideOf(o, ways[i].length, kept.unseen, m[1]) : null;
    if (r) rides = true;
    return cableSvg(named, m[1], ways[i], laid.points, place, r) + [0, 1].map((k) => leadSvg(named, laid, k, k === 1 ? head : 0, levels.get(k ? laid.route.to : laid.route.from), r && {o, r, way: ways[i]})).join('');
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

/** The length of a rounded way's pieces from `start`, in px: a corner walked in 12 straight runs, as the kit walks it. */
function piecesLength(start, pieces) {
  let length = 0, at = start;
  for (const piece of pieces) { length += piece.corner ? curveLength(at, piece.corner, piece.to, 12) : Math.hypot(piece.to[0] - at[0], piece.to[1] - at[1]); at = piece.to; }
  return length;
}

/**
 * A cable's lead into a port on a seen side of its block — the stretch out of the port, the riser and down to where its
 * corner on the floor begins — drawn again over that block: the cable lies under every block (they stand on the floor
 * it runs on), so the port and its riser, in front of the block's face, would be covered by it. The lead stands at the
 * odd level just above its block's (iso.js), so a block in front of it still covers it. It is the cable's own piece (its
 * data-k, its class), so it is shown, lit and hidden with it. `k`: which end (0 the start, 1 the end); `back`: px the
 * line stops short of the tip there, for its head; '' when that end has no lead.
 *
 * `ride`: {o, r, way} for a cable whose packets ride the new way (rideOf; `way` the cable's line). The lead then carries
 * a copy of them riding the cable's own line, shown only while they are on the lead's stretch of it (and its trails
 * drawn on that stretch only): a packet at a port on a seen side is seen there, over its block, never under it.
 */
function leadSvg(attrs, {points, radius, ends}, k, back, level, ride = null) {
  const end = ends?.[k];
  if (!end?.seen || level === undefined) return '';
  const run = k ? [...points].reverse() : [...points];
  if (back) { const [tip, next] = run, far = Math.hypot(next[0] - tip[0], next[1] - tip[1]) || 1, by = Math.max(0, Math.min(back, far - 1)); run[0] = [tip[0] + (next[0] - tip[0]) * by / far, tip[1] + (next[1] - tip[1]) * by / far]; }
  // the lead runs to the end of its floor corner: the upper part of that corner can be behind the block's face too
  const way = rounded(run, radius), pieces = way.pieces.slice(0, 2 * (end.count - 2) + 2), f = fixed;
  const marks = [way.start, ...pieces.flatMap((piece) => (piece.corner ? [piece.corner, piece.to] : [piece.to])), ...(back ? [points.at(k ? -1 : 0)] : [])];
  const pad = 20, X = Math.min(...marks.map((p) => p[0])) - pad, Y = Math.min(...marks.map((p) => p[1])) - pad, W = Math.max(...marks.map((p) => p[0])) + pad - X, H = Math.max(...marks.map((p) => p[1])) + pad - Y;
  const d = `M${f(way.start[0] - X)} ${f(way.start[1] - Y)}${pieces.map((piece) => (piece.corner ? `Q${f(piece.corner[0] - X)} ${f(piece.corner[1] - Y)} ` : 'L') + `${f(piece.to[0] - X)} ${f(piece.to[1] - Y)}`).join('')}`;
  const tip = points.at(-1), before = points.at(-2), far = Math.hypot(tip[0] - before[0], tip[1] - before[1]) || 1;
  const head = back ? headAt([tip[0] - X, tip[1] - Y], [(tip[0] - before[0]) / far, (tip[1] - before[1]) / far]) : '';
  // the packets' copy: the share of the cable's line the lead holds (its pieces' length, from that end), the copy shown on it only
  let tag = {attrs: '', style: ''}, riders = '';
  if (ride) {
    const {o, r, way: line} = ride, held = Math.min(1, piecesLength(way.start, pieces) / line.length), from = k ? 1 - held : held, t = 'var(--sd-t)';
    const seen = k ? `clamp(0, (${t} - ${short(from, 5)}) * 10000 + 1, 1)` : `clamp(0, (${short(from, 5)} - ${t}) * 10000 + 1, 1)`, dc = wayPath(line, X, Y);
    tag = rideMarks(o, r);
    tag.style = `;--sd-way:path('${dc}')${tag.style}`;
    // where packets do not run, the copy rests off the lead (the cable's own packet rests where it rests), unless it rests at the end
    riders = ridersSvg(o, r, {d: dc, circle: 'cx="0" cy="0"', seen, span: k ? [from, 1] : [0, from], restAt: r.rest ?? (k ? 0 : 1)});
  }
  // the cable's own piece (its name, its class, its ends), but not its id: an id is one element's
  return `<svg${classed(attrs.replace(/\sid=("[^"]*"|'[^']*'|\S+)/gi, ''))} data-sd-lead="${k ? 'end' : 'start'}"${tag.attrs} style="left:${f(X)}px;top:${f(Y)}px;width:${f(W)}px;height:${f(H)}px;z-index:${level + 1}${tag.style}" viewBox="0 0 ${f(W)} ${f(H)}" aria-hidden="true"><path d="${d}"/>${head}${riders}</svg>`;
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
 * `applyTransforms`, with what the build knows of the map it made: {html, ways, cables, tight, made} — `ways` what
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
  const lay = (solids) => { routes = layRoutes(floorLinks(drawn, found, solids), solids); return reachOf(routes); };
  const iso = isoDrawn(drawn, {canvas, area, links: wireLinks(drawn), lay});
  return {...wiresDrawn(callouts(iso.html, {canvas}), {...iso, routes}), tight: iso.tight ?? [], made: iso.made ?? null};
}
