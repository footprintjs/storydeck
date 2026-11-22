// motionPlace: the few number rules a moving block is placed by — a foot and a top, the landing under it, whether one
// rests on another, a point off the slide, the swept pass-through, a name's box and whether a block covers it.
import {describe, it, expect} from 'vitest';
import {footOf, topOf, cornerOf, landingUnder, overTop, ridesOn, offSlide, sweptThrough, posed, nameBox, overlapsBox, NAME_WIDTH, THROUGH_MOST} from './motionPlace.js';

const server = {name: 'server', size: [2, 2, 1.4]}, box = {name: 'box', size: [1, 1, 1]};

describe('motionPlace · where a moving block is', () => {
  it('a foot, a top and a corner, each from the other', () => {
    expect(footOf([1, 2, 3], [2, 2, 1])).toEqual([2, 3, 3]);
    expect(footOf([1, 2], [2, 2, 1])).toEqual([2, 3, 0]);
    expect(topOf([1, 2], [2, 2, 1.5])).toEqual([2, 3, 1.5]);
    expect(cornerOf([2, 3, 3], [2, 2, 1])).toEqual([1, 2, 3]);
  });

  it('lands on the highest top under it that is not above it, else the floor; rests on a top only over it and at its height', () => {
    const under = [{block: server, at: [0, 0, 0]}, {block: {name: 'low', size: [4, 4, 0.5]}, at: [0, 0, 0]}];
    expect(landingUnder([0.5, 0.5, 3], box.size, under)).toEqual({lift: 1.4, block: server, at: [0, 0, 0]});
    expect(landingUnder([0.5, 0.5, 1], box.size, under).block.name).toBe('low');       // the server's top is above it
    expect(landingUnder([5, 5, 3], box.size, under)).toEqual({lift: 0, block: null, at: null});
    expect(overTop([1, 1], {block: server, at: [0, 0, 0]})).toBe(true);
    expect(overTop([2.5, 1], {block: server, at: [0, 0, 0]})).toBe(false);
    expect(overTop([9, 9], {block: null})).toBe(true);
    expect(ridesOn({block: box, at: [0.5, 0.5, 1.4]}, server, [0, 0, 0])).toBe(true);
    expect(ridesOn({block: box, at: [0.5, 0.5, 2]}, server, [0, 0, 0])).toBe(false);
  });

  it('says how far off the slide a point lies, in whole px at least', () => {
    expect(offSlide([10, 10], [100, 50])).toBeNull();
    expect(offSlide([-0.2, 60], [100, 50])).toBe('1 px to the left and 10 px below');
    expect(offSlide([130, -4], [100, 50])).toBe('30 px to the right and 4 px above');
  });

  it('sweeps a straight stretch, so a thin block between two samples is found, at its deepest', () => {
    const wall = {block: {name: 'wall', size: [0.1, 3, 1]}, from: [5, 0, 0], to: [5, 0, 0]};
    const hit = sweptThrough([1, 1, 1], [0, 1, 0], [10, 1, 0], [wall]);
    expect(hit.block.name).toBe('wall');
    expect(hit.depth).toBeCloseTo(0.1, 6);
    expect(hit.share).toBeGreaterThan(0.39);
    expect(hit.share).toBeLessThan(0.51);
    expect(sweptThrough([1, 1, 1], [0, 5, 0], [10, 5, 0], [wall])).toBeNull();                       // apart all along
    expect(sweptThrough([1, 1, 1], [0, 1, 1], [10, 1, 1], [wall])).toBeNull();                       // resting on its height: touching is no pass
    expect(THROUGH_MOST).toBe(0.05);
  });

  it('a name\'s box from its fitted lines and small line, wider than any font draws, and whether an outline covers it', () => {
    expect(nameBox({lines: []}, null, [0, 0], 18)).toBeNull();
    expect(nameBox({}, null, [0, 0], 18)).toBeNull();
    const [x0, y0, x1, y1] = nameBox({lines: ['Server'], size: 26}, 'an API', [100, 100], 18);
    expect(x1 - x0).toBeCloseTo(6 * 26 * NAME_WIDTH, 9);
    expect(y1 - y0).toBeCloseTo(26 * 1.15 + 18 * 1.15 + 2, 9);
    expect(nameBox({lines: ['A'], size: 26}, 'a much longer small line', [0, 0], 18)[2]).toBeCloseTo((24 * 18 * NAME_WIDTH) / 2, 9);
    const square = [[0, 0], [10, 0], [10, 10], [0, 10]], diamond = [[5, 0], [10, 5], [5, 10], [0, 5]];
    expect(overlapsBox(square, [5, 5, 20, 20])).toBe(true);
    expect(overlapsBox(square, [11, 0, 20, 5])).toBe(false);
    expect(overlapsBox(diamond, [0, 0, 2, 2])).toBe(false);   // inside its bounds, beyond one of its sides
    expect(posed([10, 20], {dx: 1, dy: 2, pivot: [0, 0], sx: 2, sy: 0.5})).toEqual([21, 12]);
  });
});
