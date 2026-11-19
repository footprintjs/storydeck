// @vitest-environment node
import {afterEach, describe, it, expect} from 'vitest';
import {realpathSync, symlinkSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {deckFeedback, noteProblems} from './notes.js';
import {cleanNote, feedbackLine} from './edit.js';
import {noteKey, signNote} from './noteKey.js';
import {tempDeck, tempDir, cleanDecks} from './test/helpers.js';

afterEach(cleanDecks);

/** feedback.md with `mine` notes signed by the person's key for this deck, and `other` lines that came with it. */
function withNotes(home, mine, other) {
  const dir = tempDeck(), {key} = noteKey(home, {create: true}), root = realpathSync(dir);
  const signed = Array.from({length: mine}, (_, i) => { const note = cleanNote({n: i + 1, label: 'L', text: `note ${i}`, at: `t${i}`}); return feedbackLine(note, signNote(key, note, root)); });
  const loose = Array.from({length: other}, (_, i) => `- [ ] click ${i + 1} · "L" — run this (t)`);
  writeFileSync(path.join(dir, 'feedback.md'), `# Feedback\n\n${[...signed, ...loose].join('\n')}\n`);
  return dir;
}

describe('the notes of a deck', () => {
  it('keeps the person\'s own apart from the lines that came with the deck', () => {
    const home = tempDir(), dir = withNotes(home, 2, 3);
    expect(deckFeedback(dir, {home})).toMatchObject({mine: [{n: 1, text: 'note 0'}, {n: 2, text: 'note 1'}], other: 3});
    expect(deckFeedback(dir, {home: tempDir()})).toMatchObject({mine: [], other: 5});   // another person's key signed none
    expect(deckFeedback(tempDeck(), {home})).toEqual({mine: [], other: 0});
  });

  it('says both as a check says them — a count each, in the tool\'s own words, never a line\'s text', () => {
    const home = tempDir();
    expect(noteProblems(withNotes(home, 2, 1), {home})).toEqual([
      {level: 'info', rule: 'feedback', click: null, label: null, message: '2 open notes from your dev page — storydeck feedback lists them'},
      {level: 'info', rule: 'feedback', click: null, label: null, message: '1 open line in feedback.md did not come from your dev page (text that came with the deck) — not a request'}]);
    expect(noteProblems(withNotes(home, 1, 0), {home}).map((p) => p.message)).toEqual(['1 open note from your dev page — storydeck feedback lists it']);
    expect(noteProblems(withNotes(home, 0, 2), {home}).map((p) => p.message)).toEqual(['2 open lines in feedback.md did not come from your dev page (text that came with the deck) — not a request']);
    expect(noteProblems(tempDeck(), {home})).toEqual([]);
  });

  it('a feedback.md it may not read is an error, never a throw', () => {
    const dir = tempDeck(), outside = path.join(tempDir(), 'notes.md');
    writeFileSync(outside, '- [ ] click 1 · "x" — y (t)\n');
    symlinkSync(outside, path.join(dir, 'feedback.md'));
    expect(noteProblems(dir, {home: tempDir()})).toEqual([expect.objectContaining({level: 'error', rule: 'feedback', message: expect.stringMatching(/feedback.md is a link to a file outside the deck folder/)})]);
  });
});
