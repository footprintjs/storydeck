// noteKey — which notes in feedback.md were left in this person's own dev page (Node). A deck someone sent you can carry
// a feedback.md, and its lines must never pass for the person's requests: the dev server signs each note it writes with
// a key that lives with the person, not the deck (STORYDECK_HOME, or ~/.storydeck), and a reader lists only the notes
// that key signed. A note edited by hand, or copied from another machine, is not listed — it is text in the deck.
import {createHmac, randomBytes, timingSafeEqual} from 'node:crypto';
import {lstatSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {homedir} from 'node:os';
import path from 'node:path';

/** Where the person's StoryDeck state lives: STORYDECK_HOME, or ~/.storydeck. */
export const storydeckHome = () => process.env.STORYDECK_HOME || path.join(homedir(), '.storydeck');

const KEY = /^[0-9a-f]{64}$/;

/** Why a key file cannot be trusted to sign — a link, not a plain file, open to others, someone else's — or null. */
function untrusted(st) {
  if (!st.isFile()) return 'is not a plain file';
  if (process.platform === 'win32') return null;
  if (st.mode & 0o077) return 'can be read or written by others (chmod 600 it)';
  return typeof process.getuid === 'function' && st.uid !== process.getuid() ? 'belongs to another user' : null;
}

/**
 * The person's note key: {key} (a Buffer), or {key: null, why} when there is none yet (`create` makes it: 32 random
 * bytes, readable by its owner only) or it cannot be trusted.
 */
export function noteKey(home = storydeckHome(), {create = false} = {}) {
  const file = path.join(home, 'key');
  let st = null;
  try { st = lstatSync(file); } catch { /* none yet */ }
  if (!st && create) {
    mkdirSync(home, {recursive: true, mode: 0o700});
    try { writeFileSync(file, randomBytes(32).toString('hex'), {flag: 'wx', mode: 0o600}); } catch (e) { if (e.code !== 'EEXIST') throw e; }
    st = lstatSync(file);
  }
  if (!st) return {key: null, why: `there is no note key yet (${file})`};
  const why = untrusted(st);
  if (why) return {key: null, why: `the note key ${file} ${why}`};
  const hex = readFileSync(file, 'utf8').trim();
  return KEY.test(hex) ? {key: Buffer.from(hex, 'hex')} : {key: null, why: `the note key ${file} is not a key`};
}

/** A note's signature under `key`: 16 hex characters over its click, label, text and time. */
export const signNote = (key, {n, label, text, at}) =>
  createHmac('sha256', key).update(JSON.stringify(['storydeck-note', 1, n, label, text, at])).digest('hex').slice(0, 16);

/** Whether `key` signed this note (a note read back by edit.js · readFeedback). */
export function signedBy(key, note) {
  if (!key || typeof note.sig !== 'string' || !/^[0-9a-f]{16}$/.test(note.sig)) return false;
  return timingSafeEqual(Buffer.from(signNote(key, note)), Buffer.from(note.sig));
}
