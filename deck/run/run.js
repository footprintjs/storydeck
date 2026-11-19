// run — one run of a deck, start to finish: the chart built from its wiring (chart.js), run once with the recorders
// (engine.js), kept in the deck's log (log.js), and handed back as what the reply is made of (reply.js). `storydeck
// check` and `storydeck build` are both this run: a build is a check that also writes the page, so the two can never
// disagree about a deck, and each leaves the same record.
import {storydeckHome} from '../noteKey.js';
import {deckRoot} from '../paths.js';
import {runWiring} from './chart.js';
import {buildChart, engine, mermaidOf, runChart} from './engine.js';
import {keepRun, runFiles, runsFolder} from './log.js';
import {clickOfCall, measureWiring} from './measure.js';

const firstLine = (error) => String(error?.message ?? error).split('\n')[0];

/** Where this run is kept: {dir, files}, or {why} it is not (`why` null when there is no deck folder to keep it for). */
function placeFor(home, dir, kind, at) {
  let root;
  try { root = deckRoot(dir); } catch { return {why: null}; }   // not a folder: the run says so itself
  const {dir: folder, why} = runsFolder(home, root);
  return folder ? {dir: folder, files: runFiles(folder, kind, at)} : {why};
}

/** A run's calls as they are kept: a browser.measure call's place among its stage's calls is the click it measured. */
const callsKept = (calls) => Object.fromEntries(Object.entries(calls).map(([target, c]) =>
  [target, {...c, slowest: target === 'browser.measure' && c.count > 1 && c.slowest ? clickOfCall(c.slowest) : null}]));

/** The run kept: where it stands against the one before ({round, first, closed, since}), or {unkept: why}. */
function keep(place, run, at) {
  if (!place.files) return place.why ? {unkept: place.why} : {};
  try { return keepRun(place.dir, place.files, run, at); } catch (error) { return {unkept: firstLine(error)}; }
}

/**
 * Run a deck folder once. `write` writes its page (a build; without it, a check); `layout` measures the page in a
 * browser (Playwright beside StoryDeck — or `chromium`, or a `driver`, given by a test; `limits`: how long each call to
 * it may take, measure.js · CALL_LIMITS); `out` and `voice` are the build's (build.js). The run is kept in the person's
 * StoryDeck folder (`home`) unless `keep` is false.
 *
 * Returns {kind, verdict ('clean' | 'fix' | 'broken'), problems, errors, warnings, infos, clicks, measured, layoutNote,
 * written, ms}, and where it stands against the run before: {round, first, closed, since} — or {unkept: why}. A run
 * that cannot finish (a page that may not be written) throws what stopped it, as a build always has, and is kept too.
 */
export async function runDeck(dir, {write = false, layout = false, out, voice = false, chromium, driver, limits, home = storydeckHome(), keep: kept = true} = {}) {
  const eng = await engine(), kind = write ? 'build' : 'check', at = new Date(), t0 = performance.now(), said = [];
  const run = {dir, options: {write, layout, out, voice, chromium, driver, limits, home}, decide: eng.decide};
  const place = kept ? placeFor(home, dir, kind, at) : {why: null};
  let taken = null, failure = null;
  try {
    taken = await runChart(eng, buildChart(eng, runWiring(run), said), {record: place.files?.record});
  } catch (error) {
    failure = error;
    taken = error?.run ?? null;
  }
  const state = taken?.state ?? {};
  const result = {kind, verdict: failure ? 'failed' : state.verdict, problems: state.problems ?? [], errors: state.errors ?? 0, warnings: state.warnings ?? 0,
    infos: state.infos ?? 0, clicks: state.clicks ?? 0, measured: state.measured === true, layoutNote: state.layoutNote ?? null, written: state.written ?? null,
    ms: Math.round(performance.now() - t0)};
  const stand = keep(place, {...result, written: Boolean(result.written), stages: taken?.stages ?? [], calls: callsKept(taken?.calls ?? {}), lines: taken?.lines ?? [],
    engine: said, failure: failure ? firstLine(failure) : null}, at);
  if (failure) throw failure;
  return {...result, ...stand};
}

/** The run's chart and the browser adapter's, each drawn as Mermaid text, for the README (a test fails when they differ): {run, measure}. */
export async function runMermaid() {
  const eng = await engine(), run = {dir: '.', options: {}, decide: eng.decide};
  return {run: mermaidOf(buildChart(eng, runWiring(run))), measure: mermaidOf(buildChart(eng, measureWiring(run)))};
}
