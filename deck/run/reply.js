// reply — what a run answers, as text: one reply, in one order, short. The verdict first (clean, fix or broken), then
// each problem, worst first — what there is to fix, then the notes — each with its click and its fix; then what was
// written; then what changed since the run before. Whoever reads it — a person at a terminal, an assistant over MCP —
// reads the first line and knows whether to go on. It is made from what the run found and where the log says it
// stands (run.js): nothing is worked out again here.
import path from 'node:path';
import {problemLine, worstFirst} from '../check.js';
import {plural} from './words.js';
import {MAP_NAME} from './log.js';

/** The most problems one reply lists: the rest are counted by rule, and `all` lists every one. */
export const MOST_LISTED = 30;

const kb = (n) => `${Math.round(n / 1024)} KB`;

/** What a browser found before and this run did not measure again: it stays open, and the reply says so. */
const unmeasured = (n, measure) => `${plural(n, 'problem')} a browser found before ${n === 1 ? 'was' : 'were'} not measured again (${measure} measures)`;

/**
 * The verdict's line: what the run found, in a few words. A run that found nothing while a browser's earlier finding
 * went unmeasured is not "clean": its first line says what is still open. `measure`: how its caller asks for a measure.
 */
export function verdictLine(r, measure = '--layout') {
  if (r.verdict === 'broken') return `broken — the deck does not compile${r.kind === 'build' ? ', so no page was written' : ''}`;
  if (r.verdict === 'clean') return r.carried ? `clean so far — ${unmeasured(r.carried, measure)}` : 'clean — nothing to fix';
  return `fix ${r.errors + r.warnings} — ${plural(r.errors, 'error')}, ${plural(r.warnings, 'warning')}`;
}

/** The problems, worst first: at most MOST_LISTED lines, the rest counted by rule (`all`: every one). */
function problemLines(problems, {all, more}) {
  const sorted = worstFirst(problems), shown = all ? sorted : sorted.slice(0, MOST_LISTED), rest = sorted.slice(shown.length);
  if (!rest.length) return shown.map(problemLine);
  const byRule = new Map();
  for (const p of rest) byRule.set(p.rule, (byRule.get(p.rule) ?? 0) + 1);
  const first = rest.some((p) => p.level !== 'info') ? 'fix these first, or list' : 'list';   // notes alone are nothing to fix
  return [...shown.map(problemLine), `… and ${rest.length} more (${[...byRule].map(([rule, n]) => `${rule} ${n}`).join(', ')}) — ${first} every one with ${more}`];
}

const carriedVoice = ({have, wanted}) => (have === wanted
  ? ` · your voice on ${have} click${have === 1 ? '' : 's'}`
  : ` · your voice on ${have} of ${wanted} clicks, the browser's on the rest (voice them: storydeck narrate --kit <folder>; a page's copy of a clip needs ffmpeg)`);

/** What was written, as one line. */
function writtenLine(w, ms, cwd) {
  const rel = (file) => path.relative(cwd, file) || file;
  return `✓ ${rel(w.file)} · ${w.clicks} clicks · ${kb(w.bytes)} · ${ms} ms${w.data ? ` · ${rel(w.data)}` : ''}${w.voice ? carriedVoice(w.voice) : ''}`;
}

/** Where the run stands against the one before it, or null when there is nothing to say. */
function standingLine(r) {
  if (r.closed) return `clean after ${plural(r.closed.rounds, 'round')} of fixing (it began with ${r.closed.first.errors + r.closed.first.warnings} to fix)`;
  if (!r.since || !r.round) return null;
  const {fixed, new: fresh} = r.since;
  return `since the last run: ${fixed || fresh ? [fixed && `${fixed} fixed`, fresh && `${fresh} new`].filter(Boolean).join(', ') : 'nothing changed'} · round ${r.round}`;
}

/**
 * A map's name as an offered call gives it: as it is when it is letters, digits and _, else quoted for a shell; null
 * when it is not to be offered — a name a kept run would not keep (log.js · MAP_NAME), or one the command line would
 * read as a flag (it starts with --).
 */
export function mapArg(name) {
  if (typeof name !== 'string' || !MAP_NAME.test(name) || name.startsWith('--')) return null;
  return /^\w+$/.test(name) ? name : `'${name}'`;
}

/**
 * What the reply says of the deck's isometric maps (run/maps.js), one line each at most: a drift aloud, a record not
 * kept, the maps not built again, then how to ask — the run named by its id (a run's number moves when another is
 * kept, its id never), the first map that kept a record. Nothing when the deck has no isometric map.
 */
export function mapLines({runs = [], skipped = 0} = {}, id = null) {
  if (!runs.length) return [];
  const asked = runs.find((m) => m.file && mapArg(m.name));
  return [
    ...runs.filter((m) => m.differs).map((m) => `drift · map ${m.name}: footprint-story's map flow did not build the map the page draws — ${m.differs} (the page draws the deck's map; report it to footprint-story)`),
    ...(id ? runs.filter((m) => !m.file).map((m) => `map ${m.name}: its record was not kept, so log --why cannot answer for it`) : []),
    ...(skipped ? [`maps: ${skipped} more not built again (a run builds the first ${runs.length})`] : []),
    ...(id && asked ? [`maps: ${runs.map((m) => m.name).join(', ')} — why a block stands where it does: storydeck log --run ${id} --why at --map ${mapArg(asked.name)}`] : []),
  ];
}

/**
 * What the reply says of the maps whose blocks move (run/motions.js): a drift aloud, a record not kept, then how to ask
 * why a move takes its time. Nothing when no click moves a block.
 */
export function motionLines({runs = []} = {}, id = null) {
  if (!runs.length) return [];
  const asked = runs.find((m) => m.file && mapArg(m.name));
  return [
    ...runs.filter((m) => m.differs).map((m) => `drift · moves ${m.name}: footprint-story's intent decider did not plan the moves the page draws — ${m.differs} (the page draws the deck's; report it to footprint-story)`),
    ...(id ? runs.filter((m) => !m.file).map((m) => `moves ${m.name}: their record was not kept, so log --why cannot answer for them`) : []),
    ...(id && asked ? [`moves: ${runs.map((m) => m.name).join(', ')} — why a move takes its time: storydeck log --run ${id} --why duration-0 --motion ${mapArg(asked.name)} (model-<i>: why its model; findings-<i>: what its critics found)`] : []),
  ];
}

/**
 * A run as its reply. `all` lists every problem; `more` names how to ask for that, and `measure` how to ask for a
 * measure in a browser, in the caller's words (a flag, or a tool's argument); `cwd` is what file names are shown against.
 */
export function replyText(r, {all = false, more = '--all', measure = '--layout', cwd = process.cwd()} = {}) {
  return [
    verdictLine(r, measure),
    ...problemLines(r.problems, {all, more}),
    r.verdict === 'fix' && r.carried ? `and ${unmeasured(r.carried, measure)}` : null,
    r.written ? writtenLine(r.written, r.ms, cwd) : null,
    standingLine(r),
    ...mapLines(r.maps, r.id ?? null),
    ...motionLines(r.motions, r.id ?? null),
    r.layoutNote ?? null,
    r.unkept ? `this run was not kept for storydeck log: ${r.unkept}` : null,
  ].filter((line) => line !== null).join('\n');
}
