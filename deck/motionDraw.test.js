// motionDraw: a map's planned moves as keyframes on the page — each keyframe footprint-story's sample at its moment, to
// a millionth of a px; the paint level that jumps as a block passes another; the rope; the rest pose each click shows;
// and only under the gate that plays a forward click on a screen with motion on.
import {describe, it, expect} from 'vitest';
import {sampleMove} from 'footprint-story/human';
import {isoDrawn} from './iso.js';
import {readMoves} from './motionRead.js';
import {planMotions} from './motionPlan.js';
import {motionView, motionHtml, transformOf, keyTimes, KEYFRAME_RATE, KEYFRAMES_MOST, MOTION_CSS} from './motionDraw.js';
import {footOf, topOf} from 'footprint-story/isometric';

const CANVAS = [1920, 1080];
const GRID = '<i data-iso-grid="120 at 960 300"></i><div data-k="floor" data-iso="floor" data-size="8 6"></div>';
const block = (name, at, size = '1 1 1', words = `<b>${name}</b>`) => `<div data-k="${name}" data-iso="block" data-at="${at}" data-size="${size}">${words}</div>`;
function viewOf(blocks, clicks) {
  const movers = new Set(clicks.filter(Boolean).flatMap((v) => v.split(';').map((t) => t.trim().split(/\s+/)[0])));
  const drawn = isoDrawn(GRID + blocks.join(''), {canvas: CANVAS, movers}), map = drawn.motion;
  const holds = {blocks: map.blocks, others: new Map(), links: [], callouts: []};
  const plan = planMotions(map, clicks.map((v, i) => ({n: i + 1, moves: v === null ? [] : readMoves(v, 'data-move', holds)})), {canvas: CANVAS});
  return {drawn, map, plan, view: motionView(plan, map, {id: 'map'})};
}
/** The keyframes of one @keyframes block: [[offset, declarations]]. */
const keyframes = (css, name) => [...new RegExp(`@keyframes ${name} \\{(.*?) \\}\\n`).exec(`${css}\n`)[1].matchAll(/ ([\d.]+)% \{ (.*?); \}/g)].map((m) => [Number(m[1]), m[2]]);
const numbers = (text) => [...text.matchAll(/-?[\d.]+(?:e-?\d+)?/g)].map((m) => Number(m[0]));

describe('motionDraw · keyframes from footprint-story\'s samples', () => {
  it('writes each move as keyframes 60 a second, each one the sample at its moment, to a millionth', () => {
    const {map, plan, view} = viewOf([block('box', '1 1 3'), block('crate', '1 4')], ['box fall; crate slide to 5 4.5']);
    for (const m of plan.moves) {
      const frames = keyframes(view.css, `sdIsoMove-map-${m.k}`), times = keyTimes(m.seconds), b = m.piece;
      expect(frames.length).toBe(times.length);
      expect(times.length - 1).toBe(Math.ceil(m.seconds * KEYFRAME_RATE));
      const foot = map.grid.at(...footOf(b.at, b.size));
      frames.forEach(([offset, decl], k) => {
        expect(offset).toBeCloseTo((k / (times.length - 1)) * 100, 5);
        const [tx, ty, sx, sy] = numbers(decl), s = sampleMove(m.move, times[k]), pose = plan.poseAt(b, m.ci, times[k]);
        expect(Math.abs(tx - (pose.pivot[0] - b.box.x) * (1 - pose.sx) - pose.dx)).toBeLessThan(1e-6);
        expect(Math.abs(ty - (pose.pivot[1] - b.box.y) * (1 - pose.sy) - pose.dy)).toBeLessThan(1e-6);
        expect([sx, sy]).toEqual([1, 1]);
        // the fall's own sample, unworked: where it has come from its foot
        if (m.do === 'fall') { expect(Math.abs(tx - (s.x - foot.x))).toBeLessThan(1e-6); expect(Math.abs(ty - (s.y - foot.y))).toBeLessThan(1e-6); }
      });
    }
    expect(view.css).toContain(`[data-sd-move="map-0"]) { animation: sdIsoMove-map-0 ${+plan.moves[0].seconds.toFixed(6)}s linear var(--sd-arrive-at, 0s) both; }`);
  });

  it('caps a long move\'s keyframes, and writes a squash about its pivot', () => {
    expect(keyTimes(100).length).toBe(KEYFRAMES_MOST + 1);
    expect(keyTimes(0).length).toBe(3);
    expect(transformOf(null, {x: 0, y: 0})).toBe('translate(0px, 0px) scale(1, 1)');
    // a pivot at (110, 220) in a box at (10, 20), squashed 1.25 × 0.8 and moved by (5, -3): the pivot stays put, then moves
    expect(transformOf({pivot: [110, 220], sx: 1.25, sy: 0.8, dx: 5, dy: -3}, {x: 10, y: 20})).toBe('translate(-20px, 37px) scale(1.25, 0.8)');
    const {plan, view} = viewOf([block('box', '1 1 4')], ['box fall model bounce squash 0.3']);
    const scales = keyframes(view.css, 'sdIsoMove-map-0').map(([, d]) => numbers(d).slice(2));
    expect(scales.some(([sx, sy]) => sx !== 1 && Math.abs(sx * sy - 1) < 1e-5)).toBe(true);   // its area kept, as footprint-story squashes it
    expect(plan.moves[0].seconds).toBeGreaterThan(0);
  });

  it('jumps a block\'s paint level as it passes another (step-end, never through the levels between), and rests at its new level', () => {
    const {drawn, view} = viewOf([block('a', '1 1'), block('b', '3 3')], ['a slide to 6 1.5']);
    const zs = keyframes(view.css, 'sdIsoZ-map-0').map(([, d]) => numbers(d)[0]);
    const still = drawn.motion.blocks[1].level;
    expect(still).toBe(3 * 2);                                  // two blocks, one moving: still levels 3 apart (iso.js · stride)
    expect(zs[0]).toBeLessThan(still);
    expect(zs.at(-1)).toBeGreaterThan(still);
    expect(new Set(zs).size).toBe(2);
    expect(view.css).toContain('[data-sd-move-z="map-0"]) { animation: sdIsoZ-map-0');
    expect(view.css).toMatch(/sdIsoZ-map-0 [\d.]+s step-end var\(--sd-arrive-at, 0s\) both/);
    expect(view.click(0).movers.get(0)).toMatchObject({z: zs.at(-1), move: 'map-0', zMove: 'map-0'});
  });

  it('writes a hang\'s rope as links, each turned and stretched onto its stretch of the sample\'s rope', () => {
    const {plan, view} = viewOf([block('lamp', '3 3')], ['lamp hang from 3.5 3.5 4', null]);
    const m = plan.moves[0], times = keyTimes(m.seconds), links = plan.poseAt(m.piece, 0, 0).rope.length - 1;
    for (let j = 0; j < links; j += 1) {
      const frames = keyframes(view.css, `sdIsoRope-map-0-${j}`);
      for (const k of [0, Math.floor(times.length / 2), times.length - 1]) {
        const rope = sampleMove(m.move, times[k]).points, [x0, y0] = rope[j], [x1, y1] = rope[j + 1];
        const [tx, ty, a, len] = numbers(frames[k][1]);
        expect(Math.abs(tx - (x0 - m.piece.box.x))).toBeLessThan(1e-6);
        expect(Math.abs(ty - (y0 - m.piece.box.y))).toBeLessThan(1e-6);
        expect(Math.abs(len - Math.hypot(x1 - x0, y1 - y0))).toBeLessThan(1e-6);
        expect(Math.abs(Math.cos(a) - (x1 - x0) / len)).toBeLessThan(1e-5);
      }
    }
    const playing = view.click(0).movers.get(0), after = view.click(1).movers.get(0);
    expect(playing.rope).toContain('data-sd-rope="map-0-0"');
    expect(after.rope).toMatch(/^<svg class="iso-rope" aria-hidden="true"><line x2="1" vector-effect="non-scaling-stroke" style="transform:translate\(/);
    expect(after.move).toBeUndefined();
    expect(view.css).toContain('[data-sd-rope="map-0-0"]) { animation: sdIsoRope-map-0-0');
  });

  it('plays only on a forward click into the slide, on a screen, with motion on — every other way shows the rest', () => {
    const {view} = viewOf([block('box', '1 1 3')], ['box fall']);
    const [sheet, play] = view.css.split('@media screen and (prefers-reduced-motion: no-preference) {\n');
    expect(sheet).toMatch(/^\/\* map "map": its blocks' moves/);
    expect(sheet).not.toContain('animation:');
    const rules = play.split('\n').filter((l) => l.trim() && l !== '}');
    expect(rules.length).toBeGreaterThan(0);
    for (const rule of rules) expect(rule.startsWith('  :where(section[data-label][data-deck-active]:not([data-sd-instant]):not([data-deck-static]) [')).toBe(true);
    expect(MOTION_CSS).toContain('@keyframes sdIsoShow { from { visibility: visible; } to { visibility: visible; } }');
  });
});

describe('motionDraw · each click\'s slide', () => {
  it('rests each block where its last move left it, plays the click\'s own move, and gives the camera where it rests', () => {
    const {map, plan, view} = viewOf([block('box', '1 1 3'), block('crate', '1 4')], [null, 'box fall', null, 'crate settle to 3 4.5']);
    const box = map.blocks[0], fallen = plan.poseAt(box, 1, Infinity);
    expect(view.click(0).movers.get(0)).toMatchObject({transform: 'translate(0px, 0px) scale(1, 1)'});
    expect(view.click(0).movers.get(0).move).toBeUndefined();
    expect(view.click(1).movers.get(0)).toMatchObject({transform: transformOf(fallen, box.box), move: 'map-0'});
    expect(view.click(2).movers.get(0)).toMatchObject({transform: transformOf(fallen, box.box)});
    expect(view.click(2).movers.get(0).move).toBeUndefined();
    expect(view.click(3).movers.get(1).move).toBe('map-1');
    expect(view.moved(0).size).toBe(0);
    expect(view.moved(2).get('box')).toEqual({dx: fallen.dx, dy: fallen.dy});
    expect(fallen.at).toEqual([1, 1, 0]);
    expect(fallen.dy).toBeCloseTo(3 * (map.grid.at(0, 0, 0).y - map.grid.at(0, 0, 1).y), 6);   // down by its three tiles of lift
  });

  it('hides a covered name at rest: shown while the block that covers it moves, hidden from its rest on', () => {
    const {view} = viewOf([block('server', '4 1', '2 2 1.4'), block('box', '1 1')], ['box throw to server', null]);
    expect(view.click(0).hide).toEqual([{index: 0, show: 'map-0'}]);
    expect(view.click(1).hide).toEqual([{index: 0}]);
    expect(view.css).toContain('[data-sd-show="map-0"]) { animation: sdIsoShow');
  });

  it('dresses the drawn HTML for a click by the index the build gave each tag, and leaves the rest byte for byte', () => {
    const view = {movers: new Map([[1, {transform: 'translate(1px, 2px) scale(1, 1)', z: 7, move: 'm-0', zMove: 'm-0', rope: '<svg class="iso-rope"></svg>'}], [2, {transform: 'translate(0px, 0px) scale(1, 1)', z: 9}]]),
      hide: [{index: 0, show: 'm-0'}, {index: 3}]};
    const html = '<div data-k="a" data-sd-moving="1" style="left:1px;z-index:4;"><span class="iso-motion" data-sd-mover="1"><span class="iso-say" data-sd-say="1" style="left:2px">A</span></span></div>'
      + '<div data-k="b" data-sd-moving="2" style="left:1px"><span class="iso-motion" data-sd-mover="2"></span></div>'
      + '<span class="iso-say" data-sd-say="0" style="left:3px">S</span><span class="iso-say" data-sd-say="3">T</span><span class="iso-say" data-sd-say="5">U</span><p data-sd-moving="8">x</p>';
    expect(motionHtml(html, view)).toBe('<div data-k="a" data-sd-moving="1" style="left:1px;z-index:4;z-index:7" data-sd-move-z="m-0"><svg class="iso-rope"></svg><span class="iso-motion" data-sd-mover="1" data-sd-move="m-0" style="transform:translate(1px, 2px) scale(1, 1)"><span class="iso-say" data-sd-say="1" style="left:2px">A</span></span></div>'
      + '<div data-k="b" data-sd-moving="2" style="left:1px;z-index:9"><span class="iso-motion" data-sd-mover="2" style="transform:translate(0px, 0px) scale(1, 1)"></span></div>'
      + '<span class="iso-say" data-sd-say="0" style="left:3px;visibility:hidden" data-sd-show="m-0">S</span><span class="iso-say" data-sd-say="3" style="visibility:hidden">T</span><span class="iso-say" data-sd-say="5">U</span><p data-sd-moving="8">x</p>');
  });
});
