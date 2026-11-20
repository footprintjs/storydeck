// keepClear — floor a cable keeps off, under words that float above it: a device's name, a note, a callout.
//
//   <div data-k="lap-name" class="name" data-keep-clear style="left:660px;top:420px;width:180px;height:36px">Laptop</div>
//
// A piece placed by its own style, marked data-keep-clear: the floor its box covers on the slide is floor kept clear for
// the cables the build lays (footprint-story/isometric · routes, `keep`): a cable goes round its words where there is
// another way, and where there is none runs under them, and `check` (rule wire-way) says which cable runs under which
// piece. Kept floor is a cost, never a wall: no cable is left without a way for words.
//
// WHY the floor under the box: a cable lies on the floor, so the words cover it where the floor under them is — the
// points of the floor whose place on the slide falls in the box. WHY the floor must be in numbers: the piece stands
// where its style puts it, so a floor fitted to the slide would move under it (as for a footprint).
import {ownAttribute, pieceTags} from '../pieceRules.js';
import {readPieces} from '../focusHtml.js';

const MAYBE = /data-keep-clear(?![\w-])/i;
/** The floor kept clear is found in squares this many tiles a side. */
export const CLEAR_CELL = 0.5;
/**
 * Tiles each stretch reaches past its squares: the router asks whether a way is strictly inside kept floor, and two
 * stretches side by side meet on a line of the floor — a way along that line would be inside neither. A hair more
 * makes them overlap, so the line between them is kept floor too.
 */
const SEAM = 0.01;
/** The most squares of floor one box is asked over: a box the size of a slide on the smallest tile is far fewer. */
const MOST_CELLS = 200_000;
/** The furthest a box may stand from the slide, in px: the floor's own reach (footprint-story · FAR). */
const FAR = 1e6;

export const mayKeepClear = (html) => MAYBE.test(html);

/**
 * The pieces marked data-keep-clear, in order: [{name, box: {x, y, w, h}, where}]. Throws, naming the fix, for a mark on
 * a piece with no box of its own (a left, a top, a width and a height in its style).
 */
export function readKeepClear(html) {
  if (!mayKeepClear(html)) return [];
  const tags = [...pieceTags(html)], out = [];
  readPieces(html).pieces.forEach((piece, i) => {
    const run = tags[i].before + tags[i].after, own = MAYBE.test(run) ? ownAttribute(run, 'data-keep-clear') : null;
    if (!own) return;
    const where = `"${piece.keys[0]}" (data-keep-clear)`;
    if (!piece.box || !(piece.box.w > 0 && piece.box.h > 0)) throw new Error(`${where}: the floor kept clear is the floor under the piece's box — give it a left, a top, a width and a height in its style`);
    out.push({name: piece.keys[0], box: {...piece.box}, where});
  });
  // a mark on a tag that is no piece (no data-k) keeps nothing clear: refused, not ignored
  const marked = [...html.matchAll(/<[a-zA-Z][\w-]*\b([^>]*)>/g)].filter((t) => MAYBE.test(t[1]) && ownAttribute(t[1], 'data-keep-clear') && !ownAttribute(t[1], 'data-k')).length;
  if (marked) throw new Error('data-keep-clear: it marks a piece (a data-k name, and a box in its style) — give the element a data-k, or take the mark off');
  return out;
}

/**
 * The floor under a box on the slide at a height, as stretches: [{at: [col, row, lift], size: [wide, deep]}] —
 * every CLEAR_CELL square of the floor at `lift` whose drawn diamond meets the box (exactly: the box grown by the
 * diamond, asked at its middle), those side by side along a row joined into one, each reaching SEAM past its squares. `grid`: footprint-story's isometric
 * grid (`at`, `tileAt`, `tile`, `rise`). Throws, with the fix, when the box covers more floor than a picture needs.
 */
export function floorUnder({x, y, w, h}, grid, lift = 0, where = 'data-keep-clear', budget = {left: Infinity, most: Infinity}) {
  const [tw, th] = grid.tile, hw = CLEAR_CELL * tw / 2, hh = CLEAR_CELL * th / 2, up = lift * grid.rise;
  // the floor at `lift` is drawn `up` px higher: the point of it under a slide point is the floor's under that point lowered
  if (![x, y, x + w, y + h + up].every((v) => Math.abs(v) <= FAR)) throw new Error(`${where}: its box stands further than ${FAR} px from the slide — give it a place on the slide`);
  const corners = [[x, y], [x + w, y], [x, y + h], [x + w, y + h]].map(([px, py]) => grid.tileAt(px, py + up));
  const snap = (v, high) => (high ? Math.ceil(v / CLEAR_CELL) : Math.floor(v / CLEAR_CELL)) * CLEAR_CELL;
  const c0 = snap(Math.min(...corners.map((p) => p.col)), false) - CLEAR_CELL, c1 = snap(Math.max(...corners.map((p) => p.col)), true) + CLEAR_CELL;
  const r0 = snap(Math.min(...corners.map((p) => p.row)), false) - CLEAR_CELL, r1 = snap(Math.max(...corners.map((p) => p.row)), true) + CLEAR_CELL;
  // counted before any square is looked at: a box many slides wide on a tiny tile is refused, never scanned
  const cells = ((c1 - c0) / CLEAR_CELL) * ((r1 - r0) / CLEAR_CELL);
  if (!(cells <= MOST_CELLS)) throw new Error(`${where}: its box covers more floor than a picture needs (${Number.isFinite(cells) ? Math.round(cells) : 'no end of'} squares) — give it a box the size of its words`);
  const meets = (col, row) => {
    const {x: cx, y: cy} = grid.at(col + CLEAR_CELL / 2, row + CLEAR_CELL / 2, lift);
    const dx = Math.max(0, Math.abs(cx - (x + w / 2)) - w / 2), dy = Math.max(0, Math.abs(cy - (y + h / 2)) - h / 2);
    return dx / hw + dy / hh < 1;
  };
  const out = [];
  for (let row = r0; row < r1 - 1e-9; row += CLEAR_CELL) {
    let from = null;
    for (let col = c0; col < c1 + 1e-9; col += CLEAR_CELL) {
      const on = col < c1 - 1e-9 && meets(col, row);
      if (on && from === null) from = col;
      if (!on && from !== null) {
        // the map's whole budget of stretches, counted as they are made: many boxes at many heights stop at the most, not after
        if ((budget.left -= 1) < 0) throw new Error(`data-keep-clear: the floor kept clear on this map is more than ${budget.most} stretches, the most a map keeps — keep clear under smaller pieces, or fewer`);
        out.push({at: [from - SEAM, row - SEAM, lift], size: [col - from + 2 * SEAM, CLEAR_CELL + 2 * SEAM]}); from = null;
      }
    }
  }
  return out;
}

/**
 * Whether a cable's way on the floor, as drawn on the slide ([[x, y], …]), passes strictly inside a box: what `check`
 * says. The router's kept floor is the half-tile squares round the box (a little wider, so the cable keeps clear of
 * the words); whether a cable it could not keep off runs under the words is asked of the box itself.
 */
export function crossesBox(points, {x, y, w, h}) {
  return points.slice(1).some(([qx, qy], k) => {
    const [px, py] = points[k];
    let t0 = 0, t1 = 1;
    for (const [delta, lo, hi, from] of [[qx - px, x, x + w, px], [qy - py, y, y + h, py]]) {
      if (Math.abs(delta) < 1e-12) { if (!(from > lo + 1e-9 && from < hi - 1e-9)) return false; continue; }
      let a = (lo - from) / delta, b = (hi - from) / delta;
      if (a > b) [a, b] = [b, a];
      t0 = Math.max(t0, a); t1 = Math.min(t1, b);
      if (t1 - t0 <= 1e-9) return false;
    }
    return true;
  });
}
