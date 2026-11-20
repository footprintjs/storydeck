import {describe, it, expect} from 'vitest';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {arrange, gridFor, isometric} from 'footprint-story/isometric';
import {isoPieces, isoDrawn, isoIn, isoRing, ISO_CSS, MOST_ISO_PIECES, MOST_FLOOR, USUAL_SIZE, FITTED_TILE} from './iso.js';
import {applyTransforms, wireLinks} from './transforms.js';
import {compileDeck} from './compile.js';
import {deckStyles} from './page.js';
import {reviewClick} from './review.js';
import {nudgePiece} from './edit.js';
import {readPieces} from '../focusHtml.js';
import {pageAssets} from './assets.js';
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
    expect(tagOf(drawn, 'server')).toBe('<div data-k="server" data-at="3 1" data-size="2 2 1.4" class="iso ok" data-sd-iso="block" style="left:960px;top:257.1px;width:240px;height:222.9px;z-index:2;--iso-color:#cfe1f7">');
    expect(server).toContain('<svg class="iso-art" viewBox="0 0 240 222.9" aria-hidden="true"><polygon class="iso-left" points="0,60 120,120 120,222.9 0,162.9"/><polygon class="iso-right" points="120,120 240,60 240,162.9 120,222.9"/><polygon class="iso-top" points="120,0 240,60 120,120 0,60"/></svg>');
    expect(server).toContain('<span class="iso-say" style="left:120px;top:60px"><b>Server</b><small>an API</small></span></div>');   // its words, on its top face
    expect(drawn).toMatch(/data-sd-iso="cylinder"[^>]*><svg class="iso-art"[^>]*><path class="iso-side" d="M0 33\.9L0 122\.1A67\.9 33\.9 0 0 0 135\.8 122\.1L135\.8 33\.9Z"\/><ellipse class="iso-top" cx="67\.9" cy="33\.9" rx="67\.9" ry="33\.9"\/><\/svg>/);
    expect(drawn).toMatch(/data-sd-iso="floor"[^>]*><svg class="iso-art" viewBox="0 0 780 390"[^>]*><polygon class="iso-ground" points="300,0 780,240 480,390 0,150"\/><path class="iso-lines" d="M300 0L0 150M/);
    expect((drawn.match(/M[\d.]+ [\d.]+L/g) ?? []).length).toBe(9 + 6 + 1);   // 8 + 1 and 5 + 1 tile lines, and the cylinder's side
    expect(tagOf(drawn, 'floor')).not.toContain('z-index');
    expect(tagOf(drawn, 'floor')).toContain(' data-ground ');   // a floor is ground: no camera frames it
    expect(tagOf(drawn, 'server')).not.toContain('data-ground');
    // a floor that says it is part of the picture keeps its own word, and is framed like any piece
    const shown = isoPieces('<div data-k="f" data-iso="floor" data-size="2 2" data-ground="false"></div>', {canvas});
    expect(tagOf(shown, 'f')).toContain(' data-ground="false" class="iso" data-sd-iso="floor"');   // its own word is kept, and no second one is added
    expect(readPieces(shown).pieces[0].ground).toBe(undefined);
    // a single-quoted style keeps its quote
    expect(tagOf(isoPieces(`<div data-k="q" data-iso="block" data-at="0 0" data-size="1 1 1" style='--iso-color:"x"'></div>`, {canvas}), 'q')).toMatch(/style='left:900px;top:[\d.]+px;width:120px;height:[\d.]+px;z-index:1;--iso-color:"x"'>$/);
  });

  it('found in review: the words data-iso in a text or in another attribute do not make a piece, a floor or a refusal', () => {
    const piece = '<div data-k="a" data-iso="block" data-at="0 0" data-size="1 1 1"></div>';
    const said = `<p>write &lt;i data-iso-grid="120 at 0 0"&gt; and data-iso="block"</p><div data-k="b" class="box" title="use data-iso-grid, or  data-iso=&quot;block&quot;" style="left:1px;top:2px;width:3px;height:4px">B</div>`;
    expect(isoPieces(said, {canvas})).toBe(said);                                 // no piece: byte for byte
    const out = isoPieces(said + piece, {canvas});
    expect(out.startsWith(said)).toBe(true);                                      // the text and the plain box are untouched
    expect(isoIn(said + piece)).toEqual([{name: 'a', kind: 'block'}]);
    expect(boxIn(out, 'a')).toMatchObject({x: 900, w: 120});                      // on the default floor: the mention set none
    const titled = `<div data-k="t" title=' data-iso="block"' style="left:0px;top:0px">T</div>`;
    expect(isoPieces(titled + piece, {canvas}).startsWith(titled)).toBe(true);
  });

  it('found in review: a tag repeating data-iso-grid thousands of times costs no more than its length', () => {
    const long = `<i${' data-iso-grid=""'.repeat(12000)} x<div data-k="a" data-iso="block" data-size="1 1 1"></div>`, start = performance.now();
    expect(() => isoPieces(long, {canvas})).toThrow(/data-iso-grid/);
    expect(performance.now() - start).toBeLessThan(300);                          // it took about 2 s when the scan could back up
  });

  it('paints the nearer over the further by a level each, whatever order they are written in, and never moves the map\'s own order', () => {
    const level = (html, name) => Number(/z-index:(\d+)(?!\d)/.exec(tagOf(html, name))[1]);
    // a tall block in front of a low one, written first
    const map = `<div data-k="front" data-iso="block" data-at="2 2" data-size="1 1 3"></div><div data-k="back" data-iso="block" data-at="0 0" data-size="2 2 1"></div><div data-k="on" data-iso="block" data-at="0 0 1" data-size="1 1 1"></div>`;
    const out = isoPieces(map, {canvas});
    expect(level(out, 'back')).toBeLessThan(level(out, 'front'));
    expect(level(out, 'back')).toBeLessThan(level(out, 'on'));
    expect(readPieces(out).pieces.map((p) => p.keys[0])).toEqual(['front', 'back', 'on']);   // the order written: a click's numbering uses it
    expect([level(out, 'front'), level(out, 'back'), level(out, 'on')].sort()).toEqual([1, 2, 3]);   // one level each, from 1
    expect(level(out, 'back')).toBe(1);
  });

  it('a floor of its own: data-iso-grid sets the tile and the far corner, and its element is taken out', () => {
    const own = isoPieces(`<i data-iso-grid="96 at 330 70"></i><div data-k="a" data-iso="block" data-at="1 0" data-size="1 1 1"></div>`, {canvas});
    expect(own).not.toContain('data-iso-grid');
    expect(boxIn(own, 'a')).toMatchObject({x: 330, w: 96});
    const steep = isoPieces(`<i data-iso-grid="100 80 at 0 0 rise 50"></i><div data-k="a" data-iso="block" data-size="1 1 1"></div>`, {canvas});
    expect(boxIn(steep, 'a')).toEqual({x: -50, y: -50, w: 100, h: 130});   // 80 for the tile, 50 for its height
    // the default, for a map that places its blocks: a tile 120 wide, its far corner at the slide's middle, 240 down — a slide of another size has another middle
    expect(boxIn(isoPieces('<div data-k="a" data-iso="block" data-at="0 0" data-size="1 1 0"></div>', {canvas: [1000, 600]}), 'a')).toMatchObject({x: 440, y: 240});
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
    expect(bad('<div data-k="f" data-iso="floor"></div>')).toThrow(/"f" \(data-iso="floor"\): a floor with no data-size is fitted round the blocks that stand on it, and this map has none — give it a data-size \("8 5"\)/);
    expect(bad('<div data-k="f" data-iso="floor" data-at="1 1"></div><div data-k="a" data-iso="block"></div>')).toThrow(/"f" \(data-iso="floor"\): a floor with a data-at needs its data-size too \("8 5"\) — or write neither, and the build fits the floor round the blocks/);
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
    expect(bad('<div data-k="a" data-iso=block data-size="1 1 1"></div>')).toThrow(/an isometric piece is written data-iso="block" \(or cylinder, floor\), once, in lower case and with quotes/);
    expect(bad('<div data-k="a" DATA-ISO="block" data-size="1 1 1"></div>')).toThrow(/once, in lower case and with quotes/);
    expect(bad('<div data-k="a" data-iso="block" data-iso="floor" data-size="1 1 1"></div>')).toThrow(/once, in lower case and with quotes/);
    expect(bad('<div data-k="a" data-iso="block" data-size="1 1 1" style="color:red" style="left:5px"></div>')).toThrow(/"a" \(data-iso="block"\): its style is written once, with quotes — a browser reads only the first of two/);
    expect(bad('<div data-k="a" data-iso="block" data-size=1></div>')).toThrow(/data-size="1" — its size is "wide deep high", in tiles/);
    expect(bad('<div data-k="a" data-iso="block" data-size="1 1 1" title="oops></div>')).toThrow(/data-iso: a quote in its tag is never closed/);
    expect(bad('<i data-iso-grid="120 at 1 2"></i><i data-iso-grid="96 at 1 2"></i><div data-k="a" data-iso="block" data-size="1 1 1"></div>')).toThrow(/a map has one floor, and this one sets 2 — keep one/);
    expect(bad('<i data-iso-grid="wide"></i><div data-k="a" data-iso="block" data-size="1 1 1"></div>')).toThrow(/data-iso-grid="wide": the floor is a tile's width in px .* or "fit", and the build chooses the tile that fills the slide/);
    expect(bad('<i data-iso-grid="fit"></i>')).toThrow(/data-iso-grid="fit": the grid is fitted to the blocks, and this map has none — add a block, or take the grid out/);
    expect(bad('<i data-iso-grid="fit"></i><div data-k="f" data-iso="floor" data-size="4 4"></div>')).toThrow(/data-iso-grid="fit": the grid is fitted to the blocks, and this map has none — add a block, or write the grid in numbers/);
    expect(bad('<i data-iso-grid="60 60 at 0 0"></i><div data-k="a" data-iso="block" data-size="1 1 1"></div>')).toThrow(/data-iso-grid="60 60 at 0 0": a tile is wider than it is tall/);
    expect(bad('<div data-iso-grid="120 at 1 2"></div><div data-k="a" data-iso="block" data-size="1 1 1"></div>')).toThrow(/the floor is set on an empty <i>/);
    expect(bad('<i data-iso-grid="120 at 1 2">x</i><div data-k="a" data-iso="block" data-size="1 1 1"></div>')).toThrow(/the floor is set on an empty <i>/);
    expect(bad('<i DATA-ISO-GRID="120 at 1 2"></i><div data-k="a" data-iso="block" data-size="1 1 1"></div>')).toThrow(/the floor is set on an empty <i>, in lower case and with quotes/);
    // found in review: a floor's <i> that is also a piece would be taken out with its data-k, and every later piece's number would move
    expect(bad('<i data-k="g" data-iso-grid="120 at 1 2"></i><div data-k="a" data-iso="block" data-size="1 1 1"></div>')).toThrow(/the floor's <i> carries nothing else \(it is not a piece, and is taken out of the map\) — write <i data-iso-grid="120 at 960 240"><\/i> and put "data-k="g"" on a piece/);
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

  /** Its style rules, without the comments, the keyframes and the media gate round the one that moves. */
  const styleRules = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/@keyframes[^{]*\{[^{}]*\{[^{}]*\}\s*\}/g, '').replace(/@media[^{]*\{/g, '')
    .split('}').map((r) => r.trim()).filter(Boolean);

  it('every rule of its stylesheet has no weight and stays inside a slide, so a deck\'s own rule wins', () => {
    const rules = styleRules(ISO_CSS);
    expect(rules.length).toBeGreaterThan(12);
    for (const rule of rules) expect(rule.startsWith(':where(section[data-label]'), rule).toBe(true);
    // what plays is behind the motion gate, as every animation of a click is
    expect(ISO_CSS).toMatch(/@media screen and \(prefers-reduced-motion: no-preference\) \{\n  :where\(section\[data-label\]\[data-deck-active\]:not\(\[data-sd-instant\]\):not\(\[data-deck-static\]\) \.sd-hot-in:is\([^)]*\) \.iso-art\) \{ animation: sdIsoRing /);
    // the ring waits as a box's does (.3s after --sd-turn): the piece hands its faces that moment, which is not inherited
    expect(ISO_CSS).toContain('--sd-hot-width: 0px; --iso-turn: var(--sd-turn, 0s); }');
    expect(ISO_CSS).toContain('animation: sdIsoRing .6s ease calc(.3s + var(--iso-turn, 0s)) both;');
    expect(pageAssets().css.join('\n')).toContain('.sd-hot-in { --sd-a-hot: sdRing .6s var(--sd-ease, cubic-bezier(.2, .7, .2, 1)) calc(.3s + var(--sd-turn, 0s)) both; }');
  });

  it('a piece is what it draws: its faces and its words take the pointer, never the corners of its box', () => {
    expect(ISO_CSS).toContain(':where(section[data-label][data-deck-active] [data-sd-iso]) { pointer-events: none; }');
    expect(ISO_CSS).toContain(':where(section[data-label][data-deck-active] [data-sd-iso] :is(.iso-art > *, .iso-say)) { pointer-events: auto; }');
    // only on the slide shown: "auto" written on a face would make a slide that takes no pointer (one leaving, one under) take it there
    expect(ISO_CSS.match(/pointer-events: (?:none|auto)/g)).toHaveLength(3);
    expect(ISO_CSS).not.toMatch(/:where\(section\[data-label\] \[data-sd-iso\][^{]*\{[^}]*pointer-events/);
    // the drawing itself stays out of the way: only what is painted inside it is hit
    expect(ISO_CSS).toMatch(/:where\(section\[data-label\] \.iso-art\) \{[^}]*pointer-events: none;/);
  });

  it('a ring follows its faces: isoRing rings a block or a cylinder round what it paints, a floor along its edge', () => {
    const ring = isoRing('deck-stage .picked', 'red', '3px');
    expect(ring.split('\n')).toEqual([
      ':where(deck-stage .picked:is([data-sd-iso="block"], [data-sd-iso="cylinder"]) .iso-art) { filter: drop-shadow(3px 0 0 red) drop-shadow(-3px 0 0 red) drop-shadow(0 3px 0 red) drop-shadow(0 -3px 0 red); }',
      ':where(deck-stage .picked[data-sd-iso="floor"] .iso-ground) { stroke: red; stroke-width: 3px; }',
    ]);
    // its highlight (data-hot): the box's ring is off (focus.css reads the width), the faces are ringed in the same colour
    expect(ISO_CSS).toContain(isoRing('section[data-label] .sd-hot', 'var(--sd-hot, #ef4444)', '5px'));
    expect(pageAssets().css.join('\n')).toContain('.sd-hot { outline: var(--sd-hot-width, 5px) solid var(--sd-hot, #ef4444); outline-offset: 8px; }');
    expect(ISO_CSS).toContain(':where(section[data-label] [data-sd-iso]) { position: absolute; box-sizing: border-box; --sd-hot-width: 0px;');
  });

  it('a piece on the floor is moved in its file, not by a drag: the refusal says where', () => {
    const at = readPieces(isoPieces(MAP, {canvas})).pieces.findIndex((p) => p.keys[0] === 'server');
    expect(() => nudgePiece(MAP, {index: at, name: 'server'}, 10, 10)).toThrow(/"server" stands on the floor where its data-at says \("col row"\) — change its data-at in the file/);
    // a block the build placed has no data-at to change: the message says what would place it, for every block of the map
    // a floor is not a block: with a size of its own or fitted, it is moved by its own data-at and data-size
    for (const floor of ['<div data-k="f" data-iso="floor" data-size="8 5"></div>', '<div data-k="f" data-iso="floor"></div>']) {
      expect(() => nudgePiece(`${floor}<div data-k="a" data-iso="block" data-at="0 0"></div>`, {index: 0, name: 'f'}, 10, 10))
        .toThrow('"f" is the floor: it lies where its data-at and data-size say, or round the blocks when it has neither — change them in the file');
    }
    const unplaced = '<div data-k="a" data-iso="block"></div><div data-k="b" data-iso="block"></div>';
    expect(() => nudgePiece(unplaced, {index: 1, name: 'b'}, 10, 10)).toThrow('"b" was placed by the build, from the map\'s wires — to place the blocks yourself, give every block of the map a data-at ("col row") in the file');
  });
});

describe('iso · no places to type: the build places the blocks from what is joined to what', () => {
  const area = [0, 220, 1920, 1000];
  /** The least a map is: no data-at, no data-size, no grid. */
  const LEAST = `<div data-k="floor" data-iso="floor"></div>
<div data-k="you" data-iso="block"><b>You</b></div>
<i data-k="w1" class="wire" data-arrow="you to dns"></i>
<div data-k="dns" data-iso="block"><b>DNS</b></div>
<i data-k="w2" class="wire" data-arrow="you to server"></i>
<div data-k="server" data-iso="block" data-size="2 2 1.6"><b>Server</b></div>
<i data-k="w3" class="wire" data-arrow="server to db"></i>
<div data-k="db" data-iso="cylinder"><b>Database</b></div>`;
  const links = [['you', 'dns'], ['you', 'server'], ['server', 'db']];
  const sizes = {you: USUAL_SIZE, dns: USUAL_SIZE, server: [2, 2, 1.6], db: USUAL_SIZE};
  const round = (b) => Object.fromEntries(Object.entries(b).map(([k, v]) => [k, +v.toFixed(1)]));
  /** What the kit says of this map, worked out here apart from iso.js: the places (across the frame), the floor round them, the grid that fits the blocks. */
  function expected() {
    const placed = arrange(Object.entries(sizes).map(([name, size]) => ({name, size: [...size]})), links, {across: true}).things;
    const floor = {at: [-1, -1, 0], size: [Math.ceil(Math.max(...placed.map((t) => t.at[0] + t.size[0]))) + 2, Math.ceil(Math.max(...placed.map((t) => t.at[1] + t.size[1]))) + 2, 0]};
    return {placed, floor, grid: gridFor(placed, [area[0] + 40, area[1] + 40, area[2] - 40, area[3] - 40], FITTED_TILE)};
  }

  it('reads what the wires join, in the order written', () => {
    expect(wireLinks(LEAST)).toEqual(links);
    expect(wireLinks('<i data-k="w" class="wire" data-arrow="1 2 3 4"></i><i data-k="v" class="wire" data-arrow="a to b 30"></i>')).toEqual([['a', 'b']]);   // a wire in numbers joins no pieces
  });

  it('places every block from the wires, fits the floor round them and the grid to the slide\'s area — no number typed', () => {
    const drawn = isoPieces(LEAST, {canvas, area, links}), {placed, floor, grid} = expected();
    for (const t of placed) expect(boxIn(drawn, t.name)).toEqual(round((t.name === 'db' ? grid.cylinder(t) : grid.block(t)).box));
    expect(boxIn(drawn, 'floor')).toEqual(round(grid.floor({cols: floor.size[0], rows: floor.size[1], at: [-1, -1]}).box));   // a tile of floor on every side
    // on the slide: you on the left; the two it asks one step to its right, one above its line and one below; the
    // database one step on from the server, on the server's line (each by the middle of the tiles it stands on)
    const mid = Object.fromEntries(placed.map((t) => { const p = grid.at(t.at[0] + t.size[0] / 2, t.at[1] + t.size[1] / 2); return [t.name, [p.x, p.y]]; }));
    expect(mid.dns[0]).toBeCloseTo(mid.server[0], 6);
    expect(mid.you[0]).toBeLessThan(mid.dns[0]);
    expect(mid.dns[1]).toBeLessThan(mid.you[1]);
    expect(mid.server[1]).toBeGreaterThan(mid.you[1]);
    expect(mid.db[0]).toBeGreaterThan(mid.server[0]);
    expect(mid.db[1]).toBeCloseTo(mid.server[1], 6);
    // every block sits in the area, a little clear of its edges; the floor is ground, and may run past them
    for (const name of ['you', 'dns', 'server', 'db']) {
      const b = boxIn(drawn, name);
      expect(b.x >= area[0] + 40 - 0.1 && b.y >= area[1] + 40 - 0.1 && b.x + b.w <= area[2] - 40 + 0.1 && b.y + b.h <= area[3] - 40 + 0.1, name).toBe(true);
    }
    expect(grid.tile[0]).toBeGreaterThanOrEqual(FITTED_TILE.least);
  });

  it('a block with no data-size is 2 wide, 2 deep and 1 high', () => {
    expect(USUAL_SIZE).toEqual([2, 2, 1]);
    const one = isoPieces('<i data-iso-grid="100 at 500 100"></i><div data-k="a" data-iso="block" data-at="0 0"></div>', {canvas});
    expect(boxIn(one, 'a')).toEqual(round(isometric({tile: 100, origin: [500, 100]}).block({at: [0, 0], size: [2, 2, 1]}).box));
  });

  it('the same map through the whole helper chain: the wires run between the blocks the build placed', () => {
    const out = applyTransforms(LEAST, {canvas, area});
    expect(out).toBe(applyTransforms(LEAST, {canvas, area}));                   // the same again
    // the blocks stand as the placing alone stands them, one against another; the picture is moved to hold the wires too
    const alone = isoPieces(LEAST, {canvas, area, links}), from = (html, name) => { const a = boxIn(html, 'you'), b = boxIn(html, name); return [b.x - a.x, b.y - a.y, b.w, b.h]; };
    for (const name of ['dns', 'server', 'db']) expect(from(out, name)).toEqual(from(alone, name).map((n) => expect.closeTo(n, 1)));
    // every wire is inside the slide's area: the picture was fitted to the wires as well as the blocks
    for (const svg of out.matchAll(/<svg data-ends="[^"]*"[^>]*style="left:([\d.-]+)px;top:([\d.-]+)px;width:([\d.]+)px;height:([\d.]+)px/g)) {
      const [x, y, w, h] = svg.slice(1).map(Number);
      expect(x + 20 >= area[0] && y + 20 >= area[1] && x + w - 20 <= area[2] && y + h - 20 <= area[3], `${[x, y, w, h]} in ${area}`).toBe(true);   // 20 px: a wire's box is that much bigger than its line
    }
    for (const [name, ends] of [['w1', 'you dns'], ['w2', 'you server'], ['w3', 'server db']]) expect(tagOf(out, name)).toContain(`data-ends="${ends}"`);
    expect(out).not.toMatch(/data-arrow|data-iso=|data-at=/);
  });

  it('a link to a piece that is no block is no rule, and blocks joined to nothing are placed too', () => {
    const map = `<div data-k="a" data-iso="block"></div><div data-k="b" data-iso="block"></div><div data-k="note" class="chip" style="left:10px;top:10px;width:100px;height:40px">n</div>`;
    const drawn = isoPieces(map, {canvas, area, links: [['a', 'note'], ['note', 'b']]});
    const a = boxIn(drawn, 'a'), b = boxIn(drawn, 'b');
    expect(b.x - a.x).toBeGreaterThan(a.w);             // side by side on the slide, clear of each other
    expect(b.y).toBe(a.y);                              // on one level line
    expect(boxIn(drawn, 'note')).toEqual({x: 10, y: 10, w: 100, h: 40});   // a piece that is no block stays where it was written
  });

  it('is all or none: a map that places some of its blocks and not the others is refused, naming them', () => {
    const mixed = '<div data-k="a" data-iso="block" data-at="0 0"></div><div data-k="b" data-iso="block"></div><div data-k="c" data-iso="cylinder"></div>';
    expect(() => isoPieces(mixed, {canvas})).toThrow('"b", "c" have no data-at and "a" has one: the build places a map\'s blocks from its wires only when it places them all — take data-at off the others, or give every block one (a block with none stood at "0 0" before 0.17.0)');
    expect(() => isoPieces('<div data-k="a" data-iso="block" data-at="0 0"></div><div data-k="d" data-iso="block" data-at="3 0"></div><div data-k="b" data-iso="block"></div>', {canvas}))
      .toThrow(/^"b" has no data-at and "a", "d" have one:/);
    // a floor's place is its own matter: a floor that is placed beside blocks that are not is no mix
    expect(() => isoPieces('<div data-k="f" data-iso="floor" data-at="-1 -1" data-size="9 9"></div><div data-k="a" data-iso="block"></div>', {canvas, area})).not.toThrow();
  });

  it('refuses two blocks with one name when it has to place them by name', () => {
    const fix = 'the build places a map\'s blocks by the first name in their data-k, and two are called "a" — give each a first name of its own, or give every block its data-at';
    expect(() => isoPieces('<div data-k="a" data-iso="block"></div><div data-k="a" data-iso="block"></div>', {canvas})).toThrow(fix);
    expect(() => isoPieces('<div data-k="a x" data-iso="block"></div><div data-k="a y" data-iso="block"></div>', {canvas})).toThrow(fix);   // the first name is the name
    // what the kit itself cannot place is said in its words, with the way out
    expect(() => isoPieces('<div data-k="a" data-iso="block" data-size="70 2 1"></div>', {canvas}))
      .toThrow(/^the build cannot place this map's blocks: "a"'s size is \[wide, deep, high\] with wide and deep above 0, high 0 or more, none over 64 — not \[70,2,1\] — or give every block its data-at$/);
    // placed by the map, two of a name are drawn as they always were
    expect(() => isoPieces('<div data-k="a" data-iso="block" data-at="0 0"></div><div data-k="a" data-iso="block" data-at="4 0"></div>', {canvas})).not.toThrow();
  });

  it('a floor with no data-size is fitted round the blocks, wherever the map placed them', () => {
    const drawn = isoPieces('<i data-iso-grid="100 at 500 100"></i><div data-k="f" data-iso="floor"></div><div data-k="a" data-iso="block" data-at="2 3" data-size="1.5 1 1"></div><div data-k="b" data-iso="block" data-at="6.2 1" data-size="1 2.4 1"></div>', {canvas});
    const grid = isometric({tile: 100, origin: [500, 100]});
    expect(boxIn(drawn, 'f')).toEqual(round(grid.floor({cols: 8, rows: 5, at: [1, 0]}).box));   // cols 2..7.2 and rows 1..4, a whole tile clear on every side
    // a floor the map sized keeps its size, and its place when none is written is 0 0, as before
    expect(boxIn(isoPieces('<i data-iso-grid="100 at 500 100"></i><div data-k="f" data-iso="floor" data-size="3 2"></div><div data-k="a" data-iso="block" data-at="5 5"></div>', {canvas}), 'f'))
      .toEqual(round(grid.floor({cols: 3, rows: 2}).box));
  });

  it('a floor fitted round a map too long for one is refused in the map\'s own terms, with the fix — never in numbers nobody typed', () => {
    const far = `<div data-k="f" data-iso="floor"></div><div data-k="a" data-iso="block" data-at="0 0"></div><div data-k="b" data-iso="block" data-at="300 0"></div>`;
    expect(() => isoPieces(far, {canvas})).toThrow('"f" (data-iso="floor"): fitted round this map\'s blocks the floor would be 304 by 4 tiles, and a floor is at most 256 a side — take the floor out, or give it a data-at and a data-size of its own (it is ground: it need not lie under every block)');
    const many = Array.from({length: 90}, (_, i) => `<div data-k="b${i}" data-iso="block"></div>`).join(''), chain = Array.from({length: 89}, (_, i) => [`b${i}`, `b${i + 1}`]);
    expect(() => isoPieces(`<div data-k="f" data-iso="floor"></div>${many}`, {canvas, area, links: chain})).toThrow(/fitted round this map's blocks the floor would be \d+ by \d+ tiles, and a floor is at most 256 a side/);
    expect(() => isoPieces(many, {canvas, area, links: chain})).not.toThrow();   // the same blocks with no floor are placed
    expect(() => isoPieces(`<div data-k="f" data-iso="floor" data-at="0 0" data-size="20 20"></div>${many}`, {canvas, area, links: chain})).not.toThrow();   // or with a floor the map sized
    // the limit is the grid's own: a floor one tile over it is what the grid refuses
    expect(() => isometric().floor({cols: MOST_FLOOR, rows: 1})).not.toThrow();
    expect(() => isometric().floor({cols: MOST_FLOOR + 1, rows: 1})).toThrow(/whole numbers from 1 to 256/);
  });

  it('a fitted picture goes into the area given: a small one keeps half of itself clear, and one that is no area is refused by name', () => {
    const blocks = '<div data-k="a" data-iso="block"></div>', one = [{at: [0, 0], size: [2, 2, 1]}];
    const small = [100, 100, 220, 180];   // 120 by 80: 40 px each side would leave nothing, so a quarter each way
    expect(boxIn(isoPieces(blocks, {canvas, area: small}), 'a')).toEqual(round(gridFor(one, [120, 120, 200, 160], FITTED_TILE).block(one[0]).box));
    expect(boxIn(isoPieces(blocks, {canvas: [400, 300]}), 'a')).toEqual(round(gridFor(one, [40, 40, 360, 260], FITTED_TILE).block(one[0]).box));
    for (const not of [[0, 0, 0, 100], [10, 0, 5, 100], [0, 0, NaN, 100], [0, 0, 100], 'wide']) {
      expect(() => isoPieces(blocks, {canvas, area: not})).toThrow(/^a fitted picture goes into the slide's area, \[x0, y0, x1, y1\] in slide px with x1 past x0 and y1 past y0 \(deck\.json "area"\) — not /);
    }
    expect(() => isoPieces(blocks, {canvas, area: [NaN, 0, 10, 10]})).toThrow(/— not \[NaN, 0, 10, 10\]$/);   // each number as it is
    expect(() => isoPieces(blocks, {canvas, area: 'wide'})).toThrow(/— not "wide"$/);
  });

  it('data-iso-grid="fit" fits the grid on a map that places its own blocks; a floor the map sized is ground, and is not what the tile is chosen for', () => {
    const blocks = '<div data-k="a" data-iso="block" data-at="0 0"></div><div data-k="b" data-iso="block" data-at="5 0"></div>';
    const fitted = isoPieces(`<i data-iso-grid="fit"></i>${blocks}`, {canvas, area}), usual = isoPieces(blocks, {canvas, area});
    expect(fitted).not.toContain('data-iso-grid');
    const things = [{at: [0, 0], size: [2, 2, 1]}, {at: [5, 0], size: [2, 2, 1]}], grid = gridFor(things, [40, 260, 1880, 960], FITTED_TILE);
    expect(boxIn(fitted, 'a')).toEqual(round(grid.block(things[0]).box));
    expect(boxIn(usual, 'a')).toEqual(round(isometric({tile: 120, origin: [960, 240]}).block(things[0]).box));   // without it: the grid there has always been
    const wide = isoPieces(`<i data-iso-grid=" fit "></i><div data-k="f" data-iso="floor" data-at="-20 -20" data-size="60 60"></div>${blocks}`, {canvas, area});
    expect(boxIn(wide, 'a')).toEqual(boxIn(fitted, 'a'));
    // with no area given, the picture is fitted to the slide
    const whole = gridFor(things, [40, 40, 1880, 1040], FITTED_TILE);
    expect(boxIn(isoPieces(`<i data-iso-grid="fit"></i>${blocks}`, {canvas}), 'a')).toEqual(round(whole.block(things[0]).box));
  });

  it('a picture too big for the slide keeps a tile its words fit: it runs past the area, and a click\'s camera frames what the click shows', () => {
    const many = Array.from({length: 14}, (_, i) => `<div data-k="b${i}" data-iso="block"></div>`).join('');
    const chain = Array.from({length: 13}, (_, i) => [`b${i}`, `b${i + 1}`]);   // fourteen steps: 41 tiles across at a tile to a step
    const drawn = isoPieces(many, {canvas, area, links: chain}), first = boxIn(drawn, 'b0'), last = boxIn(drawn, 'b13');
    expect(first.w).toBe(FITTED_TILE.least * 2);        // a 2 × 2 block is two tiles wide on the slide: the least tile
    expect(first.x < area[0] || last.x + last.w > area[2]).toBe(true);
    expect(FITTED_TILE).toEqual({most: 160, least: 96});
  });

  it('hands each block\'s outline and its middle to whoever draws between pieces; a name two blocks share has none', () => {
    const {html, shapes} = isoDrawn('<i data-iso-grid="100 at 500 100"></i><div data-k="a" data-iso="block" data-at="0 0"></div><div data-k="c" data-iso="cylinder" data-at="4 0"></div>', {canvas});
    expect(html).toBe(isoPieces('<i data-iso-grid="100 at 500 100"></i><div data-k="a" data-iso="block" data-at="0 0"></div><div data-k="c" data-iso="cylinder" data-at="4 0"></div>', {canvas}));
    const grid = isometric({tile: 100, origin: [500, 100]}), block = grid.block({at: [0, 0], size: [2, 2, 1]});
    expect(shapes.get('a').outline).toEqual(block.outline.map(({x, y}) => [x, y]));
    expect(shapes.get('a').middle).toEqual([block.box.x + block.box.w / 2, block.box.y + block.box.h / 2]);
    const round_ = grid.cylinder({at: [4, 0], size: [2, 2, 1]}), points = shapes.get('c').outline;
    expect(points).toHaveLength(26);
    for (const [x, y] of points) expect(x >= round_.box.x - 1e-6 && x <= round_.box.x + round_.box.w + 1e-6 && y >= round_.box.y - 1e-6 && y <= round_.box.y + round_.box.h + 1e-6).toBe(true);
    expect(Math.min(...points.map((p) => p[1]))).toBeCloseTo(round_.box.y, 6);                       // the top of its top
    expect(Math.max(...points.map((p) => p[1]))).toBeCloseTo(round_.box.y + round_.box.h, 6);        // the foot of its foot
    expect(isoDrawn('<div data-k="a" data-iso="block" data-at="0 0"></div><div data-k="a" data-iso="block" data-at="4 0"></div>', {canvas}).shapes.size).toBe(0);
    expect(isoDrawn('<p>no piece</p>', {canvas})).toEqual({html: '<p>no piece</p>', shapes: new Map(), solids: [], tight: []});
  });

  it('the README\'s map with no number in it builds as written', () => {
    const readme = readFileSync(path.join(process.cwd(), 'README.md'), 'utf8');   // the tests run from the package's own folder
    const written = /no number to type:\n\n {2}```html\n([\s\S]*?)\n {2}```/.exec(readme)[1].split('\n').map((line) => line.trim()).join('\n');
    expect(written).not.toMatch(/data-at|data-iso-grid|\d+px/);
    expect(written.match(/data-iso="/g)).toHaveLength(5);
    const out = applyTransforms(written, {canvas, area});
    expect(isoIn(written).map((p) => p.name)).toEqual(['floor', 'you', 'dns', 'server', 'db']);
    for (const name of ['you', 'dns', 'server', 'db']) expect(boxIn(out, name).w).toBeGreaterThan(0);
    expect(out.match(/data-ends="/g)).toHaveLength(3);
  });

  it('a deck whose map types no places builds, and its clicks plan on the placed pieces', () => {
    const compiled = compileDeck(sourceOf({clicks: '<section data-label="P" data-map="map"><step data-in="floor you dns w1" data-focus="fit"><h2>One</h2></step><step data-in="server w2 db w3" data-on="server db"><h2>Two</h2></step></section>', maps: {map: LEAST}}));
    expect(compiled.clicks).toHaveLength(2);
    expect(compiled.maps.map.pieces.map((p) => p.keys[0])).toEqual(['floor', 'you', 'w1', 'dns', 'w2', 'server', 'w3', 'db']);
    expect(compiled.maps.map.pieces.every((p) => p.box && p.box.w > 0)).toBe(true);
  });
});

describe('iso · a block\'s name fits its top face', () => {
  const grid = '<i data-iso-grid="96 at 960 240"></i>';
  const say = (inner, size = '2 2 1') => /<span class="iso-say"[^>]*>(.*?)<\/span>/.exec(isoPieces(`${grid}<div data-k="a" data-iso="block" data-at="0 0" data-size="${size}">${inner}</div>`, {canvas}))[1];
  const tightOf = (inner, size = '2 2 1') => isoDrawn(`${grid}<div data-k="a" data-iso="block" data-at="0 0" data-size="${size}">${inner}</div>`, {canvas}).tight;

  it('a name that fits stays as the deck wrote it, to the letter', () => {
    for (const inner of ['<b>API</b>', '<i class="ic"></i><b>Server</b><small>an API</small>', '<b>Balancer</b>', 'plain words', '<b></b>']) expect(say(inner) ?? '').toBe(inner);
    expect(tightOf('<b>API</b>')).toEqual([]);
  });

  it('a longer name is broken onto two lines where they are most alike; a longer one still is made smaller', () => {
    expect(say('<b>Load Balancer</b>')).toBe('<b>Load<br>Balancer</b>');                                   // a face 192 px wide: 13 letters at 26 px do not fit on one line
    expect(say('<b>Authentication Service</b><small>OAuth</small>')).toBe('<b style="font-size:20px">Authentication<br>Service</b><small>OAuth</small>');
    expect(say('<b>Load Balancer</b>', '4 2 1')).toBe('<b>Load Balancer</b>');                             // a wider block: one line
    expect(say('<b>R&amp;D Lab one</b>')).toBe('<b>R&amp;D Lab one</b>');                                  // an entity is one letter: eleven letters fit, where fifteen would not
    expect(say('<b>R&amp;D Team Lab</b>')).toBe('<b>R&amp;D<br>Team Lab</b>');                             // and stays as written when the name is broken
    expect(tightOf('<b>Authentication Service</b>')).toEqual([]);
  });

  it('a name that cannot fit is drawn at the least size on two lines, and the build is told', () => {
    expect(say('<b>Supercalifragilisticexpialidocious</b>')).toBe('<b style="font-size:16px">Supercalifragilisticexpialidocious</b>');
    expect(tightOf('<b>Supercalifragilisticexpialidocious</b>')).toEqual([{name: 'a', text: 'Supercalifragilisticexpialidocious'}]);
  });

  it('a name with markup or a style of its own is the deck\'s to set: left alone', () => {
    for (const inner of ['<b style="font-size:40px">A very long name indeed here</b>', '<b class="x">A very long name indeed here</b>', '<b>A very <em>long</em> name indeed here</b>']) {
      expect(say(inner)).toBe(inner);
      expect(tightOf(inner)).toEqual([]);
    }
  });
});

