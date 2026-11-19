// stages — what each step of a run does, in the order chart.js wires them. A stage reads what the record holds and
// writes facts into it: counts, verdicts, and the problems found (the tool's own words about the deck). What is too big
// to be a fact — the deck as compiled, its page — stays in `run`, the one run's working memory, and never enters the
// record. Where the run goes next is never an `if` in a stage: it is a decider, made with decide(), so the record says
// which rule chose and what it read. How a stage does its own job (with the person's clips or without) is a fact it writes.
import {loadDeck, pageOf, writeDeck} from '../build.js';
import {checkDeck, failure} from '../check.js';
import {noteProblems} from '../notes.js';
import {deckRoot} from '../paths.js';

const count = (problems, level) => problems.filter((p) => p.level === level).length;

/** The deck folder read and compiled once, for every later stage — or why it cannot be, as the one problem. */
export function readDeck(scope, run) {
  scope.writeAsked = run.options.write === true;
  scope.layoutAsked = run.options.layout === true;
  scope.voiceAsked = run.options.voice === true;   // a fact for the record: the page carries the person's clips, or not
  try {
    run.loaded = loadDeck(run.dir);
    run.root = deckRoot(run.dir);
    scope.compiled = true;
    scope.clicks = run.loaded.compiled.clicks.length;
    scope.problems = [];
  } catch (error) {
    scope.compiled = false;
    scope.problems = failure(error);
  }
}

/** Did it compile? */
export const compiles = (run) => (scope) => run.decide(scope,
  [{when: {compiled: {eq: false}}, then: 'broken', label: 'The deck does not compile'}],
  {branch: 'check-rules', label: 'The deck compiles'});

/** Every rule a compiled deck is read against (check.js). */
export function checkRules(scope, run) {
  scope.problems = checkDeck(run.loaded.compiled);
}

/** It does not compile: that one problem is the answer, and the run stops here. */
export function broken(scope) {
  scope.errors = 1;
  scope.warnings = 0;
  scope.verdict = 'broken';
  scope.$break('the deck does not compile');
}

/** The notes the person left in their dev page, and the lines that came with the deck (notes.js). */
export function readNotes(scope, run) {
  scope.problems = [...scope.$getValue('problems'), ...noteProblems(run.dir, {home: run.options.home})];
}

/** Is the page measured in a browser? */
export const measureAsked = (run) => (scope) => run.decide(scope,
  [{when: {layoutAsked: {eq: false}}, then: 'not-asked', label: 'No measure was asked for'}],
  {branch: 'measure', label: 'A measure was asked for'});

/** No measure was asked for. */
export function notAsked(scope) {
  scope.measured = false;
}

/** The page of this reading, made once: what the browser opens and what is written. */
export const pageHtml = (run) => (run.page ??= pageOf(run.dir, run.loaded).html);

/** Is the page written? */
export const writes = (run) => (scope) => run.decide(scope,
  [{when: {writeAsked: {eq: false}}, then: 'check-only', label: 'Only a check was asked for'}],
  {branch: 'write-page', label: 'The page is written'});

/** The page written (build.js · writeDeck): the same reading that was checked, and measured. */
export function writePage(scope, run) {
  const {voice, out} = run.options;
  const made = voice ? pageOf(run.dir, run.loaded, {voice: true}) : {...run.loaded, html: pageHtml(run)};
  scope.written = writeDeck(run.dir, made, {out});
}

/** How many of each, from the rules and from the browser: the numbers the verdict reads. */
export function countProblems(scope) {
  const problems = [...scope.$getValue('problems'), ...(scope.$getValue('layoutProblems') ?? [])];
  scope.errors = count(problems, 'error');
  scope.warnings = count(problems, 'warn');
  scope.infos = count(problems, 'info');
}

/** Is there anything to fix? */
export const verdict = (run) => (scope) => run.decide(scope,
  [{when: {errors: {gt: 0}}, then: 'fix', label: 'There is an error to fix'},
    {when: {warnings: {gt: 0}}, then: 'fix', label: 'There is a warning to fix'}],
  {branch: 'clean', label: 'Nothing to fix'});

export const fix = (scope) => { scope.verdict = 'fix'; };
export const clean = (scope) => { scope.verdict = 'clean'; };
