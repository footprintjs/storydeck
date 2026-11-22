// run — one run of a deck, start to finish: the chart built from its wiring (chart.js), run once with the recorders
// (engine.js), kept in the deck's log (log.js), and handed back as what the reply is made of (reply.js). `storydeck
// check` and `storydeck build` are both this run: a build is a check that also writes the page, so the two can never
// disagree about a deck, and each leaves the same record.
import {rmSync} from 'node:fs';
import {storydeckHome} from '../noteKey.js';
import {deckRoot} from '../paths.js';
import {runWiring} from './chart.js';
import {buildChart, engine, mermaidOf, runChart} from './engine.js';
import {keepRun, mapRecordOf, motionRecordOf, runFiles, runsFolder} from './log.js';
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

/** The deck's maps with no isometric piece, by name: what a question about a map the run did not build is answered with. */
const flatMaps = (run) => Object.entries(run.loaded?.compiled?.maps ?? {}).filter(([, map]) => !map.made).map(([name]) => name);

/** The run kept: where it stands against the one before ({round, first, closed, since, carried}), or {unkept: why}. */
function keep(place, run, at) {
  if (!place.files) return place.why ? {unkept: place.why} : {};
  try {
    const {layout: _keys, ...stand} = keepRun(place.dir, place.files, run, at);   // which problems are open is the log's own to hold
    return stand;
  } catch (error) {
    return {unkept: firstLine(error)};
  }
}

/**
 * Run a deck folder once. `write` writes its page (a build; without it, a check); `layout` measures the page in a
 * browser (Playwright beside StoryDeck — or `chromium`, or a `driver`, given by a test; `limits`: how long each call to
 * it may take, measure.js · CALL_LIMITS); `out` and `voice` are the build's (build.js). The run is kept in the person's
 * StoryDeck folder (`home`) unless `keep` is false. A deck with an isometric map also builds each map again with
 * footprint-story's map flow (maps.js; `mapFlow`: a test's stand-in for runMapFlow; `limits['map.flow']`: its time
 * limit), each with its own record beside the run's.
 *
 * Returns {kind, verdict ('clean' | 'fix' | 'broken'), problems, errors, warnings, infos, clicks, measured, layoutNote,
 * written, ms, maps: {runs: [{name, file, control, keys, differs?}], skipped}, id?: the run's id when it was kept},
 * and where it stands against the run before: {round, first, closed, since, carried} — or {unkept: why}.
 * `carried`: how many problems a browser found before that this run did not measure again (they stay open). A run
 * that cannot finish (a page that may not be written) throws what stopped it, as a build always has, and is kept too.
 */
export async function runDeck(dir, {write = false, layout = false, out, voice = false, chromium, driver, limits, mapFlow, home = storydeckHome(), keep: kept = true} = {}) {
  const eng = await engine(), kind = write ? 'build' : 'check', at = new Date(), t0 = performance.now(), said = [];
  const run = {dir, options: {write, layout, out, voice, chromium, driver, limits, home, mapFlow}, decide: eng.decide, engine: eng};
  const place = kept ? placeFor(home, dir, kind, at) : {why: null};
  // each isometric map's own record, beside this run's (maps.js): named by the map's place in the list, never its words
  run.mapRecord = (k) => (place.files ? mapRecordOf(place.files, k) : null);
  run.motionRecord = (k) => (place.files ? motionRecordOf(place.files, k) : null);
  let taken = null, failure = null;
  try {
    taken = await runChart(eng, buildChart(eng, runWiring(run), said), {record: place.files?.record});
  } catch (error) {
    failure = error;
    taken = error?.run ?? null;
  }
  const state = taken?.state ?? {}, found = state.problems ?? [], measured = state.layoutProblems ?? [];   // by the rules, and by the browser
  const result = {kind, verdict: failure ? 'failed' : state.verdict, problems: [...found, ...measured], errors: state.errors ?? 0, warnings: state.warnings ?? 0,
    infos: state.infos ?? 0, clicks: state.clicks ?? 0, measured: state.measured === true, layoutNote: state.layoutNote ?? null, written: state.written ?? null,
    ms: Math.round(performance.now() - t0), maps: run.mapRuns ?? {runs: [], skipped: 0}, ...(run.motionRuns ? {motions: run.motionRuns} : {})};   // the time in all, as whoever ran it waited for it
  const stand = keep(place, {...result, problems: found, layoutProblems: measured, written: Boolean(result.written), stages: taken?.stages ?? [],
    calls: callsKept(taken?.calls ?? {}), lines: taken?.lines ?? [], control: taken?.control ?? {}, engine: said, failure: failure ? firstLine(failure) : null,
    flat: flatMaps(run)}, at);
  // a run not kept keeps no map record either
  if (stand.unkept !== undefined || !place.files) for (const m of [...result.maps.runs, ...(result.motions?.runs ?? [])]) if (m.file) rmSync(m.file, {force: true});
  if (failure) throw failure;
  return {...result, ...stand, ...(place.files && stand.unkept === undefined ? {id: place.files.id} : {})};
}

/** The run's chart and the browser adapter's, each drawn as Mermaid text, for the README (a test fails when they differ): {run, measure}. */
export async function runMermaid() {
  const eng = await engine(), run = {dir: '.', options: {}, decide: eng.decide};
  return {run: mermaidOf(buildChart(eng, runWiring(run))), measure: mermaidOf(buildChart(eng, measureWiring(run)))};
}
