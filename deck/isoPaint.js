// isoPaint — the one SVG painter of the deck: a piece's paint list (footprint-story/isometric · paint.js, the map
// steps' `style` step: `paints`, `floorPaints`) written as the SVG inside its box. Plain data in, a string out.
//
//   isoArt(built.paints[i], built.shapes[i].box)   → '<polygon class="iso-left" points="0,60 …"/>…'
//
// WHY a painter and not strings of our own: the kit's style column makes the faces, and a film paints the very same
// list on a canvas, so a deck and a film draw one picture. This file only says how an item is written in SVG.
//
// WHY classes from the role: the deck's CSS (iso.js · ISO_CSS) colours a piece by its faces' classes, so a theme's
// --iso-color still colours it. A role is written `iso-<role>`; the tile lines (`grid`) keep the class they have
// always had, `iso-lines`. An item that carries no colour gets none written: the page decides. One that carries a
// colour (a palette of its own, a later step) gets it in a style attribute, which a class rule with no weight cannot
// override — so the colour the list says is the colour drawn.
//
// WHY a stroke's width, join, cap and alpha are written apart from its colour (0.36.0): a style says them with no
// colour (a map's data-style, isoStyle.js: "line: ink width 5" draws 5 px, "line: none" draws no outline), and the
// page's CSS would draw its own 2.5 px ink (or a theme's --iso-line-width) over a list that said otherwise. So a map
// that names a style (`styled`) has every stroke value its style gives written out, as presentation attributes —
// stroke-width="5" stroke-linejoin="round" stroke-linecap="butt", or stroke="none" — so "width 2.5" and "width 2.6"
// both draw what they say, and a theme's --iso-line-width never stands in for a width the map named. A map that names
// none writes only what differs from what the page already draws for its role (PAGE_STROKES: the usual style's own
// list, the look ISO_CSS is written to) — nothing, for every list the kit makes — so it is byte for byte as before and
// --iso-line-width still sets its lines. Alpha is the one value always compared to the role's: the page's colour for a
// role already carries it (the tile lines' 16% is in --iso-grid), so writing it again would draw it twice.
// A presentation attribute is the weakest author style: it beats what an item inherits from .iso-art, and loses to any
// CSS rule that names the element — theme.css's, a state's, and the floor's focus ring (iso.js · isoRing sets stroke and
// stroke-width on .iso-ground) — so it fights none of the deck's CSS colours. (The tile lines' 1.5 px is a CSS rule on
// .iso-lines, which wins over an attribute: every line choice the kit has keeps it.)
//
// WHY a hand-drawn stroke is drawn as a filled ring (0.39.0): a `stroke` item (footprint-story/human · strokes) lays a
// width per point, and an SVG line has one width. So the painter fills the ring round it, as the kit says a painter
// that cannot vary a line's width does — that ring is footprint-story's `strokeOutline(points)`, the one geometry of a
// line of changing width, never worked out here: numbers in footprint-story, drawing in StoryDeck. Its ink is the
// stroke's colour, or the page's line colour (PAGE_LINE, the colour .iso-art outlines a face with) when it carries none,
// as its fill; it takes no outline of its own (stroke="none"), which would thicken every point by the page's line.
// Its ends are capped by the same ring (strokeOutline(points, {cap: stroke.cap}), footprint-story 0.33.0): a round, butt
// or square end is geometry, so it is the kit's, never a disc drawn here. The ring can cross itself at a round cap on a
// short, sharply turning stroke, so it is filled by the non-zero rule — written in its style attribute (fill-rule:nonzero),
// which a page's rule with no weight cannot override, so no even-odd rule cuts a hole where it crosses.
//
// WHY the whole stroke, and its time unplayed: a deck page is drawn at rest, whole — a stroke's `t` (when the pen is
// at each point) is a film's to play (StoryReel), and the map's record says so (strokesDrawn, STROKE_TIMING).
//
// WHY a texture's marks are drawn once too (0.40.0): a `lines` item a texture lays (footprint-story's `human:grain`,
// role `grain` / `grain-thinned`: one item a face, thousands of 1 to 3 px marks) is written again on every click of its
// part, as a stroke was — a 64-block grain map carried 0.33 MB a click. So every item but a face drawn once a page goes
// the strokes' way (DRAWN_ONCE): a stroke, or `lines` that are not the floor's tile lines. The tile lines (`grid`) stay
// in place — every map has them, they are a few hundred bytes a floor, and a page that draws no texture is byte for
// byte as before. A mark's colour is the map's ink when it carries none: the page's, which a `<use>` hands down to it.
//
// WHY a paper fill is written as the page's paper (0.40.0): a paper shading (footprint-story's `shading: paper`, the
// look `line-art`) fills every face and the floor's ground with the paper's colour, and a page's theme is chosen when
// it is VIEWED (T switches light and dark; with no choice saved, the system decides) — the build cannot know it. So a
// fill whose colour is the map's paper is written `fill:var(--iso-paper, <the paper>)`: in a light page the paper as
// the kit gave it, and on a dark one the page's own (iso.js · LOOK_CSS sets --iso-paper to the page's --bg-elev, and
// the ink of the map's lines and names to its --fg), so its names keep their contrast in both.
//
// Numbers are written to one decimal, as every isometric page has been (0.1 px, no trailing zeros), and from the
// piece's box: a point of the frame minus the box's corner.

import {isometric, isoStyle, paintPiece} from 'footprint-story/isometric';
import {strokeOutline} from 'footprint-story/human';

/** A role, as the kit checks it (paint.js · checkPaint): written into a class, so nothing else is let through. */
const ROLE = /^[a-z][a-z0-9-]{0,31}$/;
/** A colour, as the kit gives it: #rrggbb, lower case. Written into a style attribute, so nothing else is let through. */
const HEX = /^#[0-9a-f]{6}$/;

/** The stroke joins and caps the kit has (paint.js · checkStroke): each written into a style attribute as a word. */
const JOINS = ['round', 'miter', 'bevel'], CAPS = ['butt', 'round', 'square'];

/**
 * What the page draws for each role when an item says nothing more: the strokes of the kit's usual style (USUAL_STYLE),
 * read off its own paint list for a block, a cylinder and a floor — {role: {alpha, width, join, cap} | null}. WHY read
 * from the kit and not written here: the deck's CSS (iso.js · ISO_CSS) is written to the usual look, and a test pins its
 * numbers to these; a role no piece of the usual style has is drawn with what .iso-art hands down, a face's stroke.
 */
export const PAGE_STROKES = (() => {
  const style = isoStyle(), grid = isometric(), out = {};
  const pieces = [{name: 'b', kind: 'block', at: [0, 0], size: [2, 2, 1]}, {name: 'c', kind: 'cylinder', at: [0, 0], size: [2, 2, 1]}, {name: 'f', kind: 'floor', at: [0, 0], size: [2, 2]}];
  for (const piece of pieces) {
    for (const {role, stroke} of paintPiece(style, piece, grid).items) out[role] = stroke && Object.freeze({alpha: stroke.alpha, width: stroke.width, join: stroke.join, cap: stroke.cap});
  }
  return Object.freeze(out);
})();

/**
 * The colour a paper shading (`shading`, as a row writes it) fills a face with, as the kit gives it (lower-case
 * #rrggbb): read off the kit's own list for a block — its top face's fill — so neither the paper's default nor how a
 * colour is read is written here.
 */
const paperFill = (shading) => paintPiece(isoStyle({shading}), {name: 'b', kind: 'block', at: [0, 0], size: [2, 2, 1]}, isometric()).items.find((it) => it.role === 'top').fill.colour;
/** The paper a paper shading fills with when its style names no colour (the kit's: #ffffff). */
export const PAPER = paperFill('paper');
/** The page's paper, as a fill: the paper the map was built with when the page sets none (a light page), the page's own on a dark one (iso.js · LOOK_CSS). */
export const pagePaper = (colour) => `var(--iso-paper, ${colour})`;

/**
 * The paper a map's style fills with ({row, options}, the built map's `style`): its colour as the kit writes it, or
 * null when it has no paper shading. WHY asked of the row and not of the fills: a fill with a colour is the paper only
 * on a paper map — on another a colour is the palette's, and stays as given.
 */
export function paperOf(style) {
  if (style?.row?.shading !== 'paper') return null;
  const colour = style.options?.shading?.colour;
  return colour === undefined ? PAPER : paperFill({name: 'paper', colour});
}

/**
 * A number as written: one decimal. WHY it refuses: every number of an item reaches the page through here, so a list
 * that skipped the kit's check (paint.js · checkPaint) cannot write NaN, Infinity or a word into an attribute.
 */
function num(v) {
  if (typeof v !== 'number' || !Number.isFinite(v)) throw new Error(`isoPaint: a paint item's numbers are finite — not ${JSON.stringify(v) ?? String(v)}`);
  return v;
}
const fixed = (v) => +num(v).toFixed(1);
/** A point of the frame as written in the box: checked before it is subtracted, so null or a word never passes as 0. */
const rel = (v, corner) => fixed(num(v) - num(corner));
/** A number from `least` to `most`, or a refusal naming what it is. */
function within(v, least, most, what) {
  if (typeof v !== 'number' || !(v >= least && v <= most)) throw new Error(`isoPaint: a stroke's ${what} is from ${least} to ${most} — not ${JSON.stringify(v) ?? String(v)}`);
  return v;
}
/** A word from a fixed list, or a refusal naming the list. */
function oneOf(v, list, what) {
  if (!list.includes(v)) throw new Error(`isoPaint: a stroke's ${what} is ${list.join(', ')} — not ${JSON.stringify(v)}`);
  return v;
}

/** The class an item is written with: `iso-<role>`, the tile lines `iso-lines`. */
export function roleClass(role) {
  if (typeof role !== 'string' || !ROLE.test(role)) throw new Error(`isoPaint: a paint item's role is a short lower-case name ("top", "hatch") — not ${JSON.stringify(role)}`);
  return `iso-${role === 'grid' ? 'lines' : role}`;
}

/**
 * A stroke as the painter reads it: null, or {colour, alpha, width, join, cap} with each value checked before anything
 * is written — a word or a number past its range is refused, never dropped (and a stroke that is no object never passes
 * as none).
 */
function strokeOf(stroke) {
  if (stroke === null || stroke === undefined) return null;
  if (typeof stroke !== 'object') throw new Error(`isoPaint: a paint item's stroke is {colour, alpha, width, join, cap}, or null — not ${JSON.stringify(stroke)}`);
  return {colour: stroke.colour, alpha: within(stroke.alpha, 0, 1, 'alpha'), width: fixed(within(stroke.width, 0, 1000, 'width')), join: oneOf(stroke.join, JOINS, 'join'), cap: oneOf(stroke.cap, CAPS, 'cap')};
}

/**
 * What an item's own colours say, as a style attribute: '' when it carries none (the page's CSS colours it by role). A
 * fill in the map's `paper` (paperOf) is the page's paper (pagePaper).
 */
function colours({fill}, stroke, paper) {
  const said = [];
  if (fill?.colour != null) said.push(`fill:${fill.colour === paper ? pagePaper(hex(fill.colour)) : hex(fill.colour)}`);
  if (stroke?.colour != null) {
    said.push(`stroke:${hex(stroke.colour)}`, `stroke-width:${stroke.width}px`, `stroke-linejoin:${stroke.join}`, `stroke-linecap:${stroke.cap}`);
    if (stroke.alpha !== 1) said.push(`stroke-opacity:${stroke.alpha}`);
  }
  return said.length ? ` style="${said.join(';')}"` : '';
}

/**
 * A stroke with no colour of its own, as presentation attributes: on a map that names a style (`styled`) its width,
 * join and cap all written; on one that names none only what differs from what the page draws for its role
 * (PAGE_STROKES); its alpha only where it differs from the role's, either way. No stroke where the page draws one is
 * stroke="none". A stroke with a colour says all of it in its style attribute (colours), so nothing is written here.
 */
function strokeApart(role, stroke, styled) {
  if (stroke?.colour != null) return '';
  const page = Object.hasOwn(PAGE_STROKES, role) ? PAGE_STROKES[role] : PAGE_STROKES.top;
  if (stroke === null) return page === null ? '' : ' stroke="none"';
  const said = [];
  if (styled || stroke.width !== page?.width) said.push(` stroke-width="${stroke.width}"`);
  if (styled || stroke.join !== page?.join) said.push(` stroke-linejoin="${stroke.join}"`);
  if (styled || stroke.cap !== page?.cap) said.push(` stroke-linecap="${stroke.cap}"`);
  if (stroke.alpha !== (page?.alpha ?? 1)) said.push(` stroke-opacity="${stroke.alpha}"`);
  return said.join('');
}
const hex = (c) => { if (!HEX.test(c)) throw new Error(`isoPaint: a paint item's colour is "#rrggbb" — not ${JSON.stringify(c)}`); return c; };

/**
 * A path's segments as SVG path data. An arc runs from angle `from` to `to` on its ellipse, at most half a turn, so its
 * large-arc flag is always 0, and its sweep is 0 when it turns anticlockwise (y down, as a canvas counts). Like a
 * canvas's, an arc is reached by a straight line from the pen: that line is written only when it goes somewhere — when
 * the arc's start, as written, is not where the pen already is (SVG starts an arc at the pen).
 */
function pathData(segments, x, y) {
  let pen = null, start = null, d = '';
  const at = (px, py) => `${rel(px, x)} ${rel(py, y)}`;
  for (const [op, ...a] of segments) {
    if (op === 'move') { pen = start = at(a[0], a[1]); d += `M${pen}`; } else if (op === 'line') { pen = at(a[0], a[1]); d += `L${pen}`; } else if (op === 'arc') {
      const [cx, cy, rx, ry, from, to] = a.slice(0, 6).map(num), anticlockwise = a[6];
      if (typeof anticlockwise !== 'boolean') throw new Error(`isoPaint: an arc says which way it turns, true or false — not ${JSON.stringify(anticlockwise)}`);
      const begin = at(cx + rx * Math.cos(from), cy + ry * Math.sin(from));
      if (begin !== pen) d += `${pen === null ? 'M' : 'L'}${begin}`;
      pen = at(cx + rx * Math.cos(to), cy + ry * Math.sin(to));
      d += `A${fixed(rx)} ${fixed(ry)} 0 0 ${anticlockwise ? 0 : 1} ${pen}`;
    } else if (op === 'close') { d += 'Z'; pen = start; } else throw new Error(`isoPaint: a path's segment is move, line, arc or close — not ${JSON.stringify(op)}`);
  }
  return d;
}

/**
 * The colour the page outlines a face with, as ISO_CSS writes it on .iso-art (iso.js; a test pins the two equal): the
 * ink of a hand-drawn stroke that carries no colour of its own, written in its style attribute because a stroke is
 * drawn as a fill, and no rule of the page's fills by the line's colour.
 */
export const PAGE_LINE = 'var(--iso-line, var(--iso-ink, #14181f))';
/** What a map's record says of the strokes it draws: their time is not played on a page. */
export const STROKE_TIMING = 'drawn whole, at rest: a page does not play a stroke\'s timing (StoryReel plays it)';

/**
 * A hand-drawn stroke as one SVG path: footprint-story's ring round it, its ends capped as its stroke says
 * (strokeOutline), filled in its ink by the non-zero rule. Each point
 * is checked before the ring is asked for — [x, y, width, t], finite, its width from 0 to the stroke's — so a point
 * that skipped the kit's check never bends the ring or writes a stray word; a stroke with no ink, or a fill, is
 * refused (it would be drawn as nothing, or as a face).
 */
function strokeSvg(it, x, y) {
  const stroke = strokeOf(it.stroke);
  if (stroke === null || it.fill != null) throw new Error('isoPaint: a hand-drawn stroke\'s fill is null and its stroke names its colour, alpha and cap');
  if (!Array.isArray(it.points) || it.points.length < 2) throw new Error(`isoPaint: a hand-drawn stroke has at least 2 points — not ${JSON.stringify(it.points?.length ?? it.points)}`);
  for (const p of it.points) {
    if (!Array.isArray(p) || p.length !== 4) throw new Error(`isoPaint: a hand-drawn stroke's point is [x, y, width, t] — not ${JSON.stringify(p)}`);
    p.forEach(num);
    if (!(p[2] >= 0 && p[2] <= it.stroke.width + 1e-9)) throw new Error(`isoPaint: a hand-drawn stroke's point is as wide as 0 to its stroke's ${stroke.width} px — not ${p[2]}`);
  }
  const ring = strokeOutline(it.points, {cap: stroke.cap});
  const ink = [`fill:${stroke.colour == null ? PAGE_LINE : hex(stroke.colour)}`, ...(stroke.alpha === 1 ? [] : [`fill-opacity:${stroke.alpha}`]), 'fill-rule:nonzero'];
  return `<path class="${roleClass(it.role)}" stroke="none" style="${ink.join(';')}" d="${ring.map(([px, py], i) => `${i ? 'L' : 'M'}${rel(px, x)} ${rel(py, y)}`).join('')}Z"/>`;
}

/**
 * An item drawn once a page (isoArt's `strokes`): a hand-drawn stroke, or a texture's marks — `lines` that are not the
 * floor's tile lines (`grid`, which every map has and which stay in place, so a page with no texture is as before).
 */
export const DRAWN_ONCE = (it) => it.item === 'stroke' || (it.item === 'lines' && it.role !== 'grid');

/**
 * What a map's record says of what it draws once a page: {strokes, marks?, bytes, timing?} — how many hand-drawn
 * strokes its pieces' lists draw, how many marks a texture lays (each segment of a DRAWN_ONCE `lines` item: a grain's
 * flecks; only when there are some), the bytes the page carries them in (`defs`, isoArt's `strokes`: once for the
 * whole page; ASCII, so a letter is a byte), and that a stroke's time is not played (STROKE_TIMING; only when there are
 * strokes) — or null when they draw none, so a map with none records as before. Their points are not kept here: they
 * are the steps' (built again from the map's spec and the deck's choices).
 */
export function strokesDrawn(lists, defs = new Map()) {
  let strokes = 0, marks = 0;
  for (const it of lists.flat()) {
    if (it.item === 'stroke') strokes += 1;
    else if (DRAWN_ONCE(it)) marks += it.segments.length;
  }
  if (!strokes && !marks) return null;
  return {strokes, ...(marks ? {marks} : {}), bytes: [...defs.values()].reduce((n, g) => n + g.length, 0), ...(strokes ? {timing: STROKE_TIMING} : {})};
}

/** One paint item but a stroke (strokeSvg writes those) as one SVG element, placed in the box whose corner is (x, y). */
function itemSvg(it, x, y, styled, paper = null) {
  const stroke = strokeOf(it.stroke), head = `class="${roleClass(it.role)}"${strokeApart(it.role, stroke, styled)}${colours(it, stroke, paper)}`;
  switch (it.item) {
    case 'polygon': return `<polygon ${head} points="${it.points.map(([px, py]) => `${rel(px, x)},${rel(py, y)}`).join(' ')}"/>`;
    case 'ellipse': return `<ellipse ${head} cx="${rel(it.cx, x)}" cy="${rel(it.cy, y)}" rx="${fixed(it.rx)}" ry="${fixed(it.ry)}"/>`;
    case 'lines': return `<path ${head} d="${it.segments.map(([x1, y1, x2, y2]) => `M${rel(x1, x)} ${rel(y1, y)}L${rel(x2, x)} ${rel(y2, y)}`).join('')}"/>`;
    case 'path': return `<path ${head} d="${pathData(it.segments, x, y)}"/>`;
    // a kind of item this painter does not know is refused: drawn as nothing, a piece would lose a face unseen
    default: throw new Error(`isoPaint: a paint item is a polygon, an ellipse, a path, lines or a stroke — not ${JSON.stringify(it.item)}`);
  }
}

/**
 * A name for a run of strokes, from what it draws: FNV-1a over its markup, two 32-bit lanes (16 hex digits). WHY from
 * the markup, not a counter: the same strokes are the same def wherever they are drawn (a map's every click, two maps
 * alike), and a page's name for them never depends on the order the maps were built in.
 */
export function strokesId(markup) {
  let a = 0x811c9dc5, b = 0x01000193 ^ markup.length;
  for (let i = 0; i < markup.length; i += 1) {
    const c = markup.charCodeAt(i);
    a = Math.imul(a ^ c, 0x01000193) >>> 0;
    b = Math.imul(b ^ c, 0x0100019d) >>> 0;
  }
  return `sd-st-${a.toString(16).padStart(8, '0')}${b.toString(16).padStart(8, '0')}`;
}

/**
 * A piece's paint list as the SVG inside its box ({x, y}: the box's corner on the slide), in paint order.
 * `styled`: the map names a style (data-style), so every stroke value its style gives is written out (strokeApart);
 * left out, only what the page does not already draw.
 * `strokes`: a Map the map's hand-drawn strokes and texture marks (DRAWN_ONCE) are kept in, drawn ONCE for the whole
 * page (id → `<g id>`): each run of them in a row is written there and drawn here as one `<use href="#id"/>`, in its
 * place in the paint order. WHY: a map is written again on every click of its part, and a hatched or grained map's
 * strokes and marks are most of its bytes (64 hatched blocks: 1.6 MB a click; 64 grained: 0.33 MB) — drawn once, a
 * click carries a few bytes for each run. Left out, they are written in place, as one list's own SVG (a test, a
 * caller with no page).
 * `paper`: the map's paper (paperOf), or null — a fill in it is written as the page's paper (pagePaper).
 */
export function isoArt(items, {x, y}, {styled = false, strokes = null, paper = null} = {}) {
  let out = '', run = '';
  const flush = () => {
    if (!run) return;
    if (strokes) { const id = strokesId(run); strokes.set(id, `<g id="${id}">${run}</g>`); out += `<use href="#${id}"/>`; } else out += run;
    run = '';
  };
  for (const it of items) {
    if (DRAWN_ONCE(it)) { run += it.item === 'stroke' ? strokeSvg(it, x, y) : itemSvg(it, x, y, styled, paper); continue; }
    flush();
    out += itemSvg(it, x, y, styled, paper);
  }
  flush();
  return out;
}

/** The hidden SVG a page draws its maps' strokes in, once (isoArt's `strokes`, as {id: `<g id>`}); '' when there are none. */
export const strokesSvg = (defs) => {
  const all = Object.values(defs ?? {});
  return all.length ? `<svg data-sd-strokes aria-hidden="true" width="0" height="0" style="position:absolute;width:0;height:0;overflow:hidden"><defs>${all.join('')}</defs></svg>` : '';
};

/**
 * A slide's HTML with each drawn-once stroke run written back in place (`defs`: {id: `<g id>`}): for HTML shown away from
 * the page that holds the defs — the Read and Scroll lenses' deck-data.json, whose sections are each shown alone. An id
 * the defs do not hold is refused: a stroke would vanish unseen.
 */
export function inlineStrokes(html, defs) {
  return html.replace(/<use href="#(sd-st-[0-9a-f]{16})"\/>/g, (_, id) => {
    if (!Object.hasOwn(defs ?? {}, id)) throw new Error(`isoPaint: a slide draws strokes "${id}", which the page's strokes do not hold`);
    return defs[id].replace(/^<g id="[^"]*">/, '').replace(/<\/g>$/, '');
  });
}
