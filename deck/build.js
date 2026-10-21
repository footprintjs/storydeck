// build — a deck folder made into its page, and written (Node). `storydeck build` and the dev server both run it.
import {existsSync, lstatSync, mkdirSync, realpathSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {readDeck} from './source.js';
import {compileDeck} from './compile.js';
import {deckPage} from './page.js';
import {pageAssets} from './assets.js';

/** A deck folder read and compiled: {source, compiled}. Throws, naming the file, part and click, when it cannot be. */
export function loadDeck(dir) {
  const source = readDeck(dir);
  return {source, compiled: compileDeck(source)};
}

/** The page of a deck folder, as a string (no file written). `dev` adds the dev client (dev.js). */
export function deckHtml(dir, {dev = null} = {}) {
  const {compiled} = loadDeck(dir);
  return {compiled, html: deckPage(compiled, pageAssets(), {dev})};
}

/**
 * Write a built file. Never through a link (a link named index.html would otherwise send the page anywhere it points),
 * and — for a file deck.json names — never outside the deck folder, a link on the way included.
 */
function writeOutput(root, file, text, {chosen = false} = {}) {
  const name = path.relative(root, file) || file;
  // lstat, not exists: a link whose target is missing would otherwise be followed and its target created
  const isLink = (p) => { try { return lstatSync(p).isSymbolicLink(); } catch { return false; } };
  if (isLink(file)) throw new Error(`${name} is a link — the build writes a file, never through a link (remove the link, or build to another --out)`);
  const within = (dir) => { const real = realpathSync(dir); return real === root || real.startsWith(root + path.sep); };
  let existing = path.dirname(file);
  while (!existsSync(existing)) existing = path.dirname(existing);
  const outside = `${name} would land outside the deck folder (a folder on the way is a link) — the build writes only inside the deck`;
  if (!chosen && !within(existing)) throw new Error(outside);   // checked before any folder is made
  mkdirSync(path.dirname(file), {recursive: true});
  if (!chosen && !within(path.dirname(file))) throw new Error(outside);
  writeFileSync(file, text);
}

/**
 * Build a deck folder: its page (deck.json "out", index.html by default, inside the folder — or `out`, a path the
 * caller chose) and, when deck.json names one, the deck-data.json the Read/Scroll lenses take. Returns what was
 * written: {file, bytes, slides, clicks, data, ms}.
 */
export function buildDeck(dir, {out} = {}) {
  const t0 = performance.now();
  const {compiled, html} = deckHtml(dir);
  const root = realpathSync(path.resolve(dir));
  const file = out === undefined ? path.join(root, compiled.config.out) : path.resolve(out);
  writeOutput(root, file, html, {chosen: out !== undefined});
  let data = null;
  if (compiled.config.deckData) {
    data = path.join(root, compiled.config.deckData);
    const assets = pageAssets();
    const deckCss = [...assets.css, compiled.themeCss].join('\n');
    writeOutput(root, data, JSON.stringify({deckCss, sections: compiled.slides.map(({label, html: h}) => ({label, html: h}))}, null, 1));
  }
  return {file, bytes: Buffer.byteLength(html), slides: compiled.slides.length, clicks: compiled.clicks.length, data, ms: Math.round(performance.now() - t0)};
}
