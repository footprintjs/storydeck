// @vitest-environment node
import {afterEach, describe, it, expect} from 'vitest';
import {mkdirSync, symlinkSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {readDeck} from './source.js';
import {STARTER} from './init.js';
import {tempDeck, tempDir, cleanDecks} from './test/helpers.js';

afterEach(cleanDecks);

const ONE_MAP = '<section data-label="M" data-map="big"><step data-in="a"></step></section>';

describe('readDeck', () => {
  it('reads the starter: config, parts, the maps its clicks use, theme and icons', () => {
    const d = readDeck(tempDeck());
    expect(d.config.title).toBe('A request, end to end');
    expect(d.parts.map((p) => p.label)).toEqual(['Title', '1 · The route', '2 · Close in', 'Summary']);
    expect(Object.keys(d.maps)).toEqual(['map']);
    expect(d.themeCss).toContain(':root.dark');
    expect(Object.keys(d.icons)).toEqual(['client', 'database', 'server']);
    expect(d.icons.server.viewBox).toBe('0 0 64 64');
    expect(d.post).toBeNull();
  });

  it('finds a map by deck.json "maps", or as <name>.html', () => {
    const named = readDeck(tempDeck({'deck.json': '{"title":"T","maps":{"big":"maps/big.html"}}', 'clicks.html': ONE_MAP, 'maps/big.html': '<p data-k="a" style="left:0;top:0">x</p>'}));
    expect(named.maps.big).toContain('data-k="a"');
    const plain = readDeck(tempDeck({'deck.json': '{"title":"T"}', 'clicks.html': ONE_MAP, 'big.html': '<p data-k="a">x</p>'}));
    expect(plain.maps.big).toContain('data-k="a"');
    expect(plain.themeCss).toBe('');
    expect(plain.icons).toEqual({});
  });

  it('says what is missing, and refuses what it cannot read', () => {
    expect(() => readDeck(path.join(tempDir(), 'nope'))).toThrow(/is not a folder — a deck is a folder with deck.json/);
    expect(() => readDeck(tempDir())).toThrow(/is not a deck: the deck has no deck.json/);
    expect(() => readDeck(tempDeck({'deck.json': '{"title":"T"}'}))).toThrow(/the clicks: the deck has no clicks.html/);
    expect(() => readDeck(tempDeck({'deck.json': '{"title":"T"}', 'clicks.html': ONE_MAP}))).toThrow(/"M" is told on map "big", but the deck has no big.html/);
    expect(() => readDeck(tempDeck({'deck.json': '{"title":"T"}', 'clicks.html': '<section data-label="M" data-map="a.b"><step></step></section>'}))).toThrow(/a map's name is letters/);
    expect(() => readDeck(tempDeck({'deck.json': '{"title":"T","theme":"look.css"}', 'clicks.html': '<section data-label="P"></section>'}))).toThrow(/deck.json "theme": the deck has no look.css/);
    expect(() => readDeck(tempDeck({'deck.json': '{"title":"T","icons":"art"}', 'clicks.html': '<section data-label="P"></section>'}))).toThrow(/deck.json "icons": the deck has no art\/ folder/);
    expect(() => readDeck(tempDeck({'deck.json': '{"title":"T"}', 'clicks.html': '<section data-label="P"></section>', 'icons/a b.svg': '<svg viewBox="0 0 1 1"></svg>'}))).toThrow(/an icon's name is letters/);
    expect(() => readDeck(tempDeck({'deck.json': '{"title":"T","post":"post.json"}', 'clicks.html': '<section data-label="P"></section>', 'post.json': '{'}))).toThrow(/post.json is not valid JSON/);
    expect(() => readDeck(tempDeck({'deck.json': '{"title":"T","clicks":"c"}', 'clicks.html': 'x', 'c/x.html': 'y'}))).toThrow(/c is not a file/);
  });

  it('reads post.json when deck.json names it', () => {
    const d = readDeck(tempDeck({'deck.json': '{"title":"T","post":"post.json"}', 'clicks.html': '<section data-label="P"></section>', 'post.json': '{"sections":[]}'}));
    expect(d.post).toEqual({sections: []});
  });

  it('refuses a text file too big to be one', () => {
    const dir = tempDeck({'deck.json': '{"title":"T"}'});
    writeFileSync(path.join(dir, 'clicks.html'), 'x'.repeat(4 * 1024 * 1024 + 1));
    expect(() => readDeck(dir)).toThrow(/clicks.html is 4.0 MB — a deck's text files stay under 4 MB/);
  });

  it('never reads through a link that leaves the deck folder — a file, an icon, or the icons folder', () => {
    const secret = path.join(tempDir(), 'secret.txt');
    writeFileSync(secret, 'TOP SECRET');
    const linked = (target, at) => { const dir = tempDeck({...STARTER}); symlinkSync(target, path.join(dir, at)); return dir; };
    // map.html replaced by a link to a file elsewhere
    const dirA = tempDeck(Object.fromEntries(Object.entries(STARTER).filter(([k]) => k !== 'map.html')));
    symlinkSync(secret, path.join(dirA, 'map.html'));
    expect(() => readDeck(dirA)).toThrow(/map.html is a link to a file outside the deck folder/);
    const dirB = linked(secret, 'icons/leak.svg');
    expect(() => readDeck(dirB)).toThrow(/icons\/leak.svg is a link to a file outside the deck folder/);
    const outsideIcons = tempDir();
    writeFileSync(path.join(outsideIcons, 'x.svg'), '<svg viewBox="0 0 1 1"></svg>');
    const dirC = tempDeck(Object.fromEntries(Object.entries(STARTER).filter(([k]) => !k.startsWith('icons/'))));
    symlinkSync(outsideIcons, path.join(dirC, 'icons'));
    expect(() => readDeck(dirC)).toThrow(/icons\/ is a link to a file outside the deck folder/);
  });

  it('follows a link that stays inside the deck, and a deck folder that is itself a link', () => {
    const dir = tempDeck(Object.fromEntries(Object.entries(STARTER).filter(([k]) => k !== 'map.html')));
    mkdirSync(path.join(dir, 'parts'));
    writeFileSync(path.join(dir, 'parts', 'map.html'), STARTER['map.html']);
    symlinkSync(path.join(dir, 'parts', 'map.html'), path.join(dir, 'map.html'));
    expect(readDeck(dir).maps.map).toContain('data-k="client"');
    const alias = path.join(tempDir(), 'alias');
    symlinkSync(dir, alias);
    expect(readDeck(alias).config.title).toBe('A request, end to end');
  });
});
