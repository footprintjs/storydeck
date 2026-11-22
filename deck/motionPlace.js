// motionPlace — where things are on an isometric map while its blocks move: places in tiles, what a block lands on,
// whether a drawn point is on the slide, a moving foot's place worked back from where it is drawn, whether a move
// passes through another block, and a name's box on a block's top. Pure numbers on the built map's grid; nothing is
// planned (motionPlan.js) or drawn (motionDraw.js) here.
//
// SHARED NUMBERS, KEPT MINIMAL. Every function here is the same rule StoryReel's isometric kit holds in
// src/kits/isometric/motion-place.mjs and motion-cover.mjs (0.43–0.44): a foot and a top, the landing under a block,
// the swept pass-through test, a foot worked back from the frame, the rider rule's "rests on its top" and a name's box
// on a top. They are numbers, not drawing, so they belong in footprint-story beside planIntents; until they move there
// the deck holds this one small copy, each function as StoryReel's (only the frame is the deck's canvas, not a film's
// 1600×900). WHY a copy for now and not an import: footprint-story 0.31.0 does not hand them out, and StoryReel is no
// dependency of StoryDeck. Do not grow this file: a new rule here is one more to move.

/** A block's foot and top in tiles (the middle of its footprint, at its lift and at its height), and its corner from its foot. */
export const footOf = (at, size) => [at[0] + size[0] / 2, at[1] + size[1] / 2, at[2] ?? 0];
export const topOf = (at, size) => [at[0] + size[0] / 2, at[1] + size[1] / 2, (at[2] ?? 0) + size[2]];
export const cornerOf = (foot, size) => [foot[0] - size[0] / 2, foot[1] - size[1] / 2, foot[2]];

/** How close two numbers may be and still count as one place, in tiles: far under what a pixel shows. */
const SAME = 1e-6;
/**
 * How deep a moving block may go into another before it is said to pass through it, in tiles: a twentieth of a tile.
 * WHY not 0: a block resting on a top touches it, and a place worked back from the slide (footTiles) is exact only to
 * a few billionths. (StoryReel's THROUGH_MOST, the same number.)
 */
export const THROUGH_MOST = 0.05;

const overlap = (a0, a1, b0, b1) => Math.max(0, Math.min(a1, b1) - Math.max(a0, b0));

/**
 * Where a block falls to: the highest top of the `others` ({block, at} each, `block.size` its size) whose footprint
 * overlaps its own and which is not above its foot, else the floor — {lift, block, at} (block and at null for the
 * floor). WHY the highest: a box dropped over a server lands on the server, never through it to the floor.
 */
export function landingUnder(at, size, others) {
  let best = {lift: 0, block: null, at: null};
  for (const o of others) {
    const top = (o.at[2] ?? 0) + o.block.size[2];
    if (top > (at[2] ?? 0) + SAME || top <= best.lift) continue;
    if (overlap(at[0], at[0] + size[0], o.at[0], o.at[0] + o.block.size[0]) > SAME && overlap(at[1], at[1] + size[1], o.at[1], o.at[1] + o.block.size[1]) > SAME) best = {lift: top, block: o.block, at: o.at};
  }
  return best;
}

/** Whether a foot is over what holds it (landingUnder's): inside that block's top, edges included, or anywhere on the floor. */
export const overTop = (foot, under) => !under.block || [0, 1].every((k) => foot[k] >= under.at[k] - SAME && foot[k] <= under.at[k] + under.block.size[k] + SAME);

/** Whether `rider` ({block, at}) rests on the top of `piece` standing at `at`: on it, and at its height. */
export const ridesOn = (rider, piece, at) => landingUnder(rider.at, rider.block.size, [{block: piece, at}]).block === piece && Math.abs(rider.at[2] - (at[2] + piece.size[2])) < SAME;

/** Null when a point is on the slide ([w, h]), else how far off it lies ("34 px to the right"). */
export function offSlide([x, y], [w, h]) {
  const said = [], px = (v) => Math.max(1, Math.round(v));   // a whole pixel at least: "0 px" would say it is not off
  if (x < 0) said.push(`${px(-x)} px to the left`); else if (x > w) said.push(`${px(x - w)} px to the right`);
  if (y < 0) said.push(`${px(-y)} px above`); else if (y > h) said.push(`${px(y - h)} px below`);
  return said.length ? said.join(' and ') : null;
}

/**
 * A foot's place in tiles from where it is on the slide, during a move from `m.from` to `m.to` (tiles): the point's
 * line of places is cut by the move's way (by `share` of its time when both ends stand on one such line), and its lift
 * is what brings it to the point's height. WHY: the place projects to exactly where the block is drawn, so the paint
 * order and the pass-through check find it where it is seen. A lift under the floor (a wind-up's dip) is the floor.
 */
export function footTiles(grid) {
  const o = grid.at(0, 0, 0), half = grid.at(1, 0, 0).y - o.y, up = o.y - grid.at(0, 0, 1).y;
  return ([x, y], m, share) => {
    const ground = grid.tileAt(x, y), u = ground.col - ground.row, u0 = m.from[0] - m.from[1], u1 = m.to[0] - m.to[1];
    const f = Math.abs(u1 - u0) > 1e-9 ? (u - u0) / (u1 - u0) : share;
    const c = m.from[0] + f * (m.to[0] - m.from[0]), r = m.from[1] + f * (m.to[1] - m.from[1]);
    return [c, r, Math.max(0, ((c + r) - (ground.col + ground.row)) * half / up)];
  };
}

/**
 * The deepest a block of `size` goes into the others on the straight stretch from corner `from` to corner `to`, each
 * other ({block, from, to}) moving straight too: {block, depth, share} past THROUGH_MOST, or null. WHY swept, not
 * sampled: between two samples a fast move covers more than a thin block. The depth along each axis is concave in the
 * share, so their least is too, and its highest point is found by golden-section search: nothing between is skipped.
 */
export function sweptThrough(size, from, to, others) {
  let deepest = null;
  const lerp = (a, b, u) => a + (b - a) * u;
  for (const o of others) {
    const s = o.block.size;
    if ([0, 1, 2].some((k) => Math.max(from[k], to[k]) + size[k] <= Math.min(o.from[k], o.to[k]) || Math.max(o.from[k], o.to[k]) + s[k] <= Math.min(from[k], to[k]))) continue;
    const depthAt = (u) => Math.min(...[0, 1, 2].map((k) => {
      const a0 = lerp(from[k], to[k], u), b0 = lerp(o.from[k], o.to[k], u);
      return Math.min(a0 + size[k], b0 + s[k]) - Math.max(a0, b0);
    }));
    let lo = 0, hi = 1;
    const g = (Math.sqrt(5) - 1) / 2;
    for (let n = 0; n < 60; n += 1) {
      const m1 = hi - g * (hi - lo), m2 = lo + g * (hi - lo);
      if (depthAt(m1) < depthAt(m2)) lo = m1; else hi = m2;
    }
    const share = (lo + hi) / 2, best = [0, 1, share].reduce((x, u) => (depthAt(u) > depthAt(x) ? u : x), share), depth = depthAt(best);
    if (depth > THROUGH_MOST && (!deepest || depth > deepest.depth)) deepest = {block: o.block, depth, share: best};
  }
  return deepest;
}

/** A point of a block as built, where its pose puts it: scaled about the pivot, then moved. */
export const posed = ([x, y], {dx, dy, pivot: [px, py], sx, sy}) => [px + (x - px) * sx + dx, py + (y - py) * sy + dy];

/**
 * How wide a letter of a name is taken, as a share of its size: wider than any letter of any font draws (a bold "W"
 * is about one em), so a name that could peek out from under a block on any host is counted covered, and every host
 * decides the same — never a font's own width. (StoryReel's NAME_WIDTH.)
 */
export const NAME_WIDTH = 1.2;

/**
 * A block's words on its top as a box on the slide ([x0, y0, x1, y1]) round `centre`, or null when it has none: its
 * fitted name's lines at their size (1.15 a line) and a small line under it, each as NAME_WIDTH of its size a letter.
 */
export function nameBox({lines, size}, small, [cx, cy], smallSize) {
  if (!lines?.length) return null;
  const lh = size * 1.15, low = small ? smallSize * 1.15 + 2 : 0, height = lines.length * lh + low;
  const wide = Math.max(...lines.map((l) => [...l].length * size), small ? [...small].length * smallSize : 0) * NAME_WIDTH;
  return [cx - wide / 2, cy - height / 2, cx + wide / 2, cy + height / 2];
}

const area = (p) => p.reduce((s, [x, y], i) => { const [x2, y2] = p[(i + 1) % p.length]; return s + x * y2 - x2 * y; }, 0);
/** Whether a convex polygon (slide points, in order round it) and a box overlap: bounds meet and no side separates them. */
export function overlapsBox(points, [x0, y0, x1, y1]) {
  const xs = points.map((p) => p[0]), ys = points.map((p) => p[1]);
  if (Math.max(...xs) <= x0 || Math.min(...xs) >= x1 || Math.max(...ys) <= y0 || Math.min(...ys) >= y1) return false;
  const corners = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], n = points.length, turn = Math.sign(area(points));
  for (let i = 0; i < n; i += 1) {
    const [ax, ay] = points[i], [bx, by] = points[(i + 1) % n];
    if (corners.every(([x, y]) => turn * ((bx - ax) * (y - ay) - (by - ay) * (x - ax)) < 0)) return false;
  }
  return true;
}
