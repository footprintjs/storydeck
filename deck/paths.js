// paths — the one owner of where a deck may read and write (Node). A deck folder is content someone may have sent
// you, so every rule about its files lives here, once:
//
//   · a name deck.json gives is relative, with no ".." and no hidden segment;
//   · a file is read by its real path, which must be inside the deck folder and not hidden — a link that leaves the
//     folder, or that points at a hidden file inside it (.env), is refused;
//   · a build writes a new file and renames it into place, so it never writes through a link (a dangling one, or a
//     hard link, included); a file deck.json names never lands outside the deck, checked before any folder is made.
import {existsSync, lstatSync, mkdirSync, realpathSync, renameSync, rmSync, statSync, writeFileSync} from 'node:fs';
import path from 'node:path';

const hidden = (segment) => segment.startsWith('.');
const isText = (v) => typeof v === 'string' && v.trim().length > 0;

/** A file name deck.json gives: relative, inside the deck folder, no "..", no hidden segment. */
export function deckPath(value, key) {
  if (!isText(value)) throw new Error(`deck.json "${key}" is a file name in the deck folder, not ${JSON.stringify(value)}`);
  const parts = value.replace(/\\/g, '/').split('/');
  if (value.startsWith('/') || /^[a-zA-Z]:/.test(value) || parts.some((p) => p === '..' || hidden(p))) {
    throw new Error(`deck.json "${key}": "${value}" must stay inside the deck folder (relative, no "..", no hidden files)`);
  }
  return parts.filter((p) => p !== '').join('/');
}

/** A deck folder's real path, or why it is not one. */
export function deckRoot(dir) {
  if (!existsSync(dir) || !statSync(dir).isDirectory()) throw new Error(`${dir} is not a folder — a deck is a folder with deck.json (make one: storydeck init ${dir})`);
  return realpathSync(path.resolve(dir));
}

/** `real` is the deck folder or inside it. */
export const isInside = (root, real) => real === root || real.startsWith(root + path.sep);

/** What is at a path, without following it: 'missing', 'dangling' (a link to nothing), or 'present'. */
export function presence(full) {
  let link;
  try { link = lstatSync(full); } catch { return 'missing'; }
  if (!link.isSymbolicLink()) return 'present';
  return existsSync(full) ? 'present' : 'dangling';
}

/** Why a real path is not a place of the deck's own — outside the folder, or hidden inside it — or null when it is. */
function notDeckPlace(root, real) {
  if (!isInside(root, real)) return 'outside';
  return path.relative(root, real).split(path.sep).some(hidden) ? 'hidden' : null;
}

/**
 * Where a deck file really is, refused when its real path leaves the deck folder or is hidden inside it — so a deck
 * cannot pull a file from elsewhere on your machine (or its own .env) into its page, its review or its server.
 */
export function realInside(root, full, name) {
  const real = realpathSync(full);
  const why = notDeckPlace(root, real);
  if (why === 'outside') throw new Error(`${name} is a link to a file outside the deck folder — a deck reads only its own files`);
  if (why === 'hidden') throw new Error(`${name} is a link to a hidden file — a deck never reads hidden files (.env and the like)`);
  return real;
}

/**
 * The file a URL path names in the deck folder, for the dev server — or null: no hidden segment in the name, and its
 * real path a file inside the folder and not hidden.
 */
export function servedFile(root, pathname) {
  let rel;
  try { rel = decodeURIComponent(pathname); } catch { return null; }
  if (rel.includes('\0')) return null;
  const segs = rel.split(/[\\/]+/).filter(Boolean);
  if (!segs.length || segs.some((s) => s === '..' || hidden(s))) return null;
  try {
    const real = realInside(root, path.join(root, ...segs), rel);
    return statSync(real).isFile() ? real : null;
  } catch {
    return null;
  }
}

/**
 * Write a built file: a new file beside it, renamed into place — never through a link at that name (a dangling or a
 * hard link included). A file deck.json names (`chosen` false) never lands outside the deck folder, a folder link on
 * the way included, checked before any folder is made; a path the caller chose may be anywhere.
 */
export function writeInside(root, file, text, {chosen = false} = {}) {
  const name = path.relative(root, file) || file;
  // a file deck.json names lands in a place of the deck's own: inside it and not hidden (a link into .git is refused)
  const refuse = (dir) => {
    const why = chosen ? null : notDeckPlace(root, realpathSync(dir));
    if (why === 'outside') throw new Error(`${name} would land outside the deck folder (a folder on the way is a link) — the build writes only inside the deck`);
    if (why === 'hidden') throw new Error(`${name} would land in a hidden folder (a folder on the way is a link to one) — the build never writes hidden files`);
  };
  let existing = path.dirname(file);
  while (presence(existing) === 'missing') existing = path.dirname(existing);
  if (presence(existing) === 'dangling') throw new Error(`${path.relative(root, existing) || existing} is a link to nothing — the build cannot write through it`);
  refuse(existing);   // before any folder is made
  mkdirSync(path.dirname(file), {recursive: true});
  refuse(path.dirname(file));
  if (presence(file) !== 'missing' && lstatSync(file).isSymbolicLink()) {
    throw new Error(`${name} is a link — the build writes a file, never through a link (remove the link, or build to another --out)`);
  }
  const tmp = path.join(path.dirname(file), `.${path.basename(file)}.${process.pid}.${Date.now()}.tmp`);
  try {
    writeFileSync(tmp, text, {flag: 'wx'});   // a new file: never an existing one, never through a link
    renameSync(tmp, file);                    // replaces the name itself, not what a link there points to
  } catch (e) {
    rmSync(tmp, {force: true});
    throw e;
  }
}
