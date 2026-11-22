// A map names one of footprint-story's looks (0.40.0): `<i data-style="look: line-art">` — outlined, line-art,
// paper-grain, duotone and (0.41.0, footprint-story 0.37.0) sketchy (footprint-story/isometric · ISO_LOOKS). Each is read in the deck's words, built by the kit's
// steps with the human door's choices (HUMAN_STYLE_CHOICES), drawn, recorded by name, and kept readable on a dark page:
// a paper map takes the page's paper and ink there (iso.js · LOOK_CSS), measured here against the page's own CSS. A
// grain's marks are drawn once a page, as 0.39.0's strokes are. (A dark page's contrast, for every look and
// combination: looksDark.test.js.) Each look has a still, pinned byte for byte, made again
// after a change that means to move it with:  STORYDECK_WRITE_STILLS=1 npx vitest run deck/looks.test.js
// @vitest-environment node
import {afterEach, describe, it, expect} from 'vitest';
import {readFileSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {ISO_LOOKS, isoStyle} from 'footprint-story/isometric';
import {isoDrawn, ISO_CSS, LOOK_CSS, PAPER_DARK} from './iso.js';
import {parseStyle} from './isoStyle.js';
import {inlineStrokes, strokesSvg, PAPER, paperOf, STROKE_TIMING} from './isoPaint.js';
import {STROKES_NOTE} from './isoRules.js';
import {compileDeck} from './compile.js';
import {checkDeck} from './check.js';
import {deckPage} from './page.js';
import {pageAssets} from './assets.js';
import {buildDeck} from './build.js';
import {runDeck} from './run/run.js';
import {logTool} from './tools.js';
import {sourceOf, tempDeck, tempDir, cleanDecks} from './test/helpers.js';

afterEach(cleanDecks);

const canvas = [1920, 1080];
const LOOKS = ['outlined', 'line-art', 'paper-grain', 'duotone', 'sketchy'];
/** A map with a labelled floor, a block and a cylinder, in a look: what each test draws. */
const MAP = (style) => `<i data-iso-grid="120 at 960 240"></i>${style ? `<i data-style="${style}"></i>` : ''}
<div data-k="floor" data-iso="floor" data-size="8 5" data-label="Production"></div>
<div data-k="server" data-iso="block" data-at="1 1" data-size="2 2 1.4"><b>Server</b></div>
<div data-k="db" data-iso="cylinder" data-at="5 1" data-size="1.6 1.6 1.2"><b>Database</b></div>`;
const deckOf = (style, map = MAP) => compileDeck(sourceOf({clicks: '<section data-label="S" data-map="m"><step data-in="*"><h2>A</h2></step><step data-in="*"><h2>B</h2></step></section>', maps: {m: map(style)}}));

describe('looks · read from the map\'s data-style, in the deck\'s words', () => {
  it('"look: <name>" is a column of its own, the kit\'s names; a column beside it replaces its entry', () => {
    expect(Object.keys(ISO_LOOKS)).toEqual(LOOKS);
    for (const look of LOOKS) expect(parseStyle(`look: ${look}`, 'w')).toEqual({look});
    expect(parseStyle('look: line-art; texture: human:hatch', 'w')).toEqual({look: 'line-art', texture: 'human:hatch'});
    expect(parseStyle('  look:duotone ;', 'w')).toEqual({look: 'duotone'});
  });

  it('refuses, naming the fix: a look that is not one (with the ones there are), options, twice, none named — and the kit\'s own refusals', () => {
    const refused = (style) => () => deckOf(style);
    expect(refused('look: sketch')).toThrow('map "m": data-style="look: sketch": there is no look "sketch" — there are "outlined", "line-art", "paper-grain", "duotone", "sketchy"');
    expect(refused('look: duotone ink #000000')).toThrow('data-style="look: duotone ink #000000": the look "duotone" takes no options — not "ink #000000"; to change a part of it, write that column beside it ("look: duotone; line: ink width 3")');
    expect(refused('look: duotone; look: outlined')).toThrow('the look is written twice — keep one');
    expect(refused('look:')).toThrow('the look names one — "look: outlined"');
    expect(refused('looks: duotone')).toThrow('a style\'s columns are look, shape, shading, line, palette, texture, effects — not "looks"');
    // the kit's: a look its row overrides whole draws nothing; a texture that cannot sit with the duotone, saying it came from the look
    expect(refused('look: duotone; palette: theme')).toThrow('data-style="look: duotone; palette: theme": the look "duotone" sets palette, and the row writes it itself, so the look draws nothing — drop the look, or the palette written beside it');
    expect(refused('look: duotone; texture: human:grain')).toThrow('the texture "human:grain" cannot sit with palette "duotone" (from the look "duotone": write palette beside it to change it)');
    expect(refused('look: line-art; line: none')).toThrow('the shading "paper" (from the look "line-art": write shading beside it to change it) cannot sit with line "none"');
    expect(refused('look: sketchy; shading: paper; line: human:sketchy; texture: human:hatch')).toThrow('the look "sketchy" sets shading and line and texture, and the row writes each itself, so the look draws nothing — drop the look, or the shading and line and texture written beside it');
    expect(refused('look: sketchy; palette: duotone')).toThrow('the texture "human:hatch" (from the look "sketchy": write texture beside it to change it) cannot sit with palette "duotone"');
    expect(refused('look: sketchy; line: none')).toThrow('the shading "paper" (from the look "sketchy": write shading beside it to change it) cannot sit with line "none"');
  });

  it('a look named and its row written out draw the same picture; the record keeps the name', () => {
    for (const look of LOOKS) {
      const written = Object.entries(ISO_LOOKS[look]).map(([column, v]) => `${column}: ${typeof v === 'string' ? v : [v.name, ...Object.entries(v).filter(([k]) => k !== 'name').flat()].join(' ')}`).join('; ');
      const named = isoDrawn(MAP(`look: ${look}`), {canvas}), out = isoDrawn(MAP(written), {canvas});
      expect(named.built.map.paints).toEqual(out.built.map.paints);
      expect(named.built.map.floorPaints).toEqual(out.built.map.floorPaints);
      expect(named.html).toBe(out.html);
      expect(named.made.style.look).toBe(look);
      expect(out.made.style).not.toHaveProperty('look');
    }
  });
});

describe('looks · each drawn on a page', () => {
  it('the check reads clean for every look: no note a plain map does not get', () => {
    const noted = (style) => checkDeck(compileDeck(sourceOf({clicks: '<section data-label="S" data-map="m"><step data-in="*"><h2>A</h2><aside class="notes">Said.</aside></step></section>', maps: {m: MAP(style)}})));
    expect(noted(null)).toEqual([]);
    for (const look of LOOKS) expect(noted(`look: ${look}`), look).toEqual([]);
  });

  it('outlined: a contour round each piece under its faces, today\'s tones', () => {
    const deck = deckOf('look: outlined'), html = deck.slides[0].html;
    expect(html).toContain('<polygon class="iso-contour" stroke-width="8.5"');
    expect(html).not.toContain('data-sd-paper');
    expect(deck.looks).toBe(true);
    expect(deck.maps.m.made.style.row).toMatchObject({line: 'contour', shading: 'tones'});
  });

  it('line-art: every face and the floor\'s ground in the page\'s paper, ink lines only', () => {
    const deck = deckOf('look: line-art'), html = deck.slides[0].html;
    const filled = html.match(/<(?:polygon|ellipse|path) class="iso-(?:top|left|right|side|ground)"[^>]*>/g);
    expect(filled.length).toBeGreaterThan(5);
    for (const face of filled) expect(face).toContain(`style="fill:var(--iso-paper, ${PAPER})"`);
    expect(PAPER).toBe('#ffffff');
    expect(html.match(/ data-sd-paper/g)).toHaveLength(3);
    expect(deck.maps.m.made.paper).toBe(PAPER_DARK);
    expect(deck.looks).toBe(true);
    // a paper of the writer's own is the light page's paper, as the kit reads it
    const own = isoDrawn(MAP('look: line-art; shading: paper colour #FAF6EE'), {canvas}).built.map;
    expect(paperOf(own.style, [...own.paints, ...own.floorPaints])).toBe('#faf6ee');
    expect(paperOf(own.style)).toBe('#faf6ee');
  });

  it('paper-grain: today\'s look with a grain over every face, its marks drawn once a page', () => {
    const deck = deckOf('look: paper-grain'), [one, two] = deck.slides;
    expect(one.html).not.toContain('class="iso-grain"');
    expect(one.html.match(/<use href="#sd-st-/g)).toHaveLength(2);
    expect(two.html.match(/<use href="#sd-st-/g)).toHaveLength(2);
    const defs = Object.values(deck.strokeDefs).join('');
    expect(defs).toMatch(/<path class="iso-grain" stroke-width="0.8" stroke-linejoin="round" stroke-linecap="round" stroke-opacity="0.22" d="M/);
    const {strokes, marks, bytes} = deck.maps.m.made.strokes;
    expect({strokes, bytes}).toEqual({strokes: 0, bytes: defs.length});
    expect(marks).toBeGreaterThan(100);
    expect(deck.maps.m.made.strokes).not.toHaveProperty('timing');   // a mark has no time to play
    // the floor's tile lines stay in place: every map has them
    expect(one.html).toContain('<path class="iso-lines"');
    expect(deck.looks).toBeUndefined();
  });

  it('duotone: every line in its ink; the faces stay the page\'s (a deck colours its pieces by class and theme)', () => {
    const deck = deckOf('look: duotone'), html = deck.slides[0].html;
    for (const face of html.match(/<(?:polygon|ellipse|path) class="iso-(?:top|left|right|side)"[^>]*>/g)) expect(face).toMatch(/ style="stroke:#22304a;stroke-width:2.5px;/);
    expect(html).not.toMatch(/fill:#/);
    expect(deck.looks).toBeUndefined();
  });
});

describe('looks · sketchy, the hand-drawn look (footprint-story 0.37.0)', () => {
  it('paper faces, every edge drawn by hand and every side hatched, drawn once a page; a dark page gives it its paper and ink', () => {
    const deck = deckOf('look: sketchy'), [one, two] = deck.slides;
    // the faces: the page's paper, no outline of their own (the hand draws the edges)
    const faces = one.html.match(/<(?:polygon|ellipse|path) class="iso-(?:top|left|right|side)"[^>]*>/g);
    expect(faces.length).toBeGreaterThan(4);
    for (const face of faces) expect(face).toMatch(new RegExp(`^<\\w+ class="iso-\\w+" stroke="none" style="fill:var\\(--iso-paper, ${PAPER}\\)"`));
    expect(one.html.match(/ data-sd-paper/g)).toHaveLength(3);
    expect(deck.maps.m.made.paper).toBe(PAPER_DARK);
    expect(deck.looks).toBe(true);
    // the edges and the hatch: in the page's ink (a dark page's LOOK_CSS sets it), drawn once, a <use> a piece a click
    const defs = Object.values(deck.strokeDefs).join('');
    expect(defs.match(/<path class="iso-ink" stroke="none" style="fill:var\(--iso-line, var\(--iso-ink, #14181f\)\);fill-rule:nonzero"/g).length).toBeGreaterThan(1);
    expect(defs.match(/<path class="iso-hatch" stroke="none" style="fill:var\(--iso-line, var\(--iso-ink, #14181f\)\);fill-rule:nonzero"/g).length).toBeGreaterThan(10);
    expect(defs).not.toMatch(/(?:fill|stroke):#/);
    for (const slide of [one, two]) {
      expect(slide.html.match(/<use href="#sd-st-/g)).toHaveLength(2);
      expect(slide.html).not.toContain('class="iso-hatch"');
    }
    // the record keeps the look's name and its row: the kit's, the hatch 28 px apart
    expect(deck.maps.m.made.style).toMatchObject({look: 'sketchy', row: {shading: 'paper', line: 'human:sketchy', texture: 'human:hatch'}, options: {texture: {spacing: 28}}});
    const {strokes, bytes, timing} = deck.maps.m.made.strokes;
    expect({strokes, bytes}).toEqual({strokes: 31, bytes: defs.length});
    expect(timing).toBe(STROKE_TIMING);
  });

  it('named without the human door\'s choices it is refused, saying where they are: the deck hands in HUMAN_STYLE_CHOICES', () => {
    expect(isoDrawn(MAP('look: sketchy'), {canvas}).made.style.look).toBe('sketchy');
    expect(() => isoStyle({look: 'sketchy'})).toThrow('hand in HUMAN_STYLE_CHOICES');
  });

  it('within the stroke budget: the still\'s map and the kit\'s 64-block case draw under the note (2000 strokes, 2 MB), and no note fires', () => {
    const small = deckOf('look: sketchy');
    expect(small.maps.m.made.strokes.strokes).toBeLessThan(STROKES_NOTE.strokes);
    expect(checkDeck(compileDeck(sourceOf({clicks: '<section data-label="S" data-map="m"><step data-in="*"><h2>A</h2><aside class="notes">Said.</aside></step></section>', maps: {m: MAP('look: sketchy')}})))).toEqual([]);
    const deck = sixtyFour('look: sketchy'), {strokes, bytes} = deck.maps.m.made.strokes;
    expect(strokes).toBe(1152);
    expect(strokes).toBeLessThan(STROKES_NOTE.strokes);
    expect(bytes).toBeLessThan(STROKES_NOTE.bytes);
    expect(checkDeck(deck).filter((p) => p.rule === 'strokes')).toEqual([]);
  }, 60_000);
});

// ─── size: a grain's marks drawn once a page ─────────────────────────────────────────────────────────────────────
/** 64 blocks on an 8 × 8 floor of places, at a film's tile (96 px), told in five clicks: the kit's budget case. */
function sixtyFour(style, size = 2) {
  const blocks = [];
  for (let r = 0; r < 8; r += 1) for (let c = 0; c < 8; c += 1) blocks.push(`<div data-k="b${r}${c}" data-iso="block" data-at="${c * (size + 1)} ${r * (size + 1)}" data-size="${size} ${size} ${size / 2}"></div>`);
  const map = `<i data-iso-grid="96 at 960 60"></i>${style ? `<i data-style="${style}"></i>` : ''}${blocks.join('\n')}`;
  const clicks = `<section data-label="S" data-map="m">${Array.from({length: 5}, (_, i) => `<step data-in="*"><h2>C${i}</h2></step>`).join('')}</section>`;
  return compileDeck(sourceOf({clicks, maps: {m: map}}));
}

describe('looks · a grain\'s marks are drawn once a page, not once a click', () => {
  it('the 64-block grain map: a click carries one <use> a block — 246 KB a click written in place, now under 44 KB', () => {
    const deck = sixtyFour('look: paper-grain'), plain = sixtyFour(null), defs = Object.values(deck.strokeDefs).join('');
    expect(deck.maps.m.made.strokes).toEqual({strokes: 0, marks: 8867, bytes: defs.length});
    expect(defs.length).toBeGreaterThan(200_000);
    expect(defs.length).toBeLessThan(215_000);
    for (const [i, slide] of deck.slides.entries()) {
      expect(slide.html.match(/<use href="#sd-st-/g)).toHaveLength(64);
      expect(slide.html).not.toContain('class="iso-grain');
      expect(slide.html.length).toBeLessThan(44_000);
      expect(slide.html.length).toBeLessThan(plain.slides[i].html.length + 16_000);
      // written in place, as 0.39.0 wrote a map's lines, the click is the marks and all
      expect(inlineStrokes(slide.html, deck.strokeDefs).length).toBeGreaterThan(240_000);
    }
    expect(plain.slides[0].html.length).toBeLessThan(29_000);
    // the page holds them once; under the note's 2 MB, so no note
    const page = deckPage(deck, pageAssets());
    expect(page.match(/<svg data-sd-strokes /g)).toHaveLength(1);
    expect(page.length).toBeLessThan(deckPage(plain, pageAssets()).length + defs.length + 80_000);
    expect(checkDeck(deck).filter((p) => p.rule === 'strokes')).toEqual([]);
  });

  it('the budget counts marks by their bytes: a map past 2 MB of them is noted, naming the grain\'s fix', () => {
    const deck = sixtyFour('texture: human:grain spacing 4', 4);
    const s = deck.maps.m.made.strokes;
    expect(s.bytes).toBeGreaterThan(2_000_000);
    expect(checkDeck(deck).filter((p) => p.rule === 'strokes')).toEqual([{level: 'info', rule: 'strokes', click: 1, label: 'S · 1', message: `map "m": it draws ${s.marks} texture marks in ${(s.bytes / 1e6).toFixed(1)} MB of the page (drawn once, every click reuses them), past the 2000 strokes or 2.0 MB a map is noted at (ours) — the page opens and prints slower; a wider grain spacing ("texture: human:grain spacing 32") draws fewer`}]);
  }, 60_000);

  it('deck-data.json writes the marks back in each section; a page with no texture is as before', () => {
    const dir = tempDeck({'deck.json': '{"title":"T","deckData":"deck-data.json"}', 'clicks.html': '<section data-label="S" data-map="map"><step data-in="*"><h2>A</h2></step></section>', 'map.html': MAP('look: paper-grain')});
    const r = buildDeck(dir), data = JSON.parse(readFileSync(r.data, 'utf8'));
    expect(readFileSync(r.file, 'utf8')).toContain('<svg data-sd-strokes ');
    expect(data.sections[0].html).not.toContain('<use ');
    expect(data.sections[0].html).toContain('<path class="iso-grain"');
    const plain = deckOf(null);
    expect(plain).not.toHaveProperty('strokeDefs');
    expect(plain).not.toHaveProperty('looks');
  });
});

describe('looks · the record and the stills', () => {
  it('log --why style --map names the look the map was drawn in, from the run\'s own map flow', async () => {
    const home = tempDir(), dir = tempDeck({'deck.json': '{"title":"T"}', 'map.html': MAP('look: duotone'), 'clicks.html': '<section data-label="M" data-map="map"><step data-in="*"><h2>Them</h2></step></section>'});
    const r = await runDeck(dir, {home});
    expect(r.maps.runs[0].differs).toBeUndefined();
    const said = await logTool(dir, {home, run: '1', why: 'style', map: 'map'});
    expect(said.split('\n')[0]).toBe('style = {"row":{"shape":"box","shading":"tones","line":"ink","palette":"duotone","texture":"none","effects":[]},"options":{},"look":"duotone"}');
  }, 60_000);

  for (const look of LOOKS) {
    it(`a still of each look, byte for byte: ${look}`, () => {
      // no names: the still holds no words, so no font of the host's
      const map = MAP(`look: ${look}`).replace(/<b>[^<]*<\/b>/g, '').replace(' data-label="Production"', '');
      const {html, strokeDefs} = isoDrawn(map, {canvas});
      const still = `<!doctype html>\n<meta charset="utf-8">\n<title>look: ${look} — a StoryDeck map in footprint-story's look</title>\n<style>${ISO_CSS}\n${LOOK_CSS}</style>\n${strokesSvg(strokeDefs)}\n<section data-label="still" style="position:relative;width:1920px;height:1080px;background:#fff">\n${html}\n</section>\n`;
      const file = path.join(process.cwd(), `deck/test/look-${look}-still.html`);
      if (process.env.STORYDECK_WRITE_STILLS === '1') writeFileSync(file, still);
      expect(still).toBe(readFileSync(file, 'utf8'));
    });
  }
});
