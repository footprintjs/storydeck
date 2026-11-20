import {describe, it, expect} from 'vitest';
import {isometric} from 'footprint-story/isometric';
import {floorUnder, readKeepClear, CLEAR_CELL} from './keepClear.js';
import {transformed} from './transforms.js';
import {readWay} from './cable.js';

const canvas = [1920, 1080];
const grid = '<i data-iso-grid="120 at 960 150"></i>', floor = isometric({tile: 120, origin: [960, 150]});
const sw = '<div data-k="sw" data-iso="block" data-at="6 6" data-size="4.7 2 0.4" data-ports="p1: 0.4 2 0.3"></div>';
const lap = '<div data-k="lap" data-iso="block" data-at="0 6" data-size="2 1.4 0.3" data-ports="rj45: 2 0.7 0.15"></div>';
const wire = '<i data-k="w1" class="wire" data-arrow="lap.rj45 to sw.p1"></i>';
const label = (k, [x, y, w, h], more = ' data-keep-clear') => `<div data-k="${k}"${more} style="left:${x}px;top:${y}px;width:${w}px;height:${h}px">${k}</div>`;
/** Whether a point of the slide is inside a box, a pixel in from its edge. */
const inBox = ([px, py], [x, y, w, h]) => px > x + 1 && px < x + w - 1 && py > y + 1 && py < y + h - 1;
/** A cable's points sampled along its straight stretches. */
const along = (points) => points.slice(1).flatMap((b, i) => Array.from({length: 21}, (_, k) => [points[i][0] + (b[0] - points[i][0]) * k / 20, points[i][1] + (b[1] - points[i][1]) * k / 20]));

describe('keepClear · the floor under a box on the slide', () => {
  for (const lift of [0, 1]) it(`is every square of floor at height ${lift} whose drawn diamond meets the box, joined along a row — checked square by square`, () => {
    const box = {x: 700, y: 520, w: 80, h: 30}, strips = floorUnder(box, floor, lift);
    // each stretch reaches a hair (0.01 tile) past its squares, so two side by side overlap: read back its squares
    const kept = new Set(strips.flatMap(({at: [c, r], size: [w]}) => Array.from({length: Math.round((w - 0.02) / CLEAR_CELL)}, (_, k) => `${+(c + 0.01 + k * CLEAR_CELL).toFixed(6)},${+(r + 0.01).toFixed(6)}`)));
    // an independent test of each square near the box: its diamond's four corners and its middle, and the box's corners inside the diamond
    const diamond = (c, r) => [[c, r], [c + CLEAR_CELL, r], [c + CLEAR_CELL, r + CLEAR_CELL], [c, r + CLEAR_CELL]].map(([a, b]) => { const p = floor.at(a, b, lift); return [p.x, p.y]; });
    const inside = (pts, [px, py]) => { let s = 0; for (let i = 0; i < 4; i++) { const [ax, ay] = pts[i], [bx, by] = pts[(i + 1) % 4]; const c = (bx - ax) * (py - ay) - (by - ay) * (px - ax); if (Math.abs(c) <= 1e-9 || (s && Math.sign(c) !== s)) return false; s = Math.sign(c); } return true; };   // strictly inside: a touch at one point is no meeting
    const crosses = (pts) => pts.some(([px, py]) => px > box.x && px < box.x + box.w && py > box.y && py < box.y + box.h)
      || [[box.x, box.y], [box.x + box.w, box.y], [box.x, box.y + box.h], [box.x + box.w, box.y + box.h]].some((p) => inside(pts, p))
      // an edge of the diamond through the box: sampled
      || pts.some((a, i) => { const b = pts[(i + 1) % 4]; return Array.from({length: 41}, (_, k) => [a[0] + (b[0] - a[0]) * k / 40, a[1] + (b[1] - a[1]) * k / 40]).some(([px, py]) => px > box.x && px < box.x + box.w && py > box.y && py < box.y + box.h); });
    for (let c = -4; c < 16; c += CLEAR_CELL) for (let r = -4; r < 16; r += CLEAR_CELL) expect(kept.has(`${c},${r}`), `${c},${r}`).toBe(crosses(diamond(c, r)));
    expect(strips.length).toBeGreaterThan(0);
    expect(strips.every(({at: [, , z], size: [w, d]}) => z === lift && w > 0 && Math.abs(d - CLEAR_CELL - 0.02) < 1e-9)).toBe(true);
  });

  it('counts the floor a box covers before looking at it: a box many slides wide on a tiny tile is refused at once', () => {
    const tiny = isometric({tile: 4, origin: [960, 150]}), t0 = Date.now();
    expect(() => floorUnder({x: 0, y: 0, w: 40000, h: 40000}, tiny, 0, '"nm" (data-keep-clear)')).toThrow(/^"nm" \(data-keep-clear\): its box covers more floor than a picture needs \(\d+ squares\) — give it a box the size of its words$/);
    expect(Date.now() - t0).toBeLessThan(100);
  });
});

describe('keepClear · a cable keeps off the floor under a name (data-keep-clear)', () => {
  const plain = transformed(`${grid}${sw}${lap}${wire}`, {canvas}).cables[0];

  it('goes round the floor under a name across its way, and says nothing', () => {
    const box = [677, 523, 80, 30];
    expect(along(plain.points).some((p) => inBox(p, box))).toBe(true);   // without the mark it runs under it
    const made = transformed(`${grid}${sw}${lap}${label('nm', box)}${wire}`, {canvas}), [cable] = made.cables;
    expect(along(cable.points).some((p) => inBox(p, box))).toBe(false);
    expect(made.ways.find((w) => /under/.test(w.way))).toBeUndefined();
  });

  it('where there is no way round, the cable runs under the words and check says which, with the fix', () => {
    // a name over the switch's port: its riser has no way out but under it
    const box = [794, 567, 80, 30];
    const made = transformed(`${grid}${sw}${lap}${label('nm', box)}${wire}`, {canvas});
    expect(made.cables).toHaveLength(1);
    expect(made.ways).toEqual([{name: 'w1', from: 'lap', to: 'sw', way: expect.stringMatching(/(^|; )under nm(;|$)/)}]);
    expect(readWay('under nm', 'lap', 'sw')).toEqual([{level: 'warn', message: 'runs under nm, kept clear of cables: there was no way round on the floor — move it, or the blocks, so there is floor round it'}]);
  });

  it('keeps the other cables where they were: kept floor is a cost, it never changes how finely the floor is laid', () => {
    const far = label('far', [1800, 1000, 20, 10]);
    expect(transformed(`${grid}${sw}${lap}${far}${wire}`, {canvas}).cables[0].points).toEqual(plain.points);
  });

  it('keeps cables off words on a raised floor too: the floor under the box at the blocks\' height', () => {
    const up = (h) => h.replace('data-at="6 6"', 'data-at="6 6 1"').replace('data-at="0 6"', 'data-at="0 6 1"');
    const raised = transformed(`${grid}${up(sw)}${up(lap)}${wire}`, {canvas}).cables[0];
    const box = [677, 523 - 70, 80, 30];   // the plain test's box, lifted by the floor's rise (70 px a unit)
    expect(along(raised.points).some((p) => inBox(p, box))).toBe(true);
    const made = transformed(`${grid}${up(sw)}${up(lap)}${label('nm', box)}${wire}`, {canvas});
    expect(along(made.cables[0].points).some((p) => inBox(p, box))).toBe(false);
  });

  it('knows a piece by its own name, however long, and says it once', () => {
    const long = `n${'x'.repeat(300)}`, box = [794, 567, 80, 30];
    const made = transformed(`${grid}${sw}${lap}${label(long, box)}${wire}`, {canvas});
    expect(made.ways[0].way).toContain(`under ${long}`);
    expect(made.ways[0].way.split(`under ${long}`)).toHaveLength(2);
  });

  it('refuses, naming the piece and the fix, a mark it cannot keep', () => {
    const bad = (html) => () => transformed(html, {canvas});
    expect(bad(`<i data-iso-grid="fit"></i>${sw}${label('nm', [1, 1, 50, 20])}`)).toThrow('"nm" (data-keep-clear): the floor kept clear is the floor under the piece where its style puts it, so the floor is written in numbers beside it — data-iso-grid="120 at 960 240", not "fit"');
    expect(bad(`<div data-k="a" data-iso="block"></div>${label('nm', [1, 1, 50, 20])}`)).toThrow(/"a" has no data-at, and "nm" \(data-keep-clear\) keeps the floor under it clear where its own style puts it/);
    expect(bad(`${grid}${sw}<div data-k="nm" data-keep-clear style="left:1px;top:1px">x</div>`)).toThrow('"nm" (data-keep-clear): the floor kept clear is the floor under the piece\'s box — give it a left, a top, a width and a height in its style');
    expect(bad(`${grid}${sw}<div data-keep-clear style="left:1px;top:1px;width:9px;height:9px">x</div>`)).toThrow('data-keep-clear: it marks a piece (a data-k name, and a box in its style) — give the element a data-k, or take the mark off');
    // past the most stretches of kept floor a map has: refused, with the fix
    const big = (n) => Array.from({length: n}, (_, i) => label(`big${i}`, [0, 0, 1900, 1000])).join('');
    expect(bad(`${grid}${sw}${big(1)}`)).not.toThrow();
    expect(bad(`${grid}${sw}${big(8)}`)).toThrow(/^data-keep-clear: the floor kept clear on this map is \d+ stretches, and a map keeps at most 512 — keep clear under smaller pieces, or fewer$/);
  });

  it('a map with no mark is laid as before; a mark in another attribute\'s value is no mark', () => {
    const html = `${grid}${sw}${lap}<div data-k="t" title="data-keep-clear" style="left:1px;top:1px;width:9px;height:9px">t</div>${wire}`;
    expect(transformed(html, {canvas}).cables[0].points).toEqual(plain.points);
    expect(readKeepClear(html)).toEqual([]);
  });
});
