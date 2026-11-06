// @vitest-environment node
import {afterEach, describe, it, expect} from 'vitest';
import {LENS_CSS, LENS_FIRST, lensHtml, readLenses} from './lenses.js';
import {readConfig} from './config.js';
import {compileDeck} from './compile.js';
import {deckPage, deckStyles} from './page.js';
import {pageAssets} from './assets.js';
import {cleanDecks, sourceOf} from './test/helpers.js';

afterEach(cleanDecks);

const CLICKS = `<section data-label="One" data-kicker="The start" data-map="map">
  <step data-in="a" data-on="a"><h2>First &amp; foremost</h2><aside class="notes">Said on the first. [draft]</aside></step>
  <step data-in="b w1" data-on="a w1 b"><h2>Second</h2><aside class="notes">Said on &lt;the&gt; second.</aside></step>
</section>
<section data-label="Two" data-kicker="The end"><p>Plain</p><aside class="notes">Said at the end.</aside></section>`;
const MAP = '<div data-k="a" style="left:100px;top:400px;width:200px;height:150px">A</div><i data-k="w1" class="wire" data-arrow="a to b"></i><div data-k="b" style="left:600px;top:400px;width:200px;height:150px">B</div>';
const deck = (config = {title: 'T', lenses: true}) => compileDeck(sourceOf({deck: config, clicks: CLICKS, maps: {map: MAP}}));
const page = (config) => deckPage(deck(config), pageAssets());

describe('deck.json "lenses"', () => {
  it('is null unless a deck asks', () => {
    expect(readConfig({title: 'T'}).lenses).toBeNull();
    expect(readConfig({title: 'T', lenses: false}).lenses).toBeNull();
  });

  it('true gives the words in English, and a deck in another language must give its own', () => {
    expect(readConfig({title: 'T', lenses: true}).lenses).toEqual({read: 'Read', scroll: 'Scroll', slide: 'Slide'});
    expect(readConfig({title: 'T', lang: 'en-GB', lenses: true}).lenses.read).toBe('Read');
    expect(() => readConfig({title: 'T', lang: 'fr', lenses: true})).toThrow('says Read, Scroll and Slide in English, and the deck is in "fr"');
    expect(readConfig({title: 'T', lang: 'fr', lenses: {read: ' Lire ', scroll: 'Défiler', slide: 'Diapos'}}).lenses.read).toBe('Lire');
  });

  it.each([[1, 'is true, or the three words'], [[], 'is true, or the three words'], [null, 'is true, or the three words'], ['yes', 'is true, or the three words'],
    [{read: 'a', scroll: 'b', slide: 'c', watch: 'd'}, 'has "watch", which it does not know'], [{read: 'a', scroll: 'b'}, '"lenses.slide" is the word for it'], [{read: '', scroll: 'b', slide: 'c'}, '"lenses.read" is the word for it']])('refuses %j', (value, message) => {
    expect(() => readLenses(value, 'en')).toThrow(message);
  });
});

describe('the page', () => {
  it('a deck that does not ask builds byte for byte as before', () => {
    const plain = page({title: 'T'});
    expect(plain).not.toContain('lens-');
    expect(deckStyles(deck({title: 'T'}), pageAssets())).not.toContain('lens-');
  });

  it('one that asks differs only by what it adds, and its slides are the same', () => {
    const asked = page({title: 'T', lenses: true}), plain = page({title: 'T'});
    const slidesOf = (html) => html.slice(html.indexOf('<deck-stage'), html.indexOf('</deck-stage>'));
    expect(slidesOf(asked)).toBe(slidesOf(plain));
    expect(asked).toContain('class="lens-switch"');
    expect(asked).toContain('lens-read');
  });

  it('reads which view the link asks for before the stage starts, as the stage writes over the address', () => {
    const asked = page({title: 'T', lenses: true});
    expect(asked.indexOf(LENS_FIRST)).toBeGreaterThan(0);
    expect(asked.indexOf(LENS_FIRST)).toBeLessThan(asked.indexOf('<deck-stage'));
    expect(page({title: 'T'})).not.toContain("'data-lens'");
  });

  it('marks its first script with the dev server\'s nonce too', () => {
    const dev = deckPage(deck(), pageAssets(), {dev: {client: () => {}, version: 1, token: 't', nonce: 'abc'}});
    expect(dev).toContain(`<script nonce="abc">${LENS_FIRST}`);
  });

  it('comes before the deck\'s theme, so a deck\'s rule wins, and every rule has no weight', () => {
    const css = deckStyles({...deck(), themeCss: '.mine {}'}, pageAssets());
    expect(css.indexOf('lens-switch')).toBeLessThan(css.indexOf('.mine'));
    const selectors = [...LENS_CSS.replace(/\/\*[\s\S]*?\*\//g, '').replace(/@media[^{]+\{/g, '').matchAll(/([^{}]+)\{/g)].map((m) => m[1].trim());
    expect(selectors.length).toBeGreaterThan(10);
    for (const s of selectors) expect(s, s).toMatch(/^:where\(/);
  });
});

describe('its stylesheet', () => {
  it('lets a view stay hidden, whatever display its own rules give it: that rule comes last', () => {
    const rules = LENS_CSS.trim().split('\n');
    expect(rules.at(-1)).toBe(':where(.lens-read[hidden], .lens-scroll[hidden]) { display: none; }');
  });

  it('styles the article\'s own words only, and never the headlines inside a copied slide', () => {
    for (const tag of ['h1', 'h2', 'h3', 'p']) {
      expect(LENS_CSS).not.toMatch(new RegExp(`\\.lens-(read|scroll|part|step) ${tag}\\b`));
    }
    expect(LENS_CSS).toMatch(/\.lens-slide > section\) \{[^}]*font: 400 16px\/normal/);
  });
});

describe('Read and Scroll', () => {
  const html = lensHtml(deck());

  it('switch between the three, in the words given', () => {
    expect(html).toContain('<a href="#read">Read</a><a href="#scroll">Scroll</a><a href="#slide">Slide</a>');
    const own = lensHtml(deck({title: 'T', lang: 'fr', lenses: {read: 'Lire', scroll: 'Défiler', slide: 'Diapos'}}));
    expect(own).toContain('<a href="#read">Lire</a>');
  });

  it('are hidden until asked for', () => {
    expect(html).toContain('<main class="lens-read" hidden>');
    expect(html).toContain('<main class="lens-scroll" hidden>');
  });

  it('Read opens like an article: a title slide gives its words, and no picture repeating the title', () => {
    const titled = '<section data-label="T" data-kicker="K"><div class="title-block"><h1>The title</h1></div><aside class="notes">Opening words.</aside></section>' + CLICKS;
    const out = lensHtml(compileDeck(sourceOf({deck: {title: 'The title', lenses: true}, clicks: titled, maps: {map: MAP}})));
    const read = out.slice(out.indexOf('lens-read'), out.indexOf('lens-scroll'));
    expect(read).toContain('<h1>The title</h1><p>Opening words.</p><section class="lens-part"><h2>The start</h2>');
    expect(read.match(/data-lens-slide="\d+"/g)).toEqual(['data-lens-slide="2"', 'data-lens-slide="3"']);
    expect(out.slice(out.indexOf('lens-scroll')).match(/data-lens-at="\d+"/g)).toHaveLength(4);   // Scroll still starts on it
  });

  it('a first slide that is not the title keeps its picture', () => {
    const read = html.slice(html.indexOf('lens-read'), html.indexOf('lens-scroll'));
    expect(read).toContain('<h1>T</h1><section class="lens-part">');
  });

  it('Read gives each part its last click\'s picture, and every click\'s words as prose', () => {
    const read = html.slice(html.indexOf('lens-read'), html.indexOf('lens-scroll'));
    expect(read.match(/data-lens-slide="\d+"/g)).toEqual(['data-lens-slide="1"', 'data-lens-slide="2"']);
    expect(read).toContain('<h1>T</h1>');
    expect(read).toContain('<h2>The start</h2>');
    expect(read).toContain('<h3>First &amp; foremost</h3>');
    expect(read).toContain('<p>Said at the end.</p>');
  });

  it('Scroll gives one step per click, each naming its slide', () => {
    const scroll = html.slice(html.indexOf('lens-scroll'));
    expect(scroll.match(/data-lens-at="\d+"/g)).toEqual(['data-lens-at="0"', 'data-lens-at="1"', 'data-lens-at="2"']);
    expect(scroll).toContain('data-lens-stage');
  });

  it('keeps words as words, and a draft mark out of what is read', () => {
    expect(html).toContain('Said on &lt;the&gt; second.');
    expect(html).not.toContain('<the>');
    expect(html).not.toContain('[draft]');
  });

  it('frames a picture in the deck\'s own proportions', () => {
    expect(lensHtml(deck({title: 'T', canvas: [1600, 900], lenses: true}))).toContain('--lens-w:1600px;--lens-h:900px;aspect-ratio:1600/900');
  });
});
