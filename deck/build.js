// build — a deck folder made into its page, and written (Node). `storydeck build` and the dev server both run it.
import path from 'node:path';
import {readDeck} from './source.js';
import {compileDeck} from './compile.js';
import {deckPage, deckStyles} from './page.js';
import {pageAssets} from './assets.js';
import {deckRoot, writeInside} from './paths.js';
import {clipTags} from './narrate.js';
import {inlineStrokes} from './isoPaint.js';

/**
 * A deck folder read and compiled: {source, compiled}. Throws, naming the file, part and click, when it cannot be.
 * `dev` numbers the pieces in the slides for the dev page (compile.js).
 */
export function loadDeck(dir, {dev = false} = {}) {
  const source = readDeck(dir);
  return {source, compiled: compileDeck(source, {dev})};
}

/**
 * The page of a deck already read and compiled (`loaded`: what loadDeck gave), as a string: {source, compiled, html}.
 * `dev` adds the dev client (dev.js); `voice` carries the clips `storydeck narrate` made, and adds {voice: {have, wanted}}.
 * One reading can so be checked, measured and written: nothing is read twice, so nothing can change between.
 */
export function pageOf(dir, {source, compiled}, {dev = null, voice = false} = {}) {
  const clips = voice ? clipTags(deckRoot(dir), compiled) : null;
  return {source, compiled, html: deckPage(compiled, pageAssets(), {dev, voiceTags: clips?.tags}), ...(clips && {voice: {have: clips.have, wanted: clips.wanted}})};
}

/** The page of a deck folder, as a string (no file written): loadDeck, then pageOf. */
export const deckHtml = (dir, {dev = null, voice = false} = {}) => pageOf(dir, loadDeck(dir, {dev: Boolean(dev)}), {dev, voice});

/**
 * Write a page that was made (`made`: what pageOf or deckHtml gave): the page (deck.json "out", index.html by default,
 * inside the folder — or `out`, a path the caller chose) and, when deck.json names one, the deck-data.json the
 * Read/Scroll lenses take. Returns what was written: {file, bytes, slides, clicks, data}, and {voice} when the page carries one.
 */
export function writeDeck(dir, {compiled, html, voice: carried}, {out} = {}) {
  const root = deckRoot(dir);
  const file = out === undefined ? path.join(root, compiled.config.out) : path.resolve(out);
  writeInside(root, file, html, {chosen: out !== undefined});
  let data = null;
  if (compiled.config.deckData) {
    data = path.join(root, compiled.config.deckData);
    const deckCss = deckStyles(compiled, pageAssets());
    writeInside(root, data, JSON.stringify({deckCss, sections: compiled.slides.map(({label, html: h}) => ({label, html: compiled.strokeDefs ? inlineStrokes(h, compiled.strokeDefs) : h}))}, null, 1));
  }
  return {file, bytes: Buffer.byteLength(html), slides: compiled.slides.length, clicks: compiled.clicks.length, data, ...(carried && {voice: carried})};
}

/**
 * Build a deck folder: read, compile, make the page and write it (writeDeck). `voice` carries the clips in the page: a
 * cloned voice is the speaker's own, so only the person's own command asks. Returns what was written, and `ms`: how long it took.
 */
export function buildDeck(dir, {out, voice = false} = {}) {
  const t0 = performance.now();
  const written = writeDeck(dir, deckHtml(dir, {voice}), {out});
  const {voice: carried, ...rest} = written;
  return {...rest, ms: Math.round(performance.now() - t0), ...(carried && {voice: carried})};
}
