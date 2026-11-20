import {describe, it, expect} from 'vitest';
import {isometric} from 'footprint-story/isometric';
import {transformed} from './transforms.js';
import {isoDrawn} from './iso.js';
import {readPieces} from '../focusHtml.js';

const canvas = [1920, 1080];
const grid = '<i data-iso-grid="120 at 960 150"></i>', floorGrid = isometric({tile: 120, origin: [960, 150]});
const sw = '<div data-k="sw" data-iso="block" data-at="6 6" data-size="4.7 2 0.4" data-ports="p1: 0.4 2 0.3"></div>';
const lap = '<img data-k="lap" src="lap.svg" data-footprint="0 6 2 1.4 0.3" data-ports="rj45: 2 0.7 0.15" style="left:300px;top:420px;width:180px;height:120px">';
const wire = (k, arrow, more = '') => `<i data-k="${k}" class="wire" data-arrow="${arrow}"${more}></i>`;
/** Where a point of the slide lies on the floor, [col, row] (a point of a cable on the floor, not on a riser). */
const onFloor = ([x, y]) => { const {col, row} = floorGrid.tileAt(x, y); return [col, row]; };
const portAt = (at) => { const p = floorGrid.at(...at); return [p.x, p.y]; };
const near = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]) < 0.11;

describe('a piece that stands on the floor by its footprint (data-footprint)', () => {
  it('plugs a cable into a port of a picture, laid along the floor to a block\'s port', () => {
    const made = transformed(`${grid}${sw}${lap}${wire('w1', 'lap.rj45 to sw.p1', ' data-head="none"')}`, {canvas});
    const [cable] = made.cables;
    expect(cable).toMatchObject({from: 'lap', to: 'sw', ports: ['rj45', 'p1']});
    expect(near(cable.points[0], portAt([2, 6.7, 0.15]))).toBe(true);
    expect(near(cable.points.at(-1), portAt([6.4, 8, 0.3]))).toBe(true);
    expect(made.html).toMatch(/<svg[^>]*data-ends="lap sw"[^>]*data-sd-cable/);
    expect(made.made).toMatchObject({placed: 'hand', fitted: false, footprints: 1});
  });

  it('goes round a footprint as it goes round a block — a footprint with no height is floor kept clear', () => {
    const wall = '<div data-k="wall" data-footprint="3 4 1 6" style="left:500px;top:500px;width:10px;height:10px"></div>';
    const plain = transformed(`${grid}${sw}${lap}${wire('w1', 'lap.rj45 to sw.p1')}`, {canvas}).cables[0];
    const walled = transformed(`${grid}${sw}${lap}${wall}${wire('w1', 'lap.rj45 to sw.p1')}`, {canvas}).cables[0];
    expect(walled.length).toBeGreaterThan(plain.length);
    // every corner of the cable on the floor (past the port's riser, before the other's) is outside the wall's floor
    for (const point of walled.points.slice(4, -4)) {
      const [col, row] = onFloor(point);
      expect(col > 3 && col < 4 && row > 4 && row < 10, `${col} ${row}`).toBe(false);
    }
    // and the stretch between two corners never crosses it: sampled along each
    const pts = walled.points.slice(3, -3);
    for (let i = 1; i < pts.length; i++) {
      for (let t = 0; t <= 1; t += 0.05) {
        const [col, row] = onFloor([pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * t, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * t]);
        expect(col > 3.01 && col < 3.99 && row > 4.01 && row < 9.99, `${col} ${row}`).toBe(false);
      }
    }
  });

  it('lays cables on a map of pictures alone, with no block at all', () => {
    const router = '<img data-k="router" src="r.svg" data-footprint="9 2 2 2 0.8" data-ports="home: 0 1 0.4" style="left:1100px;top:200px;width:200px;height:150px">';
    const made = transformed(`${grid}${lap}${router}${wire('w', 'lap.rj45 to router.home')}`, {canvas});
    expect(made.cables).toHaveLength(1);
    expect(made.cables[0].ports).toEqual(['rj45', 'home']);
    expect(made.made.footprints).toBe(2);
  });

  it('paints a footprint\'s piece in the floor\'s order with the blocks, and changes nothing else of it', () => {
    // the picture stands in front of the block (its far corner nearer the viewer), so it is painted over it
    const front = '<img data-k="tv" alt="a &quot;tv&quot;" data-footprint="7 9 1 1 1" style="left:900px;top:600px;width:80px;height:80px" data-x=\'y\'>';
    const {html} = isoDrawn(`${grid}${sw}${front}`, {canvas});
    const level = (k) => Number(new RegExp(`data-k="${k}"[^>]*z-index:(\\d+)`).exec(html)[1]);
    expect(level('tv')).toBeGreaterThan(level('sw'));
    expect(level('tv') % 2).toBe(0);
    expect(html).toContain('<img data-k="tv" alt="a &quot;tv&quot;" data-footprint="7 9 1 1 1" style="z-index:4;left:900px;top:600px;width:80px;height:80px" data-x=\'y\'>');
    // every other byte of the tag as written: a new line before its style, a self-closing slash
    const odd = '<img data-k="tv" data-footprint="7 9 1 1 1"\n\tstyle=\'left:900px;top:600px;width:80px;height:80px\'/>';
    expect(isoDrawn(`${grid}${sw}${odd}`, {canvas}).html).toContain(odd.replace("style='", "style='z-index:4;"));
    // still a piece, by its own box: a click brings it in, the camera frames it
    const piece = readPieces(html).pieces.find((p) => p.keys[0] === 'tv');
    expect(piece.box).toMatchObject({x: 900, y: 600, w: 80, h: 80});
  });

  it('draws the lead into a port on a seen side of the picture over it, one level up', () => {
    const made = transformed(`${grid}${sw}${lap}${wire('w1', 'lap.rj45 to sw.p1')}`, {canvas});
    const lapLevel = Number(/data-k="lap"[^>]*z-index:(\d+)/.exec(made.html)[1]);
    const start = /<svg[^>]*data-sd-lead="start"[^>]*z-index:(\d+)/.exec(made.html);
    expect(Number(start[1])).toBe(lapLevel + 1);
  });

  it('a wire from a picture to a flat piece is no cable: it ends on the picture\'s own box, as before', () => {
    const chip = '<div data-k="note" class="chip" style="left:100px;top:900px;width:200px;height:60px">n</div>';
    const made = transformed(`${grid}${sw}${lap}${chip}${wire('w', 'lap to note')}`, {canvas});
    expect(made.html).not.toContain('data-sd-cable');
    expect(made.cables).toEqual([]);
  });

  it('fits a floor written with no size round the footprints too', () => {
    const floor = '<div data-k="floor" data-iso="floor"></div>', far = '<img data-k="far" data-footprint="-4 -3 1 1" style="left:10px;top:10px;width:10px;height:10px">';
    const {html} = isoDrawn(`${grid}${floor}${sw}${far}`, {canvas});
    // the floor's far corner is a tile past the footprint's: col -5, row -4
    const fitted = isoDrawn(`${grid}<div data-k="floor" data-iso="floor" data-at="-5 -4" data-size="17 13"></div>${sw}${far}`, {canvas}).html;
    const floorOf = (h) => /data-k="floor"[^>]*style="([^"]*)"/.exec(h)[1];
    expect(floorOf(html)).toBe(floorOf(fitted));
  });

  it('refuses, naming the piece and the fix, what it cannot stand on the floor', () => {
    const bad = (html) => () => transformed(html, {canvas});
    const foot = (spec, more = '', style = 'left:1px;top:1px;width:9px;height:9px') => `<div data-k="f" data-footprint="${spec}"${more} style="${style}"></div>`;
    expect(bad(`<i data-iso-grid="fit"></i>${sw}${foot('0 0 1 1')}`)).toThrow('"f" (data-footprint="0 0 1 1"): a footprint\'s piece stands where its own style puts it, so the floor is written in numbers beside it — data-iso-grid="120 at 960 240", not "fit"');
    expect(bad(`<div data-k="a" data-iso="block"></div>${foot('0 0 1 1')}`)).toThrow(/"a" has no data-at, and "f" \(data-footprint="0 0 1 1"\) stands where its own style puts it: the build places a map's blocks only when nothing on the floor is placed by hand — give every block its data-at/);
    expect(bad(`${grid}${foot('0 0 1 1', '', 'left:1px;top:1px;width:9px;height:9px;z-index:9')}`)).toThrow('"f" (data-footprint="0 0 1 1"): it is painted in the floor\'s order (a nearer piece over a further one) — take z-index out of its style');
    expect(bad(`${grid}${foot('0 0 1 1', '', 'width:9px;height:9px')}`)).toThrow('a footprint\'s piece is placed by its own style — give it a left and a top');
    expect(bad(`${grid}<div data-k="f" data-footprint="0 0 1 1"></div>`)).toThrow('a footprint\'s piece is placed by its own style, written once with quotes ("left:300px;top:420px") — give it one');
    expect(bad(`${grid}<div data-k="f" data-iso="block" data-at="0 0" data-footprint="0 0 1 1"></div>`)).toThrow('"f" (data-footprint="0 0 1 1"): an isometric piece stands on the floor by its own data-at and data-size — take data-footprint off it');
    for (const spec of ['0 0 1', '0 0 1 1 1 1', 'a b c d', '']) expect(bad(`${grid}${foot(spec)}`), spec).toThrow(`"f" (data-footprint="${spec}"): it is the floor the piece takes, "col row wide deep" in tiles, with its height after it ("0 6 2 1.4 0.3")`);
    expect(bad(`${grid}${foot('0 0 0 1')}`)).toThrow(/"f" \(data-footprint="0 0 0 1"\): a footprint's size is \[wide, deep, high\] with wide and deep above 0/);
    expect(bad(`${grid}<div data-footprint="0 0 1 1" style="left:1px;top:1px;width:9px;height:9px"></div>`)).toThrow('data-footprint="0 0 1 1": a footprint is a piece\'s, so a wire can end at it — give the piece a data-k name');
    expect(bad(`${grid}<div data-k="f" data-footprint=0 style="left:1px;top:1px;width:9px;height:9px"></div>`)).toThrow('data-footprint: a footprint is written data-footprint="col row wide deep", once, in lower case and with quotes');
    // a port where the footprint has no side, in the kit's words with the piece named
    expect(bad(`${grid}${foot('0 0 1 1 0.5', ' data-ports="p: 3 0 0.2"')}`)).toThrow(/"f" \(data-footprint="0 0 1 1 0.5"\)/);
    for (const style of ['left:1px;top:1px;width:9px', 'left:1px;top:1px;height:9px']) expect(bad(`${grid}${foot('0 0 1 1', '', style)}`), style).toThrow(/a footprint's piece is placed by its own style — give it a (height|width)$/);
    expect(bad(`${grid}${foot('0 0 1 1', '', 'top:1px')}`)).toThrow('give it a left, a width and a height');
    // pieces do not nest: a block or a footprint inside a footprint's element would be placed from its box
    for (const inner of ['<div data-k="x" data-iso="block" data-at="6 6"></div>', '<span data-k="y" data-footprint="4 4 1 1" style="left:1px;top:1px;width:9px;height:9px"></span>']) {
      expect(bad(`${grid}<div data-k="g" data-footprint="0 0 2 2" style="left:1px;top:1px;width:300px;height:300px">${inner}</div>`), inner).toThrow('"g" (data-footprint="0 0 2 2"): pieces do not nest, and this one holds a block or a footprint — place it beside it');
    }
    expect(bad(`${grid}<div data-k="g" data-footprint="0 0 2 2" style="left:1px;top:1px;width:9px;height:9px"><b title="data-iso">words</b></div>`)).not.toThrow();
    // a wire or a callout does not stand on the floor
    expect(bad(`${grid}${sw}<i data-k="w" class="wire" data-arrow="f to sw" data-footprint="9 0 1 1" style="left:1px;top:1px;width:9px;height:9px"></i>`)).toThrow('"w" (data-footprint="9 0 1 1"): a wire does not stand on the floor — put data-footprint on the piece it is about');
    expect(bad(`${grid}${sw}<div data-k="c" data-callout="sw above" data-footprint="9 0 1 1" style="left:1px;top:1px;width:9px;height:9px">c</div>`)).toThrow('a callout does not stand on the floor');
    // a hostile value is said back cut short
    const long = `0 0 1 ${'1'.repeat(5000)}`;
    expect(() => transformed(`${grid}${foot(long)}`, {canvas})).toThrow(/^"f" \(data-footprint="0 0 1 1{73}…"\): /);
    // ports on a piece that is neither a block nor a footprint plug nothing in: refused, not ignored — on any map
    expect(bad('<div data-k="chip" data-ports="p: 0 0 0" style="left:1px;top:1px;width:9px;height:9px">c</div>')).toThrow('"chip": data-ports are on a block');
    expect(bad(`${grid}<div data-k="chip" data-ports="p: 0 0 0" style="left:1px;top:1px;width:9px;height:9px"></div>`)).toThrow('"chip": data-ports are on a block (data-iso="block") or on a piece that stands on the floor (data-footprint="col row wide deep") — give it one, or take its ports out');
  });

  it('leaves a map with no footprint byte for byte as it was', () => {
    const html = `${grid}${sw}<div data-k="b" data-iso="block" data-at="0 0"></div>${wire('w', 'b to sw')}`;
    const {html: out, levels} = isoDrawn(html, {canvas});
    expect(out).not.toContain('data-footprint');
    expect([...levels.keys()].sort()).toEqual(['b', 'sw']);
    const plain = '<div data-k="x" style="left:1px;top:1px">x</div>';
    expect(isoDrawn(plain, {canvas}).html).toBe(plain);
  });
});
