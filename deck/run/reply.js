// reply — what a run answers, as text: one reply, in one order, short. The verdict first (clean, fix or broken), then
// only what there is to fix, worst first, each with its click and its fix; then what was written; then what changed
// since the run before. Whoever reads it — a person at a terminal, an assistant over MCP — reads the first line and
// knows whether to go on. Everything in it comes from the run's record (run.js): nothing is worked out again here.
import path from 'node:path';
import {problemLine, worstFirst} from '../check.js';
import {plural} from './words.js';

/** The most problems one reply lists: the rest are counted by rule, and `all` lists every one. */
export const MOST_LISTED = 30;

const kb = (n) => `${Math.round(n / 1024)} KB`;

/** The verdict's line: what the run found, in a few words. */
export function verdictLine(r) {
  if (r.verdict === 'broken') return `broken — the deck does not compile${r.kind === 'build' ? ', so no page was written' : ''}`;
  if (r.verdict === 'clean') return 'clean — nothing to fix';
  return `fix ${r.errors + r.warnings} — ${plural(r.errors, 'error')}, ${plural(r.warnings, 'warning')}`;
}

/** The problems, worst first: at most MOST_LISTED lines, the rest counted by rule (`all`: every one). */
function problemLines(problems, {all, more}) {
  const sorted = worstFirst(problems), shown = all ? sorted : sorted.slice(0, MOST_LISTED), rest = sorted.slice(shown.length);
  if (!rest.length) return shown.map(problemLine);
  const byRule = new Map();
  for (const p of rest) byRule.set(p.rule, (byRule.get(p.rule) ?? 0) + 1);
  return [...shown.map(problemLine), `… and ${rest.length} more (${[...byRule].map(([rule, n]) => `${rule} ${n}`).join(', ')}) — fix these first, or list every one with ${more}`];
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
 * A run as its reply. `all` lists every problem; `more` names how to ask for that, in the caller's words (a flag, or a
 * tool's argument); `cwd` is what file names are shown against.
 */
export function replyText(r, {all = false, more = '--all', cwd = process.cwd()} = {}) {
  return [
    verdictLine(r),
    ...problemLines(r.problems, {all, more}),
    r.written ? writtenLine(r.written, r.ms, cwd) : null,
    standingLine(r),
    r.layoutNote ?? null,
    r.unkept ? `this run was not kept for storydeck log: ${r.unkept}` : null,
  ].filter((line) => line !== null).join('\n');
}
