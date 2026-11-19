import {describe, it, expect} from 'vitest';
import {isometric} from 'footprint-story/isometric';
import {isoDrawn} from './iso.js';
import {cables, cablePoint, cableWalk, held, labelPlace, HANDLE, LABEL_LOOKS, LABEL_PLACES, WALK_MOST} from './cable.js';

const grid = isometric({tile: 120, origin: [960, 240]});
const floor = (col, row, lift = 0) => { const p = grid.at(col, row, lift); return [p.x, p.y]; };
const block = (at, size = [2, 2, 1], kind = 'block') => ({at, size, kind});
const canvas = [1920, 1080];
/** Pieces as the build draws them on that grid: the Map `cables` reads, each with the outline of what it draws. */
const shapesOf = (things) => isoDrawn('<i data-iso-grid="120 at 960 240"></i>' + Object.entries(things).map(([name, t]) => `<div data-k="${name}" data-iso="${t.kind}" data-at="${t.at.join(' ')}" data-size="${t.size.join(' ')}"></div>`).join(''), {canvas}).shapes;
/** Whether a slide point is inside an outline: asked here by its own count of the sides a ray crosses. */
const within = (outline, [px, py]) => outline.reduce((odd, [xi, yi], i) => { const [xj, yj] = outline.at(i - 1); return (yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi ? !odd : odd; }, false);
/**
 * How many points of a cable are well under what a piece draws: a thousand points along it (far finer than the code's
 * own walk), each counted when it and the four points 1.5 px round it are all inside the outline — so a stretch that
 * only grazes an edge between two points of the code's walk is not called hidden, and anything deeper is.
 */
const hiddenBy = (cable, shape) => Array.from({length: 1001}, (_, k) => cablePoint(cable, k / 1000))
  .filter(([x, y]) => [[0, 0], [1.5, 0], [-1.5, 0], [0, 1.5], [0, -1.5]].every(([dx, dy]) => within(shape.outline, [x + dx, y + dy]))).length;
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
  });

  it('of two pieces one straight below the other, the upper is the one on the left — whichever the wire starts from', () => {
    // two low plates far apart, one straight down the slide from the other: neither is further right
    const plates = shapesOf({a: block([0, 0], [0.4, 0.4, 0.1]), c: block([8, 8], [0.4, 0.4, 0.1])});
    const [down] = cables([['a', 'c']], plates, floor), [up] = cables([['c', 'a']], plates, floor);
    expect(touches(down[0], cols).map((v) => +v.toFixed(6))).toEqual([0.4, 0.2]);    // out of a's right foot…
    expect(touches(down[3], rows).map((v) => +v.toFixed(6))).toEqual([8.2, 8.4]);    // …into c's left foot
    expect(touches(up[0], rows).map((v) => +v.toFixed(6))).toEqual([8.2, 8.4]);      // the answer: the same two feet
    expect(touches(up[3], cols).map((v) => +v.toFixed(6))).toEqual([0.4, 0.2]);
    // two as far right and as far down (one standing where the other does): by name, so still the same feet both ways
    const twice = shapesOf({a: block([0, 0], [1, 1, 0.1]), b: block([0, 0], [1, 1, 0.1])});
    const [ab] = cables([['a', 'b']], twice, floor), [ba] = cables([['b', 'a']], twice, floor);
    expect(touches(ab[0], cols).map((v) => +v.toFixed(6))).toEqual(touches(ba[3], cols).map((v) => +v.toFixed(6)));
    expect(touches(ab[3], rows).map((v) => +v.toFixed(6))).toEqual(touches(ba[0], rows).map((v) => +v.toFixed(6)));
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
    const reach = (b, size) => { const [[start, h1]] = cables([['a', 'b']], shapesOf({a: block([0, 0], size), b: block(b, size)}), floor); return along(start, h1)[2]; };
    expect(reach([1.2, -1.2], [1, 1, 1])).toBeCloseTo(0.35 * 120, 6);   // two small blocks corner to corner, their feet under a tile apart: the least
    expect(reach([40, -40], [2, 2, 1])).toBeCloseTo(2 * 120, 6);        // far apart: the most
  });

  it('cables at one foot share it out, leaving and arriving alike: the one whose other end is furthest up the slide nearest the back', () => {
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
    // of two other ends as far up the slide, the nearer first: the cable to the further one passes in front of the nearer
    const row = shapesOf({hub: block([0, 4]), near: block([5, 1]), far: block([9, -3])});
    const fan = cables([['hub', 'far'], ['hub', 'near']], row, floor);
    expect(touches(fan[1][0], cols)[1]).toBeCloseTo(4 + 2 / 3, 6);   // to "near": nearer the back, though written second
    expect(touches(fan[0][0], cols)[1]).toBeCloseTo(4 + 4 / 3, 6);
    expect(cross(fan[0], fan[1])).toBe(false);
  });

  it('a cylinder\'s feet are on its round base, not on the square of its tiles', () => {
    const shapes = shapesOf({a: block([0, 4], [2, 2, 1], 'cylinder'), b: block([6, 0], [2, 2, 1], 'cylinder'), c: block([6, 4]), d: block([2, 9])});
    const laid = cables([['a', 'b'], ['a', 'c'], ['d', 'b'], ['b', 'a']], shapes, floor);
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

  it('a block straight in front of another, behind it or against it gets no cable: the curve would run under one of the two', () => {
    const none = (b, links = [['a', 'b']]) => cables(links, shapesOf({a: block([0, 0]), b: block(b)}), floor);
    expect(none([5, 5])).toEqual([null]);              // straight down the slide: the cable would hook under b's corner
    expect(none([5, 5], [['b', 'a']])).toEqual([null]);
    expect(none([-5, -5])).toEqual([null]);            // straight up it: it would turn back under a
    expect(none([2, 0])).toEqual([null]);              // against a's right face: its first stretch would be under b
    expect(none([0, 2])).toEqual([null]);
    expect(none([2.2, 0])).toEqual([null]);
    // beside it along a tile line with under about two tiles between: a's right foot faces b's back, and the cable would hook round under b
    expect(none([4, 0])).toEqual([null]);
    expect(none([0, 4])).toEqual([null]);
    expect(none([5, 0])[0]).toHaveLength(4);           // three tiles between: room to hook round to b's left foot
    expect(none([0, 5])[0]).toHaveLength(4);
    // corner to corner, the feet face each other: a cable, however near
    const [near] = none([2.2, -2.2]);
    expect(near).toHaveLength(4);
    // a cable kept is under neither block — and the check that says so does see a curve that ends inside one
    const shapes = shapesOf({a: block([0, 0]), b: block([5, -3])}), [kept] = cables([['a', 'b']], shapes, floor);
    expect(hiddenBy(kept, shapes.get('a')) + hiddenBy(kept, shapes.get('b'))).toBe(0);
    expect(hiddenBy([kept[0], kept[1], kept[2], shapes.get('b').middle], shapes.get('b'))).toBeGreaterThan(0);
  });

  it('a request and its answer are cables together or not at all: where the two would cross, neither is', () => {
    // b a little down the slide from a's right foot: a cable alone hooks round to b's left foot, and two side by side would cross
    const shapes = shapesOf({a: block([0, 0]), b: block([6, 1])});
    expect(cables([['a', 'b']], shapes, floor)[0]).toHaveLength(4);
    expect(cables([['b', 'a']], shapes, floor)[0]).toHaveLength(4);
    expect(cables([['a', 'b'], ['b', 'a']], shapes, floor)).toEqual([null, null]);
    expect(cables([['a', 'b'], ['a', 'b']], shapes, floor)).toEqual([null, null]);
    // and the others at those feet keep theirs
    const more = shapesOf({a: block([0, 0]), b: block([6, 1]), c: block([5, -6])});
    const laid = cables([['a', 'b'], ['b', 'a'], ['a', 'c']], more, floor);
    expect(laid.slice(0, 2)).toEqual([null, null]);
    expect(laid[2]).toHaveLength(4);
  });

  it('a cable not kept leaves no gap on its foot: the foot is shared out again among those that stay', () => {
    // n1 stands in front of n3 along the rows: the two wires from n1 to n3 pass the trial at the foot's middle, and at
    // their own places on n3's crowded left foot they would run under a block — they are not kept
    const shapes = shapesOf({n0: block([6, 15]), n1: block([12, 6]), n2: block([6, 0]), n3: block([12, 0]), n4: block([0, 3])});
    const links = [['n0', 'n1'], ['n1', 'n0'], ['n3', 'n0'], ['n1', 'n3'], ['n2', 'n1'], ['n1', 'n2'], ['n1', 'n2'], ['n3', 'n0'], ['n0', 'n3'], ['n1', 'n3']];
    const laid = cables(links, shapes, floor);
    expect([laid[3], laid[9]]).toEqual([null, null]);
    // the three that stay at n3's left foot (cols 12 to 14) stand at its quarters — not in the half the five left them
    expect([touches(laid[2][0], rows)[0], touches(laid[7][0], rows)[0], touches(laid[8][3], rows)[0]].map((v) => +v.toFixed(6))).toEqual([12.5, 13, 13.5]);
    for (const i of [2, 7, 8]) expect(hiddenBy(laid[i], shapes.get('n3')) + hiddenBy(laid[i], shapes.get('n0'))).toBe(0);   // laid again, and looked at again
  });

  it('sharing a foot out again never costs a cable: where the second laying would lose one, the first is kept, gap and all', () => {
    // seven blocks the build places, twelve wires. Laid once: eight cables, and four wires that get none. Laid again
    // without those four, two of the eight would move to places where they are not clear — so the first laying stands
    const names = Array.from({length: 7}, (_, i) => `n${i}`);
    const links = [['n0', 'n1'], ['n1', 'n0'], ['n0', 'n2'], ['n0', 'n3'], ['n3', 'n0'], ['n1', 'n4'], ['n4', 'n1'], ['n0', 'n5'], ['n5', 'n0'], ['n0', 'n6'], ['n6', 'n0'], ['n3', 'n0']];
    const {shapes, floor: placed} = isoDrawn(names.map((name) => `<div data-k="${name}" data-iso="block"></div>`).join(''), {canvas, links});
    const laid = cables(links, shapes, placed);
    expect(laid.filter(Boolean)).toHaveLength(8);
    for (const [i, cable] of laid.entries()) if (cable) expect(hiddenBy(cable, shapes.get(links[i][0])) + hiddenBy(cable, shapes.get(links[i][1])), `${links[i]}`).toBe(0);
    // a wire and its answer are still alike
    const kind = (from, to) => links.map((l, i) => (l[0] === from && l[1] === to) || (l[0] === to && l[1] === from) ? Boolean(laid[i]) : null).filter((v) => v !== null);
    for (const [from, to] of [['n0', 'n1'], ['n0', 'n3'], ['n1', 'n4'], ['n0', 'n5'], ['n0', 'n6']]) expect(new Set(kind(from, to)).size, `${from} and ${to}`).toBe(1);
  });

  it('wherever two blocks stand: a cable kept lies clear of what both draw, a pair is kept together or not at all, and a pair kept does not cross (four distances, every 5° round)', () => {
    const seen = {kept: 0, none: 0, pairs: 0, apart: 0};
    for (const far of [3, 4, 6, 10]) {
      for (let k = 0; k < 72; k++) {
        const turn = (k * 5 * Math.PI) / 180, b = [+(far * Math.cos(turn)).toFixed(2), +(far * Math.sin(turn)).toFixed(2)];
        if (Math.abs(b[0]) < 2 && Math.abs(b[1]) < 2) continue;   // one on the other
        const shapes = shapesOf({a: block([0, 0]), b: block(b)}), where = `b at ${b}`;
        const [alone] = cables([['a', 'b']], shapes, floor), [back] = cables([['b', 'a']], shapes, floor), [request, answer] = cables([['a', 'b'], ['b', 'a']], shapes, floor);
        expect(Boolean(alone), where).toBe(Boolean(back));
        expect(Boolean(request), where).toBe(Boolean(answer));
        for (const cable of [alone, back, request, answer]) if (cable) expect(hiddenBy(cable, shapes.get('a')) + hiddenBy(cable, shapes.get('b')), where).toBe(0);
        if (request) { expect(cross(request, answer), where).toBe(false); expect(Boolean(alone), where).toBe(true); }
        seen.kept += Boolean(alone); seen.none += !alone; seen.pairs += Boolean(request); seen.apart += Boolean(alone) && !request;
      }
    }
    expect(seen).toEqual({kept: 168, none: 120, pairs: 144, apart: 24});   // to the side: cables; in front, behind, against: none; a hooked pair: none
  });

  it('for any map the build places: nearly every wire gets its cable; each joins the right foot of its block on the left to the left foot of its block on the right, lies clear of both, and has a place of its own on each foot (300 seeded maps)', () => {
    let s = 20261119;
    const next = () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const seen = {wires: 0, cables: 0, shared: 0, round: 0, back: 0, pairs: 0};
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
      const sizes = names.map((_, i) => [wide[i], kinds[i] === 'cylinder' ? wide[i] : 1 + Math.floor(next() * 3), +(0.2 + next() * 1.8).toFixed(2)]);
      const links = Array.from({length: Math.floor(next() * 10)}, () => [names[Math.floor(next() * n)], names[Math.floor(next() * n)]]);
      // the build's own placing: no data-at, so the blocks stand where the wires put them
      const html = names.map((name, i) => `<div data-k="${name}" data-iso="${kinds[i]}" data-size="${sizes[i].join(' ')}"></div>`).join('');
      const {shapes, floor: placed} = isoDrawn(html, {canvas, area: [60, 200, 1860, 1000], links: links.filter(([u, v]) => u !== v)});
      const laid = cables(links, shapes, placed), feet = new Map();
      const origin = placed(0, 0, 0), tile = placed(1, 0, 0)[0] - origin[0], rise = placed(1, 0, 0)[1] - origin[1];
      const tilesOf = ([x, y]) => { const a = (x - origin[0]) / tile, b = (y - origin[1]) / rise; return [(a + b) / 2, (b - a) / 2]; };   // the floor point under a slide point
      const right = (piece) => piece.at[0] + piece.size[0] / 2 - piece.at[1] - piece.size[1] / 2, down = (piece) => piece.at[0] + piece.size[0] / 2 + piece.at[1] + piece.size[1] / 2;
      laid.forEach((cable, i) => {
        if (links[i][0] === links[i][1]) { expect(cable).toBe(null); return; }
        seen.wires += 1;
        if (!cable) return;
        const [start, h1, h2, end] = cable, a = shapes.get(links[i][0]), b = shapes.get(links[i][1]);
        for (const p of [start, h1, h2, end]) expect(Number.isFinite(p[0]) && Number.isFinite(p[1])).toBe(true);
        const side = right(a) - right(b) || down(a) - down(b), [leaves, arrives] = side > 0 || (side === 0 && links[i][0] > links[i][1]) ? ['left', 'right'] : ['right', 'left'];
        const [ux, uy] = along(start, h1), [vx, vy] = along(end, h2);
        expect(Math.abs(ux - ways[leaves][0]) + Math.abs(uy - ways[leaves][1]) + Math.abs(vx - ways[arrives][0]) + Math.abs(vy - ways[arrives][1])).toBeLessThan(1e-6);
        const out = tilesOf([start[0] - ways[leaves][0] * 6, start[1] - ways[leaves][1] * 6]), into = tilesOf([end[0] - ways[arrives][0] * 6, end[1] - ways[arrives][1] * 6]);
        onFoot(out, a, leaves); onFoot(into, b, arrives);
        expect(hiddenBy(cable, a) + hiddenBy(cable, b), `${links[i]} of run ${run}`).toBe(0);
        for (const key of [`${links[i][0]} ${leaves} ${out.map((v) => v.toFixed(4))}`, `${links[i][1]} ${arrives} ${into.map((v) => v.toFixed(4))}`]) { expect(feet.has(key), `two cables at one place: ${key}`).toBe(false); feet.set(key, i); }
        seen.cables += 1; seen.round += a.kind === 'cylinder' || b.kind === 'cylinder'; seen.back += leaves === 'left';
      });
      // cables between the same two blocks: kept together, and never across each other
      for (let i = 0; i < links.length; i++) {
        for (let j = i + 1; j < links.length; j++) {
          if (links[i][0] === links[i][1] || [...links[i]].sort().join() !== [...links[j]].sort().join()) continue;
          expect(Boolean(laid[i]), `${links[i]} and ${links[j]} of run ${run}`).toBe(Boolean(laid[j]));
          if (laid[i]) { expect(cross(laid[i], laid[j])).toBe(false); seen.pairs += 1; }
        }
      }
      seen.shared += laid.filter(Boolean).length > new Set(links.filter(([u, v]) => u !== v).map(([u]) => u)).size;
    }
    for (const [kind, count] of Object.entries(seen)) expect(count, kind).toBeGreaterThan(40);   // every kind of case was really tried
    expect(seen.cables / seen.wires).toBeGreaterThan(0.97);   // on a map the build places, the feet face each other
  });
});

describe('cable · where its label stands', () => {
  const run = [[0, 0], [100, 0], [200, 0], [300, 0]];   // a level run: the point t of the way along is at x = 300·t
  const square = (left, right) => held([[left, -50], [right, -50], [right, 50], [left, 50]]);

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

  it('points held: the box round them, asked before the points are', () => {
    expect(held([[3, 9], [-4, 2], [10, 5]])).toEqual({points: [[3, 9], [-4, 2], [10, 5]], left: -4, top: 2, right: 10, bottom: 9});
    // what a box says is far away is never looked at: an outline that would hide the label, held in a box that says it is elsewhere
    const lying = {...square(110, 190), left: 900, right: 990};
    expect(labelPlace(run, [30, 13], [lying])).toEqual([150, 0]);
  });

  it('off its own cable\'s two ends: its plate over the arrow\'s head would hide where the cable goes', () => {
    const short = [[0, 0], [50, 0], [100, 0], [150, 0]];   // 150 px: the point t of the way along is at x = 150·t
    expect(labelPlace(short, [30, 13], [])).toEqual([75, 0]);   // room at the middle: 45 to 105, off the head (134 on) and the start (to 8)
    // a block over everything left of x 100: every place is partly hidden. At four fifths of the way the least is under
    // the block, but the plate would be over the head; three quarters is no worse, and comes first
    expect(labelPlace(short, [30, 13], [square(-100, 100)])).toEqual([112.5, 0]);
    // on a cable with room to spare past both ends' zones, the ends change nothing
    expect(labelPlace(run, [30, 13], [square(-100, 235)])).toEqual([240, 0]);
  });

  it('a cable walked: from its start to its end, never more than 6 px between two points', () => {
    const level = cableWalk(run);
    expect(level).toHaveLength(51);   // its longest leg is 100 px, so no step in 50 is over 6
    expect([level[0], level.at(-1)]).toEqual([[0, 0], [300, 0]]);
    const bent = cableWalk([[10, 20], [310, 40], [-150, 420], [300, 200]]);
    expect([bent[0], bent.at(-1)]).toEqual([[10, 20], [300, 200]]);
    for (let k = 1; k < bent.length; k++) expect(Math.hypot(bent[k][0] - bent[k - 1][0], bent[k][1] - bent[k - 1][1])).toBeLessThanOrEqual(6);
    expect(cableWalk([[5, 5], [5, 5], [5, 5], [5, 5]])).toEqual([[5, 5], [5, 5]]);   // a cable of no length is still a start and an end
    // a cable far longer than a slide is walked more coarsely, never in more points
    expect(WALK_MOST).toBe(512);
    const long = cableWalk([[0, 0], [1e6, 0], [2e6, 0], [3e6, 0]]);
    expect(long).toHaveLength(513);
    expect(long.at(-1)).toEqual([3e6, 0]);
  });

  it('its own run is passed over: a cable is never in the way of its own label', () => {
    const own = {...held(cableWalk(run)), of: run}, other = {...held(cableWalk(run)), of: [[0, 0], [100, 0], [200, 0], [300, 0]]};
    const mine = {left: 1000}, theirs = {left: 1000};
    expect(labelPlace(run, [30, 13], [], [own], mine)).toEqual([150, 0]);
    expect(mine.left).toBe(999);   // found near, known as its own, not asked: the middle is free
    labelPlace(run, [30, 13], [], [other], theirs);   // the same points as another cable's: in the way at every place
    expect(theirs.left).toBeLessThan(1000 - 13 * 10);
    const crossing = {...held(Array.from({length: 41}, (_, k) => [150, -100 + 5 * k])), of: [[150, -100], [150, 0], [150, 50], [150, 100]]};
    expect(labelPlace(run, [30, 13], [], [own, crossing])).toEqual([expect.closeTo(105, 9), 0]);
  });

  it('a map\'s labels share one count of looks: a place that costs more than is left is not asked, nor any after it', () => {
    expect(LABEL_LOOKS).toBe(60_000_000);
    // a label 60 by 26 is 11 by 6 points; a square has 4 sides: a place the square is near costs 11·6·4 looks and 1 to find it near.
    // The square is near at the nine places from 0.3 to 0.7 of the way, and the tenth, a quarter of the way, is free: 9·265 + 1
    const all = {left: 5000};
    expect(labelPlace(run, [30, 13], [square(110, 190)], [], all)).toEqual([75, 0]);
    expect(all.left).toBe(5000 - 9 * 265 - 1);
    const exact = {left: 9 * 265 + 1};
    expect(labelPlace(run, [30, 13], [square(110, 190)], [], exact)).toEqual([75, 0]);
    expect(exact.left).toBe(0);
    // one look short of the tenth place: the best of the nine asked — the least hidden, the earlier of two alike
    const short = {left: 9 * 265};
    expect(labelPlace(run, [30, 13], [square(110, 190)], [], short)).toEqual([expect.closeTo(90, 9), 0]);
    expect(short.left).toBe(0);
    // not enough for the first place: the cable's middle, and nothing spent
    const little = {left: 264};
    expect(labelPlace(run, [30, 13], [square(110, 190)], [], little)).toEqual([150, 0]);
    expect(little.left).toBe(264);
    const none = {left: 0};
    expect(labelPlace(run, [30, 13], [square(110, 190)], [], none)).toEqual([150, 0]);
    expect(labelPlace(run, [30, 13], [], [], none)).toEqual([150, 0]);   // nothing to look at costs nothing
    // another cable's points are looks too: 41 of them near, and 1 to find it
    const down = held(Array.from({length: 41}, (_, k) => [500, -100 + 5 * k])), far = {left: 1000};
    expect(labelPlace(run, [30, 13], [], [down], far)).toEqual([150, 0]);
    expect(far.left).toBe(999);   // not near: only the look that found it far
    const through = held(Array.from({length: 41}, (_, k) => [150, -100 + 5 * k])), spent = {left: 1000};
    labelPlace(run, [30, 13], [], [through], spent);
    expect(spent.left).toBe(1000 - 5 * 42 - 1);   // near at the five places from 0.4 to 0.6 of the way; free at the sixth, where it is not near
  });

  it('off another cable\'s line too: where one runs through the middle, along to the nearest place it does not', () => {
    const down = (x) => held(Array.from({length: 41}, (_, k) => [x, -100 + 5 * k]));   // another cable, walked: straight down the slide at x
    // a label 60 wide keeps 3 px off a line: one at x 150 runs through it wherever it stands from 0.4 to 0.6 of the way
    expect(labelPlace(run, [30, 13], [], [down(150)])).toEqual([expect.closeTo(105, 9), 0]);
    expect(labelPlace(run, [30, 13], [], [down(150), down(100)])).toEqual([expect.closeTo(195, 9), 0]);   // the start's side crossed too: the other way
    expect(labelPlace(run, [30, 13], [], [down(500)])).toEqual([150, 0]);
    expect(labelPlace(run, [30, 13], [], [held(Array.from({length: 41}, (_, k) => [150, 17 + 5 * k]))])).toEqual([150, 0]);   // a line that passes under it, 3 px clear: not through it
  });

  it('a line through its words rather than a block over them: hidden counts first, then crossed, then how near the middle', () => {
    const down = (x) => held(Array.from({length: 41}, (_, k) => [x, -100 + 5 * k]));
    // a block over everything right of x 110, and a line down x 60: the only places not under the block have the line through them
    expect(labelPlace(run, [30, 13], [square(110, 400)], [down(60)])).toEqual([75, 0]);   // a quarter of the way: tried before a fifth, and no more crossed
    // every place as much hidden: the nearest the middle that no line runs through
    expect(labelPlace(run, [30, 13], [square(-1000, 1000)], [down(150), down(140), down(160)])).toEqual([expect.closeTo(105, 9), 0]);
  });
});
