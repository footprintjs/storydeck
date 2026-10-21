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
  let note = '';
  if (layout) {
    const browser = chromium ?? (await findChromium(dir));
    if (!browser) {
      note = '\nlayout not checked: it needs Playwright — npm i -D playwright-core, then npx playwright-core install chromium';
    } else {
      const work = mkdtempSync(path.join(tmpdir(), 'storydeck-layout-'));
      try {
        const file = path.join(work, 'index.html');
        writeFileSync(file, deckHtml(dir).html);
        problems.push(...(await layoutCheck(pathToFileURL(file).href, {clicks: compiled.clicks, chromium: browser})));
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
