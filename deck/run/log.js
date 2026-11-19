// log — the runs of a deck, kept with the person (Node). Every check and build leaves one small file: its verdict, its
// counts, which problems were open, each stage's time, each tool's calls, and the run in words. So the next run can say
// what changed since ("2 fixed, 1 new · round 3"), `storydeck log` can show how a deck's fixing went, and a run that
// went wrong is read back instead of run again. Beside it the engine keeps the record itself (engine.js · runChart).
//
// Where: <the person's StoryDeck folder>/runs/<an id of the deck's real path>/ — with the person, never in the deck: a
// deck may be someone else's folder, and nothing is written there but its own page. A folder that cannot be used (it is
// inside the deck, or not the person's) keeps nothing, and the run says why; a run's answer never waits on its log.
//
// What is read back is read as a file anyone may have put there: only names this module writes, plain files, bounded,
// and each field taken by its type — a number as a number, text cut and shown as plain text by its caller.
import {createHash, randomBytes} from 'node:crypto';
import {closeSync, constants, fstatSync, lstatSync, mkdirSync, openSync, readFileSync, readdirSync, renameSync, rmSync, writeSync} from 'node:fs';
import path from 'node:path';
import {homeInsideDeck} from '../noteKey.js';
import {isInside, realPath} from '../paths.js';

/** How many runs a deck keeps: one more drops the oldest, with its record. */
export const RUNS_KEPT = 30;
/** The most one kept run holds: bytes in all, lines of the run in words, characters a line, problems told apart. */
export const MOST = Object.freeze({bytes: 512 * 1024, lines: 400, chars: 400, keys: 500});
/** The tools whose calls are counted. */
export const COUNTED = Object.freeze(['outline', 'review', 'feedback', 'check', 'build', 'narrate', 'log']);

const NOFOLLOW = constants.O_NOFOLLOW ?? 0, NONBLOCK = constants.O_NONBLOCK ?? 0;
const RUN = /^(\d{4}-\d\d-\d\dT\d\d-\d\d-\d\d-\d{3}Z)-(check|build)\.([0-9a-f]{6})\.json$/;
const RUN_FILE = /^\d{4}-\d\d-\d\dT\d\d-\d\d-\d\d-\d{3}Z-(check|build)\.[0-9a-f]{6}\.(json|record\.jsonl)$/;
const CALLS = 'calls.json';
const VERDICTS = ['clean', 'fix', 'broken', 'failed'];

/** A count read back: a whole number from 0 that a number holds exactly, or 0. */
const whole = (v) => (Number.isSafeInteger(v) && v >= 0 ? v : 0);
const text = (v, most = MOST.chars) => (typeof v === 'string' ? v.slice(0, most) : '');
const plain = (v) => (v !== null && typeof v === 'object' && !Array.isArray(v) ? v : {});

/** Where a deck's runs are kept: {dir}, made if need be — or {why} it keeps none. `root` is the deck's real path. */
export function runsFolder(home, root) {
  try {
    if (homeInsideDeck(home, root)) return {why: `the StoryDeck folder ${home} is inside the deck folder — set STORYDECK_HOME elsewhere`};
    const dir = path.join(home, 'runs', createHash('sha256').update(root).digest('hex').slice(0, 16));
    mkdirSync(dir, {recursive: true, mode: 0o700});
    // the folder itself, not a link someone put at its name: its real place is inside the person's folder
    if (!lstatSync(dir).isDirectory() || !isInside(realPath(home), realPath(dir))) return {why: `${dir} is not a folder of your own`};
    return {dir};
  } catch (error) {
    return {why: error.message};
  }
}

/** A new run's two files in a folder: {id, file (what this module writes), record (what the engine writes as the run goes)}. */
export function runFiles(dir, kind, at = new Date()) {
  const id = `${at.toISOString().replace(/[:.]/g, '-')}-${kind}.${randomBytes(3).toString('hex')}`;   // two runs in one millisecond: two files
  return {id, file: path.join(dir, `${id}.json`), record: path.join(dir, `${id}.record.jsonl`)};
}

/** How each open problem is told from the others between two runs: its rule and its click's label (a number moves when a click is added). */
export function problemKeys(problems) {
  const counts = new Map();
  for (const p of problems) {
    if (p.level !== 'error' && p.level !== 'warn') continue;
    const key = `${p.rule}|${p.label ?? ''}`.slice(0, 160);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts].slice(0, MOST.keys);
}

/** What changed between two runs' open problems: {fixed, new}, each a count. */
function changed(before, now) {
  const was = new Map(before), is = new Map(now);
  let fixed = 0, fresh = 0;
  for (const [key, n] of was) fixed += Math.max(0, n - (is.get(key) ?? 0));
  for (const [key, n] of is) fresh += Math.max(0, n - (was.get(key) ?? 0));
  return {fixed, new: fresh};
}

/**
 * Where a run stands in the deck's fixing, from the run before it (`prev`, or null): {round, first, closed, since}.
 * A round is a run that ended with something to fix; rounds in a row are one series, and a clean run closes it.
 * `round`: this run's number in its series (0 when clean). `first`: what the series began with ({errors, warnings}).
 * `closed`: {rounds, first} when this clean run ends a series. `since`: {fixed, new} against the run before.
 */
export function progress(prev, now) {
  const open = now.verdict !== 'clean', series = Boolean(prev && prev.round > 0);
  return {
    round: open ? (series ? prev.round + 1 : 1) : 0,
    first: open ? (series ? prev.first : {errors: now.errors, warnings: now.warnings}) : null,
    closed: !open && series ? {rounds: prev.round, first: prev.first} : null,
    since: prev ? changed(prev.keys, now.keys) : null,
  };
}

const counts = (v) => ({errors: whole(plain(v).errors), warnings: whole(plain(v).warnings)});

/** A kept run as this module reads it back: every field by its type, or null when the file is not one of ours. */
function readRun(data) {
  const d = plain(data);
  if (d.v !== 1 || !VERDICTS.includes(d.verdict)) return null;
  const pairs = (list, most) => (Array.isArray(list) ? list : []).slice(0, most).filter((x) => Array.isArray(x) && typeof x[0] === 'string').map(([k, n]) => [text(k, 160), whole(n)]);
  const calls = Object.fromEntries(Object.entries(plain(d.calls)).slice(0, 16).map(([target, c]) => [text(target, 60), {
    count: whole(plain(c).count), ok: whole(plain(c).ok), failed: whole(plain(c).failed), timeout: whole(plain(c).timeout),
    p50: whole(plain(c).p50), max: whole(plain(c).max), slowest: plain(c).slowest === null ? null : whole(plain(c).slowest),
  }]));
  return {
    at: text(d.at, 30), kind: d.kind === 'build' ? 'build' : 'check', verdict: d.verdict, errors: whole(d.errors), warnings: whole(d.warnings), infos: whole(d.infos),
    clicks: whole(d.clicks), measured: d.measured === true, written: d.written === true, ms: whole(d.ms),
    round: whole(d.round), first: d.first ? counts(d.first) : null, closed: d.closed ? {rounds: whole(plain(d.closed).rounds), first: counts(plain(d.closed).first)} : null,
    since: d.since ? {fixed: whole(plain(d.since).fixed), new: whole(plain(d.since).new)} : null,
    keys: pairs(d.keys, MOST.keys),
    stages: (Array.isArray(d.stages) ? d.stages : []).slice(0, 64).map((s) => ({stage: text(plain(s).stage, 80), ms: whole(plain(s).ms)})),
    calls, failure: d.failure === null || d.failure === undefined ? null : text(d.failure, 2000),
    lines: (Array.isArray(d.lines) ? d.lines : []).slice(0, MOST.lines).map((l) => text(l)),
    engine: (Array.isArray(d.engine) ? d.engine : []).slice(0, 20).map((l) => text(l)),
  };
}

/** A plain file of bounded size read as JSON, never through a link: its data, or null. */
function readJson(file) {
  let fd;
  try {
    fd = openSync(file, constants.O_RDONLY | NOFOLLOW | NONBLOCK);   // never through a link, never waiting on a pipe put at its name
    const st = fstatSync(fd);   // the file that was opened, whatever its name holds now
    return st.isFile() && st.size <= MOST.bytes ? JSON.parse(readFileSync(fd, 'utf8')) : null;
  } catch {
    return null;
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
}

/** The names of a folder's kept runs, oldest first. */
const runNames = (dir) => { try { return readdirSync(dir).filter((n) => RUN.test(n)).sort(); } catch { return []; } };

/** The kept runs of a folder, newest first: each as readRun gives it, with its `id` and its `record` file. */
export function keptRuns(dir) {
  return runNames(dir).reverse().flatMap((name) => {
    const run = readRun(readJson(path.join(dir, name))), id = name.slice(0, -'.json'.length);
    return run ? [{id, record: path.join(dir, `${id}.record.jsonl`), ...run}] : [];
  });
}

/** A new file of the person's own, written whole: never an existing one, never through a link. */
function writeNew(file, body) {
  const fd = openSync(file, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | NOFOLLOW, 0o600);
  try { writeSync(fd, body); } finally { closeSync(fd); }
}

/** A folder's older runs go, summary and record alike, so RUNS_KEPT stay. Two processes may drop at once: a file gone under one is no failure. */
function dropOld(dir) {
  let names;
  try { names = readdirSync(dir).filter((n) => RUN_FILE.test(n)); } catch { return; }
  const idOf = (name) => name.replace(/\.(json|record\.jsonl)$/, '');
  const old = new Set([...new Set(names.map(idOf))].sort().slice(0, -RUNS_KEPT));   // a record whose summary was never written goes in its turn too
  for (const name of names) if (old.has(idOf(name))) rmSync(path.join(dir, name), {force: true});
}

/** The run in words, as it is kept: one line an entry, cut to MOST.chars, at most MOST.lines of them. */
const keptLines = (lines) => lines.slice(0, MOST.lines).map((l) => `${l.type === 'stage' ? '' : '  '}${String(l.text).replace(/\s*\r?\n\s*/g, ' ⏎ ')}`.slice(0, MOST.chars));

/**
 * Keep one run: its file written in `files` (runFiles), and where it stands against the run before ({round, first,
 * closed, since}). `run`: {kind, verdict, problems, errors, warnings, infos, clicks, measured, written, ms, stages,
 * calls, lines, engine, failure?} — calls already hold which click was slowest, as a number.
 */
export function keepRun(dir, files, run, at = new Date()) {
  const keys = problemKeys(run.problems ?? []), stand = progress(keptRuns(dir)[0] ?? null, {...run, keys});
  const body = {v: 1, at: at.toISOString(), kind: run.kind, verdict: run.verdict, errors: run.errors, warnings: run.warnings, infos: run.infos,
    clicks: run.clicks, measured: run.measured, written: run.written, ms: run.ms, ...stand, keys,
    stages: (run.stages ?? []).slice(0, 64).map((st) => ({stage: text(st.stage, 80), ms: whole(st.ms)})), calls: run.calls ?? {},
    failure: run.failure ? text(run.failure, 2000) : null, engine: (run.engine ?? []).slice(0, 20).map((w) => text(w)), lines: keptLines(run.lines ?? [])};
  let out = JSON.stringify(body);
  // text in another script is three bytes a character: a run in words that would not fit goes, and the counts stay
  if (Buffer.byteLength(out) > MOST.bytes) out = JSON.stringify({...body, lines: [], keys: keys.slice(0, 50), cut: true});
  writeNew(files.file, out);
  dropOld(dir);
  return stand;
}

/** How often each tool was called on a deck, read back by its type: {since, tools: {name: count}}. */
export function callCounts(dir) {
  const d = plain(readJson(path.join(dir, CALLS))), tools = d.v === 1 ? plain(d.tools) : {};
  return {since: text(d.since, 30) || null, tools: Object.fromEntries(COUNTED.filter((t) => whole(tools[t])).map((t) => [t, whole(tools[t])]))};
}

/**
 * One more call of a tool on a deck. A count, kept as well as it can be: two calls at the same moment may count as one,
 * and a folder that cannot be written counts nothing — a tool's answer never waits on it.
 */
export function countCall(home, root, tool, at = new Date()) {
  if (!COUNTED.includes(tool)) return;
  try {
    const {dir} = runsFolder(home, root);
    if (!dir) return;
    const had = callCounts(dir), file = path.join(dir, CALLS), tmp = path.join(dir, `.${CALLS}.${process.pid}.${randomBytes(3).toString('hex')}.tmp`);
    writeNew(tmp, JSON.stringify({v: 1, since: had.since ?? at.toISOString(), tools: {...had.tools, [tool]: (had.tools[tool] ?? 0) + 1}}));
    try { renameSync(tmp, file); } catch (error) { rmSync(tmp, {force: true}); throw error; }
  } catch { /* a count that cannot be kept is not kept */ }
}
