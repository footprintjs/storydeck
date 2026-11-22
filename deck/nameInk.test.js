// A map's words measured against what they stand on, at build (0.41.0): footprint-story's readableInk, one rule for
// StoryDeck and StoryReel, on the page's own CSS (nameInk.js) — and a name that does not read is a finding with its fix
// (check · name-ink), never a silent pass. The page itself is not changed by the measure.
// @vitest-environment node
import {describe, it, expect} from 'vitest';
import {readdirSync, readFileSync} from 'node:fs';
import path from 'node:path';
import {readableInk, contrastRatio, deltaE76} from 'footprint-story/isometric';
import {colour, hexOf, inkMessage, inksFound, over, pagesOf, rootTokens, ruleOf, wordOn} from './nameInk.js';
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
/**
 * What the base look's own tones draw, light and dark (0.42.0): each top face, its name's and <small> line's ratio. The
 * faces are 0.41.0's; the ratios were, in #14181f and #14181f at 68 %: light none 14.55 / 5.60, ok 4.88 / 3.09, warn
 * 4.73 / 3.05, bad 4.43 / 2.98; dark ok 10.76 / 4.86, warn 11.15 / 4.99, bad 9.42 / 4.58 (none as light).
 */
const TONES_READ = {
  'none light': '#e1e9f5 name 17.18 small 12.86', 'none dark': '#e1e9f5 name 17.18 small 12.86',
  'ok light': '#489565 name 5.76 small 5.07', 'ok dark': '#7bdda1 name 12.70 small 10.11',
  'warn light': '#a57d33 name 5.58 small 4.90', 'warn dark': '#f5c57b name 13.16 small 10.41',
  'bad light': '#cd5b55 name 5.22 small 4.64', 'bad dark': '#ffa59d name 11.12 small 9.01',
};
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
  it('reads clean: the 48 test pages — every look and a map with no look, no tone and each of the base look\'s three, with and without the base look', () => {
    for (const style of [null, 'look: outlined', 'look: line-art', 'look: paper-grain', 'look: duotone', 'look: sketchy']) {
      for (const tone of ['', ' class="ok"', ' class="warn"', ' class="bad"']) {
        for (const look of [true, false]) {
          const deck = deckOf(MAP(BLOCK(tone), {style}), {look});
          expect(inksFound(deck), `${style}${tone} ${look}`).toEqual([]);
          expect(inkProblems(deck), `${style}${tone} ${look}`).toEqual([]);
        }
      }
    }
  });

  it('the base look\'s own tones read (0.42.0): every tone × theme, a block\'s name and its <small> line, reads: true, and the status faces stay apart', () => {
    // 0.41.0 found a "bad" name at 4.4 : 1 and every tone's <small> line at about 3 : 1 on a light page. The words' ink
    // is black now (iso.js · WORDS_INK), the <small> line that ink at 85 %; the faces, and so the status colours, did not move.
    const pages = pagesOf({config: {look: 'base'}, themeCss: ''});
    const got = {};
    for (const tone of ['none', 'ok', 'warn', 'bad']) {
      const piece = deckOf(MAP(BLOCK(tone === 'none' ? '' : ` class="${tone}"`))).maps.m.faces[1];
      for (const page of ['light', 'dark']) {
        const [name, small] = ['name', 'small'].map((word) => wordOn(piece, word, pages[page]));
        expect([name, small], `${tone} ${page}`).toEqual([expect.objectContaining({reads: true}), expect.objectContaining({reads: true})]);
        expect(readableInk(name.face, [name.ink])).toEqual({ink: name.ink, ratio: name.ratio, reads: true});
        got[`${tone} ${page}`] = `${name.face} name ${name.ratio.toFixed(2)} small ${small.ratio.toFixed(2)}`;
      }
    }
    expect(got).toEqual(TONES_READ);
    // apart at a glance: the floor footprint-story keeps between status faces (ΔE76 over 10), on each page
    for (const page of ['light', 'dark']) {
      const face = (tone) => got[`${tone} ${page}`].slice(0, 7);
      for (const [x, y] of [['ok', 'warn'], ['ok', 'bad'], ['warn', 'bad'], ['none', 'ok'], ['none', 'warn'], ['none', 'bad']]) expect(deltaE76(face(x), face(y)), `${page} ${x}/${y}`).toBeGreaterThan(10);
    }
    expect(deltaE76('#f5c57b', '#ffa59d')).toBeCloseTo(35.5, 1);   // the nearest pair, warn and bad on a dark page (41.8 on a light one)
  });

  it('a theme\'s own dark tone: a "bad" block\'s name 2.6 : 1 on both pages — a warn with the ink that reads, at the click that shows it', () => {
    const theme = ':root { --sd-bad: #5a0f0b; }';
    const deck = deckOf(MAP(BLOCK(' class="bad"', false)), {theme});
    const [found] = inksFound(deck);
    expect(found).toEqual({map: 'm', name: 'server', kind: 'block', word: 'name', tone: 'bad', on: [{page: 'light', ratio: 2.6, face: '#7b3f3c'}, {page: 'dark', ratio: 2.6, face: '#7b3f3c'}], fix: {variable: '--iso-ink', ink: '#ffffff'}});
    // it is readableInk's own verdict on the face as drawn
    expect(readableInk('#7b3f3c', ['#000000'])).toMatchObject({ink: '#000000', reads: false});
    expect(contrastRatio('#000000', '#7b3f3c')).toBeCloseTo(2.62, 2);
    expect(inkProblems(deck)).toEqual([{level: 'warn', rule: 'name-ink', click: 1, label: 'S · 1', message: '"server": its name stands 2.6 : 1 on its block\'s top (#7b3f3c, class "bad") on a light page and 2.6 : 1 (#7b3f3c) on a dark one, under the 4.5 : 1 words need to read — write its ink beside it (style="--iso-ink:#ffffff"), or give the block a lighter colour (--iso-color), or another class than "bad"'}]);
    // the fix it names clears it
    expect(inksFound(deckOf(MAP(BLOCK(' class="bad" style="--iso-ink:#ffffff"', false)), {theme}))).toEqual([]);
  });

  it('a theme\'s own mid tone: its name and <small> line read in neither ink: said, and no ink fixes it, only a lighter face', () => {
    const found = (theme) => inksFound(deckOf(MAP(BLOCK(' class="bad"')), {theme})).map(({word, on, fix}) => [word, on.map((o) => `${o.page} ${o.ratio}`).join(', '), fix]);
    expect(found(':root { --sd-bad: #a8231d; }')).toEqual([['name', 'light 4.2, dark 4.2', null], ['small', 'light 3.8, dark 3.8', null]]);
    // with no look the classes colour nothing: the usual face, and the words read
    expect(inksFound(deckOf(MAP(BLOCK(' class="bad"')), {look: false, theme: ':root { --sd-bad: #a8231d; }'}))).toEqual([]);
    // a theme.css that lightens the tone clears it
    expect(found(':root { --sd-bad: #f4c7c3; }')).toEqual([]);
  });

  it('a dark colour of the deck\'s own: on both pages, with the light ink as its fix; a floor\'s dark ground the same, by --iso-label', () => {
    const [name] = inksFound(deckOf(MAP(BLOCK(' style="--iso-color:#333333"', false))));
    expect(name).toMatchObject({word: 'name', on: [{page: 'light', face: '#5c5c5c'}, {page: 'dark', face: '#5c5c5c'}], fix: {variable: '--iso-ink', ink: '#ffffff'}});
    expect(inkMessage(name)).toBe('"server": its name stands 3.1 : 1 on its block\'s top (#5c5c5c) on a light page and 3.1 : 1 (#5c5c5c) on a dark one, under the 4.5 : 1 words need to read — write its ink beside it (style="--iso-ink:#ffffff"), or give the block a lighter colour (--iso-color)');
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
