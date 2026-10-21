// @vitest-environment node
import {afterEach, describe, it, expect} from 'vitest';
import {chmodSync, existsSync, statSync, symlinkSync, writeFileSync} from 'node:fs';
import {homedir} from 'node:os';
import path from 'node:path';
import {noteKey, signNote, signedBy, storydeckHome} from './noteKey.js';
import {tempDeck, tempDir, cleanDecks} from './test/helpers.js';

afterEach(cleanDecks);
const posix = process.platform !== 'win32';

describe('noteKey', () => {
  it('makes the person\'s key once, readable by them only, and reads the same key back', () => {
    const home = path.join(tempDir(), 'state');
    expect(noteKey(home)).toEqual({key: null, why: expect.stringMatching(/there is no note key yet/)});
    const {key} = noteKey(home, {create: true});
    expect(key).toHaveLength(32);
    expect(noteKey(home).key.equals(key)).toBe(true);
    expect(noteKey(home, {create: true}).key.equals(key)).toBe(true);   // never made twice
    if (posix) expect(statSync(path.join(home, 'key')).mode & 0o777).toBe(0o600);
  });

  it('trusts no key that is a link, open to others, or not a key', () => {
    const home = tempDir(), other = tempDir();
    writeFileSync(path.join(other, 'key'), 'a'.repeat(64), {mode: 0o600});
    symlinkSync(path.join(other, 'key'), path.join(home, 'key'));
    expect(noteKey(home).why).toMatch(/is not a plain file/);
    if (posix) {
      chmodSync(path.join(other, 'key'), 0o644);
      expect(noteKey(other).why).toMatch(/can be read or written by others \(chmod 600 it\)/);
    }
    const bad = tempDir();
    writeFileSync(path.join(bad, 'key'), 'not hex', {mode: 0o600});
    expect(noteKey(bad).why).toMatch(/is not a key/);
  });

  it('signs a note over its click, the person\'s words and the time — never the deck\'s label — and knows its own signatures only', () => {
    const {key} = noteKey(path.join(tempDir(), 's'), {create: true});
    const note = {n: 3, label: 'Route', text: 'wider', at: '2026-10-21 12:00'}, deck = '/decks/a';
    const sig = signNote(key, note, deck);
    expect(sig).toMatch(/^[0-9a-f]{16}$/);
    expect(signedBy(key, {...note, done: true, sig}, deck)).toBe(true);   // ticking a note keeps it the person's
    expect(signedBy(key, {...note, label: 'the deck renamed this click', sig}, deck)).toBe(true);   // the label is the deck's text
    for (const changed of [{n: 4}, {text: 'narrower'}, {at: '2026-10-22 12:00'}]) expect(signedBy(key, {...note, ...changed, sig}, deck)).toBe(false);
    expect(signedBy(key, {...note, sig}, '/decks/b')).toBe(false);   // copied into another deck, it is not this deck's note
    const {key: theirs} = noteKey(path.join(tempDir(), 't'), {create: true});
    expect(signedBy(theirs, {...note, sig}, deck)).toBe(false);
    expect(signedBy(null, {...note, sig}, deck)).toBe(false);
    expect(signedBy(key, {...note, sig: 'XYZ'}, deck)).toBe(false);
  });

  it('never lives inside the deck folder the dev server serves — made there or not, through a link or not', () => {
    const deck = tempDeck();
    for (const home of [path.join(deck, 'state'), deck, path.join(deck, 'a', 'b')]) {
      expect(noteKey(home, {create: true, deck}).why).toMatch(/is inside the deck folder, which the dev server serves — set STORYDECK_HOME elsewhere/);
    }
    expect(existsSync(path.join(deck, 'state'))).toBe(false);   // refused before anything is made
    const outside = tempDir();
    symlinkSync(deck, path.join(outside, 'link'));
    expect(noteKey(path.join(outside, 'link', 'state'), {create: true, deck}).why).toMatch(/inside the deck folder/);
    expect(noteKey(path.join(outside, 'home'), {create: true, deck}).key).toHaveLength(32);
  });

  it('lives in STORYDECK_HOME (a relative one from the home folder, never the folder you run in), or in ~/.storydeck', () => {
    const before = process.env.STORYDECK_HOME;
    try {
      process.env.STORYDECK_HOME = '/somewhere/else';
      expect(storydeckHome()).toBe('/somewhere/else');
      process.env.STORYDECK_HOME = 'state';
      expect(storydeckHome()).toBe(path.join(homedir(), 'state'));
      delete process.env.STORYDECK_HOME;
      expect(storydeckHome()).toBe(path.join(homedir(), '.storydeck'));
    } finally {
      if (before === undefined) delete process.env.STORYDECK_HOME; else process.env.STORYDECK_HOME = before;
    }
  });
});
