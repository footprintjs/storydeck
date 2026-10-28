// loops — what loops on a deck's slides, and the named loops drawn as CSS. A loop is deck-stage's (deck-stage.js
// USAGE (i)): an element with data-loop runs its --loop on the slide shown, on one clock for the whole deck, and rests
// in its own style under reduced motion, in print and with motion off. Pure: strings in, strings out.
//
//   <div data-k="db" data-loop="pulse" …>        a loop from the shared table (footprint-story/motion, kind "ambient")
//   <div data-k="db" data-loop="float 4s" …>     the same, at its own pace
//   <div data-k="gear" data-loop …>              the deck's own: theme.css gives it --loop (.gear { --loop: spin 4s linear infinite })
//
// Only the loops a deck names are drawn into its page, each once.
import {moveAt, movesBy, readMove} from 'footprint-story/motion';
import {readAttributes, tagsWith} from '../pieceRules.js';

/** The named loops, in the table's order: its endless moves. */
export const LOOP_NAMES = Object.freeze(movesBy({kind: 'ambient'}).map((m) => m.name));
/** How long one cycle of a named loop may be, in seconds. */
export const LOOP_SECONDS = Object.freeze([0.2, 60]);
const STEPS = 24;   // straight lines a cycle: a wave drawn with 24 is within 1% of its swing (float: under 0.1 px)
const FORM = /^([a-z][a-z-]*)(?: (\d+(?:\.\d+)?)s)?$/;

/** A data-loop value read: null for the deck's own (a bare data-loop), or {name, seconds}; refused naming the loops. */
export function readLoop(value, where) {
  if (value === '') return null;
  const m = FORM.exec(value);
  if (!m || !LOOP_NAMES.includes(m[1])) {
    throw new Error(`${where}: data-loop="${value}" is not a loop — name one of ${LOOP_NAMES.join(', ')}, with its seconds if you like ("float 4s"), or write data-loop alone and give the piece its own --loop in theme.css`);
  }
  const seconds = m[2] === undefined ? readMove(m[1]).seconds : Number(m[2]);
  if (!(seconds >= LOOP_SECONDS[0] && seconds <= LOOP_SECONDS[1])) {
    throw new Error(`${where}: data-loop="${value}" — a cycle lasts ${LOOP_SECONDS[0]} to ${LOOP_SECONDS[1]} s`);
  }
  return {name: m[1], seconds};
}

/**
 * Every data-loop in `html`, in order, checked: [{piece, value, styled?}] — `piece` the element's first data-k name (null
 * for an element that is not a piece), `value` as written ('' for the deck's own; `styled` when its own style sets
 * --loop). One pass; each tag read as a browser reads it (the first of two data-loop attributes counts). Refused: a tag a
 * browser would read past its ">" (a quote never closed before it), and a named loop on an element with a transform of
 * its own in its tag — the loop moves it by its transform, so it would replace that one.
 */
export function loopsIn(html, where) {
  const out = [];
  for (const t of tagsWith(html, /\sdata-loop(?![\w-])/i)) {
    const attrs = readAttributes(t.before + t.m[0] + t.after);
    if (!attrs) throw new Error(`${where}: <${t.tag}> with data-loop holds a quote never closed before its ">" — write a ">" inside a value as &gt;`);
    const loop = attrs.find((a) => a.name === 'data-loop');
    if (!loop) continue;
    const k = attrs.find((a) => a.name === 'data-k')?.value.trim().split(/\s+/)[0] || null, at = k ? `${where}, piece "${k}"` : where;
    readLoop(loop.value, at);
    const style = attrs.find((a) => a.name === 'style')?.value ?? '';
    if (loop.value !== '' && (attrs.some((a) => a.name === 'transform') || /(?:^|;)\s*transform\s*:/i.test(style))) {
      throw new Error(`${at}: data-loop="${loop.value}" moves the element by its transform, which would replace the one it has — put data-loop on an element inside it`);
    }
    const styled = loop.value === '' && /(?:^|;)\s*--loop\s*:/.test(style);
    out.push({piece: k, value: loop.value, ...(styled ? {styled} : {})});
  }
  return out;
}

const r4 = (v) => +(+v).toFixed(4) + 0;   // (+ 0: never −0)
const TRANSFORM = ['x', 'y', 'rotate', 'scale'];

/**
 * One moment of a move (moveAt's values) as CSS declarations: only what the move animates (`props`, the move's own), so a
 * loop never resets the rest — a greyed piece stays grey. x, y, rotate and scale are one transform; opacity; blur.
 */
export function frameCss(v, props) {
  const out = [];
  if (TRANSFORM.some((p) => p in props)) {
    const parts = [];
    if ('x' in props || 'y' in props) parts.push(`translate(${r4(v.x)}px, ${r4(v.y)}px)`);
    if ('rotate' in props) parts.push(`rotate(${r4(v.rotate)}deg)`);
    if ('scale' in props) parts.push(`scale(${r4(v.scale)})`);
    out.push(`transform: ${parts.join(' ')}`);
  }
  if ('opacity' in props) out.push(`opacity: ${r4(v.opacity)}`);
  if ('blur' in props) out.push(`filter: blur(${r4(v.blur)}px)`);
  return out.join('; ');
}

/** A named loop's keyframes: one cycle, sampled from the shared move (the same curve a film draws). */
function keyframes(name) {
  const m = readMove(name), at = (i) => moveAt(m, (i / STEPS) * m.seconds * (1 - 1e-9), {seconds: m.seconds});
  const frames = Array.from({length: STEPS + 1}, (_, i) => `${r4((i / STEPS) * 100)}% { ${frameCss(at(i), m.props)}; }`);
  return `@keyframes sd-loop-${name} { ${frames.join(' ')} }`;
}

/**
 * The CSS for the named loops `values` (data-loop values as written; the deck's own are skipped): keyframes once per name,
 * and a shape inside a drawing (an SVG element) turned and swelled about its own middle, as a box is.
 */
export function loopCss(values) {
  const named = [...new Set(values)].filter((v) => v !== '').sort(), names = new Set();
  if (!named.length) return '';
  const rules = named.map((v) => {
    const {name, seconds} = readLoop(v, 'loopCss');
    names.add(name);
    return `:where([data-loop="${v}"]) { --loop: sd-loop-${name} ${r4(seconds)}s linear infinite; }`;
  });
  const shapes = ':where(svg [data-loop]:not([data-loop=""])) { transform-box: fill-box; transform-origin: center; }';
  return [...[...names].map(keyframes), ...rules, shapes].join('\n');
}
