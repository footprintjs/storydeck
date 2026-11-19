import {describe, it, expect} from 'vitest';
import {boxFinder, exit, exitOutline} from './boxes.js';

describe('boxes · where a piece stands, and where a line leaves it', () => {
  const square = [[0, 0], [10, 0], [10, 10], [0, 10]];

  it('exitOutline: how far a ray from inside runs before it leaves the outline, through whichever side it crosses', () => {
    expect(exitOutline(square, [5, 5], [1, 0])).toBeCloseTo(5, 9);
    expect(exitOutline(square, [5, 5], [0, -1])).toBeCloseTo(5, 9);
    expect(exitOutline(square, [2, 5], [-1, 0])).toBeCloseTo(2, 9);
    expect(exitOutline(square, [5, 5], [Math.SQRT1_2, Math.SQRT1_2])).toBeCloseTo(5 * Math.SQRT2, 9);   // out through a corner
    expect(exitOutline(square, [5, 0], [1, 0])).toBeCloseTo(5, 9);            // along a side: it leaves by the next one
    // a six-sided outline, as a block draws: the same answer as its box only where the box's edge is the outline's
    const block = [[10, 0], [20, 5], [20, 15], [10, 20], [0, 15], [0, 5]];
    expect(exitOutline(block, [10, 10], [1, 0])).toBeCloseTo(10, 9);
    expect(exitOutline(block, [10, 10], [0, 1])).toBeCloseTo(10, 9);
    expect(exitOutline(block, [10, 10], [Math.SQRT1_2, -Math.SQRT1_2])).toBeLessThan(exit({x: 0, y: 0, w: 20, h: 20}, [10, 10], [Math.SQRT1_2, -Math.SQRT1_2]));   // the box's empty corner is not the block
  });

  it('exitOutline: a ray that never meets the outline runs for ever', () => {
    expect(exitOutline(square, [20, 5], [1, 0])).toBe(Infinity);
    expect(exitOutline([], [0, 0], [1, 0])).toBe(Infinity);
  });

  it('for a box, the outline of its four corners leaves where the box does, on 2,000 seeded rays', () => {
    let s = 5;
    const next = () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    for (let i = 0; i < 2000; i++) {
      const b = {x: next() * 200 - 100, y: next() * 200 - 100, w: 1 + next() * 300, h: 1 + next() * 300}, a = next() * Math.PI * 2;
      const p = [b.x + b.w * (0.05 + next() * 0.9), b.y + b.h * (0.05 + next() * 0.9)], u = [Math.cos(a), Math.sin(a)];
      expect(exitOutline([[b.x, b.y], [b.x + b.w, b.y], [b.x + b.w, b.y + b.h], [b.x, b.y + b.h]], p, u)).toBeCloseTo(exit(b, p, u), 6);
    }
  });

  it('boxFinder finds a piece by its first name, several of one name as one box, and names the placed pieces when there is none', () => {
    const find = boxFinder('<div data-k="a" style="left:10px;top:20px;width:30px;height:40px"></div><div data-k="a twin" style="left:100px;top:20px;width:30px;height:40px"></div><b data-k="loose">x</b>');
    expect(find('a', 'here')).toEqual({x: 10, y: 20, w: 120, h: 40});
    expect(() => find('loose', 'here')).toThrow('here: no piece "loose" with a box (data-k, and an inline left, top, width and height) — the placed pieces are a');
  });
});
