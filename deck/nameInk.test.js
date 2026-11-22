// A map's words measured against what they stand on, at build (0.41.0): footprint-story's readableInk, one rule for
// StoryDeck and StoryReel, on the page's own CSS (nameInk.js) — and a name that does not read is a finding with its fix
// (check · name-ink), never a silent pass. The page itself is not changed by the measure.
// @vitest-environment node
import {describe, it, expect} from 'vitest';
import {readdirSync, readFileSync} from 'node:fs';
import path from 'node:path';
import {readableInk, contrastRatio} from 'footprint-story/isometric';
import {colour, hexOf, inkMessage, inksFound, over, pagesOf, rootTokens, ruleOf} from './nameInk.js';
import {WORDS_CSS, ISO_CSS, FLOOR_LABEL_CSS} from './iso.js';
import {compileDeck} from './compile.js';
import {checkDeck} from './check.js';
import {deckPage} from './page.js';
import {pageAssets} from './assets.js';
import {sourceOf} from './test/helpers.js';

const BLOCK = (attrs = '', small = true) => `<div data-k="server" data-iso="block" data-at="1 1" data-size="2 2 1.4"${attrs}><b>Server</b>${small ? '<small>an API</small>' : ''}</div>`;
const MAP = (block, {style = null, floor = ''} = {}) => `<i data-iso-grid="120 at 960 240"></i>${style ? `<i data-style="${style}"></i>` : ''}
<div data-k="floor" data-iso="floor" data-size="8 5" data-label="Production"${floor}></div>
${block}
<div data-k="db" data-iso="cylinder" data-at="5 1" data-size="1.6 1.6 1.2"><b>Database</b></div>`;
const CLICKS = '<section data-label="S" data-map="m"><step data-in="*"><h2>A</h2><aside class="notes">Said.</aside></step></section>';
const deckOf = (map, {look = true, theme = ''} = {}) => compileDeck(sourceOf({deck: {title: 'T', ...(look ? {look: 'base'} : {})}, clicks: CLICKS, maps: {m: map}, theme}));
const inkProblems = (deck) => checkDeck(deck).filter((p) => p.rule === 'name-ink');

describe('nameInk · what the build reads', () => {
  it('every piece with words is collected as it is drawn: its words, its face as written, its own properties and classes', () => {
    const deck = deckOf(MAP(BLOCK(' class="bad" style="--iso-line:#000000"'), {floor: ' style="--iso-floor:#eeeeee"'}));
    const [floor, server, db] = deck.maps.m.faces;
    expect(floor).toMatchObject({name: 'floor', kind: 'floor', words: ['label'], face: null, vars: {'--iso-floor': '#eeeeee'}, paper: false});
    expect(server).toMatchObject({name: 'server', kind: 'block', words: ['name', 'small'], face: null, vars: {'--iso-line': '#000000'}, paper: false});
    expect(server.classes).toContain('bad');
    expect(db).toMatchObject({name: 'db', kind: 'cylinder', words: ['name'], face: null, vars: {}, paper: false});
    expect(db.classes).not.toContain('bad');
    // a paper map's face is the page's paper, as written
    expect(deckOf(MAP(BLOCK(), {style: 'look: line-art'})).maps.m.faces[1]).toMatchObject({face: 'var(--iso-paper, #ffffff)', paper: true});
    // a map with no words has none
    expect(deckOf('<div data-k="b" data-iso="block" data-at="1 1"></div>').maps.m).not.toHaveProperty('faces');
  });

  it('the words\' colours are the page\'s own expressions: ISO_CSS and FLOOR_LABEL_CSS are written from WORDS_CSS', () => {
    expect(ruleOf(ISO_CSS, '.iso-top)').fill).toBe(WORDS_CSS.top);
    expect(ruleOf(ISO_CSS, '.iso-ground)').fill).toBe(WORDS_CSS.ground);
    expect(ruleOf(ISO_CSS, '.iso-say) {').color).toBe(WORDS_CSS.name);
    expect(ruleOf(ISO_CSS, '.iso-say small)').color).toBe(WORDS_CSS.small);
    expect(ruleOf(FLOOR_LABEL_CSS, '.iso-floor-label)').color).toBe(WORDS_CSS.label);
  });

  it('the page\'s tokens: the look\'s, then theme.css\'s on :root and :root.dark (top-level rules only), the slide from deck.css', () => {
    const theme = ':root { --sd-bad: #f4c7c3; } /* :root { --fg: #000000; } */ @media print { :root { --bg: #000000; } } :root.dark { --bg: #000010; } .x { --fg: #ff0000; }';
    expect(rootTokens(theme)).toEqual({light: {'--sd-bad': '#f4c7c3'}, dark: {'--bg': '#000010'}});
    const pages = pagesOf({config: {look: 'base'}, themeCss: theme});
    expect(pages.light.vars).toMatchObject({'--sd-bad': '#f4c7c3', '--bg': '#f5f7fa'});
    expect(pages.dark.vars).toMatchObject({'--sd-bad': '#f4c7c3', '--bg': '#000010', '--fg': '#e9eef4'});
    expect(hexOf(pages.light.slide)).toBe('#f5f7fa');
    expect(pages.light.tones).toEqual([['ok', 'var(--sd-ok)'], ['warn', 'var(--sd-warn)'], ['bad', 'var(--sd-bad)']]);
    // no look: no tokens, the fallbacks, and no tone classes
    expect(pagesOf({config: {look: null}, themeCss: ''})).toMatchObject({light: {vars: {}, tones: []}, dark: {vars: {}, tones: []}});
  });

  it('colours as the screen holds them: a byte a channel, read by footprint-story\'s readableInk', () => {
    expect(hexOf(colour('color-mix(in srgb, var(--fg, #14181f) 72%, transparent)', {}))).toBe('#14181f');
    expect(hexOf(over(colour('color-mix(in srgb, #14181f 72%, transparent)', {}), [255, 255, 255, 1]))).toBe('#56595e');
    expect(() => colour('rgb(1, 2, 3)', {})).toThrow('no colour "rgb(1, 2, 3)"');
    expect(() => colour('var(--a)', {'--a': 'var(--a)'})).toThrow('runs round');
  });

  it('one rule for both tools: no luminance or contrast formula of StoryDeck\'s own anywhere in its source or tests', () => {
    const files = (dir) => readdirSync(dir, {withFileTypes: true}).flatMap((e) => (e.isDirectory() ? (['node_modules', 'dist', '.git'].includes(e.name) ? [] : files(path.join(dir, e.name))) : /\.(m?js|jsx)$/.test(e.name) ? [path.join(dir, e.name)] : []));
    const own = files(process.cwd()).filter((f) => /0\.2126|0\.7152|\.04045|\.03928/.test(readFileSync(f, 'utf8')) && !f.endsWith('nameInk.test.js'));
    expect(own).toEqual([]);
  });
});

describe('nameInk · every look reads, and a name that does not is a finding', () => {
  it('reads clean: every look on the base look\'s pages, a map with no look, and a deck with no look of its own', () => {
    for (const style of [null, 'look: outlined', 'look: line-art', 'look: paper-grain', 'look: duotone', 'look: sketchy']) {
      for (const look of [true, false]) expect(inksFound(deckOf(MAP(BLOCK(), {style}), {look})), `${style} ${look}`).toEqual([]);
    }
  });

  it('the base look\'s "bad" block: its name 4.4 : 1 on a light page — a warn with the ink that reads, at the click that shows it', () => {
    const deck = deckOf(MAP(BLOCK(' class="bad"', false)));
    const [found] = inksFound(deck);
    expect(found).toEqual({map: 'm', name: 'server', kind: 'block', word: 'name', tone: 'bad', on: [{page: 'light', ratio: 4.4, face: '#cd5b55'}], fix: {variable: '--iso-ink', ink: '#000000'}});
    // it is readableInk's own verdict on the face as drawn
    expect(readableInk('#cd5b55', ['#14181f'])).toMatchObject({ink: '#14181f', reads: false});
    expect(contrastRatio('#14181f', '#cd5b55')).toBeCloseTo(4.43, 2);
    expect(inkProblems(deck)).toEqual([{level: 'warn', rule: 'name-ink', click: 1, label: 'S · 1', message: '"server": its name stands 4.4 : 1 on its block\'s top (#cd5b55, class "bad") on a light page, under the 4.5 : 1 words need to read — write its ink beside it (style="--iso-ink:#000000"), or give the block a lighter colour (--iso-color), or another class than "bad"'}]);
    // the fix it names clears it
    expect(inksFound(deckOf(MAP(BLOCK(' class="bad" style="--iso-ink:#000000"', false))))).toEqual([]);
  });

  it('a <small> line on any of the look\'s tones stands about 3 : 1 on a light page: said, and no ink fixes it, only a lighter face', () => {
    const found = (cls) => inksFound(deckOf(MAP(BLOCK(` class="${cls}"`)))).map(({word, on, fix}) => [word, on.map((o) => `${o.page} ${o.ratio}`).join(', '), fix]);
    expect(found('ok')).toEqual([['small', 'light 3', null]]);
    expect(found('warn')).toEqual([['small', 'light 3', null]]);
    expect(found('bad')).toEqual([['name', 'light 4.4', null], ['small', 'light 2.9', null]]);
    // with no look the classes colour nothing: the usual face, and the words read
    expect(inksFound(deckOf(MAP(BLOCK(' class="bad"')), {look: false}))).toEqual([]);
    // a theme.css that lightens the tone clears it
    expect(inksFound(deckOf(MAP(BLOCK(' class="bad"')), {theme: ':root { --sd-bad: #f4c7c3; }'}))).toEqual([]);
  });

  it('a dark colour of the deck\'s own: on both pages, with the light ink as its fix; a floor\'s dark ground the same, by --iso-label', () => {
    const [name] = inksFound(deckOf(MAP(BLOCK(' style="--iso-color:#333333"', false))));
    expect(name).toMatchObject({word: 'name', on: [{page: 'light', face: '#5c5c5c'}, {page: 'dark', face: '#5c5c5c'}], fix: {variable: '--iso-ink', ink: '#ffffff'}});
    expect(inkMessage(name)).toBe('"server": its name stands 2.6 : 1 on its block\'s top (#5c5c5c) on a light page and 2.6 : 1 (#5c5c5c) on a dark one, under the 4.5 : 1 words need to read — write its ink beside it (style="--iso-ink:#ffffff"), or give the block a lighter colour (--iso-color)');
    const [label] = inksFound(deckOf(MAP(BLOCK('', false), {floor: ' style="--iso-floor:#15202b"'})));
    expect(label).toMatchObject({name: 'floor', kind: 'floor', word: 'label', fix: {variable: '--iso-label', ink: '#ffffff'}});
    // on the dark page the label takes the page's light ink, and reads: said for the light page alone
    expect(inkMessage(label)).toBe('"floor": its label stands 1 : 1 on its floor (#15202b) on a light page, under the 4.5 : 1 words need to read — write its ink beside it (style="--iso-label:#ffffff"), or give the floor a lighter ground (--iso-floor)');
  });

  it('only a dark page: a theme.css whose dark tone is dark is said on the dark page alone', () => {
    const found = inksFound(deckOf(MAP(BLOCK(' class="ok"', false)), {theme: ':root.dark { --sd-ok: #0b3d1e; }'}));
    expect(found.map((f) => f.on.map((o) => o.page))).toEqual([['dark']]);
  });

  it('a colour the build cannot read is said as advice, never passed', () => {
    const deck = deckOf(MAP(BLOCK(' style="--iso-color:rgb(10, 20, 30)"', false)));
    expect(inkProblems(deck)).toEqual([expect.objectContaining({level: 'info', message: '"server": the build cannot measure whether its words read on its block\'s top (no colour "rgb(10, 20, 30)") — write its colours as #rrggbb, var() or color-mix(in srgb, …) to have them measured'})]);
  });

  it('the measure adds nothing to the page: the finding is the check\'s, the page draws the deck as written', () => {
    const deck = deckOf(MAP(BLOCK(' class="bad"')));
    const page = deckPage(deck, pageAssets());
    expect(page).not.toContain('name-ink');
    expect(page).not.toContain('--iso-ink:#000000');
    expect(deck.slides[0].html).toContain('class="iso bad sd');
  });
});
