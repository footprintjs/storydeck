// A map in a look on a DARK page (0.40.0). A page is light or dark when it is viewed (T, the saved choice, else the
// system), so no build hands the kit the dark page's colours: they reach the map by one route, the page's variables
// (iso.js · LOOK_CSS; isoPaint.js · pagePaper, inkOf). Every look and every combination of the columns a look writes
// is measured here in both themes, from the built page's own CSS (test/pageColours.js · measure): a block's name and
// the floor's label against what they stand on, a block's edge, a contour against the page, a wire's label on its
// plate, and the highlight ring round a block and along a floor. Each must read; the four looks and the combinations a
// review found lost are pinned to the tenth.
// @vitest-environment node
import {describe, it, expect} from 'vitest';
import {buildIsoMap} from 'footprint-story/isometric';
import {HUMAN_STYLE_CHOICES} from 'footprint-story/human';
import {ISO_CSS, LOOK_CSS} from './iso.js';
import {paperOf} from './isoPaint.js';
import {DECK} from './isoSpec.js';
import {compileDeck} from './compile.js';
import {deckPage} from './page.js';
import {pageAssets} from './assets.js';
import {sourceOf} from './test/helpers.js';
import {colour, measure, over, ratio, ruleOf, tokens} from './test/pageColours.js';

/** A labelled floor, a block, a cylinder and a labelled request wire between them, in a style. */
const MAP = (style) => `<i data-iso-grid="120 at 960 240"></i>${style ? `<i data-style="${style}"></i>` : ''}
<div data-k="floor" data-iso="floor" data-size="8 5" data-label="Production"></div>
<div data-k="server" data-iso="block" data-at="1 1" data-size="2 2 1.4"><b>Server</b></div>
<div data-k="db" data-iso="cylinder" data-at="5 1" data-size="1.6 1.6 1.2"><b>Database</b></div>
<i data-k="w" class="wire req" data-arrow="server to db" data-label="SQL"></i>`;
const deckOf = (style) => compileDeck(sourceOf({clicks: '<section data-label="S" data-map="m"><step data-in="*"><h2>A</h2></step></section>', maps: {m: MAP(style)}}));
const both = (style) => { const deck = deckOf(style); return {light: measure(deck, 'light'), dark: measure(deck, 'dark')}; };

/** Every row the look columns make: shading × line × palette × texture, less those the kit refuses (a texture beside a duotone). */
const COMBINATIONS = ['tones', 'paper'].flatMap((shading) => ['ink', 'contour', 'human:sketchy'].flatMap((line) => ['theme', 'duotone'].flatMap((palette) => ['none', 'human:grain', 'human:hatch']
  .filter((texture) => palette === 'theme' || texture === 'none').map((texture) => `shading: ${shading}; line: ${line}; palette: ${palette}; texture: ${texture}`))));
const LOOKS = ['look: outlined', 'look: line-art', 'look: paper-grain', 'look: duotone'];
/** The combinations a review found lost on a dark page before every look colour took the page's route. */
const FOUND = ['look: line-art; palette: duotone', 'look: duotone; shading: paper', 'shading: paper; palette: duotone', 'look: outlined; palette: duotone'];

/** Each measure read as a reader needs it: words 4.5 : 1 (WCAG, small text), lines, edges and rings 3 : 1 (non-text). */
function reads(style, {light, dark}) {
  for (const [mode, c] of Object.entries({light, dark})) {
    const at = `${style} · ${mode}`;
    expect(c.name, `${at} · name`).toBeGreaterThanOrEqual(4.5);
    expect(c.label, `${at} · floor label`).toBeGreaterThanOrEqual(4.5);
    expect(c.cable, `${at} · cable label`).toBeGreaterThanOrEqual(4.5);
    expect(c.line, `${at} · line`).toBeGreaterThanOrEqual(3);
    if ('edge' in c) expect(c.edge, `${at} · contour`).toBeGreaterThanOrEqual(3);
    expect(c.ring, `${at} · block ring`).toBeGreaterThanOrEqual(3);
    expect(c.floorRing, `${at} · floor ring`).toBeGreaterThanOrEqual(3);
  }
}

describe('looks on a dark page · LOOK_CSS, the one route', () => {
  it('under :root.dark a paper map takes the page\'s paper and ink (its own lines\' colours too), every contour the page\'s ink — with the page\'s own fallbacks', () => {
    expect(LOOK_CSS).toContain(':where(:root.dark section[data-label] [data-sd-paper]) { --iso-paper: var(--bg-elev, #ffffff); --iso-ink: var(--fg, #14181f); --sd-ink: var(--fg, #14181f); }');
    expect(LOOK_CSS).toContain(':where(:root.dark section[data-label] [data-sd-iso]) { --sd-contour: var(--fg, #14181f); }');
    expect(LOOK_CSS).toContain(':where(:root.dark section[data-label] .iso-contour) { stroke: var(--fg, #14181f); }');
    const page = (style) => deckPage(deckOf(style), pageAssets());
    for (const style of [...LOOKS.slice(0, 2), ...FOUND]) expect(page(style), style).toContain(LOOK_CSS);
    expect(page('look: duotone')).not.toContain(LOOK_CSS);
    expect(page(null)).not.toContain(LOOK_CSS);
    expect(page(null)).not.toContain('data-sd-paper');
  });

  it('a look\'s own colour is written by the route, never as a bare colour an inline style would hold against the page', () => {
    // a paper map's duotone lines: the paper's ink; a duotone contour: the contour's; elsewhere the duotone's ink as given
    expect(deckOf('look: line-art; palette: duotone').slides[0].html).toContain('style="stroke:var(--sd-ink, #22304a);');
    expect(deckOf('look: outlined; palette: duotone').slides[0].html).toContain('<polygon class="iso-contour" style="stroke:var(--sd-contour, #22304a);');
    expect(deckOf('look: duotone').slides[0].html).toContain('style="stroke:#22304a;');
    for (const style of [...COMBINATIONS, ...FOUND]) {
      const html = deckOf(style).slides[0].html;
      if (html.includes(' data-sd-paper')) expect(html, style).not.toMatch(/(?:fill|stroke):#/);
      expect(html, style).not.toMatch(/class="iso-contour" style="stroke:#/);
    }
  });

  it('a paper map whose faces would come out in two colours is refused: a dark page gives it one paper', () => {
    const style = {row: {shading: 'paper'}, options: {}};
    const face = (colour) => ({item: 'polygon', role: 'top', fill: {mix: [colour, 1], colour}, stroke: null});
    expect(paperOf(style, [[face('#ffffff'), face('#ffffff')]])).toBe('#ffffff');
    expect(() => paperOf(style, [[face('#ffffff')], [face('#f0e0d0')]])).toThrow('data-style: this paper map\'s faces come out in 2 colours (#ffffff, #f0e0d0), and a dark page gives a paper map its one paper — write the shading "tones", or take out what colours the paper');
    expect(paperOf({row: {shading: 'tones'}}, [[face('#f0e0d0')]])).toBeNull();
  });
});

describe('looks on a dark page · every combination reads, in both themes', () => {
  it(`all ${COMBINATIONS.length} rows of the look columns, the four looks and the combinations a review found: words, lines, contours, cable labels and rings`, () => {
    for (const style of [...COMBINATIONS, ...LOOKS, ...FOUND]) reads(style, both(style));
  }, 60_000);

  it('the four looks and the combinations a review found, pinned (measured; Chromium\'s computed styles on these built pages agree)', () => {
    const said = (c) => Object.entries(c).map(([k, v]) => `${k} ${v}`).join(', ');
    const got = Object.fromEntries([...LOOKS, ...FOUND].map((style) => { const {light, dark} = both(style); return [style, {light: said(light), dark: said(dark)}]; }));
    expect(got).toEqual({
      'look: outlined': {light: 'name 14.6, label 6.3, line 14.6, edge 16.6, cable 15.4, ring 3.5, floorRing 3.5', dark: 'name 14.6, label 8.6, line 14.6, edge 16, cable 16, ring 5, floorRing 5'},
      'look: line-art': {light: 'name 17.8, label 6.5, line 17.8, edge 16.6, cable 15.4, ring 3.5, floorRing 3.8', dark: 'name 14.5, label 8.1, line 14.5, edge 16, cable 16, ring 5, floorRing 4.5'},
      'look: paper-grain': {light: 'name 14.6, label 6.3, line 14.6, cable 15.4, ring 3.5, floorRing 3.5', dark: 'name 14.6, label 8.6, line 14.6, cable 16, ring 5, floorRing 5'},
      'look: duotone': {light: 'name 14.6, label 6.3, line 10.8, cable 15.4, ring 3.5, floorRing 3.5', dark: 'name 14.6, label 8.6, line 10.8, cable 16, ring 5, floorRing 5'},
      'look: line-art; palette: duotone': {light: 'name 17.8, label 6.5, line 13.2, edge 12.3, cable 15.4, ring 3.5, floorRing 3.8', dark: 'name 14.5, label 8.1, line 14.5, edge 16, cable 16, ring 5, floorRing 4.5'},
      'look: duotone; shading: paper': {light: 'name 17.8, label 6.5, line 13.2, cable 15.4, ring 3.5, floorRing 3.8', dark: 'name 14.5, label 8.1, line 14.5, cable 16, ring 5, floorRing 4.5'},
      'shading: paper; palette: duotone': {light: 'name 17.8, label 6.5, line 13.2, cable 15.4, ring 3.5, floorRing 3.8', dark: 'name 14.5, label 8.1, line 14.5, cable 16, ring 5, floorRing 4.5'},
      'look: outlined; palette: duotone': {light: 'name 14.6, label 6.3, line 10.8, edge 12.3, cable 15.4, ring 3.5, floorRing 3.5', dark: 'name 14.6, label 8.6, line 10.8, edge 16, cable 16, ring 5, floorRing 5'},
    });
  });

  it('why: with no LOOK_CSS a line-art floor label stood about 1.1 : 1 on a dark page; with inline duotone inks the found combinations were lost', () => {
    const before = (style) => measure(deckOf(style), 'dark', {withLook: false});
    expect(before('look: line-art')).toMatchObject({label: 1.1, edge: 1});
    expect(before('look: outlined')).toMatchObject({edge: 1});
  });

  it('why the duotone alone keeps its inks on a dark page: its faces are the page\'s, light on both, and the page\'s light ink on them would stand about 1 : 1', () => {
    const {dark} = tokens(), d = deckOf('look: duotone');
    const spec = {...d.maps.m.built.spec, style: {palette: {name: 'duotone', paper: dark['--bg-elev'], ink: dark['--fg']}}};
    const top = buildIsoMap(spec, DECK, {choices: HUMAN_STYLE_CHOICES}).paints[0].find((it) => it.role === 'top');
    expect(top.fill.colour).toBeNull();   // a face the page colours is left to it: no paper reaches it
    const face = over(colour(ruleOf(ISO_CSS, '.iso-top)').fill, dark), colour(dark['--bg'], dark));
    expect(Math.round(ratio(colour(top.stroke.colour, dark), face) * 10) / 10).toBe(1);
  });

  it('the rings render on every look: nothing inline on a floor\'s ground or a piece\'s art for the ring\'s rule to lose to', () => {
    for (const style of [...COMBINATIONS, ...LOOKS, ...FOUND]) {
      const html = deckOf(style).slides[0].html;
      for (const ground of html.match(/<polygon class="iso-ground"[^>]*>/g)) expect(ground, style).not.toMatch(/style="[^"]*stroke/);
      for (const art of html.match(/<svg class="iso-art"[^>]*>/g)) expect(art, style).not.toMatch(/style=|filter/);
    }
    expect(ISO_CSS).toContain(':where(section[data-label] .sd-hot[data-sd-iso="floor"] .iso-ground) { stroke: var(--sd-hot, #ef4444); stroke-width: 5px; }');
  });
});
