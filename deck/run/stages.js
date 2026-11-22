// stages — what each step of a run does, in the order chart.js wires them. A stage reads what the record holds and
// writes facts into it: counts, verdicts, and the problems found (the tool's own words about the deck). What is too big
// to be a fact — the deck as compiled, its page — stays in `run`, the one run's working memory, and never enters the
// record. Where the run goes next is never an `if` in a stage: it is a decider, made with decide(), so the record says
// which rule chose and what it read. How a stage does its own job (with the person's clips or without) is a fact it writes.
import {loadDeck, pageOf, writeDeck} from '../build.js';
import {checkDeck, failure} from '../check.js';
import {noteProblems} from '../notes.js';
import {deckRoot} from '../paths.js';
import {flowMaps} from './maps.js';
import {flowMotions} from './motions.js';

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

/**
 * A decision that writes its reason (`key`): the record keeps a stage's reads with what it writes, so a decider that
 * wrote nothing would leave no trace of what it read, and `storydeck log --why` would stop at it.
 */
function decided(run, scope, key, rules, otherwise) {
  const d = run.decide(scope, rules, otherwise);
  scope[key] = d.evidence?.rules?.find((r) => r.matched)?.label ?? otherwise.label;
  return d;
}

/** Did it compile? */
export const compiles = (run) => (scope) => decided(run, scope, 'compiledWhy',
  [{when: {compiled: {eq: false}}, then: 'broken', label: 'The deck does not compile'}],
  {branch: 'check-rules', label: 'The deck compiles'});

/** Every rule a compiled deck is read against (check.js). */
export function checkRules(scope, run) {
  scope.problems = checkDeck(run.loaded.compiled);
}

/**
 * How each isometric map was made, as the compile noted it — on the run's record, so the log can answer "who placed
 * these blocks" and "why is that wire straight" without the page being looked at: {map: {placed: 'build' | 'hand',
 * tile, cables, footprints?: how many pieces stand on the floor by a footprint, said: [[wire, note], …], tight: [names],
 * breaks?: [[block, rule], …] — the break rule each block's writer picked for its name (data-break), style?: {row,
 * options} — the style choices it was drawn in, when it names some (data-style)}}.
 * A deck with no such map writes nothing, and runs nothing more. One that has one also builds each map again with the
 * map flow, for its own record (mapRecords).
 */
export function mapsMade(scope, run) {
  const made = Object.entries(run.loaded.compiled.maps).filter(([, map]) => map.made).map(([name, map]) => [name, {
    placed: map.made.placed, tile: map.made.tile, cables: map.cables?.length ?? 0, ...(map.made.footprints ? {footprints: map.made.footprints} : {}),
    ...(map.ways?.length ? {said: map.ways.map((w) => [w.name, w.way])} : {}), ...(map.tight?.length ? {tight: map.tight.map((t) => t.name)} : {}), ...(map.made.breaks ? {breaks: map.made.breaks} : {}),
    // the style it was drawn in, as the steps read it ({row, options}): only on a map that names one (data-style), so a map that names none records as before
    ...(map.made.style ? {style: map.made.style} : {}),
    // its blocks' moves (data-move), as footprint-story planned them, and how each way of showing the deck carries them:
    // only on a map whose clicks move a block, so every other map records as before
    ...(map.motion ? {motion: {moves: map.motion.record.map((r) => ({click: r.click, piece: r.piece, do: r.do, model: r.model, by: r.by, seconds: r.seconds, ...(r.accepted ? {accepted: r.accepted} : {})})), carriers: map.motion.carriers}} : {}),
  }]);
  if (!made.length) return undefined;   // no isometric map: nothing more runs, and the stage stays as it was
  scope.maps = Object.fromEntries(made);
  return mapRecords(scope, run);
}

/**
 * Each isometric map built again by footprint-story's map flow, its run's record kept beside this run's (maps.js), so
 * `storydeck log --why at --map <map>` answers from a real run of the steps. What it found is a fact for the record:
 * {map: {kept, differs?}} — kept, whether that map's record was written; differs, where its map parted from the page's.
 */
async function mapRecords(scope, run) {
  const built = Object.entries(run.loaded.compiled.maps).filter(([, map]) => map.made && map.built).map(([name, map]) => ({name, built: map.built}));
  run.mapRuns = await flowMaps(scope, run, built);
  scope.mapFlows = Object.fromEntries(run.mapRuns.runs.map((m) => [m.name, {kept: m.file !== null, ...(m.differs ? {differs: m.differs} : {})}]));
  if (run.mapRuns.skipped) scope.mapsSkipped = run.mapRuns.skipped;
  // each map whose blocks move: its moves planned again through footprint-story's chart, for `log --why … --motion`
  const moving = Object.entries(run.loaded.compiled.maps).filter(([, map]) => map.motion).map(([name, map]) => ({name, motion: map.motion}));
  if (!moving.length) return;
  run.motionRuns = await flowMotions(scope, run, moving);
  scope.motionFlows = Object.fromEntries(run.motionRuns.runs.map((m) => [m.name, {kept: m.file !== null, ...(m.differs ? {differs: m.differs} : {})}]));
  if (run.motionRuns.skipped) scope.motionsSkipped = run.motionRuns.skipped;
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
export const measureAsked = (run) => (scope) => decided(run, scope, 'measureWhy',
  [{when: {layoutAsked: {eq: false}}, then: 'not-asked', label: 'No measure was asked for'}],
  {branch: 'measure', label: 'A measure was asked for'});

/** No measure was asked for. */
export function notAsked(scope) {
  scope.measured = false;
}

/** The page of this reading, made once: what the browser opens and what is written. */
export const pageHtml = (run) => (run.page ??= pageOf(run.dir, run.loaded).html);

/** Is the page written? */
export const writes = (run) => (scope) => decided(run, scope, 'writeWhy',
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
export const verdict = (run) => (scope) => decided(run, scope, 'verdictWhy',
  [{when: {errors: {gt: 0}}, then: 'fix', label: 'There is an error to fix'},
    {when: {warnings: {gt: 0}}, then: 'fix', label: 'There is a warning to fix'}],
  {branch: 'clean', label: 'Nothing to fix'});

export const fix = (scope) => { scope.verdict = 'fix'; };
export const clean = (scope) => { scope.verdict = 'clean'; };
