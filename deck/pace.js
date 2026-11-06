// pace — how a part's pieces arrive and leave. A click's new pieces grow in and the ones it takes out fade away, on the
// library's own timing. A part may ask for its own, so a deck never reaches into the library's animation variables:
//
//   <section data-label="The turn" data-map="map" data-arrive="fade" data-arrive-time="0.9" data-arrive-delay="0.5" data-leave-time="0.5">
//
//   data-arrive        grow (the default: fades in, growing a little) or fade (fades in where it stands)
//   data-arrive-time   how long a piece takes to arrive, in seconds
//   data-arrive-delay  how long it waits first, in seconds: longer than the leave time, and the old piece is gone before the new one comes
//   data-leave-time    how long a piece takes to leave, in seconds
//
// `data-enter` is how the slide itself arrives; this is how the pieces on it do. It keeps the rules of every arrival: it
// plays only on a forward step, and a jump, a step back, reduced motion and print land at once. The page carries the CSS
// only when a part asks, so any other deck is byte for byte as before.
import {readAttributes} from '../pieceRules.js';
import {esc} from './html.js';

const NAMES = ['data-arrive', 'data-arrive-time', 'data-arrive-delay', 'data-leave-time'];
const PACE_NAME = /^data-(arrive|leave)(-|$)/;
const KINDS = ['grow', 'fade'];
/** The longest a piece may take or wait: past it a click looks stuck. */
export const PACE_MOST = 10;
/** The shortest a piece may take: anything less is a cut, which a deck gets from reduced motion or a jump, not from a number. */
export const PACE_LEAST = .05;

/** The attributes that ask for a pace, misspelt ones too, so a slip is refused and never quietly plays the defaults. */
const named = (attrs) => (readAttributes(attrs) ?? []).filter((a) => PACE_NAME.test(a.name));

function seconds(value, name, least, where) {
  const text = value.trim(), n = Number(text);
  if (!text || !Number.isFinite(n) || n < least || n > PACE_MOST) throw new Error(`${where}: ${name}=${JSON.stringify(value)} — it is a time in seconds, from ${least} to ${PACE_MOST}`);
  return n;
}

/** A part's pace from its attributes, checked, each refusal naming the fix: {arrive?, arriveTime?, arriveDelay?, leaveTime?}, or null when it asks for none. */
export function readPace(attrs, where) {
  const given = named(attrs);
  if (!given.length) return null;
  const other = given.find((a) => !NAMES.includes(a.name));
  if (other) throw new Error(`${where}: ${other.name} is not a way to set how pieces arrive or leave — the attributes are ${NAMES.join(', ')}`);
  const of = (name) => given.find((a) => a.name === name)?.value ?? null;
  const arrive = of('data-arrive')?.trim().toLowerCase() ?? null;
  if (arrive !== null && !KINDS.includes(arrive)) throw new Error(`${where}: data-arrive=${JSON.stringify(of('data-arrive'))} — a piece arrives by ${KINDS.join(' or ')}`);
  const time = of('data-arrive-time'), delay = of('data-arrive-delay'), leave = of('data-leave-time');
  return {...(arrive === null ? {} : {arrive}), ...(time === null ? {} : {arriveTime: seconds(time, 'data-arrive-time', PACE_LEAST, where)}),
    ...(delay === null ? {} : {arriveDelay: seconds(delay, 'data-arrive-delay', 0, where)}), ...(leave === null ? {} : {leaveTime: seconds(leave, 'data-leave-time', PACE_LEAST, where)})};
}

/** A <step> cannot set a pace: a part does. Refuses one that tries, naming where it goes. */
export function refuseStepPace(attrs, where) {
  if (named(attrs).length) throw new Error(`${where}: a <step> cannot set how pieces arrive or leave — put ${named(attrs)[0].name} on its <section>: a part sets it for all of its clicks`);
}

/** What a part's pace puts on each of its slides: a marker and the values, as variables only the page's PACE_CSS reads. */
export function paceAttrs(pace) {
  if (!pace) return '';
  const vars = [...(pace.arrive === 'fade' ? ['--sd-arrive-with:sdArrive'] : []), ...(pace.arriveTime === undefined ? [] : [`--sd-arrive-time:${pace.arriveTime}s`]),
    ...(pace.arriveDelay === undefined ? [] : [`--sd-arrive-delay:${pace.arriveDelay}s`]), ...(pace.leaveTime === undefined ? [] : [`--sd-leave-time:${pace.leaveTime}s`])];
  return ` data-sd-pace${vars.length ? ` style="${esc(vars.join(';'))}"` : ''}`;
}

const EASE = 'var(--sd-ease, cubic-bezier(.2, .7, .2, 1))', TAKES = 'var(--sd-arrive-time, .6s)', WAITS = 'var(--sd-arrive-delay, 0s)', GOES = 'var(--sd-leave-time, .45s)';
/**
 * The same arrivals and leavings as focus.css, with the part's values in their places, each rule as weak as the one it
 * stands for, so a deck's own rule for a piece still wins. It fills the same slots, so the same gate decides whether anything plays.
 */
export const PACE_CSS = `/* how a part's pieces arrive and leave (deck/pace.js) */
@media screen and (prefers-reduced-motion: no-preference) {
  :where([data-sd-pace]) .sd-enter { --sd-a-state: var(--sd-arrive-with, sdEnter) ${TAKES} ${EASE} calc(var(--sd-delay, 0s) + ${WAITS}) both; }
  :where([data-sd-pace]) .sd-arrive { --sd-a-state: sdArrive ${TAKES} ease ${WAITS} both; }
  :where([data-sd-pace]) .sd-leave { --sd-a-state: sdLeave ${GOES} ease both; }
  :where([data-sd-pace]) .sd-path.sd-enter { --sd-a-state: var(--sd-arrive-with, sdEnter) ${TAKES} ${EASE} calc(var(--sd-turn) + ${WAITS}) both; }
  :where([data-sd-pace]) .sd-path.sd-arrive { --sd-a-state: sdArrive ${TAKES} ease calc(var(--sd-turn) + ${WAITS}) both; }
  :where([data-sd-pace]) .sd-twin-turn.sd-leave { --sd-a-state: sdLeave ${GOES} ease calc(var(--sd-turn) + var(--sd-twin-lag, 0s)) both; }
  :where([data-sd-pace] svg.wire.sd-enter:not(.sd-hot, .sd-hot-in)) { --sd-a-more: sdReveal ${TAKES} cubic-bezier(.4, 0, .2, 1) calc(var(--sd-delay, 0s) + ${WAITS}) both; }
  :where([data-sd-pace] svg.wire.sd-path.sd-enter:not(.sd-hot, .sd-hot-in)) { --sd-a-more: sdReveal ${TAKES} cubic-bezier(.4, 0, .2, 1) calc(var(--sd-turn, 0s) + ${WAITS}) both; }
}`;
