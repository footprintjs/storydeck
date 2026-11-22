// @vitest-environment node
// run/motions: each map's block moves planned again through footprint-story's intent decider as a chart, its record
// kept beside the run's, so `storydeck log --why duration-0 --motion <map>` answers from a real run — and whatever that
// run does is said, never a failed run.
import {afterEach, describe, it, expect} from 'vitest';
import {readdirSync, rmSync} from 'node:fs';
import path from 'node:path';
import {runDeck} from './run.js';
import {engine} from './engine.js';
import {flowMotions, MOTION_FLOW, MOTIONS_MOST} from './motions.js';
import {motionLines, replyText} from './reply.js';
import {runText} from './logText.js';
import {keptRuns, runsFolder} from './log.js';
import {logTool} from '../tools.js';
import {deckRoot} from '../paths.js';
import {tempDeck, tempDir, cleanDecks} from '../test/helpers.js';

afterEach(cleanDecks);

const MAP = `<i data-iso-grid="120 at 960 300"></i><div data-k="floor" data-iso="floor" data-size="8 6"></div>
<div data-k="box" data-iso="block" data-at="1 1 3" data-size="1 1 1"><b>Box</b></div>
<div data-k="crate" data-iso="block" data-at="1 4" data-size="1 1 1"><b>Crate</b></div>`;
const moving = (moves = 'box fall; crate slide to 4 4.5') => tempDeck({'deck.json': '{"title":"T"}', 'map.html': MAP,
  'clicks.html': `<section data-label="M" data-map="map"><step data-in="floor box crate"><h2>Here</h2></step><step data-move="${moves}"><h2>Moved</h2></step></section>`});
const folderOf = (home, dir) => runsFolder(home, deckRoot(dir)).dir;

describe('a map\'s moves planned again for the record, answered by log --why --motion', () => {
  it('keeps the moves\' record beside the run\'s; the reply offers the call; the answer walks back through footprint-story\'s steps', async () => {
    const dir = moving(), home = tempDir();
    const r = await runDeck(dir, {home});
    expect(r.motions.runs).toEqual([expect.objectContaining({name: 'map', file: expect.stringMatching(/\.motion-0\.record\.jsonl$/), keys: expect.arrayContaining(['duration-0', 'model-1'])})]);
    expect(r.motions.runs[0].differs).toBeUndefined();
    expect(readdirSync(folderOf(home, dir))).toContain(`${r.id}.motion-0.record.jsonl`);
    expect(replyText(r).split('\n')).toContain(`moves: map — why a move takes its time: storydeck log --run ${r.id} --why duration-0 --motion map (model-<i>: why its model; findings-<i>: what its critics found)`);
    const said = await logTool(dir, {home, run: r.id, why: 'duration-0', motion: 'map'});
    expect(said.split('\n')[0]).toMatch(/^duration-0 = \{"seconds":0\.47\d*,/);
    expect(await logTool(dir, {home, run: '1', why: 'model-1', motion: 'map'})).toMatch(/^model-1 = \{"model":"coulomb"/);
    // the run's own record says how the map's moves were made and carried
    const [kept] = keptRuns(folderOf(home, dir));
    expect(kept.motions).toEqual([expect.objectContaining({name: 'map', k: 0, kept: true, record: expect.any(String)})]);
    expect(runText(kept, 1).split('\n')).toContain(`  why a move takes its time: storydeck log --run ${kept.id} --why duration-0 --motion map`);
    const maps = await logTool(dir, {home, run: '1', why: 'maps'});
    expect(maps.split('\n')[0]).toMatch(/"motion":\{"moves":\[\{"click":2,"piece":"box","do":"fall","model":"ballistic","by":"usual","seconds":0\.47\d*\}.*"carriers":\{"page":"keyframes".*"pptx":"at rest, where each move ends"\}/);
  });

  it('refuses what it cannot answer, saying what there is', async () => {
    const dir = moving(), home = tempDir();
    await runDeck(dir, {home});
    await expect(logTool(dir, {home, run: '1', why: '', motion: 'map'})).rejects.toThrow(/why names a value of run 1 moves on map map, one of what footprint-story's steps wrote \(a map's moves write .*duration-0/);
    await expect(logTool(dir, {home, run: '1', why: 'duration-0', motion: 'other'})).rejects.toThrow(/run 1 has no moves on map "other": the maps whose blocks move are map/);
    await expect(logTool(dir, {home, run: '1', why: 'duration-0', motion: ' '})).rejects.toThrow(/--motion names one of the run's maps whose blocks move/);
    expect(() => logTool(dir, {home, run: '1', motion: 'map'})).toThrow(/--motion picks the record --why reads: ask with --why/);
    expect(() => logTool(dir, {home, run: '1', why: 'at', map: 'map', motion: 'map'})).toThrow(/--why reads one record: a map's \(--map\) or its moves' \(--motion\), not both/);
    // a record that is gone is said, never read through something else
    rmSync(path.join(folderOf(home, dir), readdirSync(folderOf(home, dir)).find((f) => f.endsWith('.motion-0.record.jsonl'))));
    await expect(logTool(dir, {home, run: '1', why: 'duration-0', motion: 'map'})).rejects.toThrow(/run 1's moves on map map kept no record \(it could not be written, or its motion flow did not finish\), so they cannot say why/);
    const still = tempDeck({'deck.json': '{"title":"T"}', 'map.html': MAP, 'clicks.html': '<section data-label="M" data-map="map"><step data-in="floor box"><h2>H</h2></step></section>'});
    const r = await runDeck(still, {home});
    expect(r.motions).toBeUndefined();
    expect(keptRuns(folderOf(home, still))[0].motions).toBeUndefined();
    await expect(logTool(still, {home, run: '1', why: 'duration-0', motion: 'map'})).rejects.toThrow(/run 1 kept no moves: no click of its deck moves a block \(data-move\)$/);
  });

  it('a motion flow that throws, returns nothing, never settles or keeps no record is said, and the run goes on', async () => {
    const eng = await engine(), scope = {$call: async (_, fn) => fn()};
    const run = (motionRecord = () => null, limits) => ({engine: eng, motionRecord, options: {limits}});
    const one = (fn) => [{name: 'map', motion: {run: fn}}];
    expect((await flowMotions(scope, run(), one(async () => { throw new Error('boom'); }))).runs[0]).toEqual({name: 'map', file: null, control: {}, keys: [], differs: 'the motion flow failed where the deck planned the moves: boom'});
    expect((await flowMotions(scope, run(), one(async () => null))).runs[0].differs).toBe('the motion flow failed where the deck planned the moves: the motion flow returned no run (no snapshot with its commit log)');
    const timeout = {$call: async () => { const e = new Error('late'); e.name = 'AttemptTimeoutError'; throw e; }};
    expect((await flowMotions(timeout, run(undefined, {[MOTION_FLOW]: 5}), one(async () => null))).runs[0].differs).toBe('the motion flow failed where the deck planned the moves: it did not finish within 0.005 s');
    // a scope that throws outside the call is that map's failure, never the stage's
    const broken = {$call: () => { throw new Error('scope gone'); }};
    expect((await flowMotions(broken, run(), one(async () => null))).runs[0].differs).toMatch(/scope gone/);
    const outside = {engine: {fileSink: () => { throw new Error('no disk'); }, controlDepRecorder: () => { throw new Error('no recorder'); }}, motionRecord: () => '/nowhere/x.jsonl', options: {}};
    expect((await flowMotions(scope, outside, one(async () => null))).runs[0]).toMatchObject({name: 'map', file: null, differs: expect.stringMatching(/no recorder/)});
    const drift = await flowMotions(scope, run(() => { throw new Error('no folder'); }), one(async () => ({snapshot: {commitLog: [], sharedState: {'duration-0': 1, 'not a key': 2}}, differs: 'durations[0]: 1 here, 2 in the deck\'s'})));
    expect(drift.runs[0]).toEqual({name: 'map', file: null, control: {}, keys: ['duration-0'], differs: 'durations[0]: 1 here, 2 in the deck\'s'});
    expect(motionLines({runs: drift.runs}, 'id1')).toEqual([
      'drift · moves map: footprint-story\'s intent decider did not plan the moves the page draws — durations[0]: 1 here, 2 in the deck\'s (the page draws the deck\'s; report it to footprint-story)',
      'moves map: their record was not kept, so log --why cannot answer for them']);
    expect(motionLines()).toEqual([]);
    const many = Array.from({length: MOTIONS_MOST + 2}, (_, i) => ({name: `m${i}`, motion: {run: async () => null}}));
    expect((await flowMotions(scope, run(), many)).skipped).toBe(2);
  });
});
