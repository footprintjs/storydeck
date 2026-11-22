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

const fixed = (v) => +v.toFixed(1);

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
    said.push(`stroke:${hex(stroke.colour)}`, `stroke-width:${fixed(stroke.width)}px`, `stroke-linejoin:${stroke.join}`, `stroke-linecap:${stroke.cap}`);
    if (stroke.alpha !== 1) said.push(`stroke-opacity:${stroke.alpha}`);
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
  const at = (px, py) => `${fixed(px - x)} ${fixed(py - y)}`;
  for (const [op, ...a] of segments) {
    if (op === 'move') { pen = start = at(a[0], a[1]); d += `M${pen}`; } else if (op === 'line') { pen = at(a[0], a[1]); d += `L${pen}`; } else if (op === 'arc') {
      const [cx, cy, rx, ry, from, to, anticlockwise] = a, begin = at(cx + rx * Math.cos(from), cy + ry * Math.sin(from));
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
    case 'polygon': return `<polygon ${head} points="${it.points.map(([px, py]) => `${fixed(px - x)},${fixed(py - y)}`).join(' ')}"/>`;
    case 'ellipse': return `<ellipse ${head} cx="${fixed(it.cx - x)}" cy="${fixed(it.cy - y)}" rx="${fixed(it.rx)}" ry="${fixed(it.ry)}"/>`;
    case 'lines': return `<path ${head} d="${it.segments.map(([x1, y1, x2, y2]) => `M${fixed(x1 - x)} ${fixed(y1 - y)}L${fixed(x2 - x)} ${fixed(y2 - y)}`).join('')}"/>`;
    case 'path': return `<path ${head} d="${pathData(it.segments, x, y)}"/>`;
    // a kind of item this painter does not know is refused: drawn as nothing, a piece would lose a face unseen
    default: throw new Error(`isoPaint: a paint item is a polygon, an ellipse, a path or lines — not ${JSON.stringify(it.item)}`);
  }
}

/** A piece's paint list as the SVG inside its box ({x, y}: the box's corner on the slide), in paint order. */
export const isoArt = (items, {x, y}) => items.map((it) => itemSvg(it, x, y)).join('');
