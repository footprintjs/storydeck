// Test helpers for deck/: a deck in memory (for the pure modules) and a deck on disk (for the Node ones).
import {mkdtempSync, mkdirSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {readConfig} from '../config.js';
import {parseClicks} from '../parse.js';
import {readIcon} from '../transforms.js';
import {STARTER} from '../init.js';

/** A small map: three boxes and two wires, named a, w1, b, w2, c. */
export const MAP = `<div data-k="a" class="box" style="left:100px;top:400px;width:200px;height:150px">A</div>
<i data-k="w1" class="wire pkt" data-arrow="300 470 500 470"></i>
<div data-k="b" class="box" style="left:500px;top:400px;width:200px;height:150px">B</div>
<i data-k="w2" class="wire" data-arrow="700 470 900 470"></i>
<div data-k="c" class="box" style="left:900px;top:400px;width:200px;height:150px">C</div>`;

/** A deck in memory, as source.js · readDeck returns it, from its files' text. */
export function sourceOf({deck = {title: 'T'}, clicks, maps = {map: MAP}, theme = '', icons = {}, post = null} = {}) {
  const config = readConfig(deck);
  return {dir: '/mem', config, clicksHtml: clicks, parts: parseClicks(clicks), maps, themeCss: theme,
    icons: Object.fromEntries(Object.entries(icons).map(([k, v]) => [k, readIcon(k, v)])), post};
}

const made = [];

/** A deck folder on disk ({path: content}, the starter by default); removed by cleanDecks(). */
export function tempDeck(files = STARTER) {
  const dir = mkdtempSync(path.join(tmpdir(), 'storydeck-test-'));
  made.push(dir);
  for (const [file, content] of Object.entries(files)) {
    const full = path.join(dir, file);
    mkdirSync(path.dirname(full), {recursive: true});
    writeFileSync(full, content);
  }
  return dir;
}

/** An empty temporary folder; removed by cleanDecks(). */
export function tempDir() {
  const dir = mkdtempSync(path.join(tmpdir(), 'storydeck-test-'));
  made.push(dir);
  return dir;
}

export function cleanDecks() {
  while (made.length) rmSync(made.pop(), {recursive: true, force: true});
}

/** A writable that keeps what it is given. */
export function sink() {
  const chunks = [];
  return {write: (t) => { chunks.push(String(t)); return true; }, text: () => chunks.join('')};
}

/**
 * `count` texts made of `tokens`, each 1 to `length` of them, from a seeded stream: the same texts on every run. For
 * proving a rewritten scan reads exactly what the one it replaced read.
 */
export function generated(tokens, {count, seed = 7, length = 40}) {
  let s = seed;
  const next = () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return Array.from({length: count}, () => Array.from({length: 1 + Math.floor(next() * length)}, () => tokens[Math.floor(next() * tokens.length)]).join(''));
}
