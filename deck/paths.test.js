// @vitest-environment node
import {afterEach, describe, it, expect} from 'vitest';
import {existsSync, linkSync, mkdirSync, readFileSync, readdirSync, realpathSync, symlinkSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {deckRoot, presence, realInside, servedFile, writeInside} from './paths.js';
import {tempDir, cleanDecks} from './test/helpers.js';

afterEach(cleanDecks);

/** A deck folder (its real path) with a few files, a hidden one and a file outside it. */
function folder() {
  const root = realpathSync(tempDir());
  writeFileSync(path.join(root, 'map.html'), 'map');
  writeFileSync(path.join(root, '.env'), 'SECRET=1');
  mkdirSync(path.join(root, 'sub'));
  writeFileSync(path.join(root, 'sub', 'a.txt'), 'a');
  const outside = path.join(realpathSync(tempDir()), 'outside.txt');
  writeFileSync(outside, 'outside');
  return {root, outside};
}

describe('paths', () => {
  it('names a missing folder the way a person would fix it', () => {
    expect(() => deckRoot(path.join(tempDir(), 'nope'))).toThrow(/nope is not a folder — a deck is a folder with deck.json \(make one: storydeck init/);
  });

  it('tells a missing path from a dangling link from a present one', () => {
    const {root} = folder();
    symlinkSync(path.join(root, 'gone'), path.join(root, 'dangling'));
    expect([presence(path.join(root, 'none')), presence(path.join(root, 'dangling')), presence(path.join(root, 'map.html'))]).toEqual(['missing', 'dangling', 'present']);
  });

  it('reads a file by its real path inside the deck — never one outside, never a hidden one, through a link either', () => {
    const {root, outside} = folder();
    symlinkSync(outside, path.join(root, 'out.txt'));
    symlinkSync(path.join(root, '.env'), path.join(root, 'theme.css'));
    symlinkSync(path.join(root, 'map.html'), path.join(root, 'alias.html'));
    expect(realInside(root, path.join(root, 'alias.html'), 'alias.html')).toBe(path.join(root, 'map.html'));
    expect(() => realInside(root, path.join(root, 'out.txt'), 'out.txt')).toThrow(/out.txt is a link to a file outside the deck folder/);
    expect(() => realInside(root, path.join(root, 'theme.css'), 'theme.css')).toThrow(/theme.css is a link to a hidden file — a deck never reads hidden files/);
  });

  it('serves a file of the deck for a URL path, and nothing hidden, outside or unreadable', () => {
    const {root, outside} = folder();
    symlinkSync(outside, path.join(root, 'leak.txt'));
    symlinkSync(path.join(root, '.env'), path.join(root, 'env.txt'));
    expect(servedFile(root, '/sub/a.txt')).toBe(path.join(root, 'sub', 'a.txt'));
    expect(servedFile(root, '/sub%2Fa.txt')).toBe(path.join(root, 'sub', 'a.txt'));
    for (const p of ['/', '/.env', '/sub/../.env', '/leak.txt', '/env.txt', '/sub', '/%E0%A4%A', '/a%00b', '/missing']) expect([p, servedFile(root, p)]).toEqual([p, null]);
  });

  it('writes a new file and renames it into place, leaving nothing beside it', () => {
    const {root} = folder();
    writeInside(root, path.join(root, 'site', 'index.html'), 'page');
    expect(readFileSync(path.join(root, 'site', 'index.html'), 'utf8')).toBe('page');
    writeInside(root, path.join(root, 'site', 'index.html'), 'again');
    expect(readFileSync(path.join(root, 'site', 'index.html'), 'utf8')).toBe('again');
    expect(readdirSync(path.join(root, 'site'))).toEqual(['index.html']);
  });

  it('never writes into what a hard link at that name shares with a file elsewhere', () => {
    const {root, outside} = folder();
    linkSync(outside, path.join(root, 'index.html'));
    writeInside(root, path.join(root, 'index.html'), 'page');
    expect(readFileSync(outside, 'utf8')).toBe('outside');
    expect(readFileSync(path.join(root, 'index.html'), 'utf8')).toBe('page');
  });

  it('never writes into a hidden folder through a link inside the deck (site -> .git)', () => {
    const {root} = folder();
    mkdirSync(path.join(root, '.git'));
    writeFileSync(path.join(root, '.git', 'config'), '[core]');
    symlinkSync(path.join(root, '.git'), path.join(root, 'site'));
    expect(() => writeInside(root, path.join(root, 'site', 'config'), 'page')).toThrow(/would land in a hidden folder/);
    expect(readFileSync(path.join(root, '.git', 'config'), 'utf8')).toBe('[core]');
  });

  it('refuses a link at the name, a dangling folder link on the way, and a folder link that leaves the deck', () => {
    const {root, outside} = folder();
    symlinkSync(outside, path.join(root, 'index.html'));
    expect(() => writeInside(root, path.join(root, 'index.html'), 'x')).toThrow(/index.html is a link — the build writes a file, never through a link/);
    symlinkSync(path.join(root, 'nowhere'), path.join(root, 'pub'));
    expect(() => writeInside(root, path.join(root, 'pub', 'a', 'index.html'), 'x')).toThrow(/pub is a link to nothing/);
    expect(existsSync(path.join(root, 'nowhere'))).toBe(false);
    symlinkSync(path.dirname(outside), path.join(root, 'site'));
    expect(() => writeInside(root, path.join(root, 'site', 'deep', 'index.html'), 'x')).toThrow(/would land outside the deck folder/);
    expect(existsSync(path.join(path.dirname(outside), 'deep'))).toBe(false);
    const chosen = path.join(path.dirname(outside), 'chosen', 'deck.html');
    writeInside(root, chosen, 'mine', {chosen: true});
    expect(readFileSync(chosen, 'utf8')).toBe('mine');
  });
});
