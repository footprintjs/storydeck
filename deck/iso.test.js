import {describe, it, expect} from 'vitest';
import {isometric} from 'footprint-story/isometric';
import {isoPieces, isoIn, ISO_CSS, MOST_ISO_PIECES} from './iso.js';
import {applyTransforms} from './transforms.js';
import {compileDeck} from './compile.js';
import {deckStyles} from './page.js';
import {reviewClick} from './review.js';
import {nudgePiece} from './edit.js';
import {readPieces} from '../focusHtml.js';
import {sourceOf} from './test/helpers.js';

const canvas = [1920, 1080];
const MAP = `<div data-k="floor" data-iso="floor" data-size="8 5"></div>
<div data-k="you" data-iso="block" data-at="0 3" data-size="2 2 0.3"><b>You</b></div>
<i data-k="w1" class="wire pkt" data-arrow="you to server"></i>
<div data-k="server" data-iso="block" data-at="3 1" data-size="2 2 1.4" class="ok" style="--iso-color:#cfe1f7"><b>Server</b><small>an API</small></div>
<div data-k="db" data-iso="cylinder" data-at="6 0" data-size="1.6 1.6 1.2"><b>Database</b></div>`;
const tagOf = (html, name) => new RegExp(`<[^>]*data-k="${name}"[^>]*>`).exec(html)[0];
const boxIn = (html, name) => readPieces(html).pieces.find((p) => p.keys[0] === name).box;

describe('iso · blocks on a floor seen from a corner', () => {
  const drawn = isoPieces(MAP, {canvas}), grid = isometric({tile: 120, origin: [960, 240]});

  it('places and sizes each piece from the floor: the box the grid gives, so focus, wires and callouts see a piece like any other', () => {
    const round = (b) => Object.fromEntries(Object.entries(b).map(([k, v]) => [k, +v.toFixed(1)]));
    expect(boxIn(drawn, 'server')).toEqual(round(grid.block({at: [3, 1], size: [2, 2, 1.4]}).box));
    expect(boxIn(drawn, 'you')).toEqual(round(grid.block({at: [0, 3], size: [2, 2, 0.3]}).box));
    expect(boxIn(drawn, 'db')).toEqual(round(grid.cylinder({at: [6, 0], size: [1.6, 1.6, 1.2]}).box));
    expect(boxIn(drawn, 'floor')).toEqual(round(grid.floor({cols: 8, rows: 5}).box));
  });

  it('draws a block as three faces, a cylinder as its side and its top, a floor as its tile lines, and keeps what the element had', () => {
    const server = drawn.slice(drawn.indexOf(tagOf(drawn, 'server')), drawn.indexOf('<div data-k="db"'));
    expect(tagOf(drawn, 'server')).toMatch(/^<div data-k="server" data-at="3 1" data-size="2 2 1.4" class="iso ok" data-sd-iso="block" style="left:960px;top:257\.1px;width:240px;height:222\.9px;z-index:\d;--iso-color:#cfe1f7">$/);
    expect(server).toContain('<svg class="iso-art" viewBox="0 0 240 222.9" aria-hidden="true"><polygon class="iso-left" points="0,60 120,120 120,222.9 0,162.9"/><polygon class="iso-right" points="120,120 240,60 240,162.9 120,222.9"/><polygon class="iso-top" points="120,0 240,60 120,120 0,60"/></svg>');
    expect(server).toContain('<span class="iso-say" style="left:120px;top:60px"><b>Server</b><small>an API</small></span></div>');   // its words, on its top face
    expect(drawn).toMatch(/data-sd-iso="cylinder"[^>]*><svg class="iso-art"[^>]*><path class="iso-side" d="M0 33\.9L0 122\.1A67\.9 33\.9 0 0 0 135\.8 122\.1L135\.8 33\.9Z"\/><ellipse class="iso-top" cx="67\.9" cy="33\.9" rx="67\.9" ry="33\.9"\/><\/svg>/);
    expect(drawn).toMatch(/data-sd-iso="floor"[^>]*><svg class="iso-art" viewBox="0 0 780 390"[^>]*><polygon class="iso-ground" points="300,0 780,240 480,390 0,150"\/><path class="iso-lines" d="M300 0L0 150M/);
    expect((drawn.match(/M[\d.]+ [\d.]+L/g) ?? []).length).toBe(9 + 6 + 1);   // 8 + 1 and 5 + 1 tile lines, and the cylinder's side
    expect(tagOf(drawn, 'floor')).not.toContain('z-index');
    expect(tagOf(drawn, 'floor')).toContain(' data-ground ');   // a floor is ground: no camera frames it
    expect(tagOf(drawn, 'server')).not.toContain('data-ground');
  });

  it('paints the nearer over the further by a level each, whatever order they are written in, and never moves the map\'s own order', () => {
    const level = (html, name) => Number(/z-index:(\d+)/.exec(tagOf(html, name))[1]);
    // a tall block in front of a low one, written first
    const map = `<div data-k="front" data-iso="block" data-at="2 2" data-size="1 1 3"></div><div data-k="back" data-iso="block" data-at="0 0" data-size="2 2 1"></div><div data-k="on" data-iso="block" data-at="0 0 1" data-size="1 1 1"></div>`;
    const out = isoPieces(map, {canvas});
    expect(level(out, 'back')).toBeLessThan(level(out, 'front'));
    expect(level(out, 'back')).toBeLessThan(level(out, 'on'));
    expect(readPieces(out).pieces.map((p) => p.keys[0])).toEqual(['front', 'back', 'on']);   // the order written: a click's numbering uses it
    expect([level(out, 'front'), level(out, 'back'), level(out, 'on')].every((n) => n >= 1)).toBe(true);
  });

  it('a floor of its own: data-iso-grid sets the tile and the far corner, and its element is taken out', () => {
    const own = isoPieces(`<i data-iso-grid="96 at 330 70"></i><div data-k="a" data-iso="block" data-at="1 0" data-size="1 1 1"></div>`, {canvas});
    expect(own).not.toContain('data-iso-grid');
    expect(boxIn(own, 'a')).toMatchObject({x: 330, w: 96});
    const steep = isoPieces(`<i data-iso-grid="100 80 at 0 0 rise 50"></i><div data-k="a" data-iso="block" data-size="1 1 1"></div>`, {canvas});
    expect(boxIn(steep, 'a')).toEqual({x: -50, y: -50, w: 100, h: 130});   // 80 for the tile, 50 for its height
    // the default: a tile 120 wide, its far corner at the slide's middle, 240 down — a slide of another size has another middle
    expect(boxIn(isoPieces('<div data-k="a" data-iso="block" data-size="1 1 0"></div>', {canvas: [1000, 600]}), 'a')).toMatchObject({x: 440, y: 240});
  });

  it('leaves HTML without an isometric piece as it was, byte for byte', () => {
    const plain = '<div data-k="a" class="box" style="left:1px;top:2px;width:3px;height:4px">A</div><i data-k="w" class="wire" data-arrow="1 2 3 4"></i>';
    expect(isoPieces(plain, {canvas})).toBe(plain);
    expect(isoIn(plain)).toEqual([]);
    expect(isoIn(MAP)).toEqual([{name: 'floor', kind: 'floor'}, {name: 'you', kind: 'block'}, {name: 'server', kind: 'block'}, {name: 'db', kind: 'cylinder'}]);
  });

  it('refuses what it cannot draw, naming the piece and the fix', () => {
    const bad = (html) => () => isoPieces(html, {canvas});
    expect(bad('<div data-k="a" data-iso="cube" data-size="1 1 1"></div>')).toThrow(/data-iso="cube": an isometric piece is a block, a cylinder or a floor/);
    expect(bad('<div data-iso="block" data-size="1 1 1"></div>')).toThrow(/an isometric piece is a piece, so a click can bring it in — give it a data-k name/);
    expect(bad('<div data-k="a" data-iso="block"></div>')).toThrow(/"a" \(data-iso="block"\): give it a data-size — "wide deep high" in tiles \("2 2 1\.4"\)/);
    expect(bad('<div data-k="f" data-iso="floor"></div>')).toThrow(/give it a data-size — "cols rows" \("8 5"\)/);
    expect(bad('<div data-k="a" data-iso="block" data-size="2 two 1"></div>')).toThrow(/data-size="2 two 1" — its size is "wide deep high", in tiles/);
    expect(bad('<div data-k="a" data-iso="block" data-size="2 2"></div>')).toThrow(/"a" \(data-iso="block"\): a block's size is \[wide, deep, high\], in tiles/);
    expect(bad('<div data-k="a" data-iso="block" data-at="1" data-size="1 1 1"></div>')).toThrow(/"a" \(data-iso="block"\): a block's at is \[col, row\] on the floor/);
    expect(bad('<div data-k="a" data-iso="block" data-at="1 x" data-size="1 1 1"></div>')).toThrow(/data-at="1 x" — where it stands is "col row" on the floor/);
    expect(bad('<div data-k="a" data-iso="cylinder" data-size="2 1 1"></div>')).toThrow(/"a" \(data-iso="cylinder"\): a cylinder is round: give it the same width and depth/);
    expect(bad('<div data-k="f" data-iso="floor" data-size="2.5 2"></div>')).toThrow(/"f" \(data-iso="floor"\): a floor is cols × rows tiles, whole numbers/);
    expect(bad('<div data-k="f" data-iso="floor" data-size="2 2 2"></div>')).toThrow(/a floor's size is "cols rows" — not "2 2 2"/);
    expect(bad('<div data-k="f" data-iso="floor" data-size="2 2">Ground</div>')).toThrow(/a floor holds no words — put them in a piece that stands on it/);
    expect(bad('<div data-k="a" data-iso="block" data-size="1 1 1" style="left:10px"></div>')).toThrow(/"a" \(data-iso="block"\): its left comes from the floor — place it with data-at="col row" and size it with data-size, and take left out of its style/);
    expect(bad('<div data-k="a" data-iso="block" data-size="1 1 1" style="color:red; Height: 4px"></div>')).toThrow(/its height comes from the floor/);
    expect(bad('<div data-k="a" data-iso="block" data-size="1 1 1"><b data-k="b">x</b></div>')).toThrow(/pieces do not nest, and this one holds a piece/);
    expect(bad('<div data-k="a" data-iso="block" data-size="1 1 1">')).toThrow(/its <div> is never closed/);
    expect(bad('<div data-k="a" data-iso=block data-size="1 1 1"></div>')).toThrow(/an isometric piece is written data-iso="block" \(or cylinder, floor\), in lower case and with quotes/);
    expect(bad('<i data-iso-grid="120 at 1 2"></i><i data-iso-grid="96 at 1 2"></i><div data-k="a" data-iso="block" data-size="1 1 1"></div>')).toThrow(/a map has one floor, and this one sets 2 — keep one/);
    expect(bad('<i data-iso-grid="wide"></i><div data-k="a" data-iso="block" data-size="1 1 1"></div>')).toThrow(/data-iso-grid="wide": the floor is a tile's width in px/);
    expect(bad('<i data-iso-grid="60 60 at 0 0"></i><div data-k="a" data-iso="block" data-size="1 1 1"></div>')).toThrow(/data-iso-grid="60 60 at 0 0": a tile is wider than it is tall/);
    expect(bad('<div data-iso-grid="120 at 1 2"></div><div data-k="a" data-iso="block" data-size="1 1 1"></div>')).toThrow(/the floor is set on an empty <i>/);
    expect(bad(Array.from({length: MOST_ISO_PIECES + 1}, (_, i) => `<div data-k="p${i}" data-iso="block" data-at="${i} 0" data-size="1 1 1"></div>`).join(''))).toThrow(/a map holds at most 256 isometric pieces, and this one has 257/);
  });
});

describe('iso · in a deck', () => {
  const clicks = `
<section data-label="A request" data-kicker="1" data-map="map">
  <step data-in="floor you" data-focus="fit"><h2>You press Enter</h2></step>
  <step data-in="w1 server" data-focus="fit path" data-focus-route="camera w1:1.2 server"><h2>The request leaves</h2></step>
  <step data-in="db why" data-on="db" data-focus="zoom"><h2>And the data</h2></step>
</section>`;
  const map = `${MAP}\n<div data-k="why" data-callout="db above">It lives here</div>`;
  const compiled = compileDeck(sourceOf({clicks, maps: {map}}));
  const assets = {css: ['/* focus */', '/* narration */', '/* deck */'], looks: {}};

  it('a wire runs between two isometric pieces and a callout stands beside one: both find its box', () => {
    const drawn = applyTransforms(map, {canvas});
    expect(tagOf(drawn, 'w1')).toMatch(/data-ends="you server"/);
    expect(tagOf(drawn, 'why')).toMatch(/data-ends="db" data-sd-callout="above"/);
  });

  it('every click works on isometric pieces: fit frames them, a route orders them, zoom closes in on one', () => {
    expect(compiled.clicks.map((c) => c.look.strategies)).toEqual([['fit'], ['fit', 'path'], ['zoom']]);
    expect(compiled.clicks[0].look.stage.move.s).toBeGreaterThan(1);
    // the floor is ground: with the whole floor shown from the first click, the view still frames only what stands on it,
    // so it is close on one piece and moves when the next comes in
    expect(compiled.maps.map.pieces.find((p) => p.keys[0] === 'floor').ground).toBe(true);
    expect(compiled.clicks[1].look.stage.move).not.toEqual(compiled.clicks[0].look.stage.move);
    expect(compiled.clicks[1].look.stage.turn).toEqual({at: 0, takes: 1});
    expect(reviewClick(compiled, 2)).toContain('route: the view (1 s) → w1 (1.2 s) → server');
    expect(compiled.slides[1].html).toContain('data-sd-iso="block"');
  });

  it('the page carries the isometric stylesheet only when the deck has such a piece: without one it is byte for byte as before', () => {
    expect(compiled.iso).toBe(true);
    expect(deckStyles(compiled, assets)).toContain(ISO_CSS);
    const plain = compileDeck(sourceOf({clicks: '<section data-label="P" data-map="map"><step data-in="a"><h2>A</h2></step></section>'}));
    expect('iso' in plain).toBe(false);
    expect(deckStyles(plain, assets)).not.toContain('iso-art');
    // a plain slide (no map) with a block on it asks for it too
    const slide = compileDeck(sourceOf({clicks: '<section data-label="S"><h1>S</h1><div data-k="a" data-iso="block" data-size="1 1 1"></div></section>'}));
    expect(slide.iso).toBe(true);
  });

  it('a callout stands over every block, and beside a piece that stands off the slide', () => {
    expect(ISO_CSS).toContain(':where(section[data-label] [data-sd-callout]) { z-index: 257; }');
    // a floor far to the right of a 1920 slide: the bubble stays above its piece, not held at the slide's edge
    const far = applyTransforms('<i data-iso-grid="120 at 3000 240"></i><div data-k="db" data-iso="cylinder" data-at="4 0" data-size="2 2 1"></div><div data-k="why" data-callout="db above">It lives here</div>', {canvas});
    const db = boxIn(far, 'db'), why = boxIn(far, 'why');
    expect(why.x + why.w / 2).toBeCloseTo(db.x + db.w / 2, 0);
    expect(why.y + why.h).toBeLessThan(db.y);
  });

  it('every rule of its stylesheet has no weight and stays inside a slide, so a deck\'s own rule wins', () => {
    const rules = ISO_CSS.replace(/\/\*[\s\S]*?\*\//g, '').split('}').map((r) => r.trim()).filter(Boolean);
    expect(rules.length).toBeGreaterThan(8);
    for (const rule of rules) expect(rule.startsWith(':where(section[data-label] '), rule).toBe(true);
  });

  it('a piece on the floor is moved in its file, not by a drag: the refusal says where', () => {
    const at = readPieces(isoPieces(MAP, {canvas})).pieces.findIndex((p) => p.keys[0] === 'server');
    expect(() => nudgePiece(MAP, {index: at, name: 'server'}, 10, 10)).toThrow(/"server" stands on the floor where its data-at says \("col row"\) — change its data-at in the file/);
  });
});
