// Hand-drawn strokes on a map (0.39.0): footprint-story's `stroke` paint item (human/strokes) drawn by the deck's one
// painter (isoPaint.js) as the capped ring footprint-story gives (strokeOutline(points, {cap})), filled in its ink by the
// non-zero rule; the whole stroke, at rest, its time not played (the map's record says so); a map that names
// footprint-story's hand-drawn style (`human:sketchy`, `human:hatch`) built, drawn and recorded through the page; and a
// still of that page, pinned byte for byte.
//
// The still is made again, after a change that means to move it, with:  STORYDECK_WRITE_STILLS=1 npx vitest run deck/strokes.test.js
import {describe, it, expect} from 'vitest';
import {readFileSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {strokeOutline, CAP_STEPS} from 'footprint-story/human';
import {isoArt, strokesDrawn, strokesSvg, inlineStrokes, PAGE_LINE, STROKE_TIMING} from './isoPaint.js';
import {isoDrawn, ISO_CSS} from './iso.js';
import {compileDeck} from './compile.js';
import {sourceOf} from './test/helpers.js';
import {mapsMade} from './run/stages.js';
import {flowMaps} from './run/maps.js';
import {engine} from './run/engine.js';

const ink = (over = {}) => ({colour: null, alpha: 1, width: 4, join: 'round', cap: 'round', ...over});
const stroke = (points, over = {}) => ({item: 'stroke', role: 'ink', of: 'p', points, fill: null, stroke: ink(over)});
/** A path's points as written: [[x, y], …]. */
const written = (svg) => [...svg.match(/ d="([^"]*)"/)[1].matchAll(/[ML](-?[\d.]+) (-?[\d.]+)/g)].map((m) => [+m[1], +m[2]]);

describe('strokes · a hand-drawn line drawn as footprint-story\'s ring round it', () => {
  it('the ring is footprint-story\'s strokeOutline with the item\'s own cap, to 1e-6, written in the box to one decimal', () => {
    // a right angle, its middle twice as wide: each point moved half its width along the normal of the chord through
    // its neighbours — worked by hand, so the geometry the painter fills is pinned, not only passed on
    const points = [[0, 0, 2, 0], [10, 0, 4, 0.5], [10, 10, 2, 1]], r = Math.SQRT1_2 * 2, near = 1e-6;
    const close = (got, want) => { expect(got).toHaveLength(want.length); got.forEach(([x, y], i) => { expect(Math.abs(x - want[i][0])).toBeLessThan(near); expect(Math.abs(y - want[i][1])).toBeLessThan(near); }); };
    const sides = [[0, -1], [10 + r, -r], [11, 10], [9, 10], [10 - r, r], [0, 1]];
    // butt: the sides alone, flat across each end
    close(strokeOutline(points, {cap: 'butt'}), sides);
    expect(isoArt([stroke(points, {cap: 'butt'})], {x: 0, y: 0})).toBe(`<path class="iso-ink" stroke="none" style="fill:${PAGE_LINE};fill-rule:nonzero" d="M0 -1L11.4 -1.4L11 10L9 10L8.6 1.4L0 1Z"/>`);
    // square: half the end's width out past each end, square — the far end runs down (0, 1), the near end back (-1, 0)
    close(strokeOutline(points, {cap: 'square'}), [...sides.slice(0, 3), [11, 11], [9, 11], ...sides.slice(3), [-1, 1], [-1, -1]]);
    // round: a half circle round each end point, CAP_STEPS segments, every point on the circle of the end's half width
    // and out past the end the way the stroke runs, at equal turns from one side to the other
    const round = strokeOutline(points, {cap: 'round'}), m = CAP_STEPS - 1;
    expect(round).toHaveLength(sides.length + 2 * m);
    close([...round.slice(0, 3), ...round.slice(3 + m, 6 + m)], sides);
    const capAt = (cap, [px, py], [hx, hy], from) => cap.forEach(([x, y], k) => {
      expect(Math.abs(Math.hypot(x - px, y - py) - 1)).toBeLessThan(near);
      expect((x - px) * hx + (y - py) * hy).toBeGreaterThan(0);
      expect(Math.abs(Math.acos(Math.max(-1, Math.min(1, (x - px) * from[0] + (y - py) * from[1]))) - (Math.PI * (k + 1)) / CAP_STEPS)).toBeLessThan(near);
    });
    capAt(round.slice(3, 3 + m), [10, 10], [0, 1], [1, 0]);
    capAt(round.slice(6 + m), [0, 0], [-1, 0], [0, 1]);
    expect(stroke(points).stroke.cap).toBe('round');
    expect(written(isoArt([stroke(points)], {x: 0, y: 0}))).toHaveLength(round.length);
    // in a box: every point of the ring, minus the box's corner, within the half-tenth it is written to
    const box = {x: 3.25, y: -7.5}, got = written(isoArt([stroke(points)], box));
    got.forEach(([x, y], i) => { expect(Math.abs(x - (round[i][0] - box.x))).toBeLessThanOrEqual(0.05 + near); expect(Math.abs(y - (round[i][1] - box.y))).toBeLessThanOrEqual(0.05 + near); });
  });

  it('draws the whole stroke, whatever its times: two points of the ring for each of its points, and its two caps', () => {
    const points = Array.from({length: 40}, (_, i) => [i * 3, Math.sin(i / 4) * 10, 1 + (i % 5) / 2, i * 0.01]);
    expect(written(isoArt([stroke(points)], {x: 0, y: 0}))).toHaveLength(80 + 2 * (CAP_STEPS - 1));
    expect(written(isoArt([stroke(points, {cap: 'butt'})], {x: 0, y: 0}))).toHaveLength(80);
    // the same line at other times is the same picture: a page is drawn at rest
    const later = points.map(([x, y, w, t]) => [x, y, w, t * 7 + 3]);
    expect(isoArt([stroke(later)], {x: 0, y: 0})).toBe(isoArt([stroke(points)], {x: 0, y: 0}));
  });

  it('is filled in its ink: its own colour and alpha, else the page\'s line colour — the one .iso-art outlines a face with', () => {
    const line = [[0, 0, 1, 0], [10, 0, 1, 1]];
    expect(ISO_CSS).toContain(`stroke: ${PAGE_LINE}; stroke-width: var(--iso-line-width, 2.5px);`);
    expect(isoArt([stroke(line, {colour: '#112233'})], {x: 0, y: 0})).toContain(' stroke="none" style="fill:#112233;fill-rule:nonzero" d=');
    expect(isoArt([stroke(line, {colour: '#112233', alpha: 0.4})], {x: 0, y: 0})).toContain(' style="fill:#112233;fill-opacity:0.4;fill-rule:nonzero" d=');
    expect(isoArt([stroke(line, {alpha: 0.4})], {x: 0, y: 0})).toContain(` style="fill:${PAGE_LINE};fill-opacity:0.4;fill-rule:nonzero" d=`);
    expect(isoArt([{...stroke(line), role: 'hatch'}], {x: 0, y: 0})).toMatch(/^<path class="iso-hatch" /);
  });

  it('refuses a stroke it cannot draw honestly, before the ring is asked for', () => {
    const line = [[0, 0, 1, 0], [10, 0, 1, 1]], draw = (item) => () => isoArt([item], {x: 0, y: 0});
    expect(draw({...stroke(line), stroke: null})).toThrow('a hand-drawn stroke\'s fill is null and its stroke names its colour, alpha and cap');
    expect(draw({...stroke(line), fill: {mix: null, colour: '#000000'}})).toThrow(/fill is null/);
    expect(draw(stroke([[0, 0, 1, 0]]))).toThrow('a hand-drawn stroke has at least 2 points — not 1');
    expect(draw(stroke(undefined))).toThrow('a hand-drawn stroke has at least 2 points — not undefined');
    expect(draw(stroke([[0, 0, 1, 0], [1, 1]]))).toThrow('a hand-drawn stroke\'s point is [x, y, width, t] — not [1,1]');
    for (const bad of [NaN, Infinity, '1', null]) expect(draw(stroke([[0, 0, 1, 0], [1, bad, 1, 1]]))).toThrow(/numbers are finite/);
    expect(draw(stroke([[0, 0, 1, 0], [1, 1, 1, NaN]]))).toThrow(/numbers are finite/);
    expect(draw(stroke([[0, 0, 1, 0], [1, 1, 5, 1]]))).toThrow('a hand-drawn stroke\'s point is as wide as 0 to its stroke\'s 4 px — not 5');
    expect(draw(stroke([[0, 0, -1, 0], [1, 1, 1, 1]]))).toThrow(/as wide as 0 to its stroke's 4 px — not -1/);
    expect(draw(stroke(line, {colour: 'red'}))).toThrow(/colour is "#rrggbb"/);
    expect(draw(stroke(line, {cap: 'flat'}))).toThrow(/cap is butt, round, square/);
    expect(draw({...stroke(line), role: 'Ink'})).toThrow(/role is a short lower-case name/);
  });
});

describe('strokes · the map\'s record says their time is not played', () => {
  it('counts the strokes a map draws and says a page draws them whole; a map with none says nothing', () => {
    expect(STROKE_TIMING).toBe('drawn whole, at rest: a page does not play a stroke\'s timing (StoryReel plays it)');
    expect(strokesDrawn([[{item: 'polygon'}], []])).toBeNull();
    expect(strokesDrawn([[{item: 'polygon'}, {item: 'stroke'}], [{item: 'stroke'}]])).toEqual({strokes: 2, bytes: 0, timing: STROKE_TIMING});
    expect(strokesDrawn([[{item: 'stroke'}]], new Map([['a', '<g id="a">12</g>'], ['b', 'xy']]))).toEqual({strokes: 1, bytes: 18, timing: STROKE_TIMING});
  });

  it('the run\'s "maps made" keeps it beside the style', async () => {
    const scope = {}, made = {placed: 'hand', tile: 120, strokes: {strokes: 3, bytes: 900, timing: STROKE_TIMING}};
    await mapsMade(scope, {loaded: {compiled: {maps: {m: {made}}}}, options: {}, mapRecord: () => null});
    expect(scope.maps).toEqual({m: {placed: 'hand', tile: 120, cables: 0, strokes: {strokes: 3, bytes: 900, timing: STROKE_TIMING}}});
  });
});

const canvas = [1920, 1080];
/** A map drawn by hand, as its writer writes it: footprint-story's sketched line and hatch on a floor, a block and a cylinder. No names: the still holds no words, so no font of the host's. */
const SKETCHY = `<i data-iso-grid="120 at 960 240"></i><i data-style="line: human:sketchy; texture: human:hatch"></i>
<div data-k="floor" data-iso="floor" data-size="8 5"></div>
<div data-k="server" data-iso="block" data-at="1 1" data-size="2 2 1.4"></div>
<div data-k="db" data-iso="cylinder" data-at="5 1" data-size="1.6 1.6 1.2"></div>`;
const paths = (html) => html.match(/<path class="iso-(?:ink|hatch)" stroke="none"[^>]*>/g) ?? [];

describe('strokes · a map drawn by hand (data-style="line: human:sketchy; texture: human:hatch")', () => {
  it('is built by the steps with the deck\'s hand-drawn choices, and every stroke they made is drawn as its ring', () => {
    const {html: page, built, made, strokeDefs} = isoDrawn(SKETCHY, {canvas});
    // the strokes are drawn once for the page and used in place (strokes-once.test.js): written back, they are the strokes
    expect(paths(page)).toHaveLength(0);
    const html = inlineStrokes(page, strokeDefs);
    expect(built.spec.style).toEqual({line: 'human:sketchy', texture: 'human:hatch'});
    expect(built.map.style.row).toMatchObject({line: 'human:sketchy', texture: 'human:hatch'});
    const lists = [...built.map.paints, ...built.map.floorPaints], all = lists.flat().filter((it) => it.item === 'stroke');
    expect(all.length).toBeGreaterThan(20);
    expect(new Set(all.map((it) => it.role))).toEqual(new Set(['ink', 'hatch']));
    expect(made.strokes).toEqual({strokes: all.length, bytes: Object.values(strokeDefs).join('').length, timing: STROKE_TIMING});
    // one path a stroke, in paint order, each footprint-story's capped ring in its piece's box
    const drawn = paths(html), boxes = [...built.map.shapes, ...built.map.floorShapes].map((s) => s.box);
    expect(drawn).toHaveLength(all.length);
    let k = 0;
    lists.forEach((items, i) => items.filter((it) => it.item === 'stroke').forEach((it) => {
      const ring = strokeOutline(it.points, {cap: it.stroke.cap}), got = written(drawn[k++]), box = boxes[i];
      expect(got).toHaveLength(ring.length);
      got.forEach(([x, y], j) => { expect(Math.abs(x - (ring[j][0] - box.x))).toBeLessThanOrEqual(0.05 + 1e-6); expect(Math.abs(y - (ring[j][1] - box.y))).toBeLessThanOrEqual(0.05 + 1e-6); });
    }));
    // the faces keep their fills and lose their ink line; the floor keeps its tile lines
    for (const face of html.match(/<(?:polygon|ellipse|path) class="iso-(?:top|left|right|side)"[^>]*>/g)) expect(face).toContain(' stroke="none"');
    expect(html).toContain('<path class="iso-lines"');
  });

  it('a deck that writes it compiles, its record says the strokes are drawn whole, and the run\'s map flow builds the same map', async () => {
    const deck = compileDeck(sourceOf({clicks: '<section data-label="S" data-map="m"><step data-in="*"><h2>A</h2></step></section>', maps: {m: SKETCHY}}));
    const {made, built} = deck.maps.m;
    expect(made.strokes.timing).toBe(STROKE_TIMING);
    // every click draws them by a <use>; the page holds them once
    for (const slide of deck.slides) expect(paths(inlineStrokes(slide.html, deck.strokeDefs))).toHaveLength(made.strokes.strokes);
    // the run's own map flow, handed the deck's choices: the very map the page draws, its record kept
    const eng = await engine();
    const {runs} = await flowMaps({$call: (target, fn) => fn()}, {engine: eng, options: {}, mapRecord: () => null}, [{name: 'm', built}]);
    expect(runs).toHaveLength(1);
    expect(runs[0]).not.toHaveProperty('differs');
    const scope = {};
    await mapsMade(scope, {loaded: {compiled: {maps: {m: {made}}}}, options: {}, mapRecord: () => null});
    expect(scope.maps.m.strokes).toEqual(made.strokes);
  });

  it('a page with no hand-drawn style draws no stroke and records none', () => {
    const plain = isoDrawn(SKETCHY.replace(/<i data-style="[^"]*"><\/i>/, ''), {canvas});
    expect(paths(plain.html)).toHaveLength(0);
    expect(plain.made).not.toHaveProperty('strokes');
  });

  it('the page, as a still: the page\'s own CSS and the map as the page writes it, byte for byte', () => {
    const {html, strokeDefs} = isoDrawn(SKETCHY, {canvas});
    const still = `<!doctype html>\n<meta charset="utf-8">\n<title>human:sketchy + human:hatch — a StoryDeck map drawn by hand</title>\n<style>${ISO_CSS}</style>\n${strokesSvg(strokeDefs)}\n<section data-label="still" style="position:relative;width:1920px;height:1080px;background:#fff">\n${html}\n</section>\n`;
    const file = path.join(process.cwd(), 'deck/test/sketchy-still.html');
    if (process.env.STORYDECK_WRITE_STILLS === '1') writeFileSync(file, still);
    expect(still).toBe(readFileSync(file, 'utf8'));
  });
});
