// tools — the deck's read-first tools as text, one core for every way they are called: the command line (cli.js)
// and an AI assistant over MCP (mcp.js). Each call reads the deck folder again, so an edit between two calls is
// always seen. Read first, look last: outline → review a click → fix → check → build.
import {mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {loadDeck, buildDeck, deckHtml} from './build.js';
import {outline, reviewClick} from './review.js';
import {checkDeck, failure, formatProblems} from './check.js';
import {findChromium, layoutCheck} from './layout.js';
import {deckRoot, presence} from './paths.js';
import {deckFileText} from './source.js';
import {FEEDBACK, readFeedback} from './edit.js';

/** The notes a person left on clicks in the dev page (feedback.md), read: [{done, n, label, text, at}]. */
export function deckFeedback(dir) {
  const root = deckRoot(dir);
  return presence(path.join(root, FEEDBACK)) === 'missing' ? [] : readFeedback(deckFileText(root, FEEDBACK));
}

/** The open notes, as text: what a person asked for, click by click. */
export function feedbackTool(dir) {
  const open = deckFeedback(dir).filter((f) => !f.done);
  if (!open.length) return 'no open notes';
  return `${open.length} open note${open.length === 1 ? '' : 's'} (tick a line in ${FEEDBACK} when it is done):\n`
    + open.map((f) => `- click ${f.n} "${f.label}": ${f.text}${f.at ? ` (${f.at})` : ''}`).join('\n');
}

const kb = (n) => `${Math.round(n / 1024)} KB`;

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
 * The deck's problems as text, worst first, and whether any is an error. `layout` also opens the built page in a
 * browser (Playwright) to find text that spills and lit pieces off the slide; `chromium` may be given (tests).
 */
export async function checkTool(dir, {layout = false, chromium} = {}) {
  let compiled;
  try {
    ({compiled} = loadDeck(dir));
  } catch (e) {
    return {text: formatProblems(failure(e)), errors: 1, warnings: 0};
  }
  const problems = checkDeck(compiled);
  try {
    const open = deckFeedback(dir).filter((f) => !f.done).length;
    if (open) problems.push({level: 'info', rule: 'feedback', click: null, label: null, message: `${open} open note${open === 1 ? '' : 's'} from the dev page — storydeck feedback lists ${open === 1 ? 'it' : 'them'}`});
  } catch (e) {
    problems.push({level: 'error', rule: 'feedback', click: null, label: null, message: e.message});   // a feedback.md it may not read
  }
  let note = '';
  if (layout) {
    // beside StoryDeck only: never from the deck or the folder you run in, nor from a StoryDeck inside the deck
    const found = chromium ? {chromium, why: null} : await findChromium({deckRoot: deckRoot(dir)});
    const browser = found.chromium;
    if (!browser) {
      note = `\nlayout not checked: ${found.why ?? 'it needs Playwright installed beside StoryDeck — npm i -D footprint-storydeck playwright-core, then npx playwright-core install chromium'}`;
    } else {
      const work = mkdtempSync(path.join(tmpdir(), 'storydeck-layout-'));
      try {
        const file = path.join(work, 'index.html');
        writeFileSync(file, deckHtml(dir).html);
        try {
          problems.push(...(await layoutCheck(pathToFileURL(file).href, {clicks: compiled.clicks, chromium: browser})));
        } catch (e) {
          problems.push({level: 'error', rule: 'layout', click: null, label: null,
            message: `the layout check stopped: ${e.message.split('\n')[0]} — the page did not settle in the browser (a script in the deck may navigate away or keep it busy)`});
        }
      } finally {
        rmSync(work, {recursive: true, force: true});
      }
    }
  }
  const errors = problems.filter((p) => p.level === 'error').length, warnings = problems.filter((p) => p.level === 'warn').length;
  return {text: `${formatProblems(problems)}${note}`, errors, warnings};
}

/** Build the page; a line saying what was written. */
export function buildTool(dir, {out} = {}) {
  const r = buildDeck(dir, {out});
  const rel = path.relative(process.cwd(), r.file) || r.file;
  return `✓ ${rel} · ${r.clicks} clicks · ${kb(r.bytes)} · ${r.ms} ms${r.data ? ` · ${path.relative(process.cwd(), r.data)}` : ''}`;
}
