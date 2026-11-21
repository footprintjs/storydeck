// rides — how a wire's packets ride, as a page draws it: the ride options read and checked, and the ride's numbers
// (footprint-story/motion · rideProfile, rideSeconds, withHold, showStops, hiddenRamps) turned into the CSS a wire's SVG carries. transforms.js draws the wire; this file says how its packets ride it.
//
//   readRide(value, where, packets, speed)   the options as written on the wire: data-speed in px, data-ride,
//                                            data-rest, data-keep-size, data-trail, data-behind — refused with the fix
//   rideOf(o, length, …)                     the ride for a line of that length: its run's seconds, easings, where a
//                                            packet shows along it (seenOf) and where it rests
//   ridersSvg(o, r, …) · rideMarks(o, r, …)  the packets (and trails) as SVG, and what the wire's tag adds
//   RIDE_CSS                                 the stylesheet, which a page carries only when a wire asks
//
// WHY its own file: transforms.js is a wire's shape; this is its packets' motion, and it grows with every option. The
// numbers are the story library's (plain numbers, nothing drawn; deck/ride.js until 0.28.0), so a film rides the same
// packets the same way.
//
// A wire that asks for any option rides every packet on its own line by length (CSS offset-path, its path as
// --sd-way: a cable's floor line, a wire through the air its curve), two loops on one clock — sdRide carries --sd-t
// by the ride's easing, sdShow carries --sd-show — and is marked data-sd-ride. A wire that asks for none is drawn as
// it always was (deck.css · sdRun), so its page is byte for byte the same.
import {hiddenRamps, rideProfile, rideSeconds, seenTerms, showStops, withHold, MOST_EASE} from 'footprint-story/motion';

export const SPEEDS = [0.5, 60];   // seconds a packet takes to run the wire
const HOLD = {plain: 1, most: 60};   // seconds a packet that rests at the end stays there: unless the wire says, and at most
const EASED = MOST_EASE;   // the most of a line's length one eased end may take (the story library's, which refuses more)
const TRAIL = [0.5, 24];   // px a trail may be wide
const COLOUR_MOST = {letters: 100, depth: 3};   // a trail's colour: at most so many letters, and brackets so deep (color-mix(in srgb, var(--a), rgb(…)))
const NUMBER = '(\\d+(?:\\.\\d+)?|\\.\\d+)';
/** A trail's colour, as a deck may write it in a style: a word, a #hex, a var() or a colour function — nothing that ends the declaration or reaches out. */
const COLOUR = /^[#\w\s.,%()+\-/]+$/;
const RADIUS = 7;   // px: a running packet's radius (deck.css · .run, r="7")
const SHOWN = 60;   // letters of a deck's value an error quotes, at most
/**
 * How sharply a lead's copy of a packet takes over from the cable's own at the lead's edge: --sd-t × this. WHY a step
 * this steep: the two copies stand on the same point there, so the change must happen within one place along the line
 * (a ten-thousandth of it, under a px on any slide) — never a stretch where both show (a doubled glow) or neither.
 * `+ 1` puts the copy's whole step before the edge, so it is fully shown on the lead itself.
 */
const STEP = 10000;
const LEAD_CAP = 2;   // px: half a lead's stroke (deck.css · svg.wire path, 4): its round cap reaches so far past its end

/** A deck's value as an error quotes it: at most SHOWN letters, cut with "…" — a value thousands of letters long gives a short error. */
export const quoted = (value) => `"${value.length > SHOWN ? `${value.slice(0, SHOWN - 1)}…` : value}"`;
/** Whether every "(" in a value is closed, in order, and none is deeper than `most`. */
function bracketed(text, most) {
  let open = 0;
  for (const c of text) { open += c === '(' ? 1 : c === ')' ? -1 : 0; if (open < 0 || open > most) return false; }
  return open === 0;
}

/**
 * The ride options of a wire's tag, checked: {perSecond, written, ride, rest, keep, trail, behind, rides}. `value(name)`:
 * an attribute as a browser reads it (undefined when absent); `where`: the wire, for an error; `packets`: how many run
 * (each option is one of theirs, so a wire with none is refused it); `speed`: data-speed as written. `perSecond` is a
 * speed in px a second (null for seconds, which transforms.js reads); `rides`, whether it asks for any of them.
 */
export function readRide(value, where, packets, speed) {
  const px = speed === undefined ? null : new RegExp(`^\\s*${NUMBER}px(?:/s)?\\s*$`).exec(speed);
  const perSecond = px ? Number(px[1]) : null;
  if (px && !(perSecond > 0)) throw new Error(`${where}: data-speed=${quoted(speed)} — a speed in px a second is more than 0 ("300px")`);
  const ride = value('data-ride'), rest = value('data-rest'), keep = value('data-keep-size'), trail = value('data-trail'), behind = value('data-behind');
  for (const [name, v] of [['data-ride', ride], ['data-rest', rest], ['data-keep-size', keep], ['data-trail', trail], ['data-behind', behind]]) {
    if (v !== undefined && !packets) throw new Error(`${where}: ${name} says how its packets ride — give it data-packets too`);
  }
  const eased = ride === undefined ? null : new RegExp(`^\\s*ease-ends\\s+${NUMBER}(?:\\s+${NUMBER})?\\s*$`).exec(ride);
  const ends = eased ? [Number(eased[1]), Number(eased[2] ?? eased[1])] : null;
  if (ride !== undefined && !(ends && ends.every((e) => e <= EASED))) throw new Error(`${where}: data-ride=${quoted(ride)} — a ride eases out of its start and into its end over shares of its length, each 0 to ${EASED}: data-ride="ease-ends 0.15 0.2" (one number for both ends)`);
  const resting = rest === undefined ? null : new RegExp(`^\\s*end(?:\\s+${NUMBER}s)?\\s*$`).exec(rest);
  const hold = resting ? Number(resting[1] ?? HOLD.plain) : null;
  if (rest !== undefined && !(resting && hold <= HOLD.most)) throw new Error(`${where}: data-rest=${quoted(rest)} — a packet rests at the end of the wire when it arrives: data-rest="end", or "end 2s" for how long it stays there (0 to ${HOLD.most} s; ${HOLD.plain} s when not said)`);
  if (keep !== undefined && keep !== '') throw new Error(`${where}: data-keep-size=${quoted(keep)} — it takes no value: write data-keep-size alone`);
  const drawn = trail === undefined ? null : new RegExp(`^\\s*${NUMBER}px\\s+(.+?)\\s*$`).exec(trail);
  const colour = drawn?.[2] ?? '';
  if (trail !== undefined && !(drawn && colour.length <= COLOUR_MOST.letters && COLOUR.test(colour) && !/url\s*\(|image|expression/i.test(colour) && bracketed(colour, COLOUR_MOST.depth))) {
    throw new Error(`${where}: data-trail=${quoted(trail)} — a trail is its width in px and its colour: data-trail="3px var(--l1)" (a colour word, a #hex, a var() or a colour function, at most ${COLOUR_MOST.letters} letters and ${COLOUR_MOST.depth} brackets deep — no ; { } quotes, & or url())`);
  }
  if (drawn && !(Number(drawn[1]) >= TRAIL[0] && Number(drawn[1]) <= TRAIL[1])) throw new Error(`${where}: data-trail=${quoted(trail)} — a trail is ${TRAIL[0]} to ${TRAIL[1]} px wide`);
  if (behind !== undefined && behind.trim() !== 'fade') throw new Error(`${where}: data-behind=${quoted(behind)} — where its cable runs behind a block its packets fade out and come back after it: data-behind="fade"`);
  const o = {perSecond, written: speed, ride: ends, rest: resting ? {hold} : null, keep: keep !== undefined, trail: drawn ? {width: Number(drawn[1]), colour} : null, behind: behind !== undefined};
  return {...o, rides: Boolean(perSecond || ends || resting || o.keep || drawn || o.behind)};
}

/** A number for a page: at most `places` decimals, no trailing zeros, never "-0". */
export const short = (v, places = 4) => +v.toFixed(places) + 0;
/**
 * Stops [[time, value], …] (footprint-story/motion · rideProfile, showStops) as CSS's linear() easing: `linear` itself for a steady ride. A value keeps six
 * decimals (a millionth of the line: well under a px on any slide), a time three of its percent — so the emitted
 * easing keeps rideProfile's half-px promise.
 */
export const easing = (stops) => (stops.length === 2 && stops[0][1] === 0 && stops[1][1] === 1 ? 'linear' : `linear(${stops.map(([t, v]) => `${short(v, 6)} ${short(t * 100, 3)}%`).join(', ')})`);

/**
 * Where a packet shows along its line, as CSS on its --sd-t: 1 in the open, 0 behind a block, straight between; ''
 * where nothing hides it. `ramps`: footprint-story/motion · hiddenRamps; `pad`: a CSS share more each ramp keeps off its stretch (a
 * packet that keeps its size is a different size on the line at each zoom: its radius over --sd-keep); `leads`:
 * [startShare | null, endShare | null], the shares a lead's copy shows instead (the cable's own is hidden there).
 * The rule is footprint-story/motion's (seenTerms; a film reads the same terms at a share, seenAt): this words each
 * term as CSS, its numbers rounded for a page.
 */
export function seenOf(ramps, pad = '', leads = [null, null]) {
  const t = 'var(--sd-t)', less = pad ? ` - ${pad}` : '';
  const each = seenTerms(ramps).map((ramp) => {
    const terms = ramp.map(({from, to, falling}) => (falling ? `(${short(to, 5)} - ${t}${less}) * ${short(1 / (to - from), 2)}` : `(${t} - ${short(from, 5)}${less}) * ${short(1 / (to - from), 2)}`));
    return terms.length ? `clamp(0, ${terms.length > 1 ? `max(${terms.join(', ')})` : terms[0]}, 1)` : '0';
  });
  // off a lead's stretch: the cable's own packet is 1 minus the lead's copy (leadSeen), so the two never both show
  if (leads[0] !== null) each.push(`clamp(0, (${t} - ${short(leads[0], 5)}) * ${STEP}, 1)`);
  if (leads[1] !== null) each.push(`clamp(0, (${short(leads[1], 5)} - ${t}) * ${STEP}, 1)`);
  return each.length > 1 ? `min(${each.join(', ')})` : each[0] ?? '';
}
/** Where a lead's copy shows: on its own stretch only — up to `share` of the line at the start's lead (k 0), from it at the end's (k 1). STEP says why so steep. */
export const leadSeen = (k, share) => (k ? `clamp(0, (var(--sd-t) - ${short(share, 5)}) * ${STEP} + 1, 1)` : `clamp(0, (${short(share, 5)} - var(--sd-t)) * ${STEP} + 1, 1)`);
/** The share of the line a lead's copy draws its trail on: its stretch, and LEAD_CAP px more, under the lead's round cap. */
export const leadSpan = (k, share, length) => (k ? [Math.max(0, share - LEAD_CAP / length), 1] : [0, Math.min(1, share + LEAD_CAP / length)]);

/**
 * How a wire's packets ride, once its line is known: `length` its px; `unseen` the stretches a block hides ([[from,
 * to], …] px along it — the build's record of a cable; none for a wire through the air); `leads` the shares its leads'
 * copies show instead (seenOf). Gives {period, vars, seen, rest}: the seconds of one run (the ride and its rest at the
 * end), the easings as CSS variables, where along it a packet shows, and where it rests when packets do not run (1:
 * the end, or null for the place it rests today). A speed in px a second that would make a run faster than half a second
 * or slower than a minute is refused, naming the speeds this wire takes; on a wire with no length, any.
 */
export function rideOf(o, length, spec, {unseen = [], leads = [null, null]} = {}) {
  const where = `wire data-arrow="${spec}": data-speed=${quoted(o.written ?? '')}`;
  if (o.perSecond && !(length >= 1)) throw new Error(`${where} — this wire is too short for a speed in px a second (${short(length, 1)} px): give it its seconds (data-speed="3")`);
  // the run's seconds are asked of the deck's own range first: a px speed far past any run (a huge or endless number), or
  // one too slow to count, gets the deck's advice — the story library's rideSeconds is asked only of a run that can be,
  // and gives the same number (the same arithmetic: the line, its eased ends, over the speed)
  const ease = o.ride ?? [0, 0], along = length * (1 + ease[0] + ease[1]), asked = o.perSecond ? along / o.perSecond : o.speed;
  const seconds = o.perSecond && asked >= SPEEDS[0] && asked <= SPEEDS[1] ? rideSeconds(length, o.perSecond, ease) : asked;
  if (!(seconds >= SPEEDS[0] && seconds <= SPEEDS[1])) {
    const slowest = Math.ceil((along / SPEEDS[1]) * 10) / 10, fastest = Math.floor((along / SPEEDS[0]) * 10) / 10;
    throw new Error(`${where} — this wire is ${short(length, 0)} px long, so a run would take ${short(seconds, 2)} s, and a run takes ${SPEEDS[0]} to ${SPEEDS[1]} s — give it ${slowest}px to ${fastest}px, or its seconds (data-speed="3")`);
  }
  // a wire whose length overflowed (numbers past what can be measured) has no ride to work out: said, not drawn as noise
  if (!Number.isFinite(length)) throw new Error(`wire data-arrow="${spec}": its length cannot be measured (its numbers are too large) — give it numbers of a slide's size`);
  const hold = o.rest?.hold ?? 0, period = seconds + hold, share = seconds / period, steady = (length * (1 + ease[0] + ease[1])) / seconds;
  const vars = `--sd-ride-ease:${easing(withHold(rideProfile(ease, length), share))};--sd-show-ease:${easing(showStops(share, {end: Boolean(o.rest)}))}`;
  // a packet is gone before its edge reaches the block: its radius more — on the line itself, or, when it keeps its
  // size, its radius over the zoom (--sd-keep), which the browser divides
  const ramps = o.behind ? hiddenRamps(unseen, length, steady, ease, {radius: o.keep ? 0 : RADIUS}) : [];
  const seen = seenOf(ramps, o.keep && ramps.length ? `${short(RADIUS / length, 6)} / var(--sd-keep)` : '', leads);
  return {period: short(period, 3), vars, seen, rest: o.rest ? 1 : null, length};
}

/**
 * A wire's riding packets (rideOf): each a loop of two animations on one clock — sdRide carries --sd-t along the line by
 * the ride's easing, sdShow carries --sd-show, how much of it shows (RIDE_CSS) — and, with a trail, a line before each
 * that draws behind it. Every packet stands at the box's corner and is carried along --sd-way. `d`: the line the trails
 * draw (the wire's line, in the box's px); `seen`: where along it a packet shows (CSS on --sd-t, '' everywhere);
 * `span`: [from, to], the share of the line its trails draw (a lead's copy draws only its own stretch); `restAt`: where
 * it rests when packets do not run (null: deck.css's middle).
 */
export function ridersSvg(o, r, {d, seen = r.seen, span = [0, 1], restAt = r.rest}) {
  const loop = (k) => { const at = short((-k * r.period) / o.packets, 3); return `--loop:sdRide ${r.period}s var(--sd-ride-ease) ${at}s infinite, sdShow ${r.period}s var(--sd-show-ease) ${at}s infinite`; };
  const rests = restAt === null || restAt === undefined ? '' : `--sd-t:${restAt};`, shows = seen ? `--sd-seen:${seen};` : '';
  const stretch = span[0] > 0 || span[1] < 1 ? `--sd-from:${short(span[0], 5)};--sd-to:${short(span[1], 5)};` : '';
  const trails = o.trail ? Array.from({length: o.packets}, (_, k) => `<path class="trail" data-loop d="${d}" pathLength="1" style="stroke:${o.trail.colour};stroke-width:${o.trail.width}px;${stretch}${loop(k)}"/>`).join('') : '';
  return trails + Array.from({length: o.packets}, (_, k) => `<circle class="run" data-loop cx="0" cy="0" r="${RADIUS}" style="${rests}${shows}${loop(k)}"/>`).join('');
}
/** What a wire whose packets ride adds to its SVG's tag: the marks RIDE_CSS reads, its easings — and its line as --sd-way, when `way` (a path's d) is given. */
export const rideMarks = (o, r, way = null) => ({attrs: ` data-sd-ride${o.keep ? ' data-sd-keep' : ''}`, style: `${way === null ? '' : `;--sd-way:path('${way}')`};${r.vars}`});

/**
 * The stylesheet of packets that ride (a wire marked data-sd-ride), which the page carries only when a deck has one —
 * so a deck that asks for no ride option is its page byte for byte. Every rule but the camera's has no weight (:where),
 * so a theme wins.
 *
 * - Every packet rides its wire's own line by length: offset-path --sd-way, --sd-t of the way — a cable's floor line,
 *   a lead's copy the cable's line in the lead's px, a wire through the air its curve (not deck.css's one-handle
 *   formula, whose --sd-t is the curve's parameter, not a share of its length).
 * - sdRide carries --sd-t by --sd-ride-ease (rideProfile, with its rest at the end); sdShow carries --sd-show by
 *   --sd-show-ease (showStops). A packet shows --sd-show times --sd-seen where loops run ([data-deck-loop]); elsewhere —
 *   reduced motion, print, motion off — it rests as deck.css rests one (the first, at its middle or at the end with
 *   data-rest="end", where --sd-seen lets it show; the others hidden), and no trail is drawn.
 * - A trail is its own line drawn from --sd-from up to --sd-t (pathLength 1: a dash as long as the share ridden), never
 *   past --sd-to — a lead's copy draws its own stretch only — and shows as its packet does.
 * - data-keep-size: the packet is scaled by one over the view's zoom (focus.css · .sd-stage: --sd-ts), about its own
 *   middle (the box's corner), before it is carried along the line. While the view moves, --sd-keep moves with it,
 *   from where the view came (--sd-ts0), in the view's own time, delay and easing, so it keeps its size through the move.
 */
export const RIDE_CSS = `/* packets that ride their wire's own line (deck/rides.js · data-ride, data-rest, data-keep-size, data-trail, data-behind) */
@property --sd-show { syntax: '<number>'; inherits: false; initial-value: 1; }
@property --sd-keep { syntax: '<number>'; inherits: false; initial-value: 1; }
@keyframes sdRide { from { --sd-t: 0; } to { --sd-t: 1; } }
@keyframes sdShow { from { --sd-show: 0; } to { --sd-show: 1; } }
@keyframes sdKeep { from { --sd-keep: var(--sd-ts0, var(--sd-ts, 1)); } }
:where(svg.wire[data-sd-ride] .run) { transform: none; offset-path: var(--sd-way); offset-distance: calc(var(--sd-t) * 100%); offset-rotate: 0deg; opacity: var(--sd-seen, 1); }
:where(svg.wire[data-sd-ride] .run + .run) { opacity: 0; }
:where(svg.wire[data-sd-ride] path.trail) { opacity: 0; fill: none; stroke-linecap: butt; stroke-dasharray: calc(max(0, min(var(--sd-t), var(--sd-to, 1)) - var(--sd-from, 0))) 3; stroke-dashoffset: calc(-1 * var(--sd-from, 0)); }
:where([data-deck-loop]) :where(svg.wire[data-sd-ride] .run) { opacity: calc(var(--sd-show) * var(--sd-seen, 1)); }
:where([data-deck-loop]) :where(svg.wire[data-sd-ride] path.trail) { opacity: var(--sd-show); }
:where(svg.wire[data-sd-ride][data-sd-keep] .run) { --sd-keep: var(--sd-ts, 1); transform: scale(calc(1 / var(--sd-keep))); }
:where(.sd-stage.sd-move svg.wire[data-sd-keep] .run) { --sd-keep-time: var(--sd-move-time, 1s); --sd-keep-at: 0s; }
:where(.sd-stage.sd-stage-turn.sd-move svg.wire[data-sd-keep] .run) { --sd-keep-time: var(--sd-stage-time, 1s); --sd-keep-at: var(--sd-stage-delay, 0s); }
:where(.sd-focus-new .sd-stage.sd-stage-turn.sd-move svg.wire[data-sd-keep] .run) { --sd-keep-at: calc(var(--sd-stage-delay, 0s) + .4s); }
@media screen and (prefers-reduced-motion: no-preference) {
  :where([data-deck-active][data-deck-loop]:not([data-sd-instant]):not([data-deck-static])) .sd-stage.sd-move svg.wire[data-sd-keep] .run {
    animation: var(--loop, sdNone 0s), sdKeep var(--sd-keep-time) var(--sd-ease, cubic-bezier(.2, .7, .2, 1)) var(--sd-keep-at) both; }
  :where([data-deck-active]:not([data-deck-loop]):not([data-sd-instant]):not([data-deck-static])) .sd-stage.sd-move svg.wire[data-sd-keep] .run {
    animation: sdKeep var(--sd-keep-time) var(--sd-ease, cubic-bezier(.2, .7, .2, 1)) var(--sd-keep-at) both; }
}`;
