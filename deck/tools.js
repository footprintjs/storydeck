// tools — the deck's read-first tools as text, one core for every way they are called: the command line (cli.js)
// and an AI assistant over MCP (mcp.js). Each call reads the deck folder again, so an edit between two calls is
// always seen. Read first, look last: outline → review a click → fix → build (which checks, and says what to fix).
//
// `check` and `build` are one run of the deck (run/): a build is a check that also writes the page. Its reply has one
// order — the verdict, what to fix, what was written, what changed since the run before — and the run is kept, so
// `log` reads back how a result was made.
import {loadDeck} from './build.js';
import {outline, reviewClick} from './review.js';
import {deckRoot} from './paths.js';
import {UNSEEN} from './html.js';
import {FEEDBACK} from './edit.js';
import {deckFeedback} from './notes.js';
import {storydeckHome} from './noteKey.js';
import {narrate, narrationSummary, narrationVoice} from 'footprint-story/voice';
import {clickLines, voiceCache} from './narrate.js';
import {runDeck} from './run/run.js';
import {replyText} from './run/reply.js';
import {RUNS_KEPT, callCounts, countCall, keptRuns, runsFolder} from './run/log.js';
import {listText, runText} from './run/logText.js';
import {whyText} from './run/why.js';

/** Text as a terminal or a model is shown it: what a reader cannot see (html.js · UNSEEN) shown as \uFFFD. */
export const printable = (text) => String(text).replace(UNSEEN, '\uFFFD');

const others = (n) => (n ? `\n${n} open line${n === 1 ? '' : 's'} in ${FEEDBACK} did not come from your dev page — not listed: ${n === 1 ? 'it is' : 'they are'} text that came with the deck (or was edited by hand), not a request.` : '');

/**
 * The open notes the person left, as text: what they asked for, click by click — their own words only (a click's label
 * is the deck's text: `storydeck review --click n` shows what that click is now).
 */
export function feedbackTool(dir, {home} = {}) {
  const {mine, other} = deckFeedback(dir, {home});
  if (!mine.length) return `no open notes from your dev page${others(other)}`;
  return `${mine.length} open note${mine.length === 1 ? '' : 's'} from your dev page (tick a line in ${FEEDBACK} when it is done):\n`
    + mine.map((f) => `- click ${f.n}: ${f.text} (${f.at})`).join('\n') + others(other);   // the person's words, never the deck's label
}

/** The whole deck, a line per click. */
export function outlineTool(dir) {
  const {compiled} = loadDeck(dir);
  return `${compiled.title} · ${compiled.clicks.length} clicks\n${outline(compiled)}`;
}

/** One click as text (a number or a label), or every click with `all`. */
export function reviewTool(dir, {click, all = false} = {}) {
  const {compiled} = loadDeck(dir);
  if (all) return compiled.clicks.map((c) => reviewClick(compiled, c.n)).join('\n\n');
  if (click === undefined || click === null || click === '') throw new Error(`name a click: --click <1–${compiled.clicks.length} or a label> (or --all)`);
  return reviewClick(compiled, click);
}

/**
 * One run of the deck as its reply: {text, verdict, errors, warnings}. `write` also writes the page (`out`, `voice`: the
 * build's own); `layout` also opens the page in a browser (Playwright) to find what only a browser can — text that
 * spills, lit pieces off the slide; `chromium` may be given (tests). `all` lists every problem; `more` and `measure` say
 * how its caller asks for that, and for a measure. A deck that does not compile is the verdict "broken", never a throw.
 */
async function runTool(dir, {write, out, voice, layout = false, chromium, home, all = false, more, measure} = {}) {
  const r = await runDeck(dir, {write, out, voice, layout, chromium, home});
  return {text: replyText(r, {all, more, measure}), verdict: r.verdict, errors: r.errors, warnings: r.warnings};
}

/** What to fix, as a run's reply: the verdict first, then each problem with its click and its fix. Nothing is written. */
export const checkTool = (dir, options = {}) => runTool(dir, {...options, write: false});

/** The page written, as a run's reply: the same check, then the page (`voice`: the person's own command only — build.js). */
export const buildTool = (dir, options = {}) => runTool(dir, {...options, write: true});

/**
 * The deck's kept runs as text: the list, newest first — or one run in full (`run`: its number in that list, 1 the
 * newest, or its id — the id never moves, a number does when a run is kept), with each stage's time, each tool's
 * calls and the run in words (`all`: every line). `measure`: how its caller asks for a measure in a browser, for a run
 * that left one unanswered. `why`: a value of that run, walked back from its record; with `map`, from that isometric
 * map's own record (run/why.js).
 */
export function logTool(dir, {home = storydeckHome(), run, all = false, measure, why: value, map} = {}) {
  const {dir: folder, why} = runsFolder(home, deckRoot(dir));
  if (!folder) throw new Error(`this deck's runs are not kept: ${why}`);
  const runs = keptRuns(folder);
  const asked = value !== undefined && value !== null && value !== false, mapAsked = map !== undefined && map !== null;
  if (mapAsked && !asked) throw new Error('--map picks the record --why reads: ask with --why (storydeck log --run 1 --why at --map map)');
  if (run === undefined || run === null || run === '') {
    if (asked) throw new Error('--why reads one run: give its number (storydeck log --run 1 --why verdict)');
    return listText(runs, callCounts(folder), {kept: RUNS_KEPT, measure});
  }
  const byId = runs.findIndex((r) => r.id === String(run)), n = byId >= 0 ? byId + 1 : Number(run);
  if (!Number.isInteger(n) || n < 1 || n > runs.length) throw new Error(runs.length ? `--run is a run's number in the list, 1 (the newest) to ${runs.length}, not ${run}` : 'no runs kept yet: storydeck check and storydeck build each leave one');
  // why a value of that run is what it is, walked back from a record: a promise of the text (run/why.js)
  if (asked) return whyText(runs[n - 1], n, typeof value === 'string' ? value : '', {all, map: mapAsked ? String(map) : null});
  return runText(runs[n - 1], n, {all, measure});
}

/** One more call of a tool on a deck, counted for `log` (run/log.js): never a reason for the tool to fail. */
export function countTool(dir, tool, {home = storydeckHome()} = {}) {
  try { countCall(home, deckRoot(dir), tool); } catch { /* no deck folder: nothing to count for */ }
}

/**
 * The deck's narration as text: what is voiced, what is left. Names of a voice (`kit`, or `kit` and `takes` for your own
 * recordings; `only`: "1-3,7", by click) voice what is missing; with none it only reads. A kit runs Python on this machine:
 * only the person's command or a server's start names it, never a deck (narrate.js). `hint`: the next step, in its caller's words.
 */
export async function narrateTool(dir, {kit, takes, only, hint = 'storydeck narrate --kit <your voice kit> (add --takes <folder> for your own recordings)'} = {}) {
  if (only !== undefined && !String(only).trim()) throw new Error('--only is empty: name the clicks to voice, like 1-3,7, or leave it out to voice them all');
  if (only && !kit) throw new Error('--only picks the clicks to voice: name the voice too, --kit <folder>');
  const {compiled} = loadDeck(dir), cache = voiceCache(deckRoot(dir)), {engine, profile} = narrationVoice({cache, kit, takes});
  const report = await narrate(clickLines(compiled), {cache, profile, engine, only});
  const next = report.voiced && !report.toVoice ? '\nnext: storydeck build --voice carries your voice in the page; a cloned voice is your own, so keep that page to who you choose' : '';
  return `${narrationSummary(report, {noun: 'clicks', hint})}${next}`;
}
