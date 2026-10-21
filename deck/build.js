// build — a deck folder made into its page, and written (Node). `storydeck build` and the dev server both run it.
import path from 'node:path';
import {readDeck} from './source.js';
import {compileDeck} from './compile.js';
import {deckPage} from './page.js';
import {pageAssets} from './assets.js';
import {deckRoot, writeInside} from './paths.js';

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
 * Build a deck folder: its page (deck.json "out", index.html by default, inside the folder — or `out`, a path the
 * caller chose) and, when deck.json names one, the deck-data.json the Read/Scroll lenses take. Returns what was
 * written: {file, bytes, slides, clicks, data, ms}.
 */
export function buildDeck(dir, {out} = {}) {
  const t0 = performance.now();
  const {compiled, html} = deckHtml(dir);
  const root = deckRoot(dir);
  const file = out === undefined ? path.join(root, compiled.config.out) : path.resolve(out);
  writeInside(root, file, html, {chosen: out !== undefined});
  let data = null;
  if (compiled.config.deckData) {
    data = path.join(root, compiled.config.deckData);
    const assets = pageAssets();
    const deckCss = [...assets.css, compiled.themeCss].join('\n');
    writeInside(root, data, JSON.stringify({deckCss, sections: compiled.slides.map(({label, html: h}) => ({label, html: h}))}, null, 1));
  }
  return {file, bytes: Buffer.byteLength(html), slides: compiled.slides.length, clicks: compiled.clicks.length, data, ms: Math.round(performance.now() - t0)};
}
