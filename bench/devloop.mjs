// The editing loop, measured: how long a rebuild takes, and how much a reviewer reads to check a click as text
// instead of a screenshot. Run: node bench/devloop.mjs [deck folder] (the starter deck when none is given).
//
// Tokens for text are ESTIMATED as characters ÷ 4 (a common rule of thumb for English); tokens for a screenshot
// use Anthropic's published image formula, width × height ÷ 750, for a 1920×1080 slide scaled to fit 1568 px.
// Neither is a measured model run.
import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {initDeck} from '../deck/init.js';
import {loadDeck, deckHtml} from '../deck/build.js';
import {outline, reviewClick} from '../deck/review.js';
import {checkDeck, formatProblems} from '../deck/check.js';

const given = process.argv[2];
const work = given ? null : mkdtempSync(path.join(tmpdir(), 'storydeck-bench-'));
const dir = given ?? path.join(work, 'deck');
if (!given) initDeck(dir);

const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const time = (fn, runs = 25) => {
  fn();   // warm
  const ms = [];
  for (let i = 0; i < runs; i++) { const t0 = performance.now(); fn(); ms.push(performance.now() - t0); }
  return median(ms);
};
const tokens = (text) => Math.round(text.length / 4);

const {compiled} = loadDeck(dir);
const n = compiled.clicks.length;
const rebuild = time(() => deckHtml(dir));
const reviews = compiled.clicks.map((c) => reviewClick(compiled, c.n));
const reviewTokens = reviews.map(tokens);
const outlineTokens = tokens(outline(compiled));
const checkTokens = tokens(formatProblems(checkDeck(compiled)));
const [w, h] = [1568, Math.round((1568 * 1080) / 1920)];
const screenshot = Math.round((w * h) / 750);

const rows = [
  ['clicks', n],
  ['rebuild after a save (read, compile, page), median of 25', `${rebuild.toFixed(1)} ms`],
  ['outline, the whole deck', `≈ ${outlineTokens} tokens`],
  ['review of one click, median (max)', `≈ ${median(reviewTokens)} (${Math.max(...reviewTokens)}) tokens`],
  ['check, the whole deck', `≈ ${checkTokens} tokens`],
  ['one screenshot of a slide', `≈ ${screenshot} tokens (${w}×${h})`],
  ['every click as a screenshot', `≈ ${screenshot * n} tokens`],
  ['every click as a review', `≈ ${reviewTokens.reduce((a, b) => a + b, 0)} tokens`],
];
console.log(`| ${path.basename(path.resolve(dir))} | |\n|---|---|\n${rows.map(([k, v]) => `| ${k} | ${v} |`).join('\n')}`);
if (work) rmSync(work, {recursive: true, force: true});
