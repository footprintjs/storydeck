// noteKey — which notes in feedback.md were left in this person's own dev page (Node). A deck someone sent you can carry
// a feedback.md, and its lines must never pass for the person's requests: the dev server signs each note it writes with
// a key that lives with the person, not the deck (STORYDECK_HOME, or ~/.storydeck), and a reader lists only the notes
// that key signed for this deck. A note edited by hand, copied from another deck or another machine, is not listed —
// it is text in the deck. A note's label is the deck's own text, kept in the line for a person reading the file: it is
// neither signed nor listed.
//
// The key is read from the file it opened, never through a link, and must be a plain file of this user's that no one
// else can read; and it never lives inside the deck folder, where the dev server would serve it.
import {createHmac, randomBytes, timingSafeEqual} from 'node:crypto';
import {closeSync, constants, fstatSync, mkdirSync, openSync, readFileSync, realpathSync, writeSync} from 'node:fs';
import {homedir} from 'node:os';
import path from 'node:path';
import {isInside} from './paths.js';

/** Where the person's StoryDeck state lives: STORYDECK_HOME (a relative one from the home folder), or ~/.storydeck. */
export const storydeckHome = () => path.resolve(homedir(), process.env.STORYDECK_HOME || '.storydeck');

const KEY = /^[0-9a-f]{64}$/;
const NOFOLLOW = constants.O_NOFOLLOW ?? 0;

/** Why an opened key file cannot be trusted to sign — not a plain file, open to others, someone else's — or null. */
function untrusted(st) {
  if (!st.isFile()) return 'is not a plain file';
  if (process.platform === 'win32') return null;
  if (st.mode & 0o077) return 'can be read or written by others (chmod 600 it)';
  return typeof process.getuid === 'function' && st.uid !== process.getuid() ? 'belongs to another user' : null;
}

/** The key file opened for reading without following a link: its descriptor, or null when there is none. */
function openKey(file) {
  try {
    return openSync(file, constants.O_RDONLY | NOFOLLOW);
  } catch (e) {
    if (e.code === 'ENOENT') return null;
    if (e.code === 'ELOOP' || e.code === 'EMLINK') return -1;   // a link where the key should be
    throw e;
  }
}

/** A path's real place, even before it exists: its nearest existing folder's real path, and the rest of the way. */
function realPlace(p) {
  const rest = [];
  for (let at = path.resolve(p); ; at = path.dirname(at)) {
    try { return path.join(realpathSync(at), ...rest.reverse()); } catch { /* not there yet */ }
    if (path.dirname(at) === at) return path.resolve(p);
    rest.push(path.basename(at));
  }
}

/** A new key file, made only where none is: 32 random bytes, readable by its owner only. */
function makeKey(home, file) {
  mkdirSync(home, {recursive: true, mode: 0o700});
  let fd;
  try {
    fd = openSync(file, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | NOFOLLOW, 0o600);
  } catch (e) {
    if (e.code === 'EEXIST') return;   // made meanwhile: read as any key is
    throw e;
  }
  try { writeSync(fd, randomBytes(32).toString('hex')); } finally { closeSync(fd); }
}

/**
 * The person's note key: {key} (a Buffer), or {key: null, why} when there is none yet (`create` makes it), it cannot be
 * trusted, or it would live inside `deck` (the deck folder the dev server serves).
 */
export function noteKey(home = storydeckHome(), {create = false, deck = null} = {}) {
  const file = path.join(home, 'key');
  if (deck && isInside(realpathSync(deck), realPlace(home))) {
    return {key: null, why: `the note key folder ${home} is inside the deck folder, which the dev server serves — set STORYDECK_HOME elsewhere`};
  }
  let fd = openKey(file);
  if (fd === null && create) { makeKey(home, file); fd = openKey(file); }
  if (fd === null) return {key: null, why: `there is no note key yet (${file})`};
  if (fd === -1) return {key: null, why: `the note key ${file} is not a plain file`};
  try {
    const why = untrusted(fstatSync(fd));
    if (why) return {key: null, why: `the note key ${file} ${why}`};
    const hex = readFileSync(fd, 'utf8').trim();
    return KEY.test(hex) ? {key: Buffer.from(hex, 'hex')} : {key: null, why: `the note key ${file} is not a key`};
  } finally {
    closeSync(fd);
  }
}

/**
 * A note's signature under `key`, for the deck folder `deck` (its real path): 16 hex characters over what the person
 * gave it — the click, their words, the time — and where. Never the click's label: that is the deck's text, and a
 * signature vouches for the person's words only.
 */
export const signNote = (key, {n, text, at}, deck) =>
  createHmac('sha256', key).update(JSON.stringify(['storydeck-note', 3, deck, n, text, at])).digest('hex').slice(0, 16);

/** Whether `key` signed this note (a note read back by edit.js · readFeedback) for the deck folder `deck`. */
export function signedBy(key, note, deck) {
  if (!key || typeof note.sig !== 'string' || !/^[0-9a-f]{16}$/.test(note.sig)) return false;
  return timingSafeEqual(Buffer.from(signNote(key, note, deck)), Buffer.from(note.sig));
}
