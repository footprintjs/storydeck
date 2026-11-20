// floorLabel — a floor's name, drawn flat on the floor along its front edge, the way a diagram heads a group box:
//
//   <div data-k="prod" data-iso="floor" data-size="8 5" data-label="Production account" data-icon="account"></div>
//
// The words lie on the floor (their lines run along the floor's cols, toward the lower right of the slide), just in
// from the edge nearest the viewer on the left, from its far end. They are part of the floor's element, so they grey,
// light and hide with it. They are fitted to the edge as a block's name is fitted to its top (footprint-story/isometric
// · wordsToFit: one line, then two, then smaller down to a least size); a label that still does not fit is drawn at the
// least size and said (check · name-fit) — never cut.
//
// WHY flat on the floor and not a plate standing on it: a plate reads as one more object; words on the ground read as
// the name of the ground. WHY a size from the tile, with a least: the camera zooms the whole slide, so a label is as
// readable as the floor it names, and never smaller than the least at the picture's own size.
import {wordsToFit} from 'footprint-story/isometric';

/** Where the words start: tiles in along the edge from its far end, and in from the edge. */
const ALONG = 0.3, IN = 0.15;
/** The label's size for each px of a tile's side on the slide, and the most and least it is drawn at. */
const SIZE = Object.freeze({per: 0.3, most: 28, least: 14});
/** The most letters a label has: a name, not a paragraph. */
export const MOST_LABEL = 120;
/** How wide a letter is for each px of its size — the common package's count (wordsToFit), a bold sans face. */
const LETTER = 0.6;
/** Tiles of floor kept clear past the counted end of the words. */
const CLEARANCE = 0.25;

/** Whether two convex outlines on the slide ([[x, y], …], each in order round it) overlap: no line parts them (SAT). */
function overlap(a, b) {
  for (const poly of [a, b]) {
    for (let i = 0; i < poly.length; i++) {
      const [x1, y1] = poly[i], [x2, y2] = poly[(i + 1) % poly.length], nx = y2 - y1, ny = x1 - x2;
      const span = (pts) => pts.map(([x, y]) => x * nx + y * ny);
      const pa = span(a), pb = span(b);
      if (Math.max(...pa) <= Math.min(...pb) + 1e-9 || Math.max(...pb) <= Math.min(...pa) + 1e-9) return false;
    }
  }
  return true;
}

/**
 * A floor's label placed: `floor` {at: [col, row], size: [cols, rows]}, `grid` footprint-story's isometric grid,
 * `text` the label's words, `covers` the outlines on the slide of what stands on the map ([[[x, y], …], …]: each is
 * drawn over the floor). Gives {x, y} where the line's foot starts on the slide, `matrix` [a, b, c, d] (the CSS
 * transform that lays the words on the floor: a line along the cols, a line's height toward the far rows), `size` the
 * font size in px, `lines` the words as drawn, `fits` false when they do not fit along the edge even at the least size,
 * `covered` true when no place along the edge is clear of what stands there.
 *
 * WHERE along the edge: from its far end, the first place (half a tile at a time) where the words' strip of floor, as
 * drawn on the slide, meets no outline — a block is drawn over the floor, so one there would hide them.
 */
export function floorLabelPlace({at: [col, row], size: [cols, rows]}, grid, text, covers = []) {
  const [tw, th] = grid.tile, side = Math.hypot(tw / 2, th / 2);   // a tile's side on the slide, in px
  const matrix = [tw / 2 / side, th / 2 / side, -tw / 2 / side, th / 2 / side];
  const size = Math.max(SIZE.least, Math.min(SIZE.most, Math.round(SIZE.per * side)));
  const room = Math.max(0, cols - 2 * ALONG) * side;
  const fit = wordsToFit(text, () => room, {size, least: SIZE.least});
  const drawnSize = fit.size ?? size, lines = Math.max(1, fit.lines.length);
  // the words' strip of floor, in tiles: how long along the cols, how deep toward the far rows
  // (a quarter tile more along it: the letters are counted, not measured, and the label's own spacing widens them)
  const long = Math.max(...fit.lines.map((line) => line.length), 1) * LETTER * drawnSize / side + CLEARANCE, deep = lines * 1.15 * drawnSize / side;
  const near = row + rows - IN, far = near - deep;
  const strip = (from) => [[from, far], [from + long, far], [from + long, near], [from, near]].map(([c, r]) => { const p = grid.at(c, r); return [p.x, p.y]; });
  const clear = (from) => covers.every((outline) => !overlap(strip(from), outline));
  let from = col + ALONG;
  for (let at = col + ALONG; at + long <= col + cols - ALONG + 1e-9; at += 0.5) if (clear(at)) { from = at; break; }
  const start = grid.at(from, near);
  return {x: start.x, y: start.y, matrix, size: drawnSize, lines: fit.lines, fits: fit.fits, covered: !clear(from)};
}
