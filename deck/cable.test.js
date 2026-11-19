import {describe, it, expect} from 'vitest';
import {arrange, isometric} from 'footprint-story/isometric';
import {cables, cablePoint, cableWalk, labelPlace, HANDLE, LABEL_PLACES} from './cable.js';

const grid = isometric({tile: 120, origin: [960, 240]});
const floor = (col, row, lift = 0) => { const p = grid.at(col, row, lift); return [p.x, p.y]; };
const block = (at, size = [2, 2, 1], kind = 'block') => ({at: [at[0], at[1], at[2] ?? 0], size, kind});
const shapesOf = (things) => new Map(Object.entries(things));
/** A slide point as the floor point under it, at a lift: [col, row]. */
const tiles = ([x, y], lift = 0) => { const p = grid.tileAt(x, y + lift * grid.rise); return [p.col, p.row]; };
const cols = [Math.cos(Math.atan2(30, 60)), Math.sin(Math.atan2(30, 60))], rows = [-cols[0], cols[1]];   // a tile along the cols is 60 right and 30 down; along the rows, 60 left and 30 down
const along = (from, to) => { const v = [to[0] - from[0], to[1] - from[1]], l = Math.hypot(...v); return [v[0] / l, v[1] / l, l]; };

/** The floor point a cable's end touches: back off the 6 px it stands clear, the way it sets off. */
const touches = (point, way, lift = 0) => tiles([point[0] - way[0] * 6, point[1] - way[1] * 6], lift);
/** Whether two cables cross, each walked as 80 short runs. */
function cross(one, other) {
  const walk = (cable) => Array.from({length: 81}, (_, k) => cablePoint(cable, k / 80));
  const turn = (a, b, c) => Math.sign((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]));
  const a = walk(one), b = walk(other);
  for (let i = 0; i < 80; i++) for (let j = 0; j < 80; j++) if (turn(a[i], a[i + 1], b[j]) * turn(a[i], a[i + 1], b[j + 1]) < 0 && turn(b[j], b[j + 1], a[i]) * turn(b[j], b[j + 1], a[i + 1]) < 0) return true;
  return false;
}

describe('cable · a wire along the floor between two isometric pieces', () => {
  it('joins the right foot of the block on the left to the left foot of the block on the right: out along the cols, in along the rows', () => {
    const a = block([0, 4]), b = block([5, 1]);
    const [[start, h1, h2, end]] = cables([['a', 'b']], shapesOf({a, b}), floor);
    // 6 px clear of each foot, out along the floor: back at the foot is the edge's middle
    const out = touches(start, cols), into = touches(end, rows);
    expect(out[0]).toBeCloseTo(2, 6);    // a's right foot: the edge at col 0 + 2…
    expect(out[1]).toBeCloseTo(5, 6);    // …at its middle, row 4 + 1
    expect(into[0]).toBeCloseTo(6, 6);   // b's left foot: the middle of its cols, 5 + 1…
    expect(into[1]).toBeCloseTo(3, 6);   // …on the edge at row 1 + 2
    const [ux, uy, reach] = along(start, h1), [vx, vy, back] = along(end, h2);
    expect([ux, uy]).toEqual([expect.closeTo(cols[0], 9), expect.closeTo(cols[1], 9)]);   // it sets off along the cols…
    expect([vx, vy]).toEqual([expect.closeTo(rows[0], 9), expect.closeTo(rows[1], 9)]);   // …and comes in along the rows, so its tip points back up them
    expect(reach).toBeCloseTo(back, 9);
    expect(reach).toBeCloseTo(HANDLE.share * Math.hypot(end[0] - start[0], end[1] - start[1]), 6);
  });

  it('the same two feet whichever block it starts from: the answer leaves the left foot along the rows and comes into the right foot along the cols', () => {
    const a = block([0, 4]), b = block([5, 1]);
    const [[start, h1, h2, end]] = cables([['b', 'a']], shapesOf({a, b}), floor);
    const out = touches(start, rows), into = touches(end, cols);
    expect([out[0], out[1]]).toEqual([expect.closeTo(6, 6), expect.closeTo(3, 6)]);     // b's left foot, where the request came in
    expect([into[0], into[1]]).toEqual([expect.closeTo(2, 6), expect.closeTo(5, 6)]);   // a's right foot, where it left
    const [ux, uy] = along(start, h1), [vx, vy] = along(end, h2);
    expect([ux, uy]).toEqual([expect.closeTo(rows[0], 9), expect.closeTo(rows[1], 9)]);
    expect([vx, vy]).toEqual([expect.closeTo(cols[0], 9), expect.closeTo(cols[1], 9)]);
    // a block straight above or below the other on the slide is taken as the one on the right: the first leaves by its right foot
    const [[level]] = cables([['a', 'c']], shapesOf({a, c: block([3, 7])}), floor);
    expect(touches(level, cols)[0]).toBeCloseTo(2, 6);
  });

  it('a request and its answer lie side by side on the feet they share, one inside the other, and never cross', () => {
    const shapes = shapesOf({a: block([0, 4]), b: block([5, 1])});
    const [request, answer] = cables([['a', 'b'], ['b', 'a']], shapes, floor);
    // a's right foot (rows 4 to 6) and b's left foot (cols 5 to 7), each shared in thirds: the one written first nearer the back on both
    expect(touches(request[0], cols)[1]).toBeCloseTo(4 + 2 / 3, 6);
    expect(touches(answer[3], cols)[1]).toBeCloseTo(4 + 4 / 3, 6);
    expect(touches(request[3], rows)[0]).toBeCloseTo(5 + 2 / 3, 6);
    expect(touches(answer[0], rows)[0]).toBeCloseTo(5 + 4 / 3, 6);
    expect(cross(request, answer)).toBe(false);
    // written the other way round they still nest
    const [back, forth] = cables([['b', 'a'], ['a', 'b']], shapes, floor);
    expect(cross(back, forth)).toBe(false);
    expect(cross([[0, 0], [0, 0], [100, 100], [100, 100]], [[0, 80], [0, 80], [100, 0], [100, 0]])).toBe(true);   // the walk does find a crossing where there is one
  });

  it('a handle is a share of the run, never under a third of a tile nor over two tiles', () => {
    expect(HANDLE).toEqual({share: 0.45, least: 0.35, most: 2});
    const reach = (b) => { const [[start, h1]] = cables([['a', 'b']], shapesOf({a: block([0, 0]), b: block(b)}), floor); return along(start, h1)[2]; };
    expect(reach([1.6, -1.2])).toBeCloseTo(0.35 * 120, 6);     // two feet half a tile apart: the least (cable.js places nothing: it lays a cable between what it is given)
    expect(reach([40, -40])).toBeCloseTo(2 * 120, 6);          // far apart: the most
  });

  it('cables at one foot share it out, leaving and arriving alike, in the order that keeps them apart: the one whose other end is furthest up the slide nearest the back', () => {
    const shapes = shapesOf({hub: block([4, 4]), up: block([8, -2]), level: block([10, 1]), down: block([13, 5]), src: block([-2, 10])});
    const links = [['hub', 'down'], ['hub', 'up'], ['hub', 'level'], ['src', 'hub'], ['up', 'hub']];
    const laid = cables(links, shapes, floor);
    // "up", "level" and "down" stand to the hub's right: four cables at its right foot (rows 4 to 6), three leaving and one
    // coming back from "up" — to and from "up" first (in the order written), then "level", then "down"
    expect([touches(laid[1][0], cols)[1], touches(laid[4][3], cols)[1], touches(laid[2][0], cols)[1], touches(laid[0][0], cols)[1]].map((v) => +v.toFixed(6))).toEqual([4.4, 4.8, 5.2, 5.6]);
    for (const at of [touches(laid[0][0], cols), touches(laid[1][0], cols), touches(laid[2][0], cols), touches(laid[4][3], cols)]) expect(at[0]).toBeCloseTo(6, 6);
    // "src" stands to its left: one cable, at the middle of the hub's left foot (cols 4 to 6, the edge at row 6)
    expect(touches(laid[3][3], rows).map((v) => +v.toFixed(6))).toEqual([5, 6]);
    // two written between the same two blocks lie side by side, never one on the other
    const twice = cables([['a', 'b'], ['a', 'b']], shapesOf({a: block([0, 4]), b: block([5, 1])}), floor);
    expect(Math.hypot(twice[0][0][0] - twice[1][0][0], twice[0][0][1] - twice[1][0][1])).toBeGreaterThan(20);
    expect(Math.hypot(twice[0][3][0] - twice[1][3][0], twice[0][3][1] - twice[1][3][1])).toBeGreaterThan(20);
    expect(cross(twice[0], twice[1])).toBe(false);
  });

  it('a cylinder\'s feet are on its round base, not on the square of its tiles', () => {
    const shapes = shapesOf({a: block([0, 4], [2, 2, 1], 'cylinder'), b: block([6, 0], [2, 2, 1], 'cylinder'), c: block([6, 4])});
    const laid = cables([['a', 'b'], ['a', 'c'], ['c', 'b'], ['b', 'a']], shapes, floor);
    const fromCentre = (point, way, centre) => { const t = touches(point, way); return Math.hypot(t[0] - centre[0], t[1] - centre[1]); };
    expect(fromCentre(laid[0][0], cols, [1, 5])).toBeCloseTo(1, 6);   // a's cables leave off the middle of its side, and still from its rim
    expect(fromCentre(laid[1][0], cols, [1, 5])).toBeCloseTo(1, 6);
    expect(fromCentre(laid[0][3], rows, [7, 1])).toBeCloseTo(1, 6);   // b's arrive on its rim
    expect(fromCentre(laid[2][3], rows, [7, 1])).toBeCloseTo(1, 6);
    expect(fromCentre(laid[3][0], rows, [7, 1])).toBeCloseTo(1, 6);   // the answer leaves b's rim and comes back to a's
    expect(fromCentre(laid[3][3], cols, [1, 5])).toBeCloseTo(1, 6);
  });

  it('pieces standing at one height above the floor are joined at that height; at two heights, by no cable', () => {
    const shapes = shapesOf({a: block([0, 4, 1.5]), b: block([5, 1, 1.5]), low: block([10, 1])});
    const [raised, mixed] = cables([['a', 'b'], ['a', 'low']], shapes, floor);
    expect(touches(raised[0], cols, 1.5)[0]).toBeCloseTo(2, 6);
    expect(mixed).toBe(null);
  });

  it('gives null for a link that is no cable, in its place: a wire that is none, an end that is no isometric piece, a piece to itself', () => {
    const shapes = shapesOf({a: block([0, 4]), b: block([5, 1])});
    const laid = cables([null, ['a', 'elsewhere'], ['nobody', 'b'], ['a', 'a'], ['a', 'b']], shapes, floor);
    expect(laid.slice(0, 4)).toEqual([null, null, null, null]);
    expect(laid[4]).toHaveLength(4);
    // the one cable there is has its feet's middles: what is no cable takes no place on a foot
    expect(touches(laid[4][0], cols)[1]).toBeCloseTo(5, 6);
    expect(cables([], shapes, floor)).toEqual([]);
  });

  it('for any map the build places: every cable joins the right foot of its block on the left to the left foot of its block on the right, sets off and comes in along the floor, and has a place of its own on each foot (300 seeded maps)', () => {
    let s = 20261119;
    const next = () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const seen = {cables: 0, shared: 0, round: 0, back: 0};
    const ways = {right: cols, left: rows};
    /** A foot's touch is on that foot: along its edge, on the piece's near half (its edge, or its round rim). */
    const onFoot = (at, piece, edge) => {
      const [c, r] = piece.at, [w, d] = piece.size, [u, v] = edge === 'right' ? [at[1] - r, at[0] - c] : [at[0] - c, at[1] - r], [span, far] = edge === 'right' ? [d, w] : [w, d];
      expect(u).toBeGreaterThan(-1e-6); expect(u).toBeLessThan(span + 1e-6);
      expect(v).toBeGreaterThan(far / 2 - 1e-6); expect(v).toBeLessThan(far + 1e-6);
    };
    for (let run = 0; run < 300; run++) {
      const n = 2 + Math.floor(next() * 7), names = Array.from({length: n}, (_, i) => `p${i}`);
      const kinds = names.map(() => (next() < 0.3 ? 'cylinder' : 'block')), wide = names.map((_, i) => (kinds[i] === 'cylinder' ? 2 : 1 + Math.floor(next() * 3)));
      const things = names.map((name, i) => ({name, size: [wide[i], kinds[i] === 'cylinder' ? wide[i] : 1 + Math.floor(next() * 3), next() * 2]}));
      const links = Array.from({length: Math.floor(next() * 10)}, () => [names[Math.floor(next() * n)], names[Math.floor(next() * n)]]);
      const placed = arrange(things, links, {across: true}).things, shapes = new Map(placed.map((t, i) => [t.name, {at: [...t.at], size: [...t.size], kind: kinds[i]}]));
      const laid = cables(links, shapes, floor), feet = new Map();
      const right = (piece) => piece.at[0] + piece.size[0] / 2 - piece.at[1] - piece.size[1] / 2;   // how far right on the slide its middle stands
      laid.forEach((cable, i) => {
        if (links[i][0] === links[i][1]) { expect(cable).toBe(null); return; }
        const [start, h1, h2, end] = cable, a = shapes.get(links[i][0]), b = shapes.get(links[i][1]);
        for (const p of [start, h1, h2, end]) expect(Number.isFinite(p[0]) && Number.isFinite(p[1])).toBe(true);
        const [leaves, arrives] = right(b) >= right(a) ? ['right', 'left'] : ['left', 'right'];
        const [ux, uy] = along(start, h1), [vx, vy] = along(end, h2);
        expect(Math.abs(ux - ways[leaves][0]) + Math.abs(uy - ways[leaves][1]) + Math.abs(vx - ways[arrives][0]) + Math.abs(vy - ways[arrives][1])).toBeLessThan(1e-6);
        const out = touches(start, ways[leaves]), into = touches(end, ways[arrives]);
        onFoot(out, a, leaves); onFoot(into, b, arrives);
        for (const key of [`${links[i][0]} ${leaves} ${out.map((v) => v.toFixed(4))}`, `${links[i][1]} ${arrives} ${into.map((v) => v.toFixed(4))}`]) { expect(feet.has(key), `two cables at one place: ${key}`).toBe(false); feet.set(key, i); }
        seen.cables += 1; seen.round += a.kind === 'cylinder' || b.kind === 'cylinder'; seen.back += leaves === 'left';
      });
      seen.shared += laid.filter(Boolean).length > new Set(links.filter(([u, v]) => u !== v).map(([u]) => u)).size;
    }
    for (const [kind, count] of Object.entries(seen)) expect(count, kind).toBeGreaterThan(40);   // every kind of case was really tried
  });
});

describe('cable · where its label stands', () => {
  const run = [[0, 0], [100, 0], [200, 0], [300, 0]];   // a level run: the point t of the way along is at x = 300·t
  const square = (left, right) => [[left, -50], [right, -50], [right, 50], [left, 50]];

  it('a point of the curve: its start, its end, and its middle an eighth of each end and three of each handle', () => {
    const cable = [[10, 20], [110, 40], [150, 220], [300, 200]];
    expect(cablePoint(cable, 0)).toEqual([10, 20]);
    expect(cablePoint(cable, 1)).toEqual([300, 200]);
    expect(cablePoint(cable, 0.5)).toEqual([(10 + 330 + 450 + 300) / 8, (20 + 120 + 660 + 200) / 8]);
  });

  it('on the cable\'s middle when no block is over it', () => {
    expect(LABEL_PLACES).toEqual([0.5, 0.45, 0.55, 0.4, 0.6, 0.35, 0.65, 0.3, 0.7, 0.25, 0.75, 0.2, 0.8]);
    expect(labelPlace(run, [30, 13], [])).toEqual([150, 0]);
    expect(labelPlace(run, [30, 13], [square(400, 500), square(-200, -50)])).toEqual([150, 0]);   // blocks elsewhere
  });

  it('along the cable to the nearest place no block is over, the nearer the start of two as near', () => {
    // a block over x 110 to 190: a label 60 wide is under it at every place from 0.3 to 0.7 of the way; 0.25 is tried before 0.75
    expect(labelPlace(run, [30, 13], [square(110, 190)])).toEqual([75, 0]);
    expect(labelPlace(run, [30, 13], [square(40, 190)])).toEqual([225, 0]);   // the start's side taken too: the other way
    expect(labelPlace(run, [30, 13], [square(160, 190)])).toEqual([expect.closeTo(120, 9), 0]);  // two places off the middle is enough
  });

  it('where a block is over every place, the place least under it — the middle when they are all alike', () => {
    expect(labelPlace(run, [30, 13], [square(-100, 235)])).toEqual([240, 0]);    // four fifths of the way: the least of it covered
    expect(labelPlace(run, [30, 13], [square(-1000, 1000)])).toEqual([150, 0]);
  });

  it('a cable walked: from its start to its end, never more than 6 px between two points', () => {
    const level = cableWalk(run);
    expect(level).toHaveLength(51);   // its longest leg is 100 px, so no step in 50 is over 6
    expect([level[0], level.at(-1)]).toEqual([[0, 0], [300, 0]]);
    const bent = cableWalk([[10, 20], [310, 40], [-150, 420], [300, 200]]);
    expect([bent[0], bent.at(-1)]).toEqual([[10, 20], [300, 200]]);
    for (let k = 1; k < bent.length; k++) expect(Math.hypot(bent[k][0] - bent[k - 1][0], bent[k][1] - bent[k - 1][1])).toBeLessThanOrEqual(6);
    expect(cableWalk([[5, 5], [5, 5], [5, 5], [5, 5]])).toEqual([[5, 5], [5, 5]]);   // a cable of no length is still a start and an end
  });

  it('off another cable\'s line too: where one runs through the middle, along to the nearest place it does not', () => {
    const down = (x) => Array.from({length: 41}, (_, k) => [x, -100 + 5 * k]);   // another cable, walked: straight down the slide at x
    // a label 60 wide keeps 3 px off a line: one at x 150 runs through it wherever it stands from 0.4 to 0.6 of the way
    expect(labelPlace(run, [30, 13], [], [down(150)])).toEqual([expect.closeTo(105, 9), 0]);
    expect(labelPlace(run, [30, 13], [], [down(150), down(100)])).toEqual([expect.closeTo(195, 9), 0]);   // the start's side crossed too: the other way
    expect(labelPlace(run, [30, 13], [], [down(500)])).toEqual([150, 0]);
    expect(labelPlace(run, [30, 13], [], [Array.from({length: 41}, (_, k) => [150, 17 + 5 * k])])).toEqual([150, 0]);   // a line that passes under it, 3 px clear: not through it
  });

  it('a line through its words rather than a block over them: hidden counts first, then crossed, then how near the middle', () => {
    const down = (x) => Array.from({length: 41}, (_, k) => [x, -100 + 5 * k]);
    // a block over everything right of x 110, and a line down x 60: the only places not under the block have the line through them
    expect(labelPlace(run, [30, 13], [square(110, 400)], [down(60)])).toEqual([75, 0]);   // a quarter of the way: tried before a fifth, and no more crossed
    // every place as much hidden: the nearest the middle that no line runs through
    expect(labelPlace(run, [30, 13], [square(-1000, 1000)], [down(150), down(140), down(160)])).toEqual([expect.closeTo(105, 9), 0]);
  });
});
