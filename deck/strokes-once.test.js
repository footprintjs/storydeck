// A map's hand-drawn strokes are drawn ONCE for the page (0.39.0): a hidden <svg data-sd-strokes> holds each run of
// strokes as a <g id>, and every click of the map draws it with a <use>. So a hatched map costs its strokes once, not
// once a click; pages without strokes are byte for byte as before; the Read lenses' deck-data.json writes them back in
// place (each section is shown alone); and a stated budget — a build note past STROKES_NOTE, a refusal past
// STROKES_MOST (isoRules.js, ours) — keeps a map from growing a page without a word.
// @vitest-environment node
import {afterEach, describe, it, expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {isoArt, strokesId, strokesSvg, inlineStrokes, PAGE_LINE} from './isoPaint.js';
import {isoDrawn} from './iso.js';
import {refuseStrokes, mb, STROKES_NOTE, STROKES_MOST} from './isoRules.js';
import {compileDeck} from './compile.js';
import {checkDeck} from './check.js';
import {deckPage} from './page.js';
import {pageAssets} from './assets.js';
import {buildDeck} from './build.js';
import {sourceOf, tempDeck, cleanDecks} from './test/helpers.js';

afterEach(cleanDecks);

const ink = {colour: null, alpha: 1, width: 2, join: 'round', cap: 'butt'};
const stroke = (y) => ({item: 'stroke', role: 'ink', of: 'p', points: [[0, y, 2, 0], [10, y, 2, 1]], fill: null, stroke: ink});
const face = {item: 'polygon', role: 'top', of: 'p', points: [[0, 0], [1, 0], [0, 1]], fill: null, stroke: null};
const ring = (y) => `<path class="iso-ink" stroke="none" style="fill:${PAGE_LINE};fill-rule:nonzero" d="M0 ${y - 1}L10 ${y - 1}L10 ${y + 1}L0 ${y + 1}Z"/>`;

/** 64 hatched, sketched blocks on an 8 × 8 floor of places, told in five clicks: the case a review measured. */
function hatched(style = 'line: human:sketchy; texture: human:hatch') {
  const blocks = [];
  for (let r = 0; r < 8; r += 1) for (let c = 0; c < 8; c += 1) blocks.push(`<div data-k="b${r}${c}" data-iso="block" data-at="${c * 3} ${r * 3}" data-size="2 2 1"></div>`);
  const map = `<i data-iso-grid="60 at 960 60"></i>${style ? `<i data-style="${style}"></i>` : ''}${blocks.join('\n')}`;
  const clicks = `<section data-label="S" data-map="m">${Array.from({length: 5}, (_, i) => `<step data-in="*"><h2>C${i}</h2></step>`).join('')}</section>`;
  return compileDeck(sourceOf({clicks, maps: {m: map}}));
}

describe('strokes once · a run of strokes is drawn once, and used where it is painted', () => {
  it('each run of strokes in a row is one <g id> and one <use>, in its place in the paint order', () => {
    const defs = new Map();
    const art = isoArt([face, stroke(0), stroke(5), face, stroke(9)], {x: 0, y: 0}, {strokes: defs});
    const first = strokesId(ring(0) + ring(5)), second = strokesId(ring(9));
    expect(art).toBe(`<polygon class="iso-top" stroke="none" points="0,0 1,0 0,1"/><use href="#${first}"/><polygon class="iso-top" stroke="none" points="0,0 1,0 0,1"/><use href="#${second}"/>`);
    expect([...defs.entries()]).toEqual([[first, `<g id="${first}">${ring(0)}${ring(5)}</g>`], [second, `<g id="${second}">${ring(9)}</g>`]]);
    // with no collector, the very strokes are written in place
    expect(isoArt([face, stroke(0), stroke(5)], {x: 0, y: 0})).toBe(`<polygon class="iso-top" stroke="none" points="0,0 1,0 0,1"/>${ring(0)}${ring(5)}`);
    // written back, the drawn-once list is the in-place one
    expect(inlineStrokes(art, Object.fromEntries(defs))).toBe(isoArt([face, stroke(0), stroke(5), face, stroke(9)], {x: 0, y: 0}));
  });

  it('a run is named by what it draws: the same strokes the same id, others another; the page\'s <svg> holds each once', () => {
    expect(strokesId(ring(0))).toBe(strokesId(ring(0)));
    expect(strokesId(ring(0))).not.toBe(strokesId(ring(1)));
    expect(strokesId(ring(0))).toMatch(/^sd-st-[0-9a-f]{16}$/);
    expect(strokesId('')).toBe('sd-st-811c9dc501000193');
    const defs = new Map();
    isoArt([stroke(0)], {x: 0, y: 0}, {strokes: defs});
    isoArt([stroke(0)], {x: 0, y: 0}, {strokes: defs});
    expect(defs.size).toBe(1);
    expect(strokesSvg(Object.fromEntries(defs))).toBe(`<svg data-sd-strokes aria-hidden="true" width="0" height="0" style="position:absolute;width:0;height:0;overflow:hidden"><defs><g id="${strokesId(ring(0))}">${ring(0)}</g></defs></svg>`);
    expect(strokesSvg({})).toBe('');
    expect(strokesSvg(undefined)).toBe('');
  });

  it('writing strokes back refuses an id the page does not hold: a stroke never vanishes unseen', () => {
    expect(() => inlineStrokes('<use href="#sd-st-0000000000000000"/>', {})).toThrow('isoPaint: a slide draws strokes "sd-st-0000000000000000", which the page\'s strokes do not hold');
    expect(() => inlineStrokes('<use href="#sd-st-0000000000000000"/>', undefined)).toThrow(/do not hold/);
    expect(inlineStrokes('<use href="#elsewhere"/><b>x</b>', {})).toBe('<use href="#elsewhere"/><b>x</b>');
  });
});

describe('strokes once · the page and its exports', () => {
  it('the 64-block hatched case: each click carries a <use> a piece, the page the strokes once — 1.6 MB a click before, now about 33 KB', () => {
    const deck = hatched(), plain = hatched(null);
    const strokes = deck.maps.m.made.strokes, defs = Object.values(deck.strokeDefs).join('');
    expect(strokes).toMatchObject({strokes: 2112, bytes: defs.length});
    // the strokes are 1.6 MB, drawn once; a click is the plain map's slide and one <use> a run (64: one a block)
    expect(defs.length).toBeGreaterThan(1_500_000);
    expect(defs.length).toBeLessThan(1_700_000);
    for (const [i, slide] of deck.slides.entries()) {
      expect((slide.html.match(/<use href="#sd-st-/g) ?? [])).toHaveLength(64);
      expect(slide.html).not.toContain('class="iso-ink"');
      expect(slide.html.length).toBeLessThan(plain.slides[i].html.length + 6_000);
      expect(slide.html.length).toBeLessThan(34_000);
    }
    // the page: its strokes once, before the stage
    const page = deckPage(deck, pageAssets());
    expect(page.match(/<svg data-sd-strokes /g)).toHaveLength(1);
    expect(page.indexOf('<svg data-sd-strokes ')).toBeLessThan(page.indexOf('<deck-stage '));
    expect(page.length).toBeLessThan(deckPage(plain, pageAssets()).length + defs.length + 40_000);
    // past the note's size: said at the map's first click, with how many, the bytes and the fix
    const said = checkDeck(deck).filter((p) => p.rule === 'strokes');
    expect(said).toEqual([{level: 'info', rule: 'strokes', click: 1, label: 'S · 1', message: `map "m": it draws 2112 hand-drawn strokes in ${mb(strokes.bytes)} of the page (drawn once, every click reuses them), past the 2000 strokes or 2.0 MB a map is noted at (ours) — the page opens and prints slower; a wider hatch spacing ("texture: human:hatch spacing 16") draws fewer`}]);
    // a sketched line alone is under it: no note
    expect(checkDeck(hatched('line: human:sketchy')).filter((p) => p.rule === 'strokes')).toEqual([]);
  });

  it('a page whose maps draw no strokes carries no strokes <svg>, and its slides no <use>', () => {
    const plain = hatched(null), page = deckPage(plain, pageAssets());
    expect(plain).not.toHaveProperty('strokeDefs');
    expect(page).not.toContain('data-sd-strokes');
    expect(plain.slides.some((s) => s.html.includes('<use '))).toBe(false);
    expect(isoDrawn('<div data-k="a" data-iso="block" data-at="0 0"></div>', {canvas: [1920, 1080]})).not.toHaveProperty('strokeDefs');
  });

  it('deck-data.json writes the strokes back in each section: a section is shown alone, away from the page\'s <svg>', () => {
    const map = '<i data-iso-grid="120 at 960 240"></i><i data-style="line: human:sketchy"></i><div data-k="a" data-iso="block" data-at="1 1"></div>';
    const dir = tempDeck({'deck.json': '{"title":"T","deckData":"deck-data.json"}', 'clicks.html': '<section data-label="S" data-map="map"><step data-in="a"><h2>A</h2></step></section>', 'map.html': map});
    const r = buildDeck(dir), data = JSON.parse(readFileSync(r.data, 'utf8')), page = readFileSync(r.file, 'utf8');
    expect(page).toContain('<svg data-sd-strokes ');
    expect(page).toContain('<use href="#sd-st-');
    expect(data.sections[0].html).not.toContain('<use ');
    expect(data.sections[0].html).toContain('<path class="iso-ink" stroke="none" style="fill:');
  });
});

describe('strokes once · the budget (isoRules.js, ours)', () => {
  it('a map is noted past 2000 strokes or 2 MB, and refused past 20000 strokes or 16 MB, naming the fix', () => {
    expect(STROKES_NOTE).toEqual({strokes: 2000, bytes: 2_000_000});
    expect(STROKES_MOST).toEqual({strokes: 20_000, bytes: 16_000_000});
    expect(() => refuseStrokes({strokes: 20_000, bytes: 16_000_000})).not.toThrow();
    const said = 'data-style: this map draws 20001 hand-drawn strokes in 1.0 MB of the page, past the 20000 strokes or 16.0 MB one map may (ours) — give the hatch a wider spacing ("texture: human:hatch spacing 16"), take the texture out, or tell it in two maps';
    expect(() => refuseStrokes({strokes: 20_001, bytes: 1_000_000})).toThrow(said);
    expect(() => refuseStrokes({strokes: 10, bytes: 16_000_001})).toThrow(/draws 10 hand-drawn strokes in 16.0 MB of the page, past the 20000 strokes or 16.0 MB/);
    expect(mb(1_648_152)).toBe('1.6 MB');
  });

  it('a map past the cap is refused at build, in the deck\'s words with the map\'s name; one under it builds', () => {
    // 40 big blocks hatched 4 px apart: about 18.5 MB of strokes, over the 16 MB a map may draw them in
    const blocks = Array.from({length: 40}, (_, i) => `<div data-k="b${i}" data-iso="block" data-at="${(i % 7) * 5} ${Math.floor(i / 7) * 5}" data-size="4 4 3"></div>`).join('');
    const map = (spacing) => `<i data-iso-grid="120 at 960 60"></i><i data-style="line: human:sketchy; texture: human:hatch spacing ${spacing}"></i>${blocks}`;
    const compile = (spacing) => () => compileDeck(sourceOf({clicks: '<section data-label="S" data-map="m"><step data-in="*"><h2>A</h2></step></section>', maps: {m: map(spacing)}}));
    expect(compile(4)).toThrow(/^map "m": data-style: this map draws \d+ hand-drawn strokes in [\d.]+ MB of the page, past the 20000 strokes or 16.0 MB one map may \(ours\) — give the hatch a wider spacing/);
    expect(compile(40)).not.toThrow();
  }, 60_000);
});
