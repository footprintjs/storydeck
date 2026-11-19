// logText — a deck's kept runs as text (log.js keeps them): the list, newest first, and one run in full — its verdict,
// each stage's time, each tool's calls, and the run in words. A person or an assistant reads how a result was made
// instead of running it again. Every line shown was read from a file: its caller shows it as plain text.
import {plural} from './words.js';
import {verdictLine} from './reply.js';

/** How many lines of one run's words are shown (`all`: every one kept). */
export const LINES_SHOWN = 60;

const when = (at) => at.replace('T', ' ').slice(0, 19);
const average = (list) => (list.length ? Math.round((list.reduce((a, b) => a + b, 0) / list.length) * 10) / 10 : 0);

/** One run on one line. `measure`: how its reader asks for a measure in a browser (reply.js · verdictLine). */
function runLine(run, n, measure) {
  const stand = run.closed ? `clean after ${plural(run.closed.rounds, 'round')}`
    : run.round ? `round ${run.round}${run.since ? ` · ${run.since.fixed} fixed, ${run.since.new} new` : ''}` : null;   // a run that could not finish stands nowhere
  return [`${String(n).padStart(2)}  ${when(run.at)}  ${run.kind.padEnd(5)}  ${run.verdict === 'failed' ? `failed — ${run.failure ?? 'the run stopped'}` : verdictLine(run, measure)}`,
    stand, `${plural(run.clicks, 'click')}`, run.measured ? 'measured' : null, `${run.ms} ms`].filter(Boolean).join(' · ');
}

/** How the deck's fixing went, over the runs kept: the series a clean run closed. */
function seriesLine(runs) {
  const closed = runs.filter((r) => r.closed).map((r) => r.closed);
  if (!closed.length) return null;
  return `${plural(closed.length, 'series')} of fixing closed: ${plural(average(closed.map((c) => c.rounds)), 'round')} each on average, beginning with ${average(closed.map((c) => c.first.errors + c.first.warnings))} to fix`;
}

const callsLine = ({tools}) => (Object.keys(tools).length ? `tool calls: ${Object.entries(tools).map(([tool, n]) => `${tool} ${n}`).join(', ')}` : null);

/** The list: the runs kept, newest first, with how the fixing went and how often each tool was called. */
export function listText(runs, calls, {kept, measure}) {
  if (!runs.length) return ['no runs kept yet: storydeck check and storydeck build each leave one', callsLine(calls)].filter(Boolean).join('\n');
  return [`${plural(runs.length, 'run')} kept (the newest ${kept} are)`, seriesLine(runs), callsLine(calls),
    ...runs.map((run, i) => runLine(run, i + 1, measure)), 'one run in full: storydeck log --run <its number>'].filter(Boolean).join('\n');
}

/** One tool's calls in a run. */
function callText(target, c) {
  const ended = [c.failed && `${c.failed} failed`, c.timeout && `${c.timeout} timed out`].filter(Boolean).join(', ');
  const times = c.count === 1 ? `${c.max} ms` : `half within ${c.p50} ms, the slowest ${c.max} ms${c.slowest ? ` at click ${c.slowest}` : ''}`;
  return `  ${target} × ${c.count}: ${times}${ended ? ` — ${ended}` : ''}`;
}

/** One run in full. */
export function runText(run, n, {all = false, measure} = {}) {
  const shown = all ? run.lines : run.lines.slice(0, LINES_SHOWN), rest = run.lines.length - shown.length;
  return [runLine(run, n, measure).trimStart(),
    run.stages.length ? `stages: ${run.stages.map((s) => `${s.stage} ${s.ms} ms`).join(' · ')}` : null,
    ...(Object.keys(run.calls).length ? ['calls:', ...Object.entries(run.calls).map(([target, c]) => callText(target, c))] : []),
    ...(run.engine.length ? ['the engine warned:', ...run.engine.map((w) => `  ${w}`)] : []),
    shown.length ? 'the run in words:' : null, ...shown,
    rest > 0 ? `… and ${rest} more lines: --all shows every one` : null,
    `the record itself: ${run.record} (one JSON line an entry: footprintjs/sinks · readRecordFile reads it)`].filter((line) => line !== null).join('\n');
}
