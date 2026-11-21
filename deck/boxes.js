// boxes — where a map's pieces stand, for the helpers that draw between them: a wire runs from one to another, a callout
// stands beside one. Plain strings in, numbers out.
import {readPieces} from '../focusHtml.js';

/**
 * A finder of a piece's box in this HTML: (name, where) → {x, y, w, h}. A piece is found by its first data-k name and must
 * be placed (inline left, top, width and height); several pieces with that first name are one box around them. Throws,
 * starting with `where` (what asked) and naming the placed pieces there are, when there is none. `finder.alone(name)`
 * says whether one placed piece alone has that first name.
 */
export function boxFinder(html) {
  const placed = readPieces(html).pieces.filter((p) => p.box && p.box.w > 0 && p.box.h > 0);
  const find = (name, where) => {
    const boxes = placed.filter((p) => p.keys[0] === name).map((p) => p.box);
    if (!boxes.length) {
      const names = [...new Set(placed.map((p) => p.keys[0]))];
      throw new Error(`${where}: no piece "${name}" with a box (data-k, and an inline left, top, width and height)${names.length ? ` — the placed pieces are ${names.slice(0, 20).join(', ')}${names.length > 20 ? ', …' : ''}` : ''}`);
    }
    const x0 = Math.min(...boxes.map((b) => b.x)), y0 = Math.min(...boxes.map((b) => b.y));
    return {x: x0, y: y0, w: Math.max(...boxes.map((b) => b.x + b.w)) - x0, h: Math.max(...boxes.map((b) => b.y + b.h)) - y0};
  };
  /** Whether exactly one placed piece has this first name: only then is the piece's own shape the whole of what the name stands for. */
  find.alone = (name) => placed.filter((p) => p.keys[0] === name).length === 1;
  return find;
}

// How far a ray runs before it leaves an outline or a box is footprint-story/isometric's (exitOutline, exitBox): a deck
// and a film start a straight wire at the same edge (moved there in 0.30.0).
