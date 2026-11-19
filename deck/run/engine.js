// engine — the one module of run/ that calls footprintjs. A run's chart is wiring written as data (chart.js); this
// builds it with footprintjs's builder, runs it with the recorders attached once, at the top, and hands back what they
// hold. Every footprintjs call is here, so a new footprintjs that changes a call changes this file.
//
// What it uses: flowChart (addFunction, addDeciderFunction, addFunctionBranch, addSubFlowChartBranch, end, setLogger,
// build), the built chart's toMermaid, FlowChartExecutor (attachCombinedRecorder, run, getSnapshot, the `sink`
// option), decide, three recorders (narrative: the run in words; metrics: each stage's time; attempts: each named call,
// counted by target) and fileSink (the record itself, written as the run goes). Stages use two scope methods of their
// own: $call (a named call to a tool outside) and $break (stop after this stage).
//
// footprintjs is loaded when a run starts, so the commands that only read a deck never load it.

let loading = null;

/** footprintjs's doors, loaded once: {flowChart, FlowChartExecutor, decide, narrative, metrics, attempts, fileSink}, and foottrace's parseAttemptId (how a recorded call is named). */
export function engine() {
  loading ??= Promise.all([import('footprintjs'), import('footprintjs/recorders'), import('footprintjs/sinks'), import('foottrace')])
    .then(([core, recorders, sinks, trace]) => ({flowChart: core.flowChart, FlowChartExecutor: core.FlowChartExecutor, decide: core.decide,
      narrative: recorders.narrative, metrics: recorders.metrics, attempts: recorders.attempts, fileSink: sinks.fileSink, parseAttemptId: trace.parseAttemptId}))
    .catch((error) => { loading = null; throw error; });   // a load that failed is tried again by the next run
  return loading;
}

/** The engine's own lines: a failure is thrown to the caller, so it is not printed too; a warning is kept, for the run's log. */
export const logger = (warnings) => ({info() {}, log() {}, debug() {}, error() {}, warn: (...words) => { warnings.push(words.map(String).join(' ')); }});

/**
 * The chart from its wiring: [first, ...rest], each {id, name, about, run, branches?} — a branch {id, name, about, run},
 * or {id, name, wiring, input, output} for a chart of its own mounted there (an adapter: its wiring is built the same
 * way, and `input` and `output` say what goes in and what comes back). `warnings` takes what the engine warns of.
 */
export function buildChart(eng, [first, ...rest], warnings = []) {
  if (first.branches) throw new TypeError('a chart starts with a stage, not a decider: put a stage first in its wiring');
  const addBranch = (list, branch) => (branch.wiring
    ? list.addSubFlowChartBranch(branch.id, buildChart(eng, branch.wiring, warnings), branch.name, {inputMapper: branch.input, outputMapper: branch.output})
    : list.addFunctionBranch(branch.id, branch.name, branch.run, branch.about));
  const addStep = (builder, step) => (step.branches
    ? step.branches.reduce(addBranch, builder.addDeciderFunction(step.name, step.run, step.id, step.about)).end()
    : builder.addFunction(step.name, step.run, step.id, step.about));
  return rest.reduce(addStep, eng.flowChart(first.name, first.run, first.id, first.about)).setLogger(logger(warnings)).build();
}

/** The chart drawn as Mermaid text, as footprintjs draws it. */
export const mermaidOf = (chart) => chart.toMermaid().trim();

/** Each stage's time, in the order they ran: [{stage, ms, runs}] (metrics). */
const stageTimes = (recorder) => [...recorder.getMetrics().stageMetrics.values()].map((s) => ({stage: s.stageName, ms: Math.round(s.totalDuration)}));

/** Which call of its stage a recorded call was (1 the first), from its id; null for an id that is not a call's. */
function ordinalOf(eng, id) {
  try { return eng.parseAttemptId(id).call?.ordinal ?? null; } catch { return null; }
}

/**
 * Each tool called, by its name: {target: {count, ok, failed, timeout, p50, max, slowest}} — times in ms, `slowest`
 * which call of its stage took longest (attempts; every number there leads to the call it came from).
 */
const callCounts = (eng, recorder) => Object.fromEntries([...recorder.byTarget()].map(([target, t]) => [target, {
  count: t.count, ok: t.byOutcome.ok, failed: t.byOutcome.failed, timeout: t.byOutcome.timeout,
  p50: Math.round(t.latencyMs.p50), max: Math.round(t.latencyMs.max), slowest: t.exemplars.slowest[0] ? ordinalOf(eng, t.exemplars.slowest[0].id) : null,
}]));

/**
 * Run a chart once: {state, lines, stages, calls} — the state it ended with, the run in words ([{type, text, stage}]),
 * each stage's time and each tool's calls. `record`, a file path, also keeps the record itself there, written as the
 * run goes (one JSON line an entry: footprintjs/sinks · readRecordFile reads it back); a record that cannot be kept
 * never costs the run. A run that throws keeps what it got to: the error carries the same as `error.run`.
 */
export async function runChart(eng, chart, {record = null} = {}) {
  const words = eng.narrative(), times = eng.metrics(), calls = eng.attempts();
  let sink = null;
  try { sink = record ? eng.fileSink(record) : null; } catch { /* no record: the run goes on */ }
  const executor = new eng.FlowChartExecutor(chart, sink ? {sink} : {});
  for (const recorder of [words, times, calls]) executor.attachCombinedRecorder(recorder);
  const taken = () => ({
    state: structuredClone(executor.getSnapshot().sharedState),   // the engine's view is live: the run keeps its own copy
    lines: words.getEntries().map((e) => ({type: String(e.type), text: String(e.text ?? ''), stage: e.stageId ?? null})),
    stages: stageTimes(times), calls: callCounts(eng, calls),
  });
  try {
    await executor.run();
  } catch (error) {
    try { if (error !== null && typeof error === 'object' && !('run' in error)) error.run = taken(); } catch { /* a frozen error: the error matters more than its record */ }
    throw error;
  } finally {
    await sink?.close().catch(() => {});   // a record that cannot be finished never costs the run its answer
  }
  return taken();
}
