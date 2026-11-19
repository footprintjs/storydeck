// cable — a wire between two isometric pieces, laid along the floor. Plain numbers in, plain numbers out.
//
// A block seen from a corner shows two feet: the one under its right face and the one under its left face. Of two
// blocks, one stands to the right of the other on the slide: a cable joins the right foot of the block on the left
// to the left foot of the block on the right, whichever of the two it starts from. So:
//
//   · it starts and ends where a block meets the floor, on a face the viewer sees — never in the air beside a block,
//     never behind one, so every arrow's tip is seen;
//   · it leaves and arrives along the floor's own two directions (out of a right foot along the cols, out of a left
//     foot along the rows), so it reads as lying on the floor;
//   · a request and its answer use the same two feet and lie side by side, one inside the other, never across;
//   · it is one smooth curve with a handle at each end (a cubic), so a packet rides it by one formula (deck.css).
//
// Several cables at one foot share it out: each has a place of its own along the foot's edge, in the order that keeps
// them from crossing (the one whose other end is furthest up the slide nearest the back). A cylinder's feet are on
// its round base.
//
// WHY the feet that face each other: the two faces a viewer sees are the only places an arrow can end and be seen;
// of those, the pair facing each other gives the shortest cable, and one that never goes round its own block. A wire
// that should run straight says so with a bend of 0 ("a to b 0").

/** A handle's length: a share of the run from start to end, between a least and a most given in tile widths. */
export const HANDLE = Object.freeze({share: 0.45, least: 0.35, most: 2});
/** How far, in slide px, a cable's ends stand off the foot they touch. */
const CLEAR = 6;

const middle = ({at, size}) => [at[0] + size[0] / 2, at[1] + size[1] / 2];
/** How far down the slide a piece stands: its middle's col and row together (a tile along either is as far down). */
const depth = (piece) => middle(piece)[0] + middle(piece)[1];
/** How far right on the slide a piece stands: its middle's col less its row (a col goes right, a row goes left). */
const across = (piece) => middle(piece)[0] - middle(piece)[1];

/** Where on a piece's foot a cable touches it: `share` (0 to 1) of the way along the edge, on the round base of a cylinder. */
function foot(piece, edge, share) {
  const {at: [col, row], size: [wide, deep]} = piece, along = edge === 'right' ? row + deep * share : col + wide * share;
  if (piece.kind !== 'cylinder') return edge === 'right' ? [col + wide, along] : [along, row + deep];
  // a round base touches the square of its tiles only at the middle of each side: elsewhere the foot is on the circle
  const r = wide / 2, off = along - ((edge === 'right' ? row : col) + r), out = Math.sqrt(Math.max(0, r * r - off * off));
  return edge === 'right' ? [col + r + out, along] : [along, row + r + out];
}

/**
 * The cables of a map. `links`: one entry a wire, [from, to] by piece name, or null for a wire that is no cable;
 * `shapes`: a Map from a name to {at: [col, row, lift], size: [wide, deep, high], kind}; `floor(col, row, lift)`: where a
 * floor point is on the slide, [x, y]. Gives, in the same order, each cable as its four points on the slide —
 * [start, handle, handle, end] — and null for a link that is none: an end that is no isometric piece, or two pieces
 * standing at different heights.
 */
export function cables(links, shapes, floor) {
  // each cable's two feet: the right foot of the piece on the left, the left foot of the piece on the right (level: the first is the one on the left)
  const ends = links.map((link) => {
    const from = link && shapes.get(link[0]), to = link && shapes.get(link[1]);
    if (!from || !to || from === to || from.at[2] !== to.at[2]) return null;
    const rightward = across(to) >= across(from);
    return {from, to, out: rightward ? 'right' : 'left', in: rightward ? 'left' : 'right'};
  });
  // each foot's cables, leaving and arriving alike, in the order that keeps them apart: the one whose other end is
  // furthest up the slide first, and two with one other end in the order written (so a request and its answer nest)
  const feet = new Map();
  const take = (piece, edge, i, other) => { const at = feet.get(piece) ?? feet.set(piece, {right: [], left: []}).get(piece); at[edge].push({i, other}); };
  ends.forEach((e, i) => { if (e) { take(e.from, e.out, `out${i}`, e.to); take(e.to, e.in, `in${i}`, e.from); } });
  const share = new Map();   // a cable's place along each of its feet: its turn among the foot's cables, evenly spaced
  for (const edges of feet.values()) {
    for (const list of [edges.right, edges.left]) {
      list.map((c, k) => ({...c, k})).sort((a, b) => depth(a.other) - depth(b.other) || a.k - b.k).forEach((c, k) => share.set(c.i, (k + 1) / (list.length + 1)));
    }
  }
  const origin = floor(0, 0, 0), col = floor(1, 0, 0), row = floor(0, 1, 0);
  const unit = (p) => { const v = [p[0] - origin[0], p[1] - origin[1]], length = Math.hypot(v[0], v[1]) || 1; return [v[0] / length, v[1] / length]; };
  const ways = {right: unit(col), left: unit(row)}, tile = Math.abs(col[0] - row[0]);   // the way out of each foot; a tile's width on the slide
  const step = (p, way, far) => [p[0] + way[0] * far, p[1] + way[1] * far];
  return ends.map((e, i) => {
    if (!e) return null;
    const lift = e.from.at[2];
    const start = step(floor(...foot(e.from, e.out, share.get(`out${i}`)), lift), ways[e.out], CLEAR);
    const end = step(floor(...foot(e.to, e.in, share.get(`in${i}`)), lift), ways[e.in], CLEAR);
    const reach = Math.min(HANDLE.most * tile, Math.max(HANDLE.least * tile, HANDLE.share * Math.hypot(end[0] - start[0], end[1] - start[1])));
    return [start, step(start, ways[e.out], reach), step(end, ways[e.in], reach), end];
  });
}

/** The point `t` (0 to 1) of the way along a cable's curve. */
export function cablePoint([p0, c1, c2, p3], t) {
  const s = 1 - t;
  return [0, 1].map((k) => s * s * s * p0[k] + 3 * s * s * t * c1[k] + 3 * s * t * t * c2[k] + t * t * t * p3[k]);
}

/** Whether a slide point is inside an outline (its points in order round it). */
function inside(outline, [x, y]) {
  let odd = false;
  for (let i = 0, j = outline.length - 1; i < outline.length; j = i++) {
    const [xi, yi] = outline[i], [xj, yj] = outline[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) odd = !odd;
  }
  return odd;
}

/** Where a label may stand along its cable: the middle first, then a twentieth further to each side by turns, a fifth to four fifths of the way. */
export const LABEL_PLACES = Object.freeze(Array.from({length: 13}, (_, k) => +(0.5 + (k % 2 ? -1 : 1) * Math.ceil(k / 2) * 0.05).toFixed(2)));
const SAMPLE = 6;   // px between the points asked: of a label, whether a block is over them; of a cable, whether they are under a label
const EDGE = 3;     // px a cable's line keeps off a label's box: half the line and a little air

/** A cable walked from its start to its end: points along its curve, SAMPLE px apart at most. */
export function cableWalk(cable) {
  // a point of the curve never moves faster than three times its longest leg (start to handle, handle to handle, handle to end)
  const leg = Math.max(...[0, 1, 2].map((k) => Math.hypot(cable[k + 1][0] - cable[k][0], cable[k + 1][1] - cable[k][1])));
  const steps = Math.max(1, Math.ceil((3 * leg) / SAMPLE));
  return Array.from({length: steps + 1}, (_, k) => cablePoint(cable, k / steps));
}

/**
 * Where a cable's label stands: on the cable itself, as near its middle as it can be with nothing in its way. A cable
 * lies on the floor, so a block standing nearer the viewer is drawn over it and over its label, and beside the middle
 * of a cable there is often a block's face, or the cable's twin. `half`: half the label's width and height;
 * `outlines`: what hides a label — what each block draws on the slide, and the labels placed before this one; `runs`:
 * the other cables, each walked (cableWalk). Gives [x, y], the label's middle: the first of LABEL_PLACES where no
 * outline reaches it and no other cable runs through it. Where there is none: the place where the least of it is
 * hidden, of those the one the least of another cable runs through, and of those the earliest.
 */
export function labelPlace(cable, half, outlines, runs = []) {
  const across = Math.max(1, Math.ceil((2 * half[0]) / SAMPLE)), down = Math.max(1, Math.ceil((2 * half[1]) / SAMPLE));
  let best = null;
  for (const t of LABEL_PLACES) {
    const at = cablePoint(cable, t);
    let hidden = 0, crossed = 0;
    for (let i = 0; i <= across; i++) {
      for (let j = 0; j <= down; j++) {
        const point = [at[0] - half[0] + (2 * half[0] * i) / across, at[1] - half[1] + (2 * half[1] * j) / down];
        if (outlines.some((outline) => inside(outline, point))) hidden += 1;
      }
    }
    for (const run of runs) for (const [x, y] of run) if (Math.abs(x - at[0]) < half[0] + EDGE && Math.abs(y - at[1]) < half[1] + EDGE) crossed += 1;
    if (!hidden && !crossed) return at;
    if (!best || hidden < best.hidden || (hidden === best.hidden && crossed < best.crossed)) best = {at, hidden, crossed};
  }
  return best.at;
}
