// maps — each isometric map the deck built, built again by footprint-story's map flow, and that run's record kept for
// `storydeck log --why <key> --map <map>`.
//
// WHY here, in the run's `maps made` stage: a check or a build is the one call after an edit, and it already keeps a
// record that `log --why` reads. The compile builds each map on its synchronous path (isoSpec.js · builtMap, with
// buildIsoMap); a footprintjs run is asynchronous, so the run does it. Each map is a run of its own (a record holds
// one run), with its own record file beside the run's own, so "why does this block stand here" is walked back
// through a real run of the same steps, nothing run again when it is asked.
//
// The map flow is handed the very spec buildIsoMap was handed (compile.js keeps it, frozen, as the map's `built`), with
// the deck's policy and its handed-in style choices (isoSpec.js · DECK, DECK_CHOICES): never one made again here. Its map must equal the one the page draws; a
// difference is said aloud (`differs`), first in every answer for that map, and counts in no verdict — the page draws
// the deck's map, so it is no fault of the deck's, but it is never silent.
//
// Each map flow is a named call (`scope.$call('map.flow', …)`, the run's law for a tool outside): one line of the
// record a map, with its time and how it ended, and a time limit, so a run that never settles ends as a recorded
// time-out and the run goes on. Whatever a map run does — throws, returns nothing, never settles — is said, never a
// failed run. A record that cannot be written never costs the run.
import {lstatSync, rmSync} from 'node:fs';
import {isDeepStrictEqual} from 'node:util';
import {DECK, DECK_CHOICES} from '../isoSpec.js';
import {KEY} from './log.js';

/** The most maps one run builds again: past it the rest are counted, and the reply says so. */
export const MAPS_MOST = 32;
/** The call each map flow is, by name: how the run's record and its log count them. */
export const MAP_FLOW = 'map.flow';
/** How long one map flow may take (ms) before it is given up: a map is built in well under a second. */
export const MAP_FLOW_MS = 30_000;
/** The most characters of a difference said: where two maps part, one line. */
const SAID = 300;
const KEYS_MOST = 60;
/** The most characters a value is shown with where two maps part. */
const SHOWN = 60;

const shown = (v) => { const s = JSON.stringify(v) ?? String(v); return s.length > SHOWN ? `${s.slice(0, SHOWN - 1)}…` : s; };

/** Whatever was thrown, in words, on one line: never a throw itself. */
export function thrownText(e) {
  try { return String(e?.message ?? e).replace(/\s+/g, ' ').trim().slice(0, SAID); } catch { return 'something that cannot be said in words was thrown'; }
}

/** Where two plain values first part, as a path and both values ("view.tile[0]: 120 here, 96 in the deck's"), or null. */
export function firstDifference(here, deck, at = '') {
  if (isDeepStrictEqual(here, deck)) return null;
  const both = (v) => v !== null && typeof v === 'object';
  if (both(here) && both(deck) && Array.isArray(here) === Array.isArray(deck)) {
    for (const k of new Set([...Object.keys(here), ...Object.keys(deck)])) {
      const deeper = firstDifference(here[k], deck[k], Array.isArray(here) ? `${at}[${k}]` : at ? `${at}.${k}` : k);
      if (deeper) return deeper;
    }
  }
  return `${at || 'the map'}: ${shown(here)} here, ${shown(deck)} in the deck's`;
}

/** A map run's answer as the run can use it: {map, snapshot} with a commit log — or {failed: why}. */
function readMade(made) {
  if (!made || typeof made !== 'object') return {failed: 'the map flow returned no map'};
  const {map, snapshot} = made;
  if (!map || typeof map !== 'object') return {failed: 'the map flow returned no map'};
  if (!snapshot || typeof snapshot !== 'object' || !Array.isArray(snapshot.commitLog)) return {failed: 'the map flow returned no run (no snapshot with its commit log)'};
  return {map, snapshot};
}

/**
 * `promise`, or a rejection after `ms`, the timer cleared either way. WHY not unref'd: the run waits on this answer, so
 * the timer must keep the process alive — unref'd, a promise that never settles (nothing else pending) lets node end
 * before the bound, with the run never settled (StoryReel saw it on CI).
 */
export function within(promise, ms, what) {
  let timer;
  const late = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`${what} did not finish within ${ms / 1000} s`)), ms); });
  return Promise.race([promise, late]).finally(() => clearTimeout(timer));
}

/** Is there a plain file at `file` (never a link)? */
export const isFile = (file) => { try { return lstatSync(file).isFile(); } catch { return false; } };

/** A call's limit: the caller's own for it when that is a time (a number over 0), else MAP_FLOW_MS. */
const limitOf = (limits) => (Number.isFinite(limits?.[MAP_FLOW]) && limits[MAP_FLOW] > 0 ? limits[MAP_FLOW] : MAP_FLOW_MS);

/**
 * One map built again: {name, file, control, keys, differs?} — `file` the record kept (null when none was; one begun and not
 * kept is removed), `control` which decision let each step run (footprint-story/record · controlEdges).
 */
async function flowOne(scope, run, {name, built}, file, ms) {
  const eng = run.engine;
  // the map flow, loaded only for a deck with a map, inside the call: a door that cannot load is that map's failure, said
  const flowOf = async () => run.options?.mapFlow ?? (await import('footprint-story/mapflow')).runMapFlow;
  let sink = null;
  try { sink = file ? eng.fileSink(file) : null; } catch { /* no record: the map is still built, and compared */ }
  const control = eng.controlDepRecorder();
  let made;
  try {
    made = readMade(await scope.$call(MAP_FLOW, async () => (await flowOf())(built.spec, DECK, {choices: DECK_CHOICES, ...(sink ? {sink} : {}), recorders: [control]}), {attempts: 1, timeoutMs: ms}));
  } catch (e) {
    made = {failed: e?.name === 'AttemptTimeoutError' ? `it did not finish within ${ms / 1000} s` : thrownText(e)};
  }
  let kept = Boolean(sink) && !made.failed;
  try { await within(Promise.resolve(sink?.close()), ms, 'the map\'s record'); } catch { kept = false; }
  kept &&= isFile(file);
  if (file && !kept) rmSync(file, {force: true});
  let edges = {};
  try { edges = made.failed ? {} : eng.controlEdges(made.snapshot.commitLog, control); } catch { /* the record still answers, without the decisions' words */ }
  let differs = null;
  try { differs = made.failed ? `the map flow failed where the deck built the map: ${made.failed}` : firstDifference(made.map, built.map); } catch (e) { differs = `the two maps could not be compared: ${thrownText(e)}`; }
  // what that run wrote, by name: what `--why` with `--map` and no key lists (the step list is the kit's, never copied here)
  let keys = [];
  try { keys = made.failed ? [] : Object.keys(made.snapshot.sharedState ?? {}).filter((k) => KEY.test(k)).slice(0, KEYS_MOST); } catch { /* no names to list */ }
  return {name, file: kept ? file : null, control: edges, keys, ...(differs ? {differs: String(differs).replace(/\s+/g, ' ').slice(0, SAID)} : {})};
}

/**
 * Every isometric map of the compiled deck built again, one after another (`maps`: [{name, built}], in the deck's
 * order). `run.mapRecord(k)`: the file the k-th map's record is written to (run.js), or null: then that map keeps none.
 * Returns {runs: [{name, file, control, keys, differs?}], skipped}.
 */
export async function flowMaps(scope, run, maps) {
  const runs = [], ms = limitOf(run.options?.limits);
  for (const one of maps.slice(0, MAPS_MOST)) {
    let file = null;
    try { file = run.mapRecord?.(runs.length) ?? null; } catch { /* a folder that cannot hold a record: the map is built without one */ }
    // whatever goes wrong around a map's run is that map's failure, said: never the run's, never a promise left unhandled
    try {
      runs.push(await flowOne(scope, run, one, file, ms));
    } catch (e) {
      if (file) rmSync(file, {force: true});
      runs.push({name: one.name, file: null, control: {}, keys: [], differs: `the map flow failed where the deck built the map: ${thrownText(e)}`});
    }
  }
  return {runs, skipped: Math.max(0, maps.length - MAPS_MOST)};
}
