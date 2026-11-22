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
// Numbers are written to one decimal, as every isometric page has been (0.1 px, no trailing zeros), and from the
// piece's box: a point of the frame minus the box's corner.

/** A role, as the kit checks it (paint.js · checkPaint): written into a class, so nothing else is let through. */
const ROLE = /^[a-z][a-z0-9-]{0,31}$/;
/** A colour, as the kit gives it: #rrggbb, lower case. Written into a style attribute, so nothing else is let through. */
const HEX = /^#[0-9a-f]{6}$/;

/** The stroke joins and caps the kit has (paint.js · checkStroke): each written into a style attribute as a word. */
const JOINS = ['round', 'miter', 'bevel'], CAPS = ['butt', 'round', 'square'];

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

/** What an item's own colours say, as a style attribute: '' when it carries none (the page's CSS colours it by role). */
function colours({fill, stroke}) {
  const said = [];
  if (fill?.colour != null) said.push(`fill:${hex(fill.colour)}`);
  if (stroke?.colour != null) {
    // each value checked before it is written: a word or a number past its range is refused, never dropped
    const width = fixed(within(stroke.width, 0, 1000, 'width')), alpha = within(stroke.alpha, 0, 1, 'alpha');
    said.push(`stroke:${hex(stroke.colour)}`, `stroke-width:${width}px`, `stroke-linejoin:${oneOf(stroke.join, JOINS, 'join')}`, `stroke-linecap:${oneOf(stroke.cap, CAPS, 'cap')}`);
    if (alpha !== 1) said.push(`stroke-opacity:${alpha}`);
  }
  return said.length ? ` style="${said.join(';')}"` : '';
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
function itemSvg(it, x, y) {
  const head = `class="${roleClass(it.role)}"${colours(it)}`;
  switch (it.item) {
    case 'polygon': return `<polygon ${head} points="${it.points.map(([px, py]) => `${rel(px, x)},${rel(py, y)}`).join(' ')}"/>`;
    case 'ellipse': return `<ellipse ${head} cx="${rel(it.cx, x)}" cy="${rel(it.cy, y)}" rx="${fixed(it.rx)}" ry="${fixed(it.ry)}"/>`;
    case 'lines': return `<path ${head} d="${it.segments.map(([x1, y1, x2, y2]) => `M${rel(x1, x)} ${rel(y1, y)}L${rel(x2, x)} ${rel(y2, y)}`).join('')}"/>`;
    case 'path': return `<path ${head} d="${pathData(it.segments, x, y)}"/>`;
    // a kind of item this painter does not know is refused: drawn as nothing, a piece would lose a face unseen
    default: throw new Error(`isoPaint: a paint item is a polygon, an ellipse, a path or lines — not ${JSON.stringify(it.item)}`);
  }
}

/** A piece's paint list as the SVG inside its box ({x, y}: the box's corner on the slide), in paint order. */
export const isoArt = (items, {x, y}) => items.map((it) => itemSvg(it, x, y)).join('');
