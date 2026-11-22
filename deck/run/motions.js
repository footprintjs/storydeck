// motions — each map's block moves (data-move) planned again through footprint-story's intent decider as a chart, its
// run's record kept for `storydeck log --why duration-0 --motion <map>`.
//
// WHY here, as the maps are (maps.js): a map's moves are planned on the compile's synchronous path (footprint-story ·
// planIntents, deck/motionPlan.js) and a footprintjs run is asynchronous, so the compiled deck hands each moving map's
// run out (compile.js · maps[name].motion.run) and the run's `maps made` stage runs it — each map's moves a run of its
// own, with its own record file, so "why does the box take 0.47 s" is answered from a real run of the same intents
// (`duration-<i>`: move i's seconds and the law's numbers; `model-<i>`: why its model; `findings-<i>`: its critics).
//
// The same rules as a map flow's: a named call with a time limit (`scope.$call('motion.flow', …)`), a record named by
// its place, whatever the run does — throws, returns nothing, never settles — said and never a failed run, and a
// result that parts from the compile's said aloud (`differs`).
import {rmSync} from 'node:fs';
import {isFile, thrownText, within} from './maps.js';
import {MOTION_KEY} from './log.js';

/** The most maps' moves one run plans again; the call each is, by name; how long one may take (ms). */
export const MOTIONS_MOST = 32;
export const MOTION_FLOW = 'motion.flow';
export const MOTION_FLOW_MS = 30_000;
const KEYS_MOST = 200;

const limitOf = (limits) => (Number.isFinite(limits?.[MOTION_FLOW]) && limits[MOTION_FLOW] > 0 ? limits[MOTION_FLOW] : MOTION_FLOW_MS);

/** One map's moves planned again: {name, file, control, keys, differs?}. */
async function flowOne(scope, run, {name, motion}, file, ms) {
  const eng = run.engine;
  let sink = null;
  try { sink = file ? eng.fileSink(file) : null; } catch { /* no record: the moves are still planned, and compared */ }
  const control = eng.controlDepRecorder();
  let made;
  try {
    made = await scope.$call(MOTION_FLOW, () => motion.run({...(sink ? {sink} : {}), recorders: [control]}), {attempts: 1, timeoutMs: ms});
    if (!made || typeof made !== 'object' || !Array.isArray(made.snapshot?.commitLog)) made = {failed: 'the motion flow returned no run (no snapshot with its commit log)'};
  } catch (e) {
    made = {failed: e?.name === 'AttemptTimeoutError' ? `it did not finish within ${ms / 1000} s` : thrownText(e)};
  }
  let kept = Boolean(sink) && !made.failed;
  try { await within(Promise.resolve(sink?.close()), ms, 'the motion\'s record'); } catch { kept = false; }
  kept &&= isFile(file);
  if (file && !kept) rmSync(file, {force: true});
  let edges = {};
  try { edges = made.failed ? {} : eng.controlEdges(made.snapshot.commitLog, control); } catch { /* the record still answers, without the decisions' words */ }
  const differs = made.failed ? `the motion flow failed where the deck planned the moves: ${made.failed}` : made.differs;
  let keys = [];
  try { keys = made.failed ? [] : Object.keys(made.snapshot.sharedState ?? {}).filter((k) => MOTION_KEY.test(k)).slice(0, KEYS_MOST); } catch { /* no names to list */ }
  return {name, file: kept ? file : null, control: edges, keys, ...(differs ? {differs: String(differs).replace(/\s+/g, ' ').slice(0, 300)} : {})};
}

/**
 * Every moving map's moves planned again, one after another (`maps`: [{name, motion}], motion as compile.js keeps it).
 * `run.motionRecord(k)`: the file the k-th one's record is written to, or null. Returns {runs, skipped}.
 */
export async function flowMotions(scope, run, maps) {
  const runs = [], ms = limitOf(run.options?.limits);
  for (const one of maps.slice(0, MOTIONS_MOST)) {
    let file = null;
    try { file = run.motionRecord?.(runs.length) ?? null; } catch { /* no record for this one */ }
    try {
      runs.push(await flowOne(scope, run, one, file, ms));
    } catch (e) {
      if (file) rmSync(file, {force: true});
      runs.push({name: one.name, file: null, control: {}, keys: [], differs: `the motion flow failed where the deck planned the moves: ${thrownText(e)}`});
    }
  }
  return {runs, skipped: Math.max(0, maps.length - MOTIONS_MOST)};
}
