// boxes — where a map's pieces stand, for the helpers that draw between them: a wire runs from one to another, a callout
// stands beside one. Plain strings in, numbers out.
import {readPieces} from '../focusHtml.js';

/**
 * A finder of a piece's box in this HTML: (name, where) → {x, y, w, h}. A piece is found by its first data-k name and must
 * be placed (inline left, top, width and height); several pieces with that first name are one box around them. Throws,
 * starting with `where` (what asked) and naming the placed pieces there are, when there is none.
 */
export function boxFinder(html) {
  const placed = readPieces(html).pieces.filter((p) => p.box && p.box.w > 0 && p.box.h > 0);
  return (name, where) => {
    const boxes = placed.filter((p) => p.keys[0] === name).map((p) => p.box);
    if (!boxes.length) {
      const names = [...new Set(placed.map((p) => p.keys[0]))];
      throw new Error(`${where}: no piece "${name}" with a box (data-k, and an inline left, top, width and height)${names.length ? ` — the placed pieces are ${names.slice(0, 20).join(', ')}${names.length > 20 ? ', …' : ''}` : ''}`);
    }
    const x0 = Math.min(...boxes.map((b) => b.x)), y0 = Math.min(...boxes.map((b) => b.y));
    return {x: x0, y: y0, w: Math.max(...boxes.map((b) => b.x + b.w)) - x0, h: Math.max(...boxes.map((b) => b.y + b.h)) - y0};
  };
}

/**
 * How far a ray from p along the unit vector u runs before it leaves an outline: `points` round a shape with no dent,
 * [[x, y], …], p inside it. Infinity when it never does (a point outside, running away).
 */
export function exitOutline(points, [px, py], [ux, uy]) {
  let least = Infinity;
  points.forEach(([ax, ay], i) => {
    const [bx, by] = points[(i + 1) % points.length], ex = bx - ax, ey = by - ay, cross = ux * ey - uy * ex;
    if (Math.abs(cross) < 1e-12) return;   // the ray runs along this side: it leaves by another
    const t = ((ax - px) * ey - (ay - py) * ex) / cross, along = ((ax - px) * uy - (ay - py) * ux) / cross;
    if (t > 1e-9 && along >= -1e-9 && along <= 1 + 1e-9) least = Math.min(least, t);
  });
  return least;
}

/** How far a ray from p (inside the box) along the unit vector u runs before it leaves the box. */
export function exit(b, [px, py], [ux, uy]) {
  const tx = ux > 0 ? (b.x + b.w - px) / ux : ux < 0 ? (b.x - px) / ux : Infinity;
  const ty = uy > 0 ? (b.y + b.h - py) / uy : uy < 0 ? (b.y - py) / uy : Infinity;
  return Math.min(tx, ty);
}
