// layout — the check only a browser can make: text that spills out of its box, and lit pieces pushed off the slide.
// It drives the built page through the video's browser port (video.js · deckStageDriver · measure), one click at a
// time as it settles. Optional: it needs Playwright (`npm i -D playwright-core`, then `npx playwright-core install
// chromium`); without it the check says so and the other checks still run.
import {realpathSync} from 'node:fs';
import {createRequire} from 'node:module';
import path from 'node:path';
import {deckStageDriver} from '../video.js';
import {packageRoot} from './assets.js';
import {isInside} from './paths.js';

const PLAYWRIGHT = 'playwright-core';   // an optional dependency: named, never imported until a layout check asks

/**
 * Playwright's chromium from the project you run the command in (the current folder), then from where StoryDeck is
 * installed; null when it is not installed. Never from the deck's folder: a deck is content, and a deck someone sent
 * you must not run code by carrying a node_modules of its own — so a project folder that is the deck (or inside it),
 * and a StoryDeck installed inside the deck, are passed over.
 */
export async function findChromium({cwd = process.cwd(), deckRoot = null} = {}) {
  const real = (p) => { try { return realpathSync(p); } catch { return path.resolve(p); } };
  const inDeck = (p) => deckRoot !== null && isInside(deckRoot, real(p));
  const chromiumOf = (mod) => mod?.chromium ?? mod?.default?.chromium ?? null;
  if (!inDeck(cwd)) {
    try {
      return chromiumOf(createRequire(path.join(real(cwd), 'noop.js'))(PLAYWRIGHT));
    } catch { /* not in the project: look beside StoryDeck */ }
  }
  if (inDeck(packageRoot())) return null;
  try { return chromiumOf(await import(/* @vite-ignore */ PLAYWRIGHT)); } catch { return null; }
}

/** Click numbers as short runs: 3–17, 29, 31–37. */
export function clickRuns(ns) {
  const runs = [];
  for (const n of [...new Set(ns)].sort((a, b) => a - b)) {
    const last = runs.at(-1);
    if (last && n === last[1] + 1) last[1] = n; else runs.push([n, n]);
  }
  return runs.map(([a, b]) => (a === b ? `${a}` : `${a}–${b}`)).join(', ');
}

/**
 * What the browser found, as problems ({level, rule, click, label, message}) — the shape check.js reports. The same
 * finding on several clicks (a piece that stays on the map) is one problem, at its first click, naming the others.
 */
export function layoutProblems(found, clicks) {
  const same = new Map();
  for (const f of found) {
    const key = JSON.stringify([f.kind, f.piece, f.text, Math.round(f.dx), Math.round(f.dy)]);
    if (!same.has(key)) same.set(key, {...f, ns: []});
    same.get(key).ns.push(f.n);
  }
  return [...same.values()].sort((a, b) => a.ns[0] - b.ns[0]).map(({ns, kind, piece, text, dx, dy}) => {
    const c = clicks[ns[0] - 1];
    const where = piece ? `"${piece}"` : 'an element';
    const by = [dx > 0 && `${Math.round(dx)} px wide`, dy > 0 && `${Math.round(dy)} px tall`].filter(Boolean).join(' and ');
    const also = ns.length > 1 ? ` (on clicks ${clickRuns(ns)})` : '';
    const message = kind === 'spills'
      ? `text spills out of ${where} by ${by} ("${text}")${also} — shorten it, or give the box more room`
      : `${where} reaches ${by} past the slide's edge ("${text}")${also} — move it in, or zoom less`;
    return {level: 'warn', rule: kind === 'spills' ? 'spills' : 'outside', click: ns[0], label: c?.label ?? null, message};
  });
}

/**
 * Open a built page and measure every click. `driver` is the browser port (deckStageDriver({chromium})), or pass
 * `chromium`. Returns the problems, as check.js reports them.
 */
export async function layoutCheck(url, {clicks, driver, chromium}) {
  const port = driver ?? deckStageDriver({chromium});
  const found = [];
  await port.open(url);
  try {
    for (let n = 1; n <= clicks.length; n++) for (const f of await port.measure(n)) found.push({n, ...f});
  } finally {
    await port.close();
  }
  return layoutProblems(found, clicks);
}
