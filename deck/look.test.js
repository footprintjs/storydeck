// @vitest-environment node
import {afterEach, describe, it, expect} from 'vitest';
import {LOOKS, readConfig} from './config.js';
import {pageAssets} from './assets.js';
import {compileDeck} from './compile.js';
import {deckPage, deckStyles} from './page.js';
import {DIFFERS_CSS} from './differs.js';
import {buildDeck} from './build.js';
import {readDeck} from './source.js';
import {checkDeck} from './check.js';
import {STARTER} from './init.js';
import {scopeDeckCss} from '../scopeDeckCss.js';
import {readFileSync} from 'node:fs';
import {cleanDecks, sourceOf, tempDeck} from './test/helpers.js';

afterEach(cleanDecks);

const BASE = pageAssets().looks.base;
const CLICKS = '<section data-label="One" data-kicker="One" data-map="map"><step data-in="a"><h2>A</h2></step></section>';
const page = (deck, extra = {}) => deckPage(compileDeck(sourceOf({deck, clicks: CLICKS, ...extra})), pageAssets());

/** The stylesheet's rules, comments gone: [{selector, body}]. It has no at-rules, so one level of braces is the whole of it. */
const rules = (css) => [...css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, selector, body]) => ({selector: selector.trim(), body}));
const tokensOf = (selector) => Object.fromEntries([...rules(BASE).find((r) => r.selector === selector).body.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map(([, k, v]) => [k, v.trim()]));
const LIGHT = tokensOf(':where(:root)');
const DARK = {...LIGHT, ...tokensOf(':where(:root.dark)')};

/** WCAG contrast of two #rrggbb colours. */
function contrast(a, b) {
  const lum = (hex) => {
    const [r, g, c] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4));
    return .2126 * r + .7152 * g + .0722 * c;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + .05) / (lo + .05);
}

describe('deck.json "look"', () => {
  it('is null unless a deck asks, and a look the library has is read back', () => {
    expect(readConfig({title: 'T'}).look).toBeNull();
    expect(readConfig({title: 'T', look: 'base'}).look).toBe('base');
  });

  it('refuses a look it does not have, naming the one it does, rather than drawing an unstyled deck', () => {
    for (const look of ['bass', '', null, true, 1, ['base']]) {
      expect(() => readConfig({title: 'T', look})).toThrow(`deck.json "look" is "base", or left out for none, not ${JSON.stringify(look)}`);
    }
  });

  it('every look it knows has its stylesheet, and the stylesheets every page carries are unchanged', () => {
    for (const name of LOOKS) expect(pageAssets().looks[name]).toContain('--bg');
    expect(pageAssets().css).toHaveLength(3);
    expect(pageAssets().css.join('\n')).not.toContain('look-base');
  });
});

describe('the page', () => {
  it('a deck that does not ask builds byte for byte as before; one that asks differs by the stylesheet alone', () => {
    expect(page({title: 'T'})).not.toContain('look-base');
    expect(page({title: 'T', look: 'base'}).replace(`${BASE}\n`, '')).toBe(page({title: 'T'}));
  });

  it('puts it after deck.css and before everything else, so the deck\'s theme.css comes after it', () => {
    const html = page({title: 'T', look: 'base'}, {theme: '.mine { color: red; }'});
    expect(html.indexOf('sdPkt')).toBeLessThan(html.indexOf('look-base'));
    expect(html.indexOf('look-base')).toBeLessThan(html.indexOf('.mine'));
    const paced = deckPage(compileDeck(sourceOf({deck: {title: 'T', look: 'base'}, clicks: CLICKS.replace('data-map', 'data-arrive="grow" data-map')})), pageAssets());
    expect(paced.indexOf('look-base')).toBeLessThan(paced.indexOf('data-sd-pace'));
  });
});

describe('deck-data.json, for the Read and Scroll lenses', () => {
  const data = (files) => JSON.parse(readFileSync(buildDeck(tempDeck({...STARTER, ...files})).data, 'utf8'));

  it('carries the same stylesheet as the page, the look included, and scoped it still sets the tokens', () => {
    const asked = data({'deck.json': '{"title":"T","look":"base","deckData":"deck-data.json"}'});
    expect(asked.deckCss).toContain(BASE);
    expect(asked.deckCss.indexOf('look-base')).toBeLessThan(asked.deckCss.indexOf(STARTER['theme.css']));
    expect(scopeDeckCss(asked.deckCss)).toContain(':where(.deck-scope) {\n  --bg: #f5f7fa');
    expect(scopeDeckCss(asked.deckCss)).toContain(':where(.deck-scope.dark) {');
  });

  it('a slide\'s label on how a part differs has its stylesheet there too', () => {
    const clicks = '<section data-label="P" data-kicker="P" data-differs-time="30"><p>x</p></section>';
    const compiled = compileDeck(sourceOf({clicks}));
    expect(deckStyles(compiled, pageAssets())).toContain(DIFFERS_CSS);
    expect(data({'deck.json': '{"title":"T","deckData":"deck-data.json"}', 'clicks.html': clicks}).deckCss).toContain(DIFFERS_CSS);
  });

  it('a deck that asks for nothing gets what it always did: what every page carries, then its theme', () => {
    const plainMap = STARTER['map.html'].replace(/<div data-k="why"[^\n]*\n/, ''), plainClicks = STARTER['clicks.html'].replace('data-in="time why" data-on="server time why"', 'data-in="time" data-on="server time"');
    const none = data({'deck.json': '{"title":"T","deckData":"deck-data.json"}', 'map.html': plainMap, 'clicks.html': plainClicks});
    expect(none.deckCss).toBe([...pageAssets().css, STARTER['theme.css']].join('\n'));
  });
});

describe('look-base.css', () => {
  it('holds every rule at no weight, so any rule of a deck wins without !important', () => {
    expect(rules(BASE).length).toBeGreaterThan(20);
    for (const {selector} of rules(BASE)) expect(selector, selector).toMatch(/^:where\(.*\)(::before)?$/);
    expect(BASE).not.toContain('!important');
    expect(BASE).not.toMatch(/@/);   // nothing outside plain rules: rules() above saw all of it
  });

  it('defines the whole token contract in light and every colour again in dark', () => {
    for (const token of ['--bg', '--bg-elev', '--fg', '--fg-muted', '--line', '--accent-ink', '--sans', '--mono', '--sd-accent', '--sd-glow', '--sd-dim-opacity', '--sd-ok', '--sd-warn', '--sd-bad', '--sd-radius']) {
      expect(LIGHT[token], token).toBeTruthy();
    }
    for (const token of Object.keys(LIGHT).filter((k) => LIGHT[k].startsWith('#'))) expect(tokensOf(':where(:root.dark)')[token], token).toBeTruthy();
  });

  it('reads only tokens it defines (a tone is the one a piece may not have, and every read of it has a fallback)', () => {
    const read = [...BASE.matchAll(/var\((--[\w-]+)(,?)/g)];
    for (const [, token, fallback] of read) {
      if (token === '--sd-tone') expect(fallback).toBe(',');
      else expect(LIGHT[token], token).toBeTruthy();
    }
  });

  it('lets the highlight follow the accent in light and dark, until a deck sets its own', () => {
    expect(LIGHT['--sd-accent']).toBe('var(--accent-ink)');
    expect(tokensOf(':where(:root.dark)')['--sd-accent']).toBeUndefined();
  });

  it('sets its tokens on the root and nowhere lower, where one would beat a deck\'s own on :root in spite of having no weight', () => {
    const lower = rules(BASE).filter((r) => !r.selector.endsWith(':root)') && !r.selector.endsWith(':root.dark)'));
    const set = lower.flatMap((r) => [...r.body.matchAll(/(--[\w-]+):/g)].map((m) => m[1]));
    expect([...new Set(set)]).toEqual(['--sd-tone']);   // a tone is a piece's own: nothing above it sets one
  });

  it('draws its pieces only inside a slide, so a site showing a deck in its own page keeps its own .card', () => {
    const pieces = rules(BASE).map((r) => r.selector).filter((sel) => !sel.includes(':root'));
    expect(pieces.length).toBeGreaterThan(20);
    for (const sel of pieces) expect(sel, sel).toMatch(/^:where\(section\[data-label\] /);
    const slides = compileDeck(readDeck(tempDeck())).slides;
    for (const slide of slides) expect(slide.html.trimStart()).toMatch(/^<section data-label="/);
  });

  it('keeps words readable: text and tones reach 4.5:1 on both grounds, light and dark', () => {
    for (const mode of [LIGHT, DARK]) {
      for (const ink of ['--fg', '--fg-muted', '--accent-ink', '--sd-ok', '--sd-warn', '--sd-bad']) {
        for (const ground of ['--bg', '--bg-elev']) {
          expect(contrast(mode[ink], mode[ground]), `${ink} ${mode[ink]} on ${ground} ${mode[ground]}`).toBeGreaterThanOrEqual(4.5);
        }
      }
    }
  });

  it('gives no words a size too small to read on a phone: at least 20 slide pixels', () => {
    const sizes = [...BASE.matchAll(/font-size:\s*(\d+)px|font:\s*\d+\s+(\d+)px/g)].map((m) => Number(m[1] ?? m[2]));
    expect(sizes.length).toBeGreaterThan(5);
    expect(Math.min(...sizes)).toBeGreaterThanOrEqual(20);
  });
});

describe('the starter', () => {
  const classes = (html) => [...html.replace(/<!--[\s\S]*?-->/g, '').matchAll(/class="([^"]+)"/g)].flatMap((m) => m[1].split(/\s+/));

  it('asks for the base look, keeps only a few tokens of its own, and builds and checks clean', () => {
    expect(JSON.parse(STARTER['deck.json']).look).toBe('base');
    const own = rules(STARTER['theme.css']);
    expect(own.map((r) => r.selector)).toEqual([':root', ':root.dark']);
    expect(own.flatMap((r) => [...r.body.matchAll(/--[\w-]+:/g)]).length).toBeLessThanOrEqual(6);
    expect(checkDeck(compileDeck(readDeck(tempDeck())))).toEqual([]);
  });

  it('has a look for every piece it draws, so taking its rules away lost nothing', () => {
    const drawn = new Set([...classes(STARTER['map.html']), ...classes(STARTER['clicks.html'])]);
    drawn.delete('ic'); drawn.delete('wire'); drawn.delete('pkt'); drawn.delete('notes');   // deck.css, focus and the notes own these
    expect([...drawn].sort()).toEqual(['box', 'chip', 'points', 'req', 'ret', 'sub', 'title-block']);
    for (const name of drawn) expect(BASE, name).toContain(`.${name}`);
  });

  it('a deck with no theme.css at all is still dressed, by asking', () => {
    const {'theme.css': _, ...rest} = STARTER;
    const html = deckPage(compileDeck(readDeck(tempDeck(rest))), pageAssets());
    expect(html).toContain('look-base');
    expect(html).toContain('--bg-elev: #ffffff');
  });
});
