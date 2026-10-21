// focusHtml — a focus plan (focus.js) written into slide HTML, for decks built as HTML strings.
//
//   const {html, pieces} = readPieces(mapHtml);          // every element with data-k="name …" is a piece
//   const {looks} = planFocus(steps, {pieces, area});      // one look per click
//   looks.map(look => `<section class="${slideClass(look)}">`
//     + `<div class="map">${wrapStage(drawFocus(html, look), look)}</div>`   // the stage goes inside the map's box…
//     + focusOverlay(look, {area}) + '</section>');                           // …the blur outside it, in slide px
//
// Pieces are read from their inline style (left/top/width/height in px, or 0; an <svg>'s width/height
// attributes too): a piece without left/top keeps its place whatever the strategy, and one without a
// size moves by its top-left corner. data-twin="name …" makes a piece step aside while its twin is lit (on a
// path, at that twin's turn).
// focus.css draws the classes; call focusRuntime() once in the page, so only a forward click animates.

import {attrRule as ATTR, pieceTags, styleLength, tagsWith} from './pieceRules.js';

/** An attribute's value in a run of attributes, single or double quoted, or null. */
const attrOf = (at, name) => ATTR(name).exec(at)?.[2] ?? null;
/** A run of attributes with `add` joined to attribute `name` (by `sep`), keeping its quotes; added when absent. */
function joinAttr(at, name, add, sep) {
  if (!add) return at;
  return ATTR(name).test(at) ? at.replace(ATTR(name), (_, q, v) => ` ${name}=${q}${v ? v.replace(sep === ';' ? /;\s*$/ : /\s+$/, '') + sep : ''}${add}${q}`) : `${at} ${name}="${add}"`;
}

/** A CSS length in px (or a bare 0) from an inline style, or null. */
const px = (style, prop) => styleLength(style, prop)?.value ?? null;

/**
 * The pieces of a slide: every element carrying `attr` (data-k) — its names, its box when its inline style
 * places it, its twin. Returns {html, pieces}: the same HTML with each piece numbered (data-sd-i), and the
 * pieces in order. Which tags are pieces is pieceRules.js · pieceTags, read in one pass.
 */
export function readPieces(html, {attr = 'data-k'} = {}) {
  const pieces = [];
  let out = '', from = 0;
  for (const {start, end, tag, before, quote: q, value: k, after} of pieceTags(html, attr)) {
    const at = before + after, style = attrOf(at, 'style') ?? '';
    const attrPx = name => { const v = attrOf(at, name); return v !== null && /^[\d.]+$/.test(v) ? Number(v) : null; };
    const x = px(style, 'left'), y = px(style, 'top'), w = px(style, 'width') ?? attrPx('width'), h = px(style, 'height') ?? attrPx('height');
    const twin = attrOf(at, 'data-twin')?.trim().split(/\s+/);
    pieces.push({keys: k.trim().split(/\s+/), box: x === null || y === null ? null : {x, y, w: w ?? 0, h: h ?? 0}, ...(twin ? {twin} : {})});
    out += `${html.slice(from, start)}<${tag}${before} ${attr}=${q}${k}${q} data-sd-i="${pieces.length - 1}"${after}>`;
    from = end;
  }
  return {html: out + html.slice(from), pieces};
}

/**
 * A click written as attributes on an element (a <step>): data-in, data-out, data-on, data-hot, data-quiet,
 * data-focus (the strategies) and data-focus-* (their options, camelCased: data-focus-aside-by → asideBy).
 */
export function readStep(attrs) {
  const list = name => { const v = attrOf(attrs, `data-${name}`); return v === null ? null : v.trim().split(/\s+/).filter(Boolean); };
  const focus = attrOf(attrs, 'data-focus') ?? '';
  if (/^[\d\s.,-]+$/.test(focus.trim()) && focus.trim()) throw new Error(`data-focus names strategies ("blur"), not a rectangle: put "${focus.trim()}" in data-focus-rect`);
  const options = {};
  for (const m of attrs.matchAll(/\sdata-focus-([\w-]+)=(["'])(.*?)\2/g)) options[m[1].replace(/-(\w)/g, (_, c) => c.toUpperCase())] = m[3];
  return {in: list('in') ?? [], out: list('out') ?? [], on: list('on'), hot: list('hot') ?? [], quiet: /\sdata-quiet(?![\w-])/.test(attrs), focus, options};
}

/**
 * The classes, style and attributes a piece gets for its look. A piece that goes by its group's spring (apart) is
 * marked `sd-apart` instead of `sd-move` — focusRuntime moves it, from `from` to `move` — and carries its group as
 * data-sd-apart="index to was stagger names…" (its place in the look's apart, where it goes and where it was, the
 * ms between two groups setting off, and the group's names, which say it is the same group on the next click).
 */
function pieceLook(p, look) {
  const cls = ['sd', `sd-${p.state}`];
  // A greyed piece, and one leaving from grey, show their look (a leaving piece fades out from how it looked).
  if (p.state === 'dim' || (p.change === 'leave' && p.was === 'dim')) { if (p.state !== 'dim') cls.push('sd-dim'); if (p.look && p.look !== 'grey') cls.push(`sd-${p.look}`); }
  if (p.change) cls.push(`sd-${p.change}`);
  if (p.fromLook) cls.push(`sd-from-${p.fromLook}`);
  if (p.hot) cls.push('sd-hot');
  if (p.hotIn) cls.push('sd-hot-in');
  if (p.twinOff) cls.push('sd-twin-off');
  const onPath = p.path !== null && p.path !== undefined, twinTurn = p.twinTurn !== null && p.twinTurn !== undefined;
  if (twinTurn) cls.push('sd-twin-turn');   // it steps aside at its lit twin's turn on the route
  if (onPath) cls.push('sd-path');
  const vars = [], spring = p.apart !== null && p.apart !== undefined;
  if (p.move) { cls.push('sd-moved'); vars.push(`--sd-dx:${p.move.dx}px`, `--sd-dy:${p.move.dy}px`, `--sd-s:${p.move.s}`); }
  if (spring) cls.push('sd-apart');
  if (p.from) { if (!spring) cls.push('sd-move'); vars.push(`--sd-dx0:${p.from.dx}px`, `--sd-dy0:${p.from.dy}px`, `--sd-s0:${p.from.s}`); }
  if (onPath || twinTurn) vars.push(`--sd-path-delay:${onPath ? p.path : p.twinTurn}s`);   // its moment on the route: its turn, or its twin's
  // The point it scales around, inline, so no stylesheet's transform-origin can move it off the planned place.
  const ref = p.move ?? p.from;
  if (ref) { if (ref.origin === 'top-left') cls.push('sd-origin-tl'); vars.push(`transform-origin:${ref.origin === 'top-left' ? '0 0' : '50% 50%'}`); }
  const g = spring ? look.apart?.groups[p.apart] : null;
  if (spring && !g) throw new Error(`piece look names apart group ${p.apart}, which the look's apart does not have (draw a look as focusStep gave it)`);
  const attrs = g ? ` data-sd-apart="${p.apart} ${g.to} ${g.was} ${look.apart.stagger} ${esc(g.names.join(' '))}"` : '';
  return {cls: cls.join(' '), style: vars.join(';'), attrs};
}

/** The slide HTML (as readPieces returned it) with each piece dressed for this click's look. */
export function drawFocus(html, look) {
  let out = '', from = 0;
  for (const {start, end, tag, before, m, after} of tagsWith(html, /\sdata-sd-i="(\d+)"/)) {
    const p = look.pieces[Number(m[1])];
    if (!p) throw new Error(`piece ${m[1]} is not in this look (read the pieces and plan the look from the same HTML)`);
    const {cls, style, attrs} = pieceLook(p, look);
    out += `${html.slice(from, start)}<${tag}${joinAttr(joinAttr(before + after, 'class', cls, ' '), 'style', style, ';')}${attrs}>`;
    from = end;
  }
  return out + html.slice(from);
}

/** The pieces' HTML inside the stage the view moves (a zoom); unchanged when nothing moves the view. Put it in the map's own box. */
export function wrapStage(inner, look) {
  if (!look.stage) return inner;
  const {move, from} = look.stage, vars = [];
  if (move) vars.push(`--sd-tx:${move.x}px`, `--sd-ty:${move.y}px`, `--sd-ts:${move.s}`);
  if (from) vars.push(`--sd-tx0:${from.x}px`, `--sd-ty0:${from.y}px`, `--sd-ts0:${from.s}`);
  return `<div class="sd-stage${from ? ' sd-move' : ''}"${vars.length ? ` style="${vars.join(';')}"` : ''}>${inner}</div>`;
}

/** Classes for the slide around a click: sd-focus-new while its blur comes in (what the click adds waits for it). */
export function slideClass(look) {
  return look.overlay?.phase === 'in-new' ? 'sd-focus-new' : '';
}

const esc = s => String(s).replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));

/**
 * The part of the area left blurred: the area minus the holes, as disjoint rectangles (a grid on every hole
 * edge, each cell kept unless a hole covers it), so holes that overlap, or reach past the area, stay clear
 * and nothing outside the area is touched.
 */
function veilPath([x0, y0, x1, y1], rects) {
  const holes = rects.map(([x, y, w, h]) => [Math.max(x0, x), Math.max(y0, y), Math.min(x1, x + w), Math.min(y1, y + h)]).filter(([a, b, c, d]) => c > a && d > b);
  const xs = [...new Set([x0, x1, ...holes.flatMap(h => [h[0], h[2]])])].sort((a, b) => a - b), ys = [...new Set([y0, y1, ...holes.flatMap(h => [h[1], h[3]])])].sort((a, b) => a - b);
  const runs = [];
  for (let j = 0; j + 1 < ys.length; j++) {
    let start = null;
    for (let i = 0; i + 1 < xs.length; i++) {
      const cx = (xs[i] + xs[i + 1]) / 2, cy = (ys[j] + ys[j + 1]) / 2, open = !holes.some(([a, b, c, d]) => cx > a && cx < c && cy > b && cy < d);
      if (open && start === null) start = xs[i];
      if ((!open || i + 2 === xs.length) && start !== null) { runs.push(`M${start} ${ys[j]}H${open ? xs[i + 1] : xs[i]}V${ys[j + 1]}H${start}Z`); start = null; }
    }
  }
  return runs.join(' ');
}

/** A path's line — the text naming its route — in slide pixels, shown once the route is done (its moment is `done`). */
function pathLine(look, [x0, , , y1]) {
  const p = look.path;
  if (!p?.line) return '';
  const at = p.lineAt ? String(p.lineAt).trim().split(/[\s,]+/).map(Number) : [x0 + 24, y1 - 56];
  if (at.length !== 2 || at.some(n => !Number.isFinite(n))) throw new Error(`focus "path": lineAt is x y in slide px, not "${p.lineAt}"`);
  return `<div class="sd-path-line" style="left:${at[0]}px;top:${at[1]}px;--sd-path-delay:${p.done}s">${esc(p.line)}</div>`;
}

/**
 * The overlay of a click — a blur with holes, a frame and its label, and a path's line — in slide pixels: put
 * it outside the map's box. `area` ([x0, y0, x1, y1]) limits the blur, so a headline above it stays clear.
 * Empty when the click has none.
 */
export function focusOverlay(look, {canvas = {w: 1920, h: 1080}, area} = {}) {
  const o = look.overlay, line = pathLine(look, area ?? [0, 0, canvas.w, canvas.h]);
  if (!o || !o.rects.length) return line;
  const path = veilPath(area ?? [0, 0, canvas.w, canvas.h], o.rects);
  const veil = `<div class="sd-veil sd-veil-${o.phase}" style="width:${canvas.w}px;height:${canvas.h}px;clip-path:path(nonzero,'${path}')"></div>`;
  if (o.phase === 'out') return veil + line;
  const [x, y, w, h] = o.rects[0];
  return `${veil}<div class="sd-frame${o.frameNew ? ' sd-new' : ''}" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px">${o.label ? `<span>${esc(o.label)}</span>` : ''}</div>${line}`;
}

/**
 * Runs in the page — call it once, at any time (inline it in a built page: `(${focusRuntime})()`). Only a
 * forward click animates its changes; a jump, a deep link or a step back lands on the click at once — what
 * you arrive at is a place, not a change. A forward step over skipped slides is still a step.
 *
 * It also runs apart's springs (focus.js · FOCUS.apart), each deck its own: one per group, its value 0 together and 1
 * apart, a little under critical damping (ζ .82), so a group settles with a hint of weight. A group sets off from
 * wherever the last click left it — mid-way too: a click reschedules only the groups not yet at its target (those
 * turning round, and those still waiting to set off), in that list's order (out in the order written, back in reverse),
 * each `stagger` ms after the one before and never sooner than a start it was waiting for, so among them the earlier
 * groups always lead. The spring is played as Web Animations sampled from it (60
 * keyframes a second, `translate`/`scale` as every mover moves a piece), so it never writes the piece: when a group
 * comes to rest the animation is over and the piece is exactly as drawn — at 0, the figure's static art — and the
 * video's frame stepper (video.js · deckStageDriver · freeze) steps it like any animation. A jump, a step back and
 * reduced motion land at once; so does a browser without Element.animate.
 */
export function focusRuntime() {
  // The flag is the runtime's version: an older runtime inlined in the page (0.4.0 set it to true, with no springs)
  // does not keep this one out; the same or a newer one does.
  const VERSION = 2;
  if (window.__sdFocusRuntime >= VERSION) return;
  window.__sdFocusRuntime = VERSION;
  const forward = e => {
    const {index, previousIndex, slide} = e.detail;
    if (index <= previousIndex) return false;
    const all = slide?.parentElement ? [...slide.parentElement.children].filter(s => s.tagName === 'SECTION') : [];
    return all.slice(previousIndex + 1, index).every(s => s.hasAttribute('data-deck-skip'));
  };
  const calm = () => !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  // ── apart's springs. A spring is {v, vel, x, pending: {to, at} | null}: its value, velocity and target, and the
  // target it takes `at` steps on (its stagger). 240 steps a second; a keyframe every 4 (60 a second).
  const K = 170, C = 2 * 0.82 * Math.sqrt(K), STEPS = 240, EVERY = 4, MOST = 60 * STEPS;
  const still = s => !s.pending && Math.abs(s.v - s.x) < 5e-4 && Math.abs(s.vel) < 5e-3;
  /** The spring s0, n steps on or at rest, whichever is first; `frame(v, k)` sees it every EVERY steps. */
  const run = (s0, n, frame) => {
    const s = {...s0, pending: s0.pending && {...s0.pending}};
    let k = 0;
    for (; k < n; k++) {
      if (s.pending && k >= s.pending.at) { s.x = s.pending.to; s.pending = null; }
      if (still(s)) { s.v = s.x; s.vel = 0; break; }
      if (frame && k % EVERY === 0) frame(s.v, k);
      s.vel += (-K * (s.v - s.x) - C * s.vel) / STEPS;
      s.v += s.vel / STEPS;
    }
    if (s.pending) s.pending.at -= k;
    return {s, k};
  };
  /** A piece's place for a mover, from its drawn style: z '' is where this click puts it, '0' where the last left it. */
  const placeOf = (style, z) => {
    const at = name => { const m = new RegExp(`(?:^|;)\\s*--sd-${name}${z}\\s*:\\s*(-?[\\d.]+)`).exec(style); return m ? Number(m[1]) : null; };
    return {dx: at('dx') ?? 0, dy: at('dy') ?? 0, s: at('s') ?? 1};
  };
  const r = (v, d) => Math.round(v * 10 ** d) / 10 ** d;
  // Each deck has its own springs: what one deck does never stops or replays another's (two decks on a page).
  const decks = new WeakMap();   // deck → {live: the springs in flight, by group; playing: their animations, on its slide shown}
  const springsOn = (deck, slide, moving) => {
    const now = performance.now(), mine = decks.get(deck) ?? {live: new Map(), playing: []};
    decks.set(deck, mine);
    const elapsed = g => (typeof g.anim?.currentTime === 'number' ? g.anim.currentTime : now - g.t0);
    const where = new Map([...mine.live].map(([key, g]) => [key, run(g.s, Math.round(elapsed(g) * STEPS / 1000)).s]));
    mine.playing.forEach(a => a.cancel());
    mine.playing = []; mine.live = new Map();
    if (!moving) return;   // a jump lands: the piece as drawn
    const groups = new Map();
    for (const el of slide.querySelectorAll('[data-sd-apart]')) {
      const [k, to, was, stagger, ...names] = el.getAttribute('data-sd-apart').trim().split(/\s+/), key = names.join(' ');
      if (!groups.has(key)) groups.set(key, {key, order: Number(k), to: Number(to), was: Number(was), stagger: Number(stagger), els: []});
      groups.get(key).els.push(el);
    }
    // Where each group is, and which turn round. One already at its new target stays (a start still pending the other
    // way is dropped: it never set off). Every other one is rescheduled — those turning round, and those still waiting
    // to set off the same way — in that list's order, `stagger` ms after the one before it, and never sooner than a
    // start it was already waiting for: so among them the earlier groups always lead, and a click that keeps a group's
    // target keeps its time too.
    const changing = [];
    for (const g of groups.values()) {
      g.s = where.get(g.key) ?? {v: g.was, vel: 0, x: g.was, pending: null};
      if (g.s.x === g.to) g.s.pending = null; else changing.push(g);
    }
    const opening = changing.filter(g => g.to === 1).sort((a, b) => a.order - b.order);
    const closing = changing.filter(g => g.to !== 1).sort((a, b) => b.order - a.order);
    for (const list of [opening, closing]) {
      let ms = -Infinity;   // when the group before it sets off
      for (const g of list) {
        ms = Math.max(ms + g.stagger, g.s.pending ? g.s.pending.at * 1000 / STEPS : 0, 0);
        g.s.pending = {to: g.to, at: Math.round(ms * STEPS / 1000)};
      }
    }
    for (const g of groups.values()) {
      const frames = [], {s: end, k} = run(g.s, MOST, (v, at) => frames.push([v, at]));
      if (!k) continue;   // at rest where it is drawn
      frames.push([end.x, k]);
      const live1 = {s: g.s, t0: now, anim: null};
      mine.live.set(g.key, live1);
      for (const el of g.els) {
        if (typeof el.animate !== 'function') continue;
        const style = el.getAttribute('style') ?? '', [together, apart] = g.to === 1 ? [placeOf(style, '0'), placeOf(style, '')] : [placeOf(style, ''), placeOf(style, '0')];
        const at = (a, b, v) => a + (b - a) * v;
        const anim = el.animate(frames.map(([v, f]) => ({offset: f / k, translate: `${r(at(together.dx, apart.dx, v), 2)}px ${r(at(together.dy, apart.dy, v), 2)}px`, scale: String(r(at(together.s, apart.s, v), 4))})),
          {duration: k * 1000 / STEPS, easing: 'linear', fill: 'none'});
        live1.anim ??= anim;
        mine.playing.push(anim);
      }
    }
  };
  document.addEventListener('slidechange', e => {
    const slide = e.detail?.slide;
    if (!slide) return;
    const deck = slide.parentElement ?? document;   // a deck's slides are its children
    deck.querySelectorAll('[data-sd-instant]').forEach(s => s.removeAttribute('data-sd-instant'));
    const ahead = forward(e);
    if (!ahead) slide.setAttribute('data-sd-instant', '');
    springsOn(deck, slide, ahead && !slide.hasAttribute('data-deck-static') && !calm());
  });
  // Called after the deck showed its first slide: that arrival was no forward click either.
  document.querySelectorAll('[data-deck-active]').forEach(s => s.setAttribute('data-sd-instant', ''));
}
