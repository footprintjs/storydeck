// callouts — words pinned to a piece: a bubble beside it, with a tail that points at it. Plain strings in, plain strings
// out; applied before a map's pieces are read, so a callout is a piece like any other: a click brings it in, lights it,
// greys it and takes it out, and a wire may reach it.
//
//   <div data-k="why" data-callout="server above">Most of the <b>wait</b> is here</div>
//
// data-callout names the piece it is about and the side it stands on: above (the default), below, left or right. It takes
// its size from its words and stays on the slide; an inline width or height of its own sets that, and an inline left and
// top place it by hand, its tail still reaching the piece. `server+` in a click is the server, its wires and its callouts.
//
// It looks like a bubble in the colours opposite the slide's, from CALLOUT_CSS, which the page carries only when a deck
// has one. Every rule has no weight, so theme.css has the last word: set --callout-bg, --callout-fg, --callout-size,
// --callout-radius or --callout-lag (how long after its piece it comes in), or write a rule for .callout, .callout-say
// or .callout-tail. Class ok, warn or bad from the base look colours one.
import {attrRule, attrValue, pieceTags, readAttributes, styleLength, tagsWith} from '../pieceRules.js';
import {plainText} from './parse.js';
import {boxFinder, exit} from './boxes.js';

const SIDES = ['above', 'below', 'left', 'right'];
const ATTR = /\sdata-callout([\w-]*)=(["'])(.*?)\2/;
const SPEC = /^\s*([^\s"'<>]+)(?:\s+(\S+))?\s*$/;
const TEXT = {size: 28, line: 35, char: 15.7, padX: 20, padY: 12};   // CALLOUT_CSS's type, and a generous width per letter
const WIDE = {most: 400, least: 120};   // px, for a bubble that takes its width from its words
const CLEAR = 24;      // px a bubble stays inside the slide's edges
const TAIL = {reach: 34, half: 14, into: 8, gap: 4, least: 10};   // how far a bubble stands off, half the tail's foot, how far the foot goes into the bubble, px left clear of the piece, the shortest tail
/** The letters a line wraps as twice as wide. */
const DOUBLE = /[\p{scx=Han}\p{scx=Hira}\p{scx=Kana}\p{scx=Hang}]/u;

const fixed = (v) => +v.toFixed(1);
const unitsOf = (word) => [...word].reduce((n, ch) => n + (DOUBLE.test(ch) ? 2 : 1), 0);

/** The element's end: where its own closing tag is, counting those of its kind inside it. Throws when it is never closed. */
function closeOf(html, tag, from, where) {
  const scan = new RegExp(`<(/?)${tag}\\b[^>]*>`, 'gi');
  scan.lastIndex = from;
  let depth = 1;
  for (let m = scan.exec(html); m; m = scan.exec(html)) {
    depth += m[1] ? -1 : 1;
    if (!depth) return {at: m.index, end: m.index + m[0].length};
  }
  throw new Error(`${where}: its <${tag}> is never closed — end it with </${tag}>`);
}

/** Every callout as written, in order, checked: [{start, open, close, end, tag, attrs, where, name, target, side, inner, text}]. Throws, naming the fix. */
function readCallouts(html) {
  return tagsWith(html, ATTR).map(({start, end: open, tag, before, m, after}) => {
    if (m[1]) throw new Error(`data-callout${m[1]}="${m[3]}": a callout is written data-callout="piece side" ("server above"), with no other data-callout attribute`);
    const where = `data-callout="${m[3]}"`, attrs = before + after, spec = SPEC.exec(m[3]);
    if (!spec || (spec[2] && !SIDES.includes(spec[2]))) throw new Error(`${where}: a callout names the piece it is about and the side it stands on ("server above"): ${SIDES.slice(0, -1).join(', ')} or ${SIDES.at(-1)}`);
    if (!readAttributes(attrs)) throw new Error(`${where}: a quote in its tag is never closed — write a ">" or "<" inside a value as &gt; or &lt;`);
    const name = attrRule('data-k').exec(attrs)?.[2].trim().split(/\s+/)[0];
    if (!name) throw new Error(`${where}: a callout is a piece, so a click can bring it in — give it a data-k name`);
    if (name === spec[1]) throw new Error(`${where}: "${name}" is the callout itself — name the piece it is about`);
    const {at: close, end} = closeOf(html, tag, open, where), inner = html.slice(open, close);
    if (pieceTags(inner).length) throw new Error(`${where}: pieces do not nest, and this callout holds one — place it beside the callout`);
    const text = plainText(inner).replace(/\s+/g, ' ').trim();
    if (!text) throw new Error(`${where}: a callout says something — put its words inside its <${tag}>`);
    return {start, open, close, end, tag, attrs, where, name, target: spec[1], side: spec[2] ?? SIDES[0], inner, text};
  });
}

/** The callouts in a map's or a slide's HTML, for reading back: [{name, target, side, text}]. */
export const calloutsIn = (html) => readCallouts(html).map(({name, target, side, text}) => ({name, target, side, text}));

/** The size a bubble's words ask for, wrapped at the width it has or may take: {w, h}. Its own width or height wins. */
function sizeOf({inner}, width, height) {
  const room = Math.max(1, Math.floor(((width ?? WIDE.most) - 2 * TEXT.padX) / TEXT.char));
  let lines = 0, widest = 0;
  for (const line of inner.split(/<br\s*\/?>/i)) {
    let used = 0;
    lines += 1;
    for (const word of plainText(line).trim().split(/\s+/).filter(Boolean)) {
      const units = unitsOf(word);
      if (units > room) { lines += Math.ceil(units / room) - (used ? 0 : 1); used = units % room || room; widest = room; continue; }
      if (used && used + 1 + units > room) { widest = Math.max(widest, used); lines += 1; used = units; } else used += (used ? 1 : 0) + units;
    }
    widest = Math.max(widest, used);
  }
  return {w: width ?? Math.min(WIDE.most, Math.max(WIDE.least, Math.ceil(widest * TEXT.char + 2 * TEXT.padX))), h: height ?? lines * TEXT.line + 2 * TEXT.padY};
}

/** Where a bubble of this size stands on this side of the piece, kept on the slide. */
function besidePiece(side, t, {w, h}, canvas) {
  const midX = t.x + t.w / 2 - w / 2, midY = t.y + t.h / 2 - h / 2;
  const at = {above: [midX, t.y - TAIL.reach - h], below: [midX, t.y + t.h + TAIL.reach], left: [t.x - TAIL.reach - w, midY], right: [t.x + t.w + TAIL.reach, midY]}[side];
  if (!canvas) return at;
  const keep = (v, room, size) => Math.max(CLEAR, Math.min(v, Math.max(CLEAR, room - CLEAR - size)));
  return [keep(at[0], canvas[0], w), keep(at[1], canvas[1], h)];
}

/** The tail: from inside the bubble's edge to just short of the piece's, along the line between their middles. In slide px. */
function tailOf(b, t, c) {
  const from = [b.x + b.w / 2, b.y + b.h / 2], to = [t.x + t.w / 2, t.y + t.h / 2], len = Math.hypot(to[0] - from[0], to[1] - from[1]);
  const u = len ? [(to[0] - from[0]) / len, (to[1] - from[1]) / len] : [0, 1];
  const leaves = exit(b, from, u), reaches = len - exit(t, to, [-u[0], -u[1]]);
  if (!len || reaches - leaves - TAIL.gap < TAIL.least) throw new Error(`${c.where}: "${c.name}" stands on "${c.target}", so its tail has nowhere to go — try another side, or give it a left and top clear of the piece`);
  const foot = leaves - TAIL.into, tip = reaches - TAIL.gap;
  const at = (d, off = 0) => [from[0] + u[0] * d - u[1] * off, from[1] + u[1] * d + u[0] * off];
  return {corners: [at(foot, TAIL.half), at(tip), at(foot, -TAIL.half)], foot: at(leaves)};
}

/** The tail as an <svg> inside its bubble, in the bubble's own px. */
function tailSvg(b, {corners}) {
  const xs = corners.map((p) => p[0]), ys = corners.map((p) => p[1]);
  const X = Math.min(...xs), Y = Math.min(...ys), W = Math.max(...xs) - X || 1, H = Math.max(...ys) - Y || 1;
  const d = corners.map(([x, y], i) => `${i ? 'L' : 'M'}${fixed(x - X)} ${fixed(y - Y)}`).join('');
  const [tx, ty] = corners[1];
  return `<svg class="callout-tail" style="left:${fixed(X - b.x)}px;top:${fixed(Y - b.y)}px;width:${fixed(W)}px;height:${fixed(H)}px" viewBox="0 0 ${fixed(W)} ${fixed(H)}" data-sd-tip="${fixed(tx - X)} ${fixed(ty - Y)}" aria-hidden="true"><path d="${d}Z"/></svg>`;
}

/** One callout, drawn: its element with a place and a size, its tail, and its words. */
function draw(c, html, boxOf, canvas) {
  const style = attrValue(c.attrs, 'style')?.value ?? '';
  const given = (prop) => {
    const n = styleLength(style, prop);
    if (!n && new RegExp(`(?:^|;)\\s*${prop}\\s*:`, 'i').test(style)) throw new Error(`${c.where}: its ${prop} is a number of px, so its tail can be drawn`);
    return n?.value ?? null;
  };
  const [left, top] = [given('left'), given('top')];
  if ((left === null) !== (top === null)) throw new Error(`${c.where}: it needs both a left and a top to stand by hand, or neither to stand ${c.side} "${c.target}"`);
  const t = boxOf(c.target, c.where), size = sizeOf(c, given('width'), given('height'));
  const [x, y] = left === null ? besidePiece(c.side, t, size, canvas) : [left, top];
  const b = {x, y, w: size.w, h: size.h}, tail = tailOf(b, t, c);
  // a value it was given stays where it was written, in its own style; only what it worked out is added
  const placed = [['left', x], ['top', y], ['width', size.w], ['height', size.h]].filter(([prop]) => given(prop) === null).map(([prop, v]) => `${prop}:${fixed(v)}px`);
  const origin = `transform-origin:${fixed(tail.foot[0] - x)}px ${fixed(tail.foot[1] - y)}px`;   // it unfolds from its tail; a mover's own origin comes later in the style and wins
  const css = [...placed, origin, style.trim()].filter(Boolean).join(';');
  let at = c.attrs.replace(attrRule('style'), '');
  at = attrRule('class').test(at) ? at.replace(attrRule('class'), (_, q, v) => ` class=${q}${/(^|\s)callout(\s|$)/.test(v) ? v : `callout ${v}`}${q}`) : `${at} class="callout"`;
  return `<${c.tag}${at} data-ends="${c.target}" data-sd-callout="${c.side}" style="${css}">${tailSvg(b, tail)}<span class="callout-say">${c.inner}</span>${html.slice(c.close, c.end)}`;
}

/** Every callout in some HTML drawn beside its piece; HTML without one comes back as it was. `canvas`, [w, h]: keep them on the slide. */
export function callouts(html, {canvas = null} = {}) {
  const found = readCallouts(html);
  if (!found.length) return html;
  const boxOf = boxFinder(html);
  let out = '', from = 0;
  for (const c of found) {
    out += html.slice(from, c.start) + draw(c, html, boxOf, canvas);
    from = c.end;
  }
  return out + html.slice(from);
}

const BUBBLE = 'var(--callout-bg, var(--sd-tone, var(--fg, #14181f)))';
const ARRIVES = 'var(--sd-arrive-with, sdCalloutIn) var(--sd-arrive-time, .6s) var(--sd-ease, cubic-bezier(.2, .7, .2, 1))';
const WAITS = 'var(--sd-arrive-delay, 0s) + var(--callout-lag, .3s)';
/**
 * A callout's look and its arrival, each rule with no weight and only inside a slide, so a deck's rule wins and a site
 * showing a deck keeps its own .callout. It unfolds from its tail, overshooting a little, just after its piece: in the
 * slot focus.css leaves for one more animation, so it plays by the same gate (never on a jump, a step back or reduced motion).
 */
export const CALLOUT_CSS = `/* a callout: a bubble pinned to a piece (deck/callouts.js) */
:where(section[data-label] [data-sd-callout]) {
  position: absolute; box-sizing: border-box; border-radius: var(--callout-radius, var(--sd-radius, 16px));
  background: ${BUBBLE}; color: var(--callout-fg, var(--bg-elev, #ffffff));
  font: 600 var(--callout-size, ${TEXT.size}px)/${TEXT.line / TEXT.size} var(--sans, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif);
}
:where(section[data-label] .callout-say) {
  display: block; box-sizing: border-box; height: 100%; padding: ${TEXT.padY}px ${TEXT.padX}px;
  align-content: center; text-align: center; text-wrap: balance; overflow-wrap: anywhere;
}
:where(section[data-label] .callout-tail) { position: absolute; overflow: visible; pointer-events: none; fill: ${BUBBLE}; }
@keyframes sdCalloutIn { from { opacity: 0; scale: calc(var(--sd-s, 1) * .4); } 70% { opacity: 1; scale: calc(var(--sd-s, 1) * 1.04); } }
@media screen and (prefers-reduced-motion: no-preference) {
  :where(section[data-label] [data-sd-callout].sd-enter) { --sd-a-more: ${ARRIVES} calc(var(--sd-delay, 0s) + ${WAITS}) both; }
  :where(section[data-label] [data-sd-callout].sd-path.sd-enter) { --sd-a-more: ${ARRIVES} calc(var(--sd-turn, 0s) + ${WAITS}) both; }
}
`;
