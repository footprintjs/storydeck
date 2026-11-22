// Hand-drawn strokes on a map (0.39.0): footprint-story's `stroke` paint item (human/strokes) drawn by the deck's one
// painter (isoPaint.js) as the ring footprint-story gives (strokeOutline), filled in its ink; the whole stroke, at rest,
// its time not played (the map's record says so); and a still of footprint-story's two hand-drawn style choices
// (human:sketchy, human:hatch) on a block, a cylinder and a floor, pinned byte for byte.
//
// The still is made again, after a change that means to move it, with:  STORYDECK_WRITE_STILLS=1 npx vitest run deck/strokes.test.js
import {describe, it, expect} from 'vitest';
import {readFileSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {isometric, isoStyle, paintPiece} from 'footprint-story/isometric';
import {sketchyLine, hatchTexture, strokeOutline} from 'footprint-story/human';
import {isoArt, strokesDrawn, PAGE_LINE, STROKE_TIMING} from './isoPaint.js';
import {ISO_CSS} from './iso.js';
import {mapsMade} from './run/stages.js';

const ink = (over = {}) => ({colour: null, alpha: 1, width: 4, join: 'round', cap: 'round', ...over});
const stroke = (points, over = {}) => ({item: 'stroke', role: 'ink', of: 'p', points, fill: null, stroke: ink(over)});
/** A path's points as written: [[x, y], …]. */
const written = (svg) => [...svg.match(/ d="([^"]*)"/)[1].matchAll(/[ML](-?[\d.]+) (-?[\d.]+)/g)].map((m) => [+m[1], +m[2]]);

describe('strokes · a hand-drawn line drawn as footprint-story\'s ring round it', () => {
  it('the ring is footprint-story\'s strokeOutline, to 1e-6, written in the box to one decimal', () => {
    // a right angle, its middle twice as wide: each point moved half its width along the normal of the chord through
    // its neighbours — worked by hand, so the geometry the painter fills is pinned, not only passed on
    const points = [[0, 0, 2, 0], [10, 0, 4, 0.5], [10, 10, 2, 1]], r = Math.SQRT1_2 * 2;
    const ring = [[0, -1], [10 + r, -r], [11, 10], [9, 10], [10 - r, r], [0, 1]];
    const outline = strokeOutline(points);
    expect(outline).toHaveLength(ring.length);
    outline.forEach(([x, y], i) => { expect(Math.abs(x - ring[i][0])).toBeLessThan(1e-6); expect(Math.abs(y - ring[i][1])).toBeLessThan(1e-6); });
    expect(isoArt([stroke(points)], {x: 0, y: 0})).toBe(`<path class="iso-ink" stroke="none" style="fill:${PAGE_LINE}" d="M0 -1L11.4 -1.4L11 10L9 10L8.6 1.4L0 1Z"/>`);
    // in a box: every point of the ring, minus the box's corner, within the half-tenth it is written to
    const box = {x: 3.25, y: -7.5}, got = written(isoArt([stroke(points)], box));
    got.forEach(([x, y], i) => { expect(Math.abs(x - (outline[i][0] - box.x))).toBeLessThanOrEqual(0.05 + 1e-6); expect(Math.abs(y - (outline[i][1] - box.y))).toBeLessThanOrEqual(0.05 + 1e-6); });
  });

  it('draws the whole stroke, whatever its times: two points of the ring for each of its points', () => {
    const points = Array.from({length: 40}, (_, i) => [i * 3, Math.sin(i / 4) * 10, 1 + (i % 5) / 2, i * 0.01]);
    expect(written(isoArt([stroke(points)], {x: 0, y: 0}))).toHaveLength(80);
    // the same line at other times is the same picture: a page is drawn at rest
    const later = points.map(([x, y, w, t]) => [x, y, w, t * 7 + 3]);
    expect(isoArt([stroke(later)], {x: 0, y: 0})).toBe(isoArt([stroke(points)], {x: 0, y: 0}));
  });

  it('is filled in its ink: its own colour and alpha, else the page\'s line colour — the one .iso-art outlines a face with', () => {
    const line = [[0, 0, 1, 0], [10, 0, 1, 1]];
    expect(ISO_CSS).toContain(`stroke: ${PAGE_LINE}; stroke-width: var(--iso-line-width, 2.5px);`);
    expect(isoArt([stroke(line, {colour: '#112233'})], {x: 0, y: 0})).toContain(' stroke="none" style="fill:#112233" d=');
    expect(isoArt([stroke(line, {colour: '#112233', alpha: 0.4})], {x: 0, y: 0})).toContain(' style="fill:#112233;fill-opacity:0.4" d=');
    expect(isoArt([stroke(line, {alpha: 0.4})], {x: 0, y: 0})).toContain(` style="fill:${PAGE_LINE};fill-opacity:0.4" d=`);
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
    expect(strokesDrawn([[{item: 'polygon'}, {item: 'stroke'}], [{item: 'stroke'}]])).toEqual({strokes: 2, timing: STROKE_TIMING});
  });

  it('the run\'s "maps made" keeps it beside the style', async () => {
    const scope = {}, made = {placed: 'hand', tile: 120, strokes: {strokes: 3, timing: STROKE_TIMING}};
    await mapsMade(scope, {loaded: {compiled: {maps: {m: {made}}}}, options: {}, mapRecord: () => null});
    expect(scope.maps).toEqual({m: {placed: 'hand', tile: 120, cables: 0, strokes: {strokes: 3, timing: STROKE_TIMING}}});
  });
});

/** footprint-story's two hand-drawn choices on a floor, a block and a cylinder, painted as a styled map's pieces are. */
function sketchyMap() {
  const grid = isometric({tile: 120, origin: [960, 240]}), colours = {ink: '#1f2430'};
  const style = isoStyle({line: 'human:sketchy', texture: 'human:hatch'}, {choices: [sketchyLine, hatchTexture]});
  const pieces = [{name: 'floor', kind: 'floor', at: [0, 0], size: [6, 4]}, {name: 'server', kind: 'block', at: [1, 1], size: [2, 2, 1]}, {name: 'db', kind: 'cylinder', at: [4, 1], size: [1.5, 1.5, 1.2]}];
  return pieces.map((piece) => ({piece, ...paintPiece(style, piece, grid, colours)}));
}
const one = (v) => +v.toFixed(1);

describe('strokes · a still of human:sketchy + human:hatch', () => {
  it('every stroke is drawn, the faces keep their fills and lose their ink line, and the page is the still byte for byte', () => {
    const painted = sketchyMap(), all = painted.flatMap((p) => p.items).filter((it) => it.item === 'stroke');
    expect(all.length).toBeGreaterThan(20);
    expect(new Set(all.map((it) => it.role))).toEqual(new Set(['ink', 'hatch']));
    const drawn = painted.map(({items, box}) => ({box, art: isoArt(items, box, {styled: true})}));
    // one path a stroke, its ring footprint-story's, and each face with no outline of its own
    for (const [k, {items, box}] of painted.entries()) {
      const paths = drawn[k].art.match(/<path class="iso-(?:ink|hatch)" stroke="none"[^>]*>/g) ?? [];
      const strokes = items.filter((it) => it.item === 'stroke');
      expect(paths).toHaveLength(strokes.length);
      strokes.forEach((it, i) => {
        const ring = strokeOutline(it.points), got = written(paths[i]);
        expect(got).toHaveLength(ring.length);
        got.forEach(([x, y], j) => { expect(Math.abs(x - (ring[j][0] - box.x))).toBeLessThanOrEqual(0.05 + 1e-6); expect(Math.abs(y - (ring[j][1] - box.y))).toBeLessThanOrEqual(0.05 + 1e-6); });
      });
      for (const face of drawn[k].art.match(/<(?:polygon|ellipse|path) class="iso-(?:top|left|right|side)"[^>]*>/g) ?? []) expect(face).toContain(' stroke="none"');
    }
    expect(drawn[0].art).toContain('<path class="iso-lines"');   // a floor keeps its tile lines
    expect(strokesDrawn(painted.map((p) => p.items))).toEqual({strokes: all.length, timing: STROKE_TIMING});
    // the still: the page's own CSS, each piece placed by its box, no words (so no font of the host's)
    const pieces = painted.map(({piece}, k) => {
      const {box, art} = drawn[k];
      return `<div data-sd-iso="${piece.kind}" style="left:${one(box.x)}px;top:${one(box.y)}px;width:${one(box.w)}px;height:${one(box.h)}px"><svg class="iso-art" viewBox="0 0 ${one(box.w)} ${one(box.h)}" aria-hidden="true">${art}</svg></div>`;
    });
    const still = `<!doctype html>\n<meta charset="utf-8">\n<title>human:sketchy + human:hatch — StoryDeck's painter</title>\n<style>${ISO_CSS}</style>\n<section data-label="still" style="position:relative;width:1920px;height:720px;background:#fff">\n${pieces.join('\n')}\n</section>\n`;
    const file = path.join(process.cwd(), 'deck/test/sketchy-still.html');
    if (process.env.STORYDECK_WRITE_STILLS === '1') writeFileSync(file, still);
    expect(still).toBe(readFileSync(file, 'utf8'));
  });
});
