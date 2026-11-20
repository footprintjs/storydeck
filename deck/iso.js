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
// NO PLACES TO TYPE. A map whose blocks have no data-at says only what is joined to what, with its wires ("you to
// server"), and the build places them (footprint-story/isometric · arrange, across the frame): a joined block one
// step to the right of what leads to it on the slide, the blocks led to from one place one below the other. A slide is
// wider than it is tall, so the steps run across it; along the floor's own cols a chain is a long slant that leaves two
// corners of the slide empty. Then nothing else needs a number: a block with no data-size is 2 2 1, a floor with none
// is fitted round the blocks, and with no data-iso-grid the tile is chosen so the blocks fill the slide's area
// (gridFor). The least a map is:
//
//   <div data-k="floor" data-iso="floor"></div>
//   <div data-k="you" data-iso="block"><b>You</b></div>
//   <div data-k="server" data-iso="block"><b>Server</b></div>
//   <i data-k="w1" class="wire" data-arrow="you to server"></i>
//
// It is all or none: a map that places some of its blocks and not the others is refused, naming them — the build
// does not guess where the unplaced go among the placed. data-iso-grid="fit" asks for the fitted grid on a map that
// places its own blocks.
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
// and a nearer block's box lies over the block behind it: so on the slide shown only its faces and its words take the
// pointer, and a ring round it (a highlight, explore's hover) follows its faces — isoRing, for whoever rings a piece.
import {arrange, gridFor, isometric, readThing, wordsToFit} from 'footprint-story/isometric';
import {decodeEntities} from './html.js';
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
/** A block or a cylinder that gives no data-size: 2 wide, 2 deep, 1 high. */
export const USUAL_SIZE = Object.freeze([2, 2, 1]);
/**
 * A fitted grid's tile, in px: no wider than the first, and no narrower than the second — a block's words are drawn
 * at one size whatever the tile, and under 96 px a block's top has no room for them. A picture too big for the slide
 * at that tile runs past it, and a click's camera frames what the click shows (data-focus="fit"); the layout check
 * names a lit piece that runs past the slide's edge.
 */
export const FITTED_TILE = Object.freeze({most: 160, least: 96});
/** The px a fitted picture keeps clear of the area's edges, and the tiles of floor a fitted floor shows round the blocks. */
const INSET = 40, MARGIN = 1;
/** The most tiles a floor has along one side (the grid's own limit: footprint-story/isometric · floor). */
export const MOST_FLOOR = 256;
const FIT = 'fit';

const fixed = (v) => +v.toFixed(1);
const points = (list, x, y) => list.map((p) => `${fixed(p.x - x)},${fixed(p.y - y)}`).join(' ');

/** Numbers written in an attribute, "3 1" or "2 2 1.4": a list, or null when a word is not a number. */
function numbersIn(text) {
  const words = text.trim().split(/\s+/).filter(Boolean), out = words.map(Number);
  return words.length && words.every((w) => new RegExp(`^${NUMBER}$`).test(w)) ? out : null;
}

/**
 * What the map says of its grid, and the map without the element that says it: {html, grid} when it is written in
 * numbers, {html, fit: true} for data-iso-grid="fit", {html} alone when nothing is written (the build then decides:
 * isoPieces). The element is an empty <i> that carries data-iso-grid and nothing else: it is not a piece, so taking it
 * out moves no piece's number (a data-k on it would, and is refused). One pass over the tags.
 */
function readGrid(html) {
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
  if (!found.length) return {html};
  const [{start, end, spec}] = found, map = html.slice(0, start) + html.slice(end);
  if (spec.trim() === FIT) return {html: map, fit: true};
  const m = GRID.exec(spec);
  if (!m) throw new Error(`data-iso-grid="${spec}": the floor is a tile's width in px (and its height, for another angle), "at", and where its far corner stands, x y — "120 at 960 240", with "rise 70" after it to set a unit of height; or "fit", and the build chooses the tile that fills the slide`);
  const [w, h, x, y, rise] = m.slice(1).map((v) => (v === undefined ? undefined : Number(v)));
  try {
    return {html: map, grid: isometric({tile: h === undefined ? w : [w, h], origin: [x, y], ...(rise === undefined ? {} : {rise})})};
  } catch (e) {
    throw new Error(`data-iso-grid="${spec}": ${e.message.replace(/^isometric: /, '')}`, {cause: e});
  }
}

/**
 * Every isometric piece as written, in order, checked: [{start, open, close, end, tag, attrs, where, name, kind, at, size,
 * inner}] — `at` null where no data-at is written, a floor's `size` null where no data-size is. Throws, naming the fix. A tag is one when a browser reads data-iso as its own attribute; the words inside
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
    // left out, a block's size is the usual one; a floor's size and anything's place are the build's to work out (place, below)
    const size = read('data-size', kind === 'floor' ? 'a floor\'s size is "cols rows", whole numbers' : 'its size is "wide deep high", in tiles') ?? (kind === 'floor' ? null : [...USUAL_SIZE]);
    const at = read('data-at', 'where it stands is "col row" on the floor, with a third number to lift it');
    const {at: close, end} = closeOf(html, tag, open, told), inner = html.slice(open, close);
    if (pieceTags(inner).length) throw new Error(`${told}: pieces do not nest, and this one holds a piece — place it beside it`);
    if (kind === 'floor' && inner.trim()) throw new Error(`${told}: a floor holds no words — put them in a piece that stands on it`);
    out.push({start, open, close, end, tag, attrs, where: told, name, kind, at, size, inner, style, quote: styled?.quote ?? '"', styleCut: styled ? styled.before + styled.after : attrs});
  }
  return out;
}

/** The isometric pieces a map has: [{name, kind}] — nothing for a map without one. */
export const isoIn = (html) => readIso(html).map(({name, kind}) => ({name, kind}));

const quoted = (pieces) => pieces.map((p) => `"${p.name}"`).join(', ');

/**
 * Every piece given its place and its size, in tiles: `found` (readIso) with `at` and `size` filled in. Returns whether
 * the build placed the blocks.
 *
 * The blocks (and cylinders): all placed by the map, or all placed here from `links` ([[from, to]], the map's wires) —
 * never some of each. A floor with no data-size is fitted round them, a tile of floor showing on every side.
 */
function place(found, links, lay) {
  const solid = found.filter((p) => p.kind !== 'floor'), unplaced = solid.filter((p) => p.at === null);
  if (unplaced.length && unplaced.length < solid.length) {
    throw new Error(`${quoted(unplaced)} ${unplaced.length === 1 ? 'has' : 'have'} no data-at and ${quoted(solid.filter((p) => p.at !== null))} ${solid.length - unplaced.length === 1 ? 'has' : 'have'} one: the build places a map's blocks from its wires only when it places them all — take data-at off the others, or give every block one (a block with none stood at "0 0" before 0.17.0)`);
  }
  const placedHere = unplaced.length > 0;
  if (placedHere) {
    // a piece is known by the first name in its data-k: the wires say it, and the build places by it
    const twice = solid.map((p) => p.name).find((name, i, all) => all.indexOf(name) !== i);
    if (twice !== undefined) throw new Error(`the build places a map's blocks by the first name in their data-k, and two are called "${twice}" — give each a first name of its own, or give every block its data-at`);
    // each block's size first, by the rule that draws it: a size that is none is refused naming the piece, as it always was
    for (const p of solid) {
      try { readThing({at: [0, 0], size: p.size}, `a ${p.kind}`); } catch (e) { throw new Error(`${p.where}: ${e.message.replace(/^isometric: /, '')}`, {cause: e}); }
    }
    let arranged;
    try {
      arranged = arrange(solid.map((p) => ({name: p.name, size: p.size})), links, {across: true});   // a slide is wider than it is tall
    } catch (e) {
      throw new Error(`the build cannot place this map's blocks: ${e.message.replace(/^isometric: /, '')} — or give every block its data-at`, {cause: e});
    }
    solid.forEach((p, i) => { p.at = [...arranged.things[i].at]; });
  }
  // every block as the rule that draws it reads it, before a wire is laid round it: a size or a place that is none is
  // refused here, naming the piece in the deck's words — not later, by whoever lays the wires, in words of its own
  const unit = isometric();
  for (const p of solid) shapeOf(p, unit);
  // the blocks stand: the wires are laid between them now, before anything is fitted, so the floor and the picture hold them too
  const reach = lay ? lay(solid.map((p) => ({name: p.name, kind: p.kind, at: [p.at[0], p.at[1], p.at[2] ?? 0], size: [...p.size]}))) : [];
  for (const floor of found.filter((p) => p.kind === 'floor')) {
    if (floor.size !== null) { floor.at ??= [0, 0]; continue; }
    if (floor.at !== null) throw new Error(`${floor.where}: a floor with a data-at needs its data-size too ("8 5") — or write neither, and the build fits the floor round the blocks`);
    if (!solid.length) throw new Error(`${floor.where}: a floor with no data-size is fitted round the blocks that stand on it, and this map has none — give it a data-size ("8 5")`);
    // round the blocks, and round the wires laid between them (a wire that goes round a block reaches past it)
    const far = (axis, end) => (end ? Math.ceil(Math.max(...solid.map((p) => p.at[axis] + p.size[axis]), ...reach.map((p) => p[axis])) - 1e-9) : Math.floor(Math.min(...solid.map((p) => p.at[axis]), ...reach.map((p) => p[axis])) + 1e-9));
    floor.at = [far(0, false) - MARGIN, far(1, false) - MARGIN];
    floor.size = [far(0, true) + MARGIN - floor.at[0], far(1, true) + MARGIN - floor.at[1]];
    // refused here, in the map's own terms: the author wrote no size, so the grid's "not [271,271]" would name numbers nobody typed
    if (Math.max(...floor.size) > MOST_FLOOR) throw new Error(`${floor.where}: fitted round this map's blocks the floor would be ${floor.size[0]} by ${floor.size[1]} tiles, and a floor is at most ${MOST_FLOOR} a side — take the floor out, or give it a data-at and a data-size of its own (it is ground: it need not lie under every block)`);
  }
  return {placedHere, reach};
}

/**
 * The grid of a map that writes none in numbers: fitted when the build placed the blocks or the map asks ("fit") — the
 * tile that lets the blocks fill the slide's area, a little clear of its edges — and else the grid there has always
 * been: a tile 120 px wide, its far corner at the slide's middle, 240 px down. A floor is not what the tile is chosen
 * for: it is ground, and runs past the slide's edges as far as it likes.
 */
function gridOf(found, {fit, canvas, area, also = []}) {
  const [w, h] = canvas ?? [1920, 1080];
  if (!fit) return isometric({tile: 120, origin: [w / 2, 240]});
  const things = found.filter((p) => p.kind !== 'floor').map((p) => ({at: p.at, size: p.size}));
  if (!things.length) throw new Error('data-iso-grid="fit": the grid is fitted to the blocks, and this map has none — add a block, or write the grid in numbers ("120 at 960 240")');
  const into = area ?? [0, 0, w, h];
  if (!(Array.isArray(into) && into.length === 4 && into.every(Number.isFinite) && into[2] > into[0] && into[3] > into[1])) {
    // each number as it is (NaN as NaN, where JSON would say null)
    throw new Error(`a fitted picture goes into the slide's area, [x0, y0, x1, y1] in slide px with x1 past x0 and y1 past y0 (deck.json "area") — not ${Array.isArray(into) ? `[${into.map(String).join(', ')}]` : JSON.stringify(into)}`);
  }
  const [x0, y0, x1, y1] = into, inset = Math.min(INSET, (x1 - x0) / 4, (y1 - y0) / 4);   // a small area keeps half of itself
  return gridFor(things, [x0 + inset, y0 + inset, x1 - inset, y1 - inset], {...FITTED_TILE, also});   // the blocks, and the floor points their wires reach
}

/** A round thing's outline as points round it: the upper half of its top, then the lower half of its foot. */
function roundOutline(top, bottom, steps = 12) {
  const arc = (e, from) => Array.from({length: steps + 1}, (_, i) => { const a = from + (Math.PI * i) / steps; return {x: e.cx + e.rx * Math.cos(a), y: e.cy + e.ry * Math.sin(a)}; });
  return [...arc(top, Math.PI), ...arc(bottom, 0)];
}

/**
 * What the grid says of a piece, with the refusal naming the piece: {box, art, say} — and, for a block or a cylinder,
 * {outline}: the points round what it draws on the slide.
 */
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
      return {box: c.box, art: `<path class="iso-side" d="${side}"/><ellipse class="iso-top" cx="${fixed(t.cx - x)}" cy="${fixed(t.cy - y)}" rx="${fixed(t.rx)}" ry="${fixed(t.ry)}"/>`, say: c.centre, outline: roundOutline(t, b)};
    }
    const b = grid.block(thing), {x, y} = b.box;
    return {box: b.box, art: `<polygon class="iso-left" points="${points(b.left, x, y)}"/><polygon class="iso-right" points="${points(b.right, x, y)}"/><polygon class="iso-top" points="${points(b.top, x, y)}"/>`, say: b.centre, outline: b.outline};
  } catch (e) {
    throw new Error(`${p.where}: ${e.message.replace(/^isometric: /, '')}`, {cause: e});
  }
}

/** A name's size in the page's own CSS (.iso-say): the size it is drawn at when it fits, and the least it is shrunk to. */
const NAME = Object.freeze({size: 26, least: 16});
/**
 * A block's words with its name made to fit its top face: the name is the first <b> holding plain text and no style
 * of its own. It stays as written when it fits on one line; else it is broken onto two lines, then made smaller
 * (footprint-story/isometric · wordsToFit: the same rule a film uses). Gives {inner, tight}: `tight` the name and the
 * size it would need, when it does not fit even at the least size on two lines — the build says so (check ·
 * name-fit), it never hides a name. `wide`: the face's width on the slide, in px.
 * WHY counted in letters: a build has no browser. `build --layout` measures the page itself.
 */
function fitName(inner, wide) {
  const found = /<b>([^<]*)<\/b>/.exec(inner);
  if (!found || !found[1].trim()) return {inner, tight: null};
  const raw = found[1].trim().split(/\s+/), shown = raw.map((word) => decodeEntities(word));
  const {lines, size, fits} = wordsToFit(shown.join(' '), [wide * 0.9, 2 * 1.15 * NAME.size + 1], NAME);
  if (lines.length === 1 && size === NAME.size) return {inner, tight: null};
  // the words as the deck wrote them (an entity stays an entity), broken where the fitted lines break
  const first = lines[0].split(' ').length, written = lines.length === 2 ? `${raw.slice(0, first).join(' ')}<br>${raw.slice(first).join(' ')}` : raw.join(' ');
  const name = `<b${size === NAME.size ? '' : ` style="font-size:${size}px"`}>${written}</b>`;
  return {inner: inner.slice(0, found.index) + name + inner.slice(found.index + found[0].length), tight: fits ? null : shown.join(' ')};
}

/** One piece, drawn: its element placed and sized by the floor, its faces, and its words on its top face. */
function draw(p, html, shape, level, tile, tight) {
  const {box, art, say} = shape;
  const placed = [`left:${fixed(box.x)}px`, `top:${fixed(box.y)}px`, `width:${fixed(box.w)}px`, `height:${fixed(box.h)}px`, ...(level === null ? [] : [`z-index:${level}`])];
  const css = [...placed, p.style.trim()].filter(Boolean).join(';');
  let at = p.styleCut;   // its attributes without its style (and without data-iso): the one style written below is its only one
  at = attrRule('class').test(at) ? at.replace(attrRule('class'), (_, q, v) => ` class=${q}${/(^|\s)iso(\s|$)/.test(v) ? v : `iso ${v}`}${q}`) : `${at} class="iso"`;
  const svg = `<svg class="iso-art" viewBox="0 0 ${fixed(box.w)} ${fixed(box.h)}" aria-hidden="true">${art}</svg>`;
  // its name fitted to its top face: as wide as the face is on the slide, half a tile for each tile of its width and its depth
  // (a round thing's top is narrower than the block on its tiles: its width over √2)
  const fitted = say && p.inner.trim() ? fitName(p.inner, p.kind === 'cylinder' ? p.size[0] * tile / Math.SQRT2 : (p.size[0] + p.size[1]) * tile / 2) : null;
  if (fitted?.tight) tight.push({name: p.name, text: fitted.tight});
  const words = fitted ? `<span class="iso-say" style="left:${fixed(say.x - box.x)}px;top:${fixed(say.y - box.y)}px">${fitted.inner}</span>` : '';
  // a floor is ground: a camera frames what stands on it, never the floor itself (focus.js) — unless it says otherwise (data-ground="false")
  const ground = p.kind === 'floor' && ownAttribute(at, 'data-ground') === null ? ' data-ground' : '';
  return `<${p.tag}${at}${ground} data-sd-iso="${p.kind}" style=${p.quote}${css}${p.quote}>${svg}${words}${html.slice(p.close, p.end)}`;
}

/**
 * Every isometric piece in some HTML drawn on its floor; HTML without one (and without a floor set) comes back as it
 * was. `canvas`: [w, h], the slide; `area`: [x0, y0, x1, y1], where a fitted picture goes (the deck's area: below the
 * headline, above the footer); `links`: [[from, to]] by piece name, what the map's wires join — what the build places
 * the blocks from, when the map places none itself.
 */
export const isoPieces = (html, options) => isoDrawn(html, options).html;

/**
 * isoPieces, with what a helper that draws between pieces needs of an isometric one: {html, shapes, solids, floor} —
 * `shapes` a Map from a block's or a cylinder's name to {name, outline: [[x, y], …], middle: [x, y]} in slide px (the
 * points round what it draws, and the middle of that) and {kind, at: [col, row, lift], size} in tiles (where it
 * stands); `solids`: every block and cylinder so, those that share a name too (a wire cannot end at one of them, and
 * still must not run under it); `tight`: the names that do not fit their block's face even broken and shrunk,
 * [{name, text}]; `made`: how the map was made — {placed: 'build' | 'hand', tile, fitted};
 * `floor(col, row, lift)`: where a point of the floor is on the slide, [x, y] (absent when the map has no isometric
 * piece). A block is not the box it is placed by: a wire between two blocks is a cable along the floor, from a foot
 * of one to a foot of the other (cable.js), and a wire from a block to a flat piece ends on the block's outline
 * (transforms.js). A name two pieces share has no shape: it is found by its box, as before.
 */
export function isoDrawn(html, {canvas = null, area = null, links = [], lay = null} = {}) {
  const shapes = new Map(), solids = [], tight = [];
  if (!MAYBE.test(html) && !MAYBE_GRID.test(html)) return {html, shapes, solids, tight};
  const {html: map, grid: written, fit = false} = readGrid(html), found = readIso(map);
  if (!found.length) {
    if (fit) throw new Error('data-iso-grid="fit": the grid is fitted to the blocks, and this map has none — add a block, or take the grid out');
    return {html: map, shapes, solids, tight};
  }
  if (found.length > MOST_ISO_PIECES) throw new Error(`a map holds at most ${MOST_ISO_PIECES} isometric pieces, and this one has ${found.length}`);
  const {placedHere, reach} = place(found, links, lay);
  const grid = written ?? gridOf(found, {fit: fit || placedHere, canvas, area, also: reach});
  const drawn = found.map((p) => shapeOf(p, grid));
  // the order they are painted in, the furthest first: a level each, above the floor and the wires (which share level 0)
  const solid = found.filter((p) => p.kind !== 'floor'), order = grid.backToFront(solid, (p) => ({at: p.at, size: p.size}));
  let out = '', from = 0;
  found.forEach((p, i) => {
    out += map.slice(from, p.start) + draw(p, map, drawn[i], p.kind === 'floor' ? null : order.indexOf(p) + 1, grid.tile[0], tight);
    from = p.end;
  });
  const twice = new Set(solid.map((p) => p.name).filter((name, i, all) => all.indexOf(name) !== i));
  for (const p of solid) {
    const {outline, box} = drawn[found.indexOf(p)];
    const shape = {name: p.name, outline: outline.map(({x, y}) => [x, y]), middle: [box.x + box.w / 2, box.y + box.h / 2], kind: p.kind, at: [p.at[0], p.at[1], p.at[2] ?? 0], size: [...p.size]};
    solids.push(shape);
    if (!twice.has(p.name)) shapes.set(p.name, shape);
  }
  const made = {placed: placedHere ? 'build' : 'hand', tile: grid.tile[0], fitted: !written && (fit || placedHere)};
  return {html: out + map.slice(from), shapes, solids, tight, made, floor: (col, row, lift = 0) => { const point = grid.at(col, row, lift); return [point.x, point.y]; }};
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
:where(section[data-label] [data-sd-iso]) { position: absolute; box-sizing: border-box; --sd-hot-width: 0px; --iso-turn: var(--sd-turn, 0s); }
/* what it draws takes the pointer: its faces and its words, never the empty corners of its box. Only on the slide
   shown (deck-stage's [data-deck-active]): a slide that takes no pointer stays that way — "auto" written on a face
   would bring it back there — and a piece shown anywhere else (a Read lens) is left as it was */
:where(section[data-label][data-deck-active] [data-sd-iso]) { pointer-events: none; }
:where(section[data-label][data-deck-active] [data-sd-iso] :is(.iso-art > *, .iso-say)) { pointer-events: auto; }
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
/* on a forward click the ring comes when a box's does: .3s after the piece's moment (--sd-turn: 0 off a route, its turn
   on one, later under a new blur). That moment is not inherited, so the piece hands it to its faces as --iso-turn */
@keyframes sdIsoRing { from { filter: ${ringFilter('transparent', HOT_WIDTH)}; } }
@media screen and (prefers-reduced-motion: no-preference) {
  :where(section[data-label][data-deck-active]:not([data-sd-instant]):not([data-deck-static]) .sd-hot-in:is(${SOLID}) .iso-art) { animation: sdIsoRing .6s ease calc(.3s + var(--iso-turn, 0s)) both; }
}
`;
