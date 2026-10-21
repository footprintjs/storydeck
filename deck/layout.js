// layout — the check only a browser can make: text that spills out of its box, and lit pieces pushed off the slide.
// It drives the built page through the video's browser port (video.js · deckStageDriver · measure), one click at a
// time as it settles, offline. Optional: it needs Playwright installed beside StoryDeck (`npm i -D footprint-storydeck
// playwright-core`, then `npx playwright-core install chromium`); without it the check says so and the others run.
import {realpathSync} from 'node:fs';
import {deckStageDriver} from '../video.js';
import {packageRoot} from './assets.js';
import {isInside} from './paths.js';

const PLAYWRIGHT = 'playwright-core';   // an optional dependency: named, never imported until a layout check asks

/**
 * Playwright's chromium, found the way StoryDeck finds its own dependencies — beside it, where it is installed: {chromium}
 * or {chromium: null, why}. Never from the deck's folder or the folder you run in: those may hold files someone sent
 * you, and a module found there would run as you. Loading a package installed beside StoryDeck trusts nothing more than
 * StoryDeck itself, which is already running — unless StoryDeck is running from inside the deck (`deckRoot`), whose
 * node_modules is the deck's, not yours: then nothing is loaded.
 */
export async function findChromium({deckRoot = null} = {}) {
  if (deckRoot !== null && isInside(deckRoot, realpathSync(packageRoot()))) {
    return {chromium: null, why: 'StoryDeck is running from inside the deck folder — run it from your own project, naming the deck'};
  }
  try {
    const mod = await import(/* @vite-ignore */ PLAYWRIGHT);
    return {chromium: mod?.chromium ?? mod?.default?.chromium ?? null, why: null};
  } catch {
    return {chromium: null, why: null};
  }
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
 * Open a built page and measure every click. `driver` is the browser port, or pass `chromium` and the deck-stage driver
 * is made offline: the page loads nothing but itself, so a deck's own scripts cannot reach the network from your
 * machine while it is measured. Returns the problems, as check.js reports them.
 */
export async function layoutCheck(url, {clicks, driver, chromium}) {
  const port = driver ?? deckStageDriver({chromium, offline: true});   // the page is whole; it needs no network
  const found = [];
  try {
    await port.open(url);   // inside the try: a page that never comes up still closes its browser
    for (let n = 1; n <= clicks.length; n++) for (const f of await port.measure(n)) found.push({n, ...f});
  } finally {
    await port.close();
  }
  return layoutProblems(found, clicks);
}
