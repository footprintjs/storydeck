// @vitest-environment node
import {afterEach, describe, it, expect} from 'vitest';
import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {initDeck, STARTER} from './init.js';
import {loadDeck} from './build.js';
import {checkDeck} from './check.js';
import {tempDir, cleanDecks} from './test/helpers.js';

afterEach(cleanDecks);

describe('initDeck', () => {
  it('writes the starter into a new folder, and it builds and checks clean', () => {
    const dir = path.join(tempDir(), 'deep', 'talk');
    const r = initDeck(dir);
    expect(r.files.sort()).toEqual(Object.keys(STARTER).sort());
    expect(readFileSync(path.join(dir, 'icons', 'server.svg'), 'utf8')).toBe(STARTER['icons/server.svg']);
    const {compiled} = loadDeck(dir);
    expect(compiled.clicks).toHaveLength(6);
    expect(checkDeck(compiled)).toEqual([]);
  });

  it('writes into an empty folder, or one holding only hidden files, and refuses one with files', () => {
    const empty = tempDir();
    expect(initDeck(empty).files).toHaveLength(8);
    const hidden = tempDir();
    mkdirSync(path.join(hidden, '.git'));
    expect(initDeck(hidden).files).toHaveLength(8);
    const full = tempDir();
    writeFileSync(path.join(full, 'notes.txt'), 'mine');
    expect(() => initDeck(full)).toThrow(/already holds files — init writes a new deck into an empty or new folder/);
    expect(readFileSync(path.join(full, 'notes.txt'), 'utf8')).toBe('mine');
  });

  it('tells a reader how to use the deck with the commands that run without installing, naming its folder', () => {
    expect(STARTER['README.md']).toContain('npx footprint-storydeck dev my-talk');
    const dir = path.join(tempDir(), 'q3-review');
    initDeck(dir);
    expect(readFileSync(path.join(dir, 'README.md'), 'utf8')).toContain('npx footprint-storydeck review q3-review --click 3');
    expect(STARTER['clicks.html']).toContain('data-focus="path"');
    expect(STARTER['theme.css']).toContain(':root.dark');
  });
});
