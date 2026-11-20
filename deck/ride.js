// ride — how a packet rides a line: plain numbers in, plain numbers out, nothing drawn.
//
// A wire's running packets (transforms.js · data-packets) ride its line once a run, on one clock. These are the
// numbers of that ride, for any length of line:
//
//   rideProfile(ease, length)        how far along the line a packet is (a share of its length) at each moment of
//                                    the ride (a share of its time): stops [[time, progress], …] to draw straight
//                                    lines between — CSS's linear() easing, or a film's own interpolation
//   rideSeconds(length, speed, ease) the ride's time for a speed in px a second — the steady speed of its middle
//   speedAt(progress, ease)          the speed at a place along the line, as a share of that steady speed
//   withHold(stops, share)           a ride that takes `share` of the run, then rests at the end for the rest of it
//   showStops(share, {end})          how much of the packet shows over a run (0 to 1): in at the start, out before
//                                    the end — or kept at the end, where it rests
//   hiddenRamps(unseen, length, …)   where along the line it fades out before a stretch a block hides, and back
//                                    after it: [[outFrom, outTo, backFrom, backTo], …] as shares of the length
//
// WHY its own file: these are the numbers of a motion, not of a page. A deck turns them into CSS (transforms.js), and a
// film can ride the same packets with the same numbers — the place is the same share of the same line at the same
// moment in both. WHY "ease-ends" is measured along the LENGTH, not the time: a deck says where the packet eases (out of
// the port, into the switch), and a place on the line stays the place whatever the ride's time.
//
// The ease: the packet starts from rest and gathers speed evenly over the first `a` of the line, keeps one steady
// speed, and slows evenly to rest over the last `b` (a, b from 0 to 0.5). Evenly gathered speed covers a stretch in
// twice the time the steady speed would, so the ride takes (1 + a + b) times as long as the line at its steady speed.

/** Px a stop may stand off the true ease, at most: under a pixel, so no one sees the corners of the stops. */
const TOLERANCE = 0.5;
const MOST_STOPS = 32;   // stops for one eased end, at most: within TOLERANCE for half of any line up to 4096 px (a slide is 1920)
const SHOW = {in: 0.12, out: 0.15};   // the share of a ride a packet takes to fade in at its start and out before its end (deck.css · sdRun)

/** The ride's time, in seconds: a line `length` px long at `speed` px a second, its steady speed, with its ends eased [a, b]. */
export const rideSeconds = (length, speed, [a, b] = [0, 0]) => (length * (1 + a + b)) / speed;

/** The speed at `progress` (a share of the line, 0 to 1), as a share of the steady speed: gathered evenly from rest over the first `a`, shed evenly over the last `b`. */
export function speedAt(progress, [a, b] = [0, 0]) {
  if (a > 0 && progress < a) return Math.sqrt(Math.max(0, progress) / a);
  if (b > 0 && progress > 1 - b) return Math.sqrt(Math.max(0, 1 - progress) / b);
  return 1;
}

/**
 * Where the packet is over its ride: [[time, progress], …] from [0, 0] to [1, 1], each a share (of the ride's time, of
 * the line's length), straight between stops. [a, b]: the eased shares of the line at its start and its end; with
 * neither, the two stops of a steady ride. `length`: the line's length in px — an eased end gets as many stops as
 * keep it within TOLERANCE px of the true curve there (a straight stretch is never off it), and at least two.
 */
export function rideProfile([a, b] = [0, 0], length = 0) {
  if (!(a > 0) && !(b > 0)) return [[0, 0], [1, 1]];
  const whole = 1 + a + b, ta = (2 * a) / whole, tb = (2 * b) / whole;   // the time each eased end takes, as a share of the ride
  // a parabola cut into n straight pieces strays at most (its stretch) / (4·n²) off it
  const pieces = (share) => Math.min(MOST_STOPS, Math.max(2, Math.ceil(Math.sqrt((share * length) / (4 * TOLERANCE)))));
  const stops = [[0, 0]];
  if (a > 0) { const n = pieces(a); for (let i = 1; i <= n; i++) stops.push([(ta * i) / n, a * (i / n) ** 2]); }
  if (b > 0) {
    const n = pieces(b);
    if (stops.at(-1)[0] < 1 - tb) stops.push([1 - tb, 1 - b]);   // the steady stretch: one straight line
    for (let i = n - 1; i >= 0; i--) stops.push([1 - (tb * i) / n, 1 - b * (i / n) ** 2]);
  } else stops.push([1, 1]);
  return stops;
}

/** A ride's stops (rideProfile) when the ride takes only `share` of the run (0 to 1): the packet then rests at the end. */
export const withHold = (stops, share) => (share >= 1 ? stops : [...stops.map(([t, p]) => [t * share, p]), [1, 1]]);

/**
 * How much of the packet shows over a run: [[time, shown], …], `shown` 0 to 1, straight between. `share`: the share of
 * the run the ride takes (the rest it rests at the end); `end`: it stays at the end when it arrives. Without either it
 * is today's: in over the first 12% of the ride, out over its last 15%.
 */
export function showStops(share = 1, {end = false} = {}) {
  const shown = [[0, 0], [SHOW.in * share, 1]];
  return end ? [...shown, [1, 1]] : [...shown, [1 - SHOW.out, 1], [1, 0]];
}

/**
 * Where a packet fades out before each stretch a block hides and comes back after it: [[outFrom, outTo, backFrom,
 * backTo], …], shares of the line. `unseen`: the stretches, [[from, to], …] in px along the line (the build's record of a
 * cable); `length`: the line's px; `speed`: its steady px a second; `ease`: [a, b] (speedAt). Each fade takes `frames`
 * frames at `fps` — about three, the least a fade is seen as one and not as a jump — at the speed the packet has at
 * that edge, and never less than `least` px. It is gone by the edge and comes back from the far edge, so it never shows
 * cut by the block, and comes out on the same line it went in on. A stretch at the line's start has no fade out, one at
 * its end no fade back; a stretch with no length is no stretch.
 */
export function hiddenRamps(unseen, length, speed, ease = [0, 0], {frames = 3, fps = 60, least = 2} = {}) {
  if (!(length > 0)) return [];
  const fade = (at) => Math.max(least, (speed * speedAt(at / length, ease) * frames) / fps);
  return unseen
    .map(([lo, hi]) => [Math.max(0, lo), Math.min(length, hi)])
    .filter(([lo, hi]) => hi > lo)
    .map(([lo, hi]) => [lo > 0 ? Math.max(0, lo - fade(lo)) / length : 0, lo / length, hi / length, hi < length ? Math.min(length, hi + fade(hi)) / length : 1]);
}
