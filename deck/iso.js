// iso — blocks on a floor seen from a corner. Plain strings in, plain strings out; applied before a map's pieces are
// read, so an isometric piece is a piece like any other: a click brings it in, lights it, greys it and moves the view
// to it, a wire runs to it and a callout stands beside it.
//
//   <i data-iso-grid="120 at 960 240"></i>                                     the floor's tile and far corner (optional)
//   <div data-k="floor" data-iso="floor" data-size="8 5"></div>                 the tile lines
//   <div data-k="server" data-iso="block" data-at="3 1" data-size="2 2 1.4"><b>Server</b><small>an API</small></div>
//   <div data-k="db" data-iso="cylinder" data-at="6 0" data-size="1.6 1.6 1.2"><b>Database</b></div>
//
// data-at is where it stands on the floor, "col row" (col runs down and to the right of the slide, row down and to the
// left), and a third number lifts it; data-size is "wide deep high" in tiles (a floor: "cols rows"). The numbers that
// place it come from footprint-story/isometric, the grid a film can draw with too. Its words stand on its top face.
//
// WHY the build places it (and refuses a left/top/width/height of its own): where a block lands and how big it is on
// the slide follow from the floor, and the order they are painted in (a nearer block over a further one) follows from
// all of them together — written as a z-index, so the map's own order, which a click's numbering uses, never moves.
// A floor is written first: it and the wires share a level, and the later one is drawn over the earlier. A floor is
// ground (data-ground): a camera frames what stands on it, so the view follows the pieces, not the floor.
//
// It looks as ISO_CSS says, which the page carries only when a deck has one. Every rule has no weight, so theme.css has
// the last word: --iso-color (a piece's colour: its top is lighter, its sides darker), --iso-ink, --iso-line,
// --iso-grid, --iso-floor. Class ok, warn or bad from the base look colours one.
//
// A piece is what it draws, not the box it is placed by. The box of a block seen from a corner has four empty corners,
// and a nearer block's box lies over the block behind it: so only its faces and its words take the pointer, and a ring
// round it (a highlight, explore's hover) follows its faces — isoRing, for whoever rings a piece.
import {isometric} from 'footprint-story/isometric';
import {attrRule, ownAttribute, pieceTags, tagsWith} from '../pieceRules.js';
import {closeOf} from './callouts.js';

const KINDS = ['block', 'cylinder', 'floor'];
/** A tag that may carry the attribute: a cheap look, in any case. Whether it does is ownAttribute's to say (a mention inside another value is not it). */
const MAYBE = /data-iso(?![\w-])/i, MAYBE_GRID = /data-iso-grid(?![\w-])/i;
const NUMBER = '(-?(?:\\d+(?:\\.\\d*)?|\\.\\d+))';
/** The grid as written: "tile [tile-height] at x y [rise r]". */
const GRID = new RegExp(`^\\s*${NUMBER}(?:\\s+${NUMBER})?\\s+at\\s+${NUMBER}\\s+${NUMBER}(?:\\s+rise\\s+${NUMBER})?\\s*$`);
const PLACED = ['left', 'top', 'width', 'height'];
/** The most isometric pieces on one map (the grid orders that many). */
export const MOST_ISO_PIECES = 256;

const fixed = (v) => +v.toFixed(1);
const points = (list, x, y) => list.map((p) => `${fixed(p.x - x)},${fixed(p.y - y)}`).join(' ');

/** Numbers written in an attribute, "3 1" or "2 2 1.4": a list, or null when a word is not a number. */
function numbersIn(text) {
  const words = text.trim().split(/\s+/).filter(Boolean), out = words.map(Number);
  return words.length && words.every((w) => new RegExp(`^${NUMBER}$`).test(w)) ? out : null;
}

/**
 * The map's grid and the map without the element that set it: the default is a tile 120 px wide, its far corner at the
 * slide's middle, 240 px down. The element is an empty <i> that carries data-iso-grid and nothing else: it is not a
 * piece, so taking it out moves no piece's number (a data-k on it would, and is refused). One pass over the tags.
 */
function readGrid(html, canvas) {
  const found = [];
  for (const t of tagsWith(html, MAYBE_GRID)) {
    const run = t.before + t.m[0] + t.after, own = ownAttribute(run, 'data-iso-grid');
    if (own === null) continue;   // the words inside another attribute's value: not a floor
    const written = '<i data-iso-grid="120 at 960 240"></i>';
    if (own === undefined || own.bare || own.twice || t.tag !== 'i' || !html.startsWith('</i>', t.end)) throw new Error(`data-iso-grid: the floor is set on an empty <i>, in lower case and with quotes — ${written}`);
    if ((own.before + own.after).trim()) throw new Error(`data-iso-grid: the floor's <i> carries nothing else (it is not a piece, and is taken out of the map) — write ${written} and put "${(own.before + own.after).trim()}" on a piece`);
    found.push({start: t.start, end: t.end + '</i>'.length, spec: own.value});
  }
  if (found.length > 1) throw new Error(`data-iso-grid: a map has one floor, and this one sets ${found.length} — keep one`);
  if (!found.length) return {grid: isometric({tile: 120, origin: [(canvas?.[0] ?? 1920) / 2, 240]}), html};
  const [{start, end, spec}] = found, m = GRID.exec(spec);
  if (!m) throw new Error(`data-iso-grid="${spec}": the floor is a tile's width in px (and its height, for another angle), "at", and where its far corner stands, x y — "120 at 960 240", with "rise 70" after it to set a unit of height`);
  const [w, h, x, y, rise] = m.slice(1).map((v) => (v === undefined ? undefined : Number(v)));
  let grid;
  try {
    grid = isometric({tile: h === undefined ? w : [w, h], origin: [x, y], ...(rise === undefined ? {} : {rise})});
  } catch (e) {
    throw new Error(`data-iso-grid="${spec}": ${e.message.replace(/^isometric: /, '')}`, {cause: e});
  }
  return {grid, html: html.slice(0, start) + html.slice(end)};
}

/**
 * Every isometric piece as written, in order, checked: [{start, open, close, end, tag, attrs, where, name, kind, at, size,
 * inner}]. Throws, naming the fix. A tag is one when a browser reads data-iso as its own attribute; the words inside
 * another attribute's value do not make it one.
 */
function readIso(html) {
  const out = [];
  for (const {start, end: open, tag, before, m, after} of tagsWith(html, MAYBE)) {
    const run = before + m[0] + after, own = ownAttribute(run, 'data-iso');
    if (own === null) continue;
    if (own === undefined) throw new Error('data-iso: a quote in its tag is never closed — write a ">" or "<" inside a value as &gt; or &lt;');
    // written any other way a browser reads it as the attribute and a reader of the file would not: refused, never silently a plain element
    if (own.bare || own.twice) throw new Error('data-iso: an isometric piece is written data-iso="block" (or cylinder, floor), once, in lower case and with quotes');
    const kind = own.value.trim(), where = `data-iso="${own.value}"`, attrs = own.before + own.after;
    if (!KINDS.includes(kind)) throw new Error(`${where}: an isometric piece is a ${KINDS.slice(0, -1).join(', a ')} or a ${KINDS.at(-1)}`);
    const name = ownAttribute(attrs, 'data-k')?.value?.trim().split(/\s+/)[0];
    if (!name) throw new Error(`${where}: an isometric piece is a piece, so a click can bring it in — give it a data-k name`);
    const told = `"${name}" (${where})`, styled = ownAttribute(attrs, 'style');
    // a browser keeps the first of two style attributes, and the build writes one: two would leave it where neither says
    if (styled?.bare || styled?.twice) throw new Error(`${told}: its style is written once, with quotes — a browser reads only the first of two, and the build adds its place to it`);
    const style = styled?.value ?? '';
    const placed = PLACED.find((prop) => new RegExp(`(?:^|;)\\s*${prop}\\s*:`, 'i').test(style));
    if (placed) throw new Error(`${told}: its ${placed} comes from the floor — place it with data-at="col row" and size it with data-size, and take ${placed} out of its style`);
    const read = (attr, form) => {
      const a = ownAttribute(attrs, attr);
      if (!a) return null;
      return (a.bare ? null : numbersIn(a.value)) ?? (() => { throw new Error(`${told}: ${attr}="${a.value}" — ${form}`); })();
    };
    const size = read('data-size', kind === 'floor' ? 'a floor\'s size is "cols rows", whole numbers' : 'its size is "wide deep high", in tiles');
    if (!size) throw new Error(`${told}: give it a data-size — ${kind === 'floor' ? '"cols rows" ("8 5")' : '"wide deep high" in tiles ("2 2 1.4")'}`);
    const at = read('data-at', 'where it stands is "col row" on the floor, with a third number to lift it') ?? [0, 0];
    const {at: close, end} = closeOf(html, tag, open, told), inner = html.slice(open, close);
    if (pieceTags(inner).length) throw new Error(`${told}: pieces do not nest, and this one holds a piece — place it beside it`);
    if (kind === 'floor' && inner.trim()) throw new Error(`${told}: a floor holds no words — put them in a piece that stands on it`);
    out.push({start, open, close, end, tag, attrs, where: told, name, kind, at, size, inner, style, quote: styled?.quote ?? '"', styleCut: styled ? styled.before + styled.after : attrs});
  }
  return out;
}

/** The isometric pieces a map has: [{name, kind}] — nothing for a map without one. */
export const isoIn = (html) => readIso(html).map(({name, kind}) => ({name, kind}));

/** What the grid says of a piece, with the refusal naming the piece: {box, art, say}. */
function shapeOf(p, grid) {
  try {
    if (p.kind === 'floor') {
      if (p.size.length !== 2) throw new Error(`isometric: a floor's size is "cols rows" — not "${p.size.join(' ')}"`);
      const f = grid.floor({cols: p.size[0], rows: p.size[1], at: p.at.slice(0, 2)}), {x, y} = f.box;
      const lines = f.lines.map(([x1, y1, x2, y2]) => `M${fixed(x1 - x)} ${fixed(y1 - y)}L${fixed(x2 - x)} ${fixed(y2 - y)}`).join('');
      return {box: f.box, art: `<polygon class="iso-ground" points="${points(f.outline, x, y)}"/><path class="iso-lines" d="${lines}"/>`, say: null};
    }
    const thing = {at: p.at, size: p.size};
    if (p.kind === 'cylinder') {
      const c = grid.cylinder(thing), {x, y} = c.box, t = c.top, b = c.bottom;
      const side = `M${fixed(t.cx - t.rx - x)} ${fixed(t.cy - y)}L${fixed(b.cx - b.rx - x)} ${fixed(b.cy - y)}A${fixed(b.rx)} ${fixed(b.ry)} 0 0 0 ${fixed(b.cx + b.rx - x)} ${fixed(b.cy - y)}L${fixed(t.cx + t.rx - x)} ${fixed(t.cy - y)}Z`;
      return {box: c.box, art: `<path class="iso-side" d="${side}"/><ellipse class="iso-top" cx="${fixed(t.cx - x)}" cy="${fixed(t.cy - y)}" rx="${fixed(t.rx)}" ry="${fixed(t.ry)}"/>`, say: c.centre};
    }
    const b = grid.block(thing), {x, y} = b.box;
    return {box: b.box, art: `<polygon class="iso-left" points="${points(b.left, x, y)}"/><polygon class="iso-right" points="${points(b.right, x, y)}"/><polygon class="iso-top" points="${points(b.top, x, y)}"/>`, say: b.centre};
  } catch (e) {
    throw new Error(`${p.where}: ${e.message.replace(/^isometric: /, '')}`, {cause: e});
  }
}

/** One piece, drawn: its element placed and sized by the floor, its faces, and its words on its top face. */
function draw(p, html, shape, level) {
  const {box, art, say} = shape;
  const placed = [`left:${fixed(box.x)}px`, `top:${fixed(box.y)}px`, `width:${fixed(box.w)}px`, `height:${fixed(box.h)}px`, ...(level === null ? [] : [`z-index:${level}`])];
  const css = [...placed, p.style.trim()].filter(Boolean).join(';');
  let at = p.styleCut;   // its attributes without its style (and without data-iso): the one style written below is its only one
  at = attrRule('class').test(at) ? at.replace(attrRule('class'), (_, q, v) => ` class=${q}${/(^|\s)iso(\s|$)/.test(v) ? v : `iso ${v}`}${q}`) : `${at} class="iso"`;
  const svg = `<svg class="iso-art" viewBox="0 0 ${fixed(box.w)} ${fixed(box.h)}" aria-hidden="true">${art}</svg>`;
  const words = say && p.inner.trim() ? `<span class="iso-say" style="left:${fixed(say.x - box.x)}px;top:${fixed(say.y - box.y)}px">${p.inner}</span>` : '';
  // a floor is ground: a camera frames what stands on it, never the floor itself (focus.js) — unless it says otherwise (data-ground="false")
  const ground = p.kind === 'floor' && ownAttribute(at, 'data-ground') === null ? ' data-ground' : '';
  return `<${p.tag}${at}${ground} data-sd-iso="${p.kind}" style=${p.quote}${css}${p.quote}>${svg}${words}${html.slice(p.close, p.end)}`;
}

/** Every isometric piece in some HTML drawn on its floor; HTML without one (and without a floor set) comes back as it was. `canvas`: [w, h], the slide. */
export function isoPieces(html, {canvas = null} = {}) {
  if (!MAYBE.test(html) && !MAYBE_GRID.test(html)) return html;
  const {grid, html: map} = readGrid(html, canvas), found = readIso(map);
  if (!found.length) return map;
  if (found.length > MOST_ISO_PIECES) throw new Error(`a map holds at most ${MOST_ISO_PIECES} isometric pieces, and this one has ${found.length}`);
  const shapes = found.map((p) => shapeOf(p, grid));
  // the order they are painted in, the furthest first: a level each, above the floor and the wires (which share level 0)
  const solid = found.filter((p) => p.kind !== 'floor'), order = grid.backToFront(solid, (p) => ({at: p.at, size: p.size}));
  let out = '', from = 0;
  found.forEach((p, i) => {
    out += map.slice(from, p.start) + draw(p, map, shapes[i], p.kind === 'floor' ? null : order.indexOf(p) + 1);
    from = p.end;
  });
  return out + map.slice(from);
}

const TONE = 'var(--iso-color, var(--sd-tone, #d9e4f3))';
const INK = 'var(--iso-ink, #14181f)';
const HOT = 'var(--sd-hot, #ef4444)', HOT_WIDTH = '5px';
/** A piece with faces: a block or a cylinder (a floor is lines on the ground). */
const SOLID = '[data-sd-iso="block"], [data-sd-iso="cylinder"]';
/** Four hard shadows, one a side: a ring `width` wide round whatever the element paints. */
const ringFilter = (colour, width) => [`${width} 0`, `-${width} 0`, `0 ${width}`, `0 -${width}`].map((at) => `drop-shadow(${at} 0 ${colour})`).join(' ');

/**
 * The rules that ring the isometric pieces `piece` picks (a selector that ends on the piece), in `colour`: round the
 * faces of a block or a cylinder, along the edge of a floor — never round the box the piece is placed by. The ring is
 * on the faces alone, so the piece's own filter (grey, a glow) stays its state's and its words are not ringed. Each
 * rule has no weight. Whoever rings a piece by its box takes that ring off an isometric one and writes these.
 */
export const isoRing = (piece, colour, width = '4px') => `:where(${piece}:is(${SOLID}) .iso-art) { filter: ${ringFilter(colour, width)}; }
:where(${piece}[data-sd-iso="floor"] .iso-ground) { stroke: ${colour}; stroke-width: ${width}; }`;
/**
 * An isometric piece's look, each rule with no weight and only inside a slide, so a deck's rule wins. One colour a
 * piece (--iso-color): its top a little lighter, its two sides darker by different amounts, as light from the upper
 * left would leave them. Its words are drawn flat on its top face, in --iso-ink (dark by default, as the faces are light).
 */
export const ISO_CSS = `/* isometric pieces: blocks on a floor seen from a corner (deck/iso.js) */
:where(section[data-label] [data-sd-iso]) { position: absolute; box-sizing: border-box; pointer-events: none; --sd-hot-width: 0px; }
/* what it draws takes the pointer: its faces and its words, never the empty corners of its box */
:where(section[data-label] [data-sd-iso] :is(.iso-art > *, .iso-say)) { pointer-events: auto; }
:where(section[data-label] .iso-art) {
  position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; pointer-events: none;
  stroke: var(--iso-line, ${INK}); stroke-width: var(--iso-line-width, 2.5px); stroke-linejoin: round;
}
:where(section[data-label] .iso-top) { fill: color-mix(in srgb, ${TONE} 80%, #fff); }
:where(section[data-label] .iso-left) { fill: color-mix(in srgb, ${TONE} 94%, #000); }
:where(section[data-label] :is(.iso-right, .iso-side)) { fill: color-mix(in srgb, ${TONE} 82%, #000); }
:where(section[data-label] .iso-ground) { fill: var(--iso-floor, transparent); stroke: none; }
:where(section[data-label] .iso-lines) { fill: none; stroke: var(--iso-grid, color-mix(in srgb, var(--fg, #14181f) 16%, transparent)); stroke-width: 1.5px; }
:where(section[data-label] .iso-say) {
  position: absolute; translate: -50% -50%; display: grid; justify-items: center; gap: 2px; text-align: center; white-space: nowrap;
  font: 700 26px/1.15 var(--sans, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif); color: ${INK};
}
:where(section[data-label] .iso-say small) { font-size: 18px; font-weight: 500; color: color-mix(in srgb, ${INK} 68%, transparent); }
:where(section[data-label] .iso-say svg.ic) { width: 40px; height: 40px; color: ${INK}; }
/* a callout is words about the picture: over every block, whose levels end at ${MOST_ISO_PIECES} */
:where(section[data-label] [data-sd-callout]) { z-index: ${MOST_ISO_PIECES + 1}; }
/* its highlight (data-hot) rings what it draws; the box's own ring is off (--sd-hot-width: 0, read by focus.css) */
${isoRing('section[data-label] .sd-hot', HOT, HOT_WIDTH)}
/* on a forward click the ring comes as a flat piece's does, .3s after the click (or its turn on a route) */
@keyframes sdIsoRing { from { filter: ${ringFilter('transparent', HOT_WIDTH)}; } }
@media screen and (prefers-reduced-motion: no-preference) {
  :where(section[data-label][data-deck-active]:not([data-sd-instant]):not([data-deck-static]) .sd-hot-in:is(${SOLID}) .iso-art) { animation: sdIsoRing .6s ease calc(.3s + var(--sd-path-delay, 0s)) both; }
}
`;
