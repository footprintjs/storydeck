import {describe, it, expect} from 'vitest';
import {readConfig, DEFAULTS} from './config.js';
import {deckPath} from './paths.js';

describe('readConfig', () => {
  it('fills every default from a title alone', () => {
    const c = readConfig('{"title": " My talk "}');
    expect(c).toMatchObject({title: 'My talk', footer: 'My talk', description: '', lang: 'en', canvas: [1920, 1080], area: [0, 220, 1920, 1000],
      clicks: 'clicks.html', theme: 'theme.css', icons: 'icons', maps: {}, out: 'index.html', post: null, deckData: null,
      checks: {maxWords: 12, maxSlideWords: 40}, given: ['title']});
    expect(Object.isFrozen(c)).toBe(true);
    expect(DEFAULTS.checks.maxWords).toBe(12);
  });

  it('takes every key it knows, and derives the area from a smaller canvas', () => {
    const c = readConfig({title: 'T', description: 'D', lang: 'de', footer: 'F', canvas: [1280, 720], clicks: 'deck/clicks.html', theme: 'look.css',
      icons: 'art', maps: {big: 'maps/big.html'}, out: 'site/index.html', post: 'post.json', deckData: 'deck-data.json', checks: {maxWords: 9, maxSlideWords: 30}});
    expect(c).toMatchObject({description: 'D', lang: 'de', footer: 'F', canvas: [1280, 720], area: [0, 220, 1280, 640], maps: {big: 'maps/big.html'},
      out: 'site/index.html', post: 'post.json', deckData: 'deck-data.json', checks: {maxWords: 9, maxSlideWords: 30}});
    expect(readConfig({title: 'T', area: [10, 20, 30, 40]}).area).toEqual([10, 20, 30, 40]);
  });

  it('refuses what it cannot use, naming the fix', () => {
    expect(() => readConfig('{nope')).toThrow(/not valid JSON/);
    expect(() => readConfig('[]')).toThrow(/is an object/);
    expect(() => readConfig({title: 'T', titel: 'x'})).toThrow(/"titel", which it does not know \(the keys are title, /);
    expect(() => readConfig({})).toThrow(/needs a "title"/);
    expect(() => readConfig({title: 'T', footer: 3})).toThrow(/"footer" is text/);
    expect(() => readConfig({title: 'T', canvas: [0, 10]})).toThrow(/"canvas" is \[width, height\]/);
    expect(() => readConfig({title: 'T', area: [0, 0, 0, 10]})).toThrow(/"area" is \[x0, y0, x1, y1\]/);
    expect(() => readConfig({title: 'T', maps: ['a']})).toThrow(/"maps" names each map's file/);
    expect(() => readConfig({title: 'T', checks: 5})).toThrow(/"checks" is an object/);
    expect(() => readConfig({title: 'T', checks: {maxWord: 3}})).toThrow(/"checks" has maxWord/);
    expect(() => readConfig({title: 'T', checks: {maxWords: 0}})).toThrow(/"checks.maxWords" is a whole number/);
    expect(() => readConfig({title: 'T', out: '../x.html'})).toThrow(/must stay inside the deck folder/);
  });
});

describe('deckPath', () => {
  it('keeps a relative file inside the deck, and refuses one that leaves it or hides', () => {
    expect(deckPath('maps//big.html', 'k')).toBe('maps/big.html');
    expect(deckPath('a\\b.html', 'k')).toBe('a/b.html');
    for (const bad of ['/etc/passwd', 'C:/x', 'a/../../b', '.env', 'maps/.hidden']) expect(() => deckPath(bad, 'k')).toThrow(/must stay inside/);
    expect(() => deckPath('', 'k')).toThrow(/is a file name in the deck folder/);
  });
});
