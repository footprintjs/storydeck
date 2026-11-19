// notes — the open notes of a deck that are the person's own (Node). feedback.md may have come with the folder, so a
// reader keeps two things apart: the notes this person's dev page signed (noteKey.js), which are requests, and every
// other open line, which is text in the deck and is counted, never listed.
import path from 'node:path';
import {FEEDBACK, readFeedback} from './edit.js';
import {noteKey, signedBy, storydeckHome} from './noteKey.js';
import {deckRoot, presence} from './paths.js';
import {deckFileText} from './source.js';

/**
 * The open notes in feedback.md: {mine, other} — `mine` the ones this person's dev page left (signed with their note
 * key: noteKey.js), `other` how many open lines it holds that it did not (they came with the folder, or were edited by
 * hand: text in the deck, never a request).
 */
export function deckFeedback(dir, {home = storydeckHome()} = {}) {
  const root = deckRoot(dir);
  const open = presence(path.join(root, FEEDBACK)) === 'missing' ? [] : readFeedback(deckFileText(root, FEEDBACK)).filter((f) => !f.done);
  const {key} = noteKey(home, {deck: root});
  const mine = open.filter((f) => signedBy(key, f, root));
  return {mine, other: open.length - mine.length};
}

const about = (level, message) => ({level, rule: 'feedback', click: null, label: null, message});

/**
 * What a check says about the notes: how many the person left, how many lines came with the deck — or, as an error, a
 * feedback.md it may not read (a link out of the deck).
 */
export function noteProblems(dir, {home} = {}) {
  try {
    const {mine, other} = deckFeedback(dir, {home});
    return [
      ...(mine.length ? [about('info', `${mine.length} open note${mine.length === 1 ? '' : 's'} from your dev page — storydeck feedback lists ${mine.length === 1 ? 'it' : 'them'}`)] : []),
      ...(other ? [about('info', `${other} open line${other === 1 ? '' : 's'} in ${FEEDBACK} did not come from your dev page (text that came with the deck) — not a request`)] : []),
    ];
  } catch (e) {
    return [about('error', e.message)];
  }
}
