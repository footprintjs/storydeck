// cable — a wire between two isometric pieces, laid along the floor. Plain numbers in, plain numbers out.
//
// A block seen from a corner shows two feet: the one under its right face and the one under its left face. Of two
// blocks, one stands to the right of the other on the slide: a cable joins the right foot of the block on the left
// to the left foot of the block on the right, whichever of the two it starts from. So:
//
//   · it starts and ends where a block meets the floor, on a face the viewer sees — never in the air beside a block,
//     never behind its own block (another block standing nearer may still be drawn over a foot);
//   · it leaves and arrives along the floor's own two directions (out of a right foot along the cols, out of a left
//     foot along the rows), so it reads as lying on the floor;
//   · a request and its answer use the same two feet and lie side by side, one inside the other;
//   · it is one smooth curve with a handle at each end (a cubic), so a packet rides it by one formula (deck.css).
//
// Several cables at one foot share it out: each has a place of its own along the foot's edge, the one whose other end
// is furthest up the slide nearest the back. A cylinder's feet are on its round base.
//
// NOT EVERY WIRE IS A CABLE. The two feet face each other only when one block stands to the side of the other. When
// one stands straight in front of the other, or they touch, a curve between those feet would run under one of its own
// blocks; and a request and its answer between feet that the cable must hook round to reach would cross. So a cable
// is laid, then looked at: one that passes under what either of its own blocks draws is not kept, nor are two between
// the same feet that cross. A wire with no cable is drawn straight, from outline to outline (transforms.js).
//
// WHY the feet that face each other: the two faces a viewer sees are the only places an arrow can end and be seen;
// of those, the pair facing each other gives the shortest cable. WHY look, and not a rule that says beforehand: what
// is under a block depends on the curve drawn, so the curve drawn is what is asked. A wire that should run straight
// anyway says so with a bend of 0 ("a to b 0").

/** A handle's length: a share of the run from start to end, between a least and a most given in tile widths. */
export const HANDLE = Object.freeze({share: 0.45, least: 0.35, most: 2});
/** How far, in slide px, a cable's ends stand off the foot they touch. */
const CLEAR = 6;
const SAMPLE = 6;   // px between the points asked: of a cable, whether a block is over them; of a label, the same
/** The most points a cable is walked in: a cable longer than a slide is asked more coarsely, never at greater cost. */
export const WALK_MOST = 512;
const CROSS_RUNS = 64;   // the straight runs a cable is taken as, when two are asked whether they cross

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

/** The point `t` (0 to 1) of the way along a cable's curve. */
export function cablePoint([p0, c1, c2, p3], t) {
  const s = 1 - t;
  return [0, 1].map((k) => s * s * s * p0[k] + 3 * s * s * t * c1[k] + 3 * s * t * t * c2[k] + t * t * t * p3[k]);
}

/** A cable walked from its start to its end: points along its curve, SAMPLE px apart at most (further on a cable longer than WALK_MOST of them). */
export function cableWalk(cable) {
  // a point of the curve never moves faster than three times its longest leg (start to handle, handle to handle, handle to end)
  const leg = Math.max(...[0, 1, 2].map((k) => Math.hypot(cable[k + 1][0] - cable[k][0], cable[k + 1][1] - cable[k][1])));
  const steps = Math.min(WALK_MOST, Math.max(1, Math.ceil((3 * leg) / SAMPLE)));
  return Array.from({length: steps + 1}, (_, k) => cablePoint(cable, k / steps));
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

/**
 * Points, with the box that holds them: {points, left, top, right, bottom}. What may be in the way is asked by its
 * box first, so on a map of hundreds of cables each one looks only at the few things near it.
 */
export function held(points) {
  let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
  for (const [x, y] of points) { left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y); }
  return {points, left, top, right, bottom};
}
/** Those of `things` (each held) whose box reaches within `far` px of the box round `at`. */
const near = (things, at, half, far = 0) => things.filter((t) => t.right > at[0] - half[0] - far && t.left < at[0] + half[0] + far && t.bottom > at[1] - half[1] - far && t.top < at[1] + half[1] + far);

/** Whether any point of a walk is under what a piece draws (`drawn`: its outline, held). */
const under = (walk, drawn) => walk.some(([x, y]) => x > drawn.left && x < drawn.right && y > drawn.top && y < drawn.bottom && inside(drawn.points, [x, y]));

/** Whether two walks cross, each taken as CROSS_RUNS straight runs at most. */
function cross(one, other) {
  const runs = (walk) => { const stride = Math.max(1, Math.ceil((walk.length - 1) / CROSS_RUNS)); return walk.filter((_, k) => k % stride === 0 || k === walk.length - 1); };
  const turn = (a, b, c) => Math.sign((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]));
  const a = runs(one), b = runs(other);
  for (let i = 0; i + 1 < a.length; i++) {
    for (let j = 0; j + 1 < b.length; j++) {
      if (turn(a[i], a[i + 1], b[j]) * turn(a[i], a[i + 1], b[j + 1]) < 0 && turn(b[j], b[j + 1], a[i]) * turn(b[j], b[j + 1], a[i + 1]) < 0) return true;
    }
  }
  return false;
}

/**
 * The cables of a map. `links`: one entry a wire, [from, to] by piece name, or null for a wire that is no cable;
 * `shapes`: a Map from a name to {at: [col, row, lift], size: [wide, deep, high], kind, outline: [[x, y], …]} (the
 * outline: what the piece draws on the slide); `floor(col, row, lift)`: where a floor point is on the slide, [x, y].
 * Gives, in the same order, each cable as its four points on the slide — [start, handle, handle, end] — and null for
 * a link that has none: an end that is no isometric piece, two pieces standing at different heights, a cable that
 * would pass under what one of its own two blocks draws, or cables between the same two feet that would cross.
 */
export function cables(links, shapes, floor) {
  // each wire's two feet: the right foot of the piece on the left, the left foot of the piece on the right. Which of
  // two is on the left never depends on where the wire starts: by how far right it stands, then how far down, then its name
  const ends = links.map((link) => {
    const from = link && shapes.get(link[0]), to = link && shapes.get(link[1]);
    if (!from || !to || from === to || from.at[2] !== to.at[2]) return null;
    const side = across(from) - across(to) || depth(from) - depth(to), leftward = side > 0 || (side === 0 && link[0] > link[1]);
    return {from, to, out: leftward ? 'left' : 'right', in: leftward ? 'right' : 'left', feet: (leftward ? [link[1], link[0]] : link).join('\u0000')};
  });
  const origin = floor(0, 0, 0), col = floor(1, 0, 0), row = floor(0, 1, 0);
  const unit = (p) => { const v = [p[0] - origin[0], p[1] - origin[1]], length = Math.hypot(v[0], v[1]) || 1; return [v[0] / length, v[1] / length]; };
  const ways = {right: unit(col), left: unit(row)}, tile = Math.abs(col[0] - row[0]);   // the way out of each foot; a tile's width on the slide
  const step = (p, way, far) => [p[0] + way[0] * far, p[1] + way[1] * far];
  /** A cable between its two feet, at a share of the way along each. */
  const lay = (e, out, into) => {
    const lift = e.from.at[2];
    const start = step(floor(...foot(e.from, e.out, out), lift), ways[e.out], CLEAR), end = step(floor(...foot(e.to, e.in, into), lift), ways[e.in], CLEAR);
    const reach = Math.min(HANDLE.most * tile, Math.max(HANDLE.least * tile, HANDLE.share * Math.hypot(end[0] - start[0], end[1] - start[1])));
    return [start, step(start, ways[e.out], reach), step(end, ways[e.in], reach), end];
  };
  const drawn = new Map();   // what each piece draws, held
  const drawnOf = (piece) => drawn.get(piece) ?? drawn.set(piece, held(piece.outline ?? [])).get(piece);
  /** A cable's walk when it lies clear of what both its blocks draw, or null. */
  const clear = (e, cable) => { const walk = cableWalk(cable); return under(walk, drawnOf(e.from)) || under(walk, drawnOf(e.to)) ? null : walk; };
  // first a trial from the middle of one foot to the middle of the other: a wire whose cable would pass under one of its own blocks takes no place on a foot
  const can = ends.map((e) => (e && clear(e, lay(e, 0.5, 0.5)) ? e : null));
  // each foot's cables, leaving and arriving alike, in the order that keeps them apart: the one whose other end is
  // furthest up the slide first; of two as far up, the nearer; of two with one other end, the one written first (so
  // a request and its answer nest)
  const feet = new Map();
  const take = (piece, edge, i, other) => { const at = feet.get(piece) ?? feet.set(piece, {right: [], left: []}).get(piece); at[edge].push({i, other}); };
  can.forEach((e, i) => { if (e) { take(e.from, e.out, `out${i}`, e.to); take(e.to, e.in, `in${i}`, e.from); } });
  const share = new Map();   // a cable's place along each of its feet: its turn among the foot's cables, evenly spaced
  for (const [piece, edges] of feet) {
    for (const list of [edges.right, edges.left]) {
      const nearer = (c) => Math.abs(across(c.other) - across(piece));
      list.map((c, k) => ({...c, k})).sort((a, b) => depth(a.other) - depth(b.other) || nearer(a) - nearer(b) || a.k - b.k).forEach((c, k) => share.set(c.i, (k + 1) / (list.length + 1)));
    }
  }
  const laid = can.map((e, i) => e && lay(e, share.get(`out${i}`), share.get(`in${i}`)));
  const walks = laid.map((cable, i) => cable && clear(can[i], cable));   // off its foot's middle a cable may meet its block where the trial did not
  // cables between the same two feet are kept together or not at all: where one of them is not clear of its
  // blocks, or two neighbours (in their order along the left block's foot) cross, none is kept — a request as a
  // cable beside its answer as a straight wire would read as two different things
  const twins = new Map();
  can.forEach((e, i) => { if (e) twins.set(e.feet, [...(twins.get(e.feet) ?? []), i]); });
  for (const group of twins.values()) {
    const at = (i) => share.get(can[i].out === 'right' ? `out${i}` : `in${i}`), order = [...group].sort((a, b) => at(a) - at(b));
    if (order.some((i, k) => !walks[i] || (k > 0 && cross(walks[order[k - 1]], walks[i])))) for (const i of group) walks[i] = null;
  }
  return laid.map((cable, i) => (walks[i] ? cable : null));
}

/** Where a label may stand along its cable: the middle first, then a twentieth further to each side by turns, a fifth to four fifths of the way. */
export const LABEL_PLACES = Object.freeze(Array.from({length: 13}, (_, k) => +(0.5 + (k % 2 ? -1 : 1) * Math.ceil(k / 2) * 0.05).toFixed(2)));
const EDGE = 3;     // px a cable's line keeps off a label's box: half the line and a little air
const TIP = 16;     // px round a cable's tip that its label keeps off: the arrow's head
/**
 * The looks one map's labels may spend between them (labelPlace): a look is one point of a label asked against one
 * side of an outline, or one point of another cable asked against a label. WHY a limit: a deck is text someone
 * wrote, and a build runs on every save — a map of thousands of labelled cables, or a label thousands of letters
 * long, must cost no more than this (about a third of a second), where a careful search of it would take minutes.
 * A map of sixty labelled cables spends a twentieth of it; three hundred on a crowded floor, nearly all.
 */
export const LABEL_LOOKS = 60_000_000;

/**
 * Where a cable's label stands: on the cable itself, as near its middle as it can be with nothing in its way. A cable
 * lies on the floor, so a block standing nearer the viewer is drawn over it and over its label, and beside the middle
 * of a cable there is often a block's face, or the cable's twin. `half`: half the label's width and height; `hides`:
 * what hides a label, each an outline held (`held`) — what each block draws on the slide, and the labels placed
 * before this one; `runs`: the map's cables, each walked (cableWalk), held, and marked with the cable it is (`of`) —
 * this cable's own is passed over. Gives [x, y], the label's middle: the first of LABEL_PLACES where no outline
 * reaches it and no other cable runs through it. Where there is none: the place where the least of it is hidden, of
 * those the one the least of another cable runs through, and of those the earliest.
 *
 * A label keeps off its own cable's two ends as it keeps off a block: its plate over the arrow's head would hide
 * where the cable goes (TIP px round the tip, half that round the start).
 *
 * `looks`: {left}, the looks the map has left (LABEL_LOOKS at its start); each place asked spends its own. A place
 * that would cost more than is left is not asked, nor any after it: the label takes the best place asked so far, or
 * the cable's middle when none was.
 */
export function labelPlace(cable, half, hides, runs = [], looks = {left: LABEL_LOOKS}) {
  const across = Math.max(1, Math.ceil((2 * half[0]) / SAMPLE)), down = Math.max(1, Math.ceil((2 * half[1]) / SAMPLE));
  const round = ([x, y], far) => held([[x - far, y - far], [x + far, y - far], [x + far, y + far], [x - far, y + far]]);
  const ends = [round(cable[3], TIP), round(cable[0], TIP / 2)];
  let best = null;
  for (const t of LABEL_PLACES) {
    if (hides.length + runs.length > looks.left) break;   // finding what is near is a look at each thing
    const at = cablePoint(cable, t), over = [...near(hides, at, half), ...near(ends, at, half)], lines = near(runs, at, half, EDGE).filter((run) => run.of !== cable);
    const sides = over.reduce((sum, outline) => sum + outline.points.length, 0), steps = lines.reduce((sum, run) => sum + run.points.length, 0);
    const cost = (across + 1) * (down + 1) * sides + steps + hides.length + runs.length;
    if (cost > looks.left) break;
    looks.left -= cost;
    let hidden = 0, crossed = 0;
    for (let i = 0; over.length && i <= across; i++) {
      for (let j = 0; j <= down; j++) {
        const point = [at[0] - half[0] + (2 * half[0] * i) / across, at[1] - half[1] + (2 * half[1] * j) / down];
        if (over.some((outline) => inside(outline.points, point))) hidden += 1;
      }
    }
    for (const run of lines) for (const [x, y] of run.points) if (Math.abs(x - at[0]) < half[0] + EDGE && Math.abs(y - at[1]) < half[1] + EDGE) crossed += 1;
    if (!hidden && !crossed) return at;
    if (!best || hidden < best.hidden || (hidden === best.hidden && crossed < best.crossed)) best = {at, hidden, crossed};
  }
  return best ? best.at : cablePoint(cable, 0.5);
}
