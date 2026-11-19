// @vitest-environment node
import {afterEach, describe, it, expect} from 'vitest';
import {existsSync, readFileSync} from 'node:fs';
import path from 'node:path';
import {readRecordFile} from 'footprintjs/sinks';
import {buildChart, engine, logger, mermaidOf, runChart} from './engine.js';
import {tempDir, cleanDecks} from '../test/helpers.js';

afterEach(cleanDecks);

/** A small wiring: a stage, a decider with a stage branch and a mounted chart, a last stage. */
async function small({fail = null, call = async () => 'ok'} = {}) {
  const eng = await engine();
  const inner = [
    {id: 'ask', name: 'ask', about: 'One call to a tool outside', run: async (scope) => { scope.answer = await scope.$call('tool.ask', call, {attempts: 1, timeoutMs: 500}); }},
    {id: 'again', name: 'again', about: 'A second call', run: async (scope) => { scope.second = await scope.$call('tool.ask', call, {attempts: 1, timeoutMs: 500}); }},
  ];
  const wiring = [
    {id: 'start', name: 'start', about: 'What was asked', run: (scope) => { scope.n = 2; }},
    {id: 'big', name: 'big?', about: 'Whether n is big', run: (scope) => eng.decide(scope, [{when: {n: {gt: 1}}, then: 'mounted', label: 'n is over 1'}], {branch: 'plain', label: 'n is small'}), branches: [
      {id: 'plain', name: 'plain', about: 'A stage branch', run: (scope) => { scope.way = 'plain'; }},
      {id: 'mounted', name: 'mounted chart', wiring: inner, input: (host) => ({n: host.n}), output: (out) => ({way: 'mounted', answer: out.answer})},
    ]},
    {id: 'end', name: 'end', about: 'The last stage', run: (scope) => { if (fail) throw fail; scope.done = true; }},
  ];
  return {eng, chart: buildChart(eng, wiring)};
}

describe('engine: a chart from its wiring', () => {
  it('builds stages, a decider, a stage branch and a mounted chart, and draws them', async () => {
    const {chart} = await small();
    expect(mermaidOf(chart).split('\n')).toEqual(['flowchart TD', 'start["start"]', 'start --> big', 'big["big?"]', 'big --> plain', 'plain["plain"]', 'big --> mounted', 'mounted["mounted chart"]', 'big --> end', 'end["end"]']);
  });

  it('refuses a wiring that starts with a decider, naming the fix', async () => {
    const eng = await engine();
    expect(() => buildChart(eng, [{id: 'd', name: 'd', about: '', run: () => 'a', branches: []}])).toThrow('a chart starts with a stage, not a decider: put a stage first in its wiring');
  });

  it('loads the engine once', async () => {
    expect(await engine()).toBe(await engine());
    expect(Object.keys(await engine()).sort()).toEqual(['FlowChartExecutor', 'attempts', 'decide', 'fileSink', 'flowChart', 'metrics', 'narrative', 'parseAttemptId']);
  });

  it('keeps what the engine warns of, and prints none of its other lines', () => {
    const kept = [], log = logger(kept);
    log.info('a'); log.log('b'); log.debug('c'); log.error('d');
    log.warn('a stage', 'wrote nothing', 3);
    expect(kept).toEqual(['a stage wrote nothing 3']);
  });
});

describe('engine: a run, and what its recorders hold', () => {
  it('hands back the state, the run in words, each stage\'s time and each tool\'s calls by name', async () => {
    const {eng, chart} = await small({call: () => new Promise((done) => setTimeout(() => done('ok'), 5))});
    const run = await runChart(eng, chart);
    expect(run.state).toMatchObject({n: 2, way: 'mounted', answer: 'ok', done: true});
    expect(run.lines.map((l) => l.text).join('\n')).toContain('[Condition]: It evaluated Rule 0 "n is over 1": n 2 gt 1 ✓, and chose mounted chart.');
    expect(run.lines.every((l) => typeof l.type === 'string' && typeof l.text === 'string')).toBe(true);
    expect(run.stages.map((s) => s.stage)).toEqual(['start', 'big?', 'mounted/ask', 'mounted/again', 'end']);   // a mounted chart's stages, under its name
    expect(run.stages.every((s) => Number.isInteger(s.ms) && s.ms >= 0)).toBe(true);
    expect(run.calls).toEqual({'tool.ask': {count: 2, ok: 2, failed: 0, timeout: 0, p50: expect.any(Number), max: expect.any(Number), slowest: 1}});   // each the first call of its stage
  });

  it('the state it hands back is the run\'s own copy', async () => {
    const {eng, chart} = await small();
    const run = await runChart(eng, chart);
    run.state.n = 99;
    expect((await runChart(eng, chart)).state.n).toBe(2);
  });

  it('keeps the record itself in a file when given one, and runs the same when the file cannot be made', async () => {
    const {eng, chart} = await small(), file = path.join(tempDir(), 'run.record.jsonl');
    await runChart(eng, chart, {record: file});
    const record = readRecordFile(file);
    expect(record.entries.map((e) => e.kind).filter((k) => k === 'opened' || k === 'closed')).toEqual(['opened', 'opened', 'closed', 'closed']);
    expect(readFileSync(file, 'utf8').trim().split('\n').every((line) => line.startsWith('{'))).toBe(true);   // one JSON line an entry
    const nowhere = path.join(tempDir(), 'no', 'such', 'folder', 'run.record.jsonl');
    expect((await runChart(eng, chart, {record: nowhere})).state.done).toBe(true);
    expect(existsSync(nowhere)).toBe(false);
  });

  it('a run that throws rejects with what was thrown, carrying what the run got to', async () => {
    const boom = new Error('the page may not be written');
    const {eng, chart} = await small({fail: boom});
    const error = await runChart(eng, chart).catch((e) => e);
    expect(error).toBe(boom);
    expect(error.run.state).toMatchObject({n: 2, way: 'mounted'});
    expect(error.run.stages.at(-1).stage).toBe('end');
    // an error that cannot carry anything, or that already carries a run of its own, is thrown as it is
    const frozen = Object.freeze(new Error('frozen'));
    expect(await runChart(eng, (await small({fail: frozen})).chart).catch((e) => e)).toBe(frozen);
    const own = Object.assign(new Error('own'), {run: 'mine'});
    expect((await runChart(eng, (await small({fail: own})).chart).catch((e) => e)).run).toBe('mine');
    expect(await runChart(eng, (await small({fail: 'a string'})).chart).catch((e) => e)).toBe('a string');
  });

  it('a call that fails or runs out of time is counted as it ended', async () => {
    let n = 0;
    const {eng, chart} = await small({call: () => { n += 1; return n === 1 ? Promise.resolve('ok') : new Promise(() => {}); }});
    const error = await runChart(eng, chart).catch((e) => e);
    expect(String(error.message)).toMatch(/500ms/);
    expect(error.run.calls['tool.ask']).toMatchObject({count: 2, ok: 1, failed: 0, timeout: 1});
  });
});
