// build — a deck folder made into its page, and written (Node). `storydeck build` and the dev server both run it.
import path from 'node:path';
import {readDeck} from './source.js';
import {compileDeck} from './compile.js';
import {deckPage, deckStyles} from './page.js';
import {pageAssets} from './assets.js';
import {deckRoot, writeInside} from './paths.js';
import {clipTags} from './narrate.js';

/**
 * A deck folder read and compiled: {source, compiled}. Throws, naming the file, part and click, when it cannot be.
 * `dev` numbers the pieces in the slides for the dev page (compile.js).
 */
export function loadDeck(dir, {dev = false} = {}) {
  const source = readDeck(dir);
  return {source, compiled: compileDeck(source, {dev})};
}

/**
 * The page of a deck folder, as a string (no file written): {source, compiled, html}. `dev` adds the dev client (dev.js);
 * `voice` carries the clips `storydeck narrate` made, and adds {voice: {have, wanted}}.
 */
export function deckHtml(dir, {dev = null, voice = false} = {}) {
  const {source, compiled} = loadDeck(dir, {dev: Boolean(dev)});
  const clips = voice ? clipTags(deckRoot(dir), compiled) : null;
  return {source, compiled, html: deckPage(compiled, pageAssets(), {dev, voiceTags: clips?.tags}), ...(clips && {voice: {have: clips.have, wanted: clips.wanted}})};
}

/**
 * Build a deck folder: its page (deck.json "out", index.html by default, inside the folder — or `out`, a path the
 * caller chose) and, when deck.json names one, the deck-data.json the Read/Scroll lenses take. `voice` carries the
 * clips in the page: a cloned voice is the speaker's own, so only the person's own command asks. Returns what was
 * written: {file, bytes, slides, clicks, data, ms}, and {voice: {have, wanted}} when asked.
 */
export function buildDeck(dir, {out, voice = false} = {}) {
  const t0 = performance.now();
  const {compiled, html, voice: carried} = deckHtml(dir, {voice});
  const root = deckRoot(dir);
  const file = out === undefined ? path.join(root, compiled.config.out) : path.resolve(out);
  writeInside(root, file, html, {chosen: out !== undefined});
  let data = null;
  if (compiled.config.deckData) {
    data = path.join(root, compiled.config.deckData);
    const deckCss = deckStyles(compiled, pageAssets());
    writeInside(root, data, JSON.stringify({deckCss, sections: compiled.slides.map(({label, html: h}) => ({label, html: h}))}, null, 1));
  }
  return {file, bytes: Buffer.byteLength(html), slides: compiled.slides.length, clicks: compiled.clicks.length, data, ms: Math.round(performance.now() - t0), ...(carried && {voice: carried})};
}
