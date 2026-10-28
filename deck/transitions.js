// transitions — how a part of the deck arrives: the editor's changes of picture StoryReel's films use
// (footprint-story/motion · TRANSITIONS), played between two slides. Written on the part's <section>:
//
//   <section data-label="2 · Storage" data-enter="push" data-enter-from="right">     its settings as data-enter-*
//   <section … data-enter="iris" data-enter-at="960 540" data-enter-seconds="1">      a point is "x y" in slide px
//
// The build reads each one against the shared table (its settings, their defaults, its length and ease) and samples it
// into keyframes for both slides (transitionKeyframes: percentages, so they fit the slide at any scale; the same
// curves a film draws). The page plays them only on a forward step into the part — a jump, a step back, reduced
// motion and motion off land at once — and a video steps them like any animation. A page plays cut, fade, dip, wipe,
// split, iris, push, slide, whip and zoom; the others need a canvas and are refused, naming those.
import {easeNamed, readTransition} from 'footprint-story/motion';

/** The changes of picture a page can play; the shared table's others (clock, page, through, match) need a canvas. */
export const CSS_TRANSITIONS = Object.freeze(['cut', 'fade', 'dip', 'wipe', 'split', 'iris', 'push', 'slide', 'whip', 'zoom']);
const FPS = 30;   // samples a second, played linearly between: a 0.8 s change is 25 of them

const r4 = (v) => +(+v).toFixed(4) + 0;   // (+ 0: never −0)
const pct = (v) => `${r4(v * 100)}%`;
const UNIT = {left: [-1, 0], right: [1, 0], top: [0, -1], bottom: [0, 1]};
const REST = {opacity: 1, transform: 'translate(0%, 0%) scale(1)', filter: 'blur(0px)'};
/** How far a circle's radius in CSS's percentage reaches: a percentage of √(w² + h²) / √2. */
const IRIS_UNIT = Math.SQRT1_2;

/** Both pictures at e (0..1, eased) for one change: [leaving, arriving] as CSS. */
function framesAt(type, p, e, [w, h]) {
  const keep = {...REST};
  if (type === 'fade') return [keep, {...REST, opacity: r4(e)}];
  if (type === 'dip') return [{...REST, opacity: r4(Math.max(0, 1 - 2 * e))}, {...REST, opacity: r4(Math.max(0, 2 * e - 1))}];
  if (type === 'wipe') {
    const hidden = pct(1 - e), from = p.from;
    const inset = from === 'left' ? `inset(0% ${hidden} 0% 0%)` : from === 'right' ? `inset(0% 0% 0% ${hidden})` : from === 'top' ? `inset(0% 0% ${hidden} 0%)` : `inset(${hidden} 0% 0% 0%)`;
    return [keep, {...REST, clipPath: inset}];
  }
  if (type === 'split') {
    const half = pct((1 - e) / 2);
    return [keep, {...REST, clipPath: p.line === 'horizontal' ? `inset(${half} 0% ${half} 0%)` : `inset(0% ${half} 0% ${half})`}];
  }
  if (type === 'iris') {
    const [x, y] = p.at, far = Math.max(...[[0, 0], [w, 0], [0, h], [w, h]].map(([cx, cy]) => Math.hypot(cx - x, cy - y)));
    return [keep, {...REST, clipPath: `circle(${pct((e * far) / (Math.hypot(w, h) * IRIS_UNIT))} at ${pct(x / w)} ${pct(y / h)})`}];
  }
  if (type === 'push' || type === 'whip') {
    const [dx, dy] = UNIT[p.from], blur = type === 'whip' ? `blur(${r4(4 * e * (1 - e) * 0.02 * w)}px)` : 'blur(0px)';
    return [{...REST, transform: `translate(${pct(-dx * e)}, ${pct(-dy * e)}) scale(1)`, filter: blur}, {...REST, transform: `translate(${pct(dx * (1 - e))}, ${pct(dy * (1 - e))}) scale(1)`, filter: blur}];
  }
  if (type === 'slide') {
    const [dx, dy] = UNIT[p.from];
    return [keep, {...REST, transform: `translate(${pct(dx * (1 - e))}, ${pct(dy * (1 - e))}) scale(1)`}];
  }
  // zoom: the old picture rushes forward and fades over the new one, which settles from a little larger
  const origin = `${pct(p.at[0] / w)} ${pct(p.at[1] / h)}`;
  return [{...REST, opacity: r4(1 - e), transform: `translate(0%, 0%) scale(${r4(1 + 0.6 * e)})`, transformOrigin: origin},
    {...REST, transform: `translate(0%, 0%) scale(${r4(1 + 0.25 * (1 - e))})`, transformOrigin: origin}];
}
/** Which picture is drawn over the other while the change runs. */
const ON_TOP = {fade: 'arriving', dip: 'arriving', wipe: 'arriving', split: 'arriving', iris: 'arriving', push: 'arriving', whip: 'arriving', slide: 'arriving', zoom: 'leaving', cut: 'arriving'};

/**
 * A change of picture as keyframes for both slides: {type, seconds, on ('leaving' | 'arriving': the one drawn over),
 * backdrop (a dip's colour), leaving, arriving, options} — `t` as readTransition reads it, `frame` the slide's size.
 */
export function transitionKeyframes(t, frame) {
  if (t.type === 'cut') return {type: 'cut', seconds: 0, on: 'arriving', backdrop: null, leaving: [], arriving: [], options: {duration: 0, easing: 'linear', fill: 'both'}};
  const ease = easeNamed(t.ease, `${t.type}: ease`), steps = Math.max(2, Math.ceil(t.seconds * FPS)), leaving = [], arriving = [];
  for (let i = 0; i <= steps; i++) {
    const [a, b] = framesAt(t.type, t.p, ease(i / steps), frame), offset = r4(i / steps);
    leaving.push({offset, ...a});
    arriving.push({offset, ...b});
  }
  return {type: t.type, seconds: t.seconds, on: ON_TOP[t.type], backdrop: t.type === 'dip' ? t.p.color : null, leaving, arriving,
    options: {duration: r4(t.seconds * 1000), easing: 'linear', fill: 'both'}};
}

/**
 * A part's entrance as written — {type, given: {setting: text}} from data-enter and data-enter-* — read against the
 * shared table: {type, seconds, ease, p}, or null for none. Its settings are its own (a push's from), plus seconds and
 * ease; a point is "x y" in slide px (or "centre"). Refused, naming the fix: a change a page cannot play, a setting
 * it does not take, a value out of its range.
 */
export function readEnter(enter, where, {frame = [1920, 1080]} = {}) {
  if (!enter) return null;
  const who = `${where}: data-enter="${enter.type}"`;
  if (!CSS_TRANSITIONS.includes(enter.type)) {
    let known = true;
    try { readTransition(enter.type, who); } catch { known = false; }
    throw new Error(`${who} — ${known ? 'a page cannot play it (it needs a canvas, as StoryReel draws it); ' : ''}a part arrives by ${CSS_TRANSITIONS.join(', ')}`);
  }
  const params = readTransition(enter.type, who, {frame}).p, out = {type: enter.type};
  for (const [name, text] of Object.entries(enter.given)) {
    if (name !== 'seconds' && name !== 'ease' && !Object.hasOwn(params, name)) {
      const takes = ['seconds', 'ease', ...Object.keys(params)].map((k) => `data-enter-${k}`).join(', ');
      throw new Error(`${who} takes ${takes} — not data-enter-${name}`);
    }
    const point = Array.isArray(params[name]), centre = point && text.trim() === 'centre';
    const value = name === 'seconds' ? Number(text) : centre ? [frame[0] / 2, frame[1] / 2] : point ? text.trim().split(/[\s,]+/).map(Number) : text.trim();
    if (name === 'seconds' && !Number.isFinite(value)) throw new Error(`${who}: data-enter-seconds is a number of seconds, not "${text}"`);
    if (point && !centre && (value.length !== 2 || value.some((n) => !Number.isFinite(n)))) throw new Error(`${who}: data-enter-${name} is a point, "x y" in slide px (or "centre"), not "${text}"`);
    out[name] = value;
  }
  const t = readTransition(out, who, {frame});
  return {type: t.type, seconds: t.seconds, ease: t.ease, p: t.p};
}

/** A part's entrance in words, for review: "push from right, 0.7 s" ("cut, at once"). */
export const enterText = (t) => `${t.type}${Object.entries(t.p).map(([k, v]) => ` ${k} ${Array.isArray(v) ? v.join(' ') : v}`).join('')}, ${t.type === 'cut' ? 'at once' : `${t.seconds} s`}`;

/**
 * What the page carries for the entrances its slides make: {kinds: {key: keyframes}, enter: [key or null, per slide]}
 * — each distinct change sampled once — or null when no slide makes one.
 */
export function transitionTable(enters, frame) {
  if (!enters.some(Boolean)) return null;
  const kinds = {}, enter = enters.map((t) => {
    if (!t) return null;
    const key = JSON.stringify([t.type, t.seconds, t.ease, t.p]);
    kinds[key] ??= transitionKeyframes(t, frame);
    return key;
  });
  return {kinds, enter};
}

/** The data the page carries, safe inside its <script> tag. */
export const transitionData = (table) => `<script type="application/json" id="deck-transitions">${JSON.stringify(table).replace(/</g, '\\u003c')}</script>`;

/** The slide a change leaves, kept in view while it runs — in the page only when the deck has changes. */
export const TRANSITION_CSS = 'deck-stage > [data-sd-leaving] { visibility: visible; opacity: 1; }';

/**
 * Runs in the page: on a forward step onto a slide that makes an entrance (a step over skipped slides is still one),
 * plays its change — the slide it leaves kept in view as it rests (its loops still running) and animated out, the one
 * it arrives at animated in, the one drawn over on top, a dip's colour behind both, the frame clipping both — and puts
 * everything back when it ends, when printing starts, or when the next change of slide comes. Never on a jump, a step
 * back or an arrival that lands at once (data-deck-static), nor under reduced motion or with motion off. Web
 * Animations, so a video's frame stepper steps it like any animation.
 */
export function transitionRuntime() {
  const stage = document.querySelector('deck-stage'), data = document.getElementById('deck-transitions');
  if (!stage || !data) return;
  const {kinds, enter} = JSON.parse(data.textContent);
  let playing = null;
  const settle = () => {
    if (!playing) return;
    const p = playing;
    playing = null;
    p.anims.forEach((a) => a.cancel());
    p.leaving.removeAttribute('data-sd-leaving');
    if (p.looped && !p.leaving.hasAttribute('data-deck-active') && !p.leaving.hasAttribute('data-deck-under')) p.leaving.removeAttribute('data-deck-loop');
    p.leaving.style.zIndex = p.z[0];
    p.arriving.style.zIndex = p.z[1];
    if (p.bg !== null) stage.style.setProperty('--deck-canvas', p.bg);
    stage.removeAttribute('data-deck-changing');
  };
  const calm = () => !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || stage.getAttribute('data-motion') === 'off';
  window.addEventListener('beforeprint', settle);   // a page prints as it rests
  stage.addEventListener('slidechange', (e) => {
    const {index, previousIndex, slide, previousSlide} = e.detail;
    if (index === previousIndex) return;   // the stage saying again where it is (its slides re-read): nothing moved
    settle();
    const t = kinds[enter[index]];
    if (!t || t.type === 'cut' || !slide || !previousSlide || index < previousIndex || calm() || slide.hasAttribute('data-deck-static')) return;
    const all = [...stage.children].filter((s) => s.tagName === 'SECTION');
    if (!all.slice(previousIndex + 1, index).every((s) => s.hasAttribute('data-deck-skip')) || typeof slide.animate !== 'function') return;
    const over = t.on === 'leaving';
    const p = {anims: [], leaving: previousSlide, arriving: slide, z: [previousSlide.style.zIndex, slide.style.zIndex],
      bg: t.backdrop ? stage.style.getPropertyValue('--deck-canvas') : null, looped: false};
    previousSlide.setAttribute('data-sd-leaving', '');
    // its loops run on while it leaves, when loops run at all (the stage marks the arriving slide so): one clock, so
    // they go on in step
    if (slide.hasAttribute('data-deck-loop') && !previousSlide.hasAttribute('data-deck-loop')) { previousSlide.setAttribute('data-deck-loop', ''); p.looped = true; }
    previousSlide.style.zIndex = over ? '2' : '1';
    slide.style.zIndex = over ? '1' : '2';
    if (t.backdrop) stage.style.setProperty('--deck-canvas', t.backdrop);   // deck-stage paints its canvas with it, behind both slides
    stage.setAttribute('data-deck-changing', '');                          // and keeps both inside its frame
    p.anims = [previousSlide.animate(t.leaving, t.options), slide.animate(t.arriving, t.options)];
    playing = p;
    // ended, or cancelled by someone else (a frame stepper): either way, put everything back
    const done = () => { if (playing === p) settle(); };
    p.anims[1].finished.then(done, done);
  });
}
