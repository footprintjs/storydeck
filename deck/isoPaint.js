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
// Numbers are written to one decimal, as every isometric page has been (0.1 px, no trailing zeros), and from the
// piece's box: a point of the frame minus the box's corner.

import {isometric, isoStyle, paintPiece} from 'footprint-story/isometric';

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

/** What an item's own colours say, as a style attribute: '' when it carries none (the page's CSS colours it by role). */
function colours({fill}, stroke) {
  const said = [];
  if (fill?.colour != null) said.push(`fill:${hex(fill.colour)}`);
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

/** One paint item as one SVG element, placed in the box whose corner is (x, y). */
function itemSvg(it, x, y, styled) {
  const stroke = strokeOf(it.stroke), head = `class="${roleClass(it.role)}"${strokeApart(it.role, stroke, styled)}${colours(it, stroke)}`;
  switch (it.item) {
    case 'polygon': return `<polygon ${head} points="${it.points.map(([px, py]) => `${rel(px, x)},${rel(py, y)}`).join(' ')}"/>`;
    case 'ellipse': return `<ellipse ${head} cx="${rel(it.cx, x)}" cy="${rel(it.cy, y)}" rx="${fixed(it.rx)}" ry="${fixed(it.ry)}"/>`;
    case 'lines': return `<path ${head} d="${it.segments.map(([x1, y1, x2, y2]) => `M${rel(x1, x)} ${rel(y1, y)}L${rel(x2, x)} ${rel(y2, y)}`).join('')}"/>`;
    case 'path': return `<path ${head} d="${pathData(it.segments, x, y)}"/>`;
    // a hand-drawn stroke (footprint-story 0.30's `stroke` item) comes only from the sketch style choices a tool hands
    // in (sketchyLine, hatchTexture), and a deck's data-style offers none of them: refused by name, never drawn as nothing
    case 'stroke': throw new Error('isoPaint: a hand-drawn stroke item is painted by a tool that offers the sketch styles (footprint-story/human · sketchyLine, hatchTexture) — a deck\'s data-style offers none, so its paint list has no strokes');
    // a kind of item this painter does not know is refused: drawn as nothing, a piece would lose a face unseen
    default: throw new Error(`isoPaint: a paint item is a polygon, an ellipse, a path or lines — not ${JSON.stringify(it.item)}`);
  }
}

/** A piece's paint list as the SVG inside its box ({x, y}: the box's corner on the slide), in paint order. */
/**
 * `styled`: the map names a style (data-style), so every stroke value its style gives is written out (strokeApart);
 * left out, only what the page does not already draw.
 */
export const isoArt = (items, {x, y}, {styled = false} = {}) => items.map((it) => itemSvg(it, x, y, styled)).join('');
