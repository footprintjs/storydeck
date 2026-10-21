// @vitest-environment node
import {afterEach, describe, it, expect} from 'vitest';
import {existsSync, mkdirSync, readFileSync, realpathSync, symlinkSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {buildDeck, deckHtml, loadDeck} from './build.js';
import {STARTER} from './init.js';
import {tempDeck, tempDir, cleanDecks} from './test/helpers.js';

afterEach(cleanDecks);

describe('buildDeck', () => {
  it('writes the deck\'s one self-contained page into its folder', () => {
    const dir = tempDeck();
    const r = buildDeck(dir);
    expect(r).toMatchObject({file: path.join(realpathSync(dir), 'index.html'), slides: 6, clicks: 6, data: null});
    expect(r.bytes).toBeGreaterThan(50000);
    const html = readFileSync(r.file, 'utf8');
    expect(html).toMatch(/^<!doctype html>/);
    expect(html).toContain('<deck-stage width="1920" height="1080" no-rail>');
    // nothing loaded from elsewhere (the runtime's own usage comment mentions a <script src>, escaped)
    expect(html).not.toMatch(/<script\b[^>]*\bsrc=[^>]*><\/script>|<link\b[^>]*rel="stylesheet"/);
    expect(html).not.toContain('storydeck-dev');                      // the dev client never ships
  });

  it('writes where deck.json "out" says, with deck-data.json for the Read and Scroll lenses when named', () => {
    const dir = tempDeck({...STARTER, 'deck.json': '{"title":"T","out":"site/talk.html","deckData":"site/deck-data.json"}'});
    const r = buildDeck(dir);
    expect(r.file).toBe(path.join(realpathSync(dir), 'site', 'talk.html'));
    const data = JSON.parse(readFileSync(r.data, 'utf8'));
    expect(data.sections.map((s) => s.label)).toEqual(['Title', '1 · The route · 1', '1 · The route · 2', '1 · The route · 3', '2 · Close in · 1', 'Summary']);
    expect(data.deckCss).toContain('sdPkt');
  });

  it('writes to a path the caller chose, anywhere', () => {
    const dir = tempDeck();
    const out = path.join(tempDir(), 'elsewhere', 'deck.html');
    expect(buildDeck(dir, {out}).file).toBe(out);
    expect(existsSync(out)).toBe(true);
    expect(existsSync(path.join(dir, 'index.html'))).toBe(false);
  });

  it('never writes through a link, a dangling one included', () => {
    const dir = tempDeck();
    const target = path.join(tempDir(), 'victim.txt');
    writeFileSync(target, 'keep me');
    symlinkSync(target, path.join(dir, 'index.html'));
    expect(() => buildDeck(dir)).toThrow(/index.html is a link — the build writes a file, never through a link/);
    expect(readFileSync(target, 'utf8')).toBe('keep me');
    const dangling = tempDeck();
    const missing = path.join(tempDir(), 'would-be-created.txt');
    symlinkSync(missing, path.join(dangling, 'index.html'));
    expect(() => buildDeck(dangling)).toThrow(/is a link/);
    expect(existsSync(missing)).toBe(false);
  });

  it('never writes outside the deck through a folder that is a link, and makes no folder there first', () => {
    const outside = tempDir();
    const dir = tempDeck({...STARTER, 'deck.json': '{"title":"T","out":"site/a/b/index.html"}'});
    symlinkSync(outside, path.join(dir, 'site'));
    expect(() => buildDeck(dir)).toThrow(/would land outside the deck folder/);
    expect(existsSync(path.join(outside, 'a'))).toBe(false);
  });

  it('builds into a folder inside the deck that is a link inside the deck', () => {
    const dir = tempDeck({...STARTER, 'deck.json': '{"title":"T","out":"pub/index.html"}'});
    mkdirSync(path.join(dir, 'real-pub'));
    symlinkSync(path.join(dir, 'real-pub'), path.join(dir, 'pub'));
    expect(existsSync(buildDeck(dir).file)).toBe(true);
    expect(existsSync(path.join(dir, 'real-pub', 'index.html'))).toBe(true);
  });
});

describe('loadDeck and deckHtml', () => {
  it('reads and compiles, and gives the page as a string, with the dev client only when asked', () => {
    const dir = tempDeck();
    expect(loadDeck(dir).compiled.clicks).toHaveLength(6);
    const {html} = deckHtml(dir, {dev: {client: () => {}, version: 3}});
    expect(html).toContain('<meta name="storydeck-dev" content="3">');
    expect(deckHtml(dir).html).not.toContain('storydeck-dev');
  });
});
