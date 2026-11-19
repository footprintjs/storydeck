// measure — the browser, as an adapter: a chart of its own that a run mounts when a measure is asked for. It owns
// everything about the browser: finding one (beside StoryDeck, never in the deck), opening the page of this reading
// offline, measuring every click as it settles, and saying what it found as problems — or why it could not.
//
// Its port is the video's browser port (video.js · deckStageDriver): open(url), measure(n), close(). Each step through
// it is a named call (scope.$call: browser.open, browser.measure, browser.close), so the record holds one line a call,
// with its time and how it ended, and a call that never answers ends at its time limit instead of holding the run.
// What it hands back is facts: {measured, problems, layoutNote?}. The host decides what follows.
import {mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {deckStageDriver} from '../../video.js';
import {findChromium, layoutFindings, layoutProblems} from '../layout.js';
import {pageHtml} from './stages.js';

const NO_BROWSER = 'it needs Playwright installed beside StoryDeck — npm i -D footprint-storydeck playwright-core, then npx playwright-core install chromium';
/** How long one call through the port may take (ms) before it is ended and recorded as timed out: a page that hangs never holds the run. */
export const CALL_LIMITS = Object.freeze({'browser.open': 120_000, 'browser.measure': 60_000, 'browser.close': 30_000});
/** Which click a recorded browser.measure call measured, from its place among the stage's calls: the page is opened first. */
export const clickOfCall = (ordinal) => ordinal - 1;

const firstLine = (error) => String(error?.message ?? error).split('\n')[0];

/** A browser to measure with: one the caller gave (a test's), or Playwright's, found beside StoryDeck. */
async function findBrowser(scope, run) {
  const {driver, chromium} = run.options;
  const found = driver || chromium ? {chromium: chromium ?? null, why: null} : await findChromium({deckRoot: run.root});
  run.chromium = found.chromium;
  scope.browserFound = Boolean(driver || found.chromium);
  scope.browserWhy = scope.browserFound ? '' : found.why ?? NO_BROWSER;
}

const hasBrowser = (run) => (scope) => run.decide(scope,
  [{when: {browserFound: {eq: false}}, then: 'no-browser', label: 'No browser was found'}],
  {branch: 'measure-clicks', label: 'A browser was found'});

/** No browser: the run says why, and the adapter ends here. */
function noBrowser(scope) {
  scope.measured = false;
  scope.problems = [];
  scope.layoutNote = `layout not checked: ${scope.browserWhy}`;
  scope.$break('no browser to measure with');
}

/**
 * Every click measured: the page written to a folder of its own, opened offline, and each click measured as it settles.
 * The folder and the browser both go whatever happens. A step that fails or runs out of time stops the measure: the
 * stage says so as a fact (`settled`), and what was found before it is dropped — half a measure is not one.
 */
async function measureClicks(scope, run) {
  const work = mkdtempSync(path.join(tmpdir(), 'storydeck-layout-'));
  const port = run.options.driver ?? deckStageDriver({chromium: run.chromium, offline: true});   // the page is whole; it needs no network
  const limits = run.options.limits ?? CALL_LIMITS;
  const call = (target, step) => scope.$call(target, step, {attempts: 1, timeoutMs: limits[target]});
  try {
    const file = path.join(work, 'index.html');
    writeFileSync(file, pageHtml(run));
    run.found = await layoutFindings(port, pathToFileURL(file).href, scope.clicks, call);
    scope.settled = true;
    scope.findings = run.found.length;
  } catch (error) {
    run.found = [];
    scope.settled = false;
    scope.stoppedWhy = firstLine(error);
  } finally {
    rmSync(work, {recursive: true, force: true});
  }
}

const settled = (run) => (scope) => run.decide(scope,
  [{when: {settled: {eq: false}}, then: 'stopped', label: 'The browser stopped before every click was measured'}],
  {branch: 'measured', label: 'Every click was measured'});

/** What the browser found, as problems (layout.js · layoutProblems). */
function measured(scope, run) {
  scope.measured = true;
  scope.problems = layoutProblems(run.found, run.loaded.compiled.clicks);
}

/** The measure stopped: one error says so, with the browser's own first line. */
function stopped(scope) {
  scope.measured = false;
  scope.problems = [{level: 'error', rule: 'layout', click: null, label: null,
    message: `the layout check stopped: ${scope.stoppedWhy} — the page did not settle in the browser (a script in the deck may navigate away or keep it busy)`}];
}

/** The adapter's wiring: find a browser, measure every click, say what was found. */
export const measureWiring = (run) => [
  {id: 'find-browser', name: 'find browser', about: 'A browser to measure with, found beside StoryDeck', run: (scope) => findBrowser(scope, run)},
  {id: 'has-browser', name: 'browser found?', about: 'Whether there is a browser to measure with', run: hasBrowser(run), branches: [
    {id: 'measure-clicks', name: 'measure clicks', about: 'The page opened offline, every click measured as it settles', run: (scope) => measureClicks(scope, run)},
    {id: 'no-browser', name: 'no browser', about: 'None: the run says why and goes on unmeasured', run: noBrowser},
  ]},
  {id: 'settled', name: 'settled?', about: 'Whether every click was measured', run: settled(run), branches: [
    {id: 'measured', name: 'measured', about: 'What the browser found, as problems', run: (scope) => measured(scope, run)},
    {id: 'stopped', name: 'stopped', about: 'The browser stopped: one error says so', run: stopped},
  ]},
];

/** How the host mounts it: the number of clicks in, the facts out (its problems join the host's). */
export const measureMount = Object.freeze({
  input: (host) => ({clicks: host.clicks}),
  output: (out) => ({problems: out.problems, measured: out.measured, ...(out.layoutNote ? {layoutNote: out.layoutNote} : {})}),
});
