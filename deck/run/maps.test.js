// @vitest-environment node
import {afterEach, describe, it, expect} from 'vitest';
import {existsSync, readFileSync, readdirSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {runMapFlow} from 'footprint-story/mapflow';
import {runDeck} from './run.js';
import {engine} from './engine.js';
import {firstDifference, flowMaps, MAP_FLOW, MAPS_MOST} from './maps.js';
import {mapArg, mapLines, replyText} from './reply.js';
import {keptRuns, runsFolder} from './log.js';
import {logTool} from '../tools.js';
import {loadDeck} from '../build.js';
import {deckRoot} from '../paths.js';
import {MAP, tempDeck, tempDir, cleanDecks} from '../test/helpers.js';

afterEach(cleanDecks);

const EXAMPLE = path.join(process.cwd(), 'examples', 'a-request');
const exampleFiles = () => Object.fromEntries(['deck.json', 'clicks.html', 'map.html', 'theme.css', ...readdirSync(path.join(EXAMPLE, 'icons')).map((f) => `icons/${f}`)]
  .map((f) => [f, readFileSync(path.join(EXAMPLE, f), 'utf8')]));
/** A one-map deck: its map's HTML, and one click that brings in `pieces`. */
const oneMap = (map, pieces, name = 'map') => tempDeck({'deck.json': '{"title":"T"}', [`${name}.html`]: map,
  'clicks.html': `<section data-label="M" data-map="${name}"><step data-in="${pieces}"><h2>Them</h2></step></section>`});
const BUILT = '<div data-k="a" data-iso="block" data-size="2 2 1"><b>A</b></div>\n<i data-k="w" class="wire" data-arrow="a to b"></i>\n<div data-k="b" data-iso="block" data-size="2 2 1"><b>B</b></div>';
const HAND = '<div data-k="a" data-iso="block" data-at="0 0" data-size="2 2 1"><b>A</b></div>\n<div data-k="b" data-iso="block" data-at="4 0" data-size="2 2 1"><b>B</b></div>';
const folderOf = (home, dir) => runsFolder(home, deckRoot(dir)).dir;
const askLine = (text) => /storydeck log --run (\S+) --why at --map (\S+)$/m.exec(text);

describe('each isometric map built again by the map flow, its record kept for log --why --map', () => {
  it('the example deck: the reply offers the call by the run\'s id, and the answer walks through the place step and its decision', async () => {
    const dir = tempDeck(exampleFiles()), home = tempDir();
    const r = await runDeck(dir, {home, write: true});
    expect(r.verdict).toBe('clean');
    const reply = replyText(r), [, id, map] = askLine(reply);
    expect(reply.split('\n').at(-1)).toBe(`maps: map — why a block stands where it does: storydeck log --run ${id} --why at --map map`);
    expect(id).toBe(r.id);
    expect(map).toBe('map');
    // the record sits beside the run's, named by the map's place in the list
    expect(readdirSync(folderOf(home, dir))).toContain(`${id}.map-0.record.jsonl`);
    const at = await logTool(dir, {home, run: id, why: 'at', map: 'map'});
    expect(at.split('\n')[0]).toBe('at = [[0,5,0],[4,1,0],[7,4,0],[12,2,0]]');
    // a map placed by hand says so, through the decision that let the hand step run
    expect(at).toMatch(/^place: hand \(hand#\d+\) \[wrote: at\]$/m);
    expect(at).toMatch(/^ {2}place \(place#\d+\) ← \[control: every block has an at: the map placed them\] \[wrote: placed, placedWhy\]$/m);
    const view = await logTool(dir, {home, run: id, why: 'view', map: 'map'});
    expect(view).toMatch(/^grid: written \(written#\d+\) \[wrote: view\]$/m);
    expect(view).toMatch(/\[control: the map writes its grid in numbers: its tile and where the floor's far corner stands\]/);
    // every line one line; the same run by its number answers the same
    expect(at.split('\n').every((line) => !/[\r\u2028\u2029]/.test(line))).toBe(true);
    expect(await logTool(dir, {home, run: '1', why: 'at', map: 'map'})).toBe(at.replace(`run ${id}`, 'run 1'));
    // the run's own record says the call was made, and what it found
    const [kept] = keptRuns(folderOf(home, dir));
    expect(kept.calls[MAP_FLOW]).toMatchObject({count: 1, ok: 1});
    expect(kept.maps).toEqual([expect.objectContaining({name: 'map', k: 0, kept: true, record: expect.stringMatching(/\.map-0\.record\.jsonl$/)})]);
    expect(await logTool(dir, {home, run: '1', why: 'mapFlows'})).toMatch(/^mapFlows = \{"map":\{"kept":true\}\}\nmaps made \(maps-made#\d+\)/);
    expect(logTool(dir, {home, run: '1'})).toContain(`maps: map\n  why a block stands where it does: storydeck log --run ${id} --why at --map map`);
  });

  it('a map the build places: its blocks through the build step, its grid fitted; one placed by hand with no grid is on the usual grid, and says why', async () => {
    const home = tempDir(), built = oneMap(BUILT, 'a w b');
    await runDeck(built, {home});
    const at = await logTool(built, {home, run: '1', why: 'at', map: 'map'});
    expect(at).toMatch(/^place: build \(build#\d+\) \[wrote: at\]$/m);
    expect(at).toContain('[control: no block has an at: the build places them from their wires, across the frame]');
    expect(await logTool(built, {home, run: '1', why: 'view', map: 'map'})).toContain('[control: no grid is written and the build placed the blocks: it is fitted so the picture fills the area, not drawn on the usual grid]');
    const usual = oneMap(HAND, 'a b');
    await runDeck(usual, {home});
    const view = await logTool(usual, {home, run: '1', why: 'view', map: 'map'});
    expect(view.split('\n')[0]).toBe('view = {"tile":[120,60],"origin":[960,240],"rise":73.48469228349535}');
    expect(view).toMatch(/^grid: usual \(usual#\d+\) \[wrote: view\]$/m);
    expect(view).toContain('[control: no grid is written and the map placed its blocks: it is the usual grid the tool handed in]');
    // --why with no key is refused, as the run's own is, naming what that map's run wrote; a key no step wrote says what there is
    await expect(logTool(usual, {home, run: '1', why: '', map: 'map'})).rejects.toThrow(/^why names a value of run 1 map map, one of what its steps wrote \(a map's steps write who, blocks, .*\bat\b.*\bview\b.*\bnames\b.*\)$/);
    await expect(logTool(usual, {home, run: '1', why: ''})).rejects.toThrow('why names a value of the run, one of what its stages wrote (storydeck log --run 1 shows what each stage wrote)');
    expect(await logTool(usual, {home, run: '1', why: 'nope', map: 'map'})).toMatch(/^nope: no stage of this run wrote it \(a map's steps write .*placedWhy/);
  });

  it('the map flow is handed the very spec the deck built with, frozen at every level, and makes the same map', async () => {
    const dir = oneMap(BUILT, 'a w b'), {built} = loadDeck(dir).compiled.maps.map;
    const frozenAll = (v) => (v === null || typeof v !== 'object' ? true : Object.isFrozen(v) && Object.values(v).every(frozenAll));
    expect(frozenAll(built.spec)).toBe(true);
    let handed = null;
    const r = await runDeck(dir, {home: tempDir(), mapFlow: (spec, policy, options) => { handed = spec; return runMapFlow(spec, policy, options); }});
    expect(handed).toEqual(built.spec);
    expect(frozenAll(handed)).toBe(true);
    expect(r.maps.runs[0].differs).toBeUndefined();
    // the very object, never one made again: what the compile kept is what the flow is handed
    const eng = await engine();
    await flowMaps({$call: (target, fn) => fn()}, {engine: eng, options: {mapFlow: (spec, policy, options) => { handed = spec; return runMapFlow(spec, policy, options); }}, mapRecord: () => null}, [{name: 'map', built}]);
    expect(handed).toBe(built.spec);
  });

  it('a deck with no isometric map runs nothing new: no call, no map record, the reply as it was — and --map says what the deck has', async () => {
    const dir = oneMap(MAP, 'a', 'flat'), home = tempDir();
    let asked = 0;
    const r = await runDeck(dir, {home, write: true, mapFlow: () => { asked += 1; }});
    expect(asked).toBe(0);
    expect(r.maps).toEqual({runs: [], skipped: 0});
    expect(replyText(r)).toBe(replyText({...r, maps: undefined, id: undefined}));
    expect(replyText(r)).not.toMatch(/^maps:|--map|drift/m);
    expect(readdirSync(folderOf(home, dir)).filter((n) => /\.map-/.test(n))).toEqual([]);
    const [kept] = keptRuns(folderOf(home, dir));
    expect(kept.calls[MAP_FLOW]).toBeUndefined();
    expect(kept.stages.map((s) => s.stage)).toContain('maps made');
    await expect(logTool(dir, {home, run: '1', why: 'at', map: 'flat'})).rejects.toThrow('run 1 kept no map: its deck has no isometric map — its maps are flat, with no isometric piece');
    // a deck that does not compile built no map, and says so
    writeFileSync(path.join(dir, 'deck.json'), '{"title":"T","oops":1}');
    await runDeck(dir, {home});
    await expect(logTool(dir, {home, run: '1', why: 'at', map: 'flat'})).rejects.toThrow('run 1 kept no map: its deck did not compile, so no map was built');
  });

  it('an unknown map names the maps there are; --map without --why is refused; a map name finds no file', async () => {
    const files = {...exampleFiles(), 'flat.html': MAP, 'deck.json': '{"title":"T","maps":{"map":"map.html","flat":"flat.html"}}'};
    files['clicks.html'] += '\n<section data-label="F" data-map="flat"><step data-in="a"><h2>Flat</h2></step></section>';
    const dir = tempDeck(files), home = tempDir();
    await runDeck(dir, {home});
    await expect(logTool(dir, {home, run: '1', why: 'at', map: 'nope'})).rejects.toThrow('run 1 has no map "nope": its isometric maps are map (the deck\'s other maps, flat, have no isometric piece)');
    await expect(logTool(dir, {home, run: '1', why: 'at', map: '../../x\nverdict = 1'})).rejects.toThrow(/^run 1 has no map "\.\.\/\.\.\/x verdict = 1": /);
    await expect(logTool(dir, {home, run: '1', why: 'at', map: ' '})).rejects.toThrow('--map names one of the run\'s maps');
    expect(() => logTool(dir, {home, run: '1', map: 'map'})).toThrow('--map picks the record --why reads: ask with --why (storydeck log --run 1 --why at --map map)');
  });

  it('a map flow whose map is not the page\'s is a drift line, first in every answer for that map, and never changes the verdict', async () => {
    const home = tempDir(), dir = oneMap(HAND, 'a b');
    const plain = await runDeck(dir, {home});
    const moved = async (spec, policy, options) => { const out = await runMapFlow(spec, policy, options); return {...out, map: {...out.map, at: [[1, 0, 0], ...out.map.at.slice(1)]}}; };
    const r = await runDeck(dir, {home, mapFlow: moved});
    expect(r.verdict).toBe(plain.verdict);
    expect(r.maps.runs[0].differs).toBe('at[0][0]: 1 here, 0 in the deck\'s');
    expect(replyText(r)).toContain('\ndrift · map map: footprint-story\'s map flow did not build the map the page draws — at[0][0]: 1 here, 0 in the deck\'s (the page draws the deck\'s map; report it to footprint-story)\n');
    for (const key of ['at', 'view']) expect((await logTool(dir, {home, run: '1', why: key, map: 'map'})).split('\n')[0]).toBe('(this map flow did not build the map the page draws: at[0][0]: 1 here, 0 in the deck\'s)');
    expect(logTool(dir, {home, run: '1'})).toContain('maps: map (drift: its map flow parted from the page\'s map)');
  });

  it('a map flow that throws, returns nothing or never settles is said, and the run goes on; the record it began is removed', async () => {
    const home = tempDir(), dir = oneMap(HAND, 'a b');
    const cases = [
      [() => { throw new Error('boom\nverdict = "forged"'); }, 'the map flow failed where the deck built the map: boom verdict = "forged"'],
      [async () => undefined, 'the map flow failed where the deck built the map: the map flow returned no map'],
      [async () => ({map: {}, snapshot: null}), 'the map flow failed where the deck built the map: the map flow returned no run (no snapshot with its commit log)'],
      [() => new Promise(() => {}), 'the map flow failed where the deck built the map: it did not finish within 0.2 s'],
    ];
    for (const [mapFlow, said] of cases) {
      const r = await runDeck(dir, {home, write: true, mapFlow, limits: {'map.flow': 200}});
      expect(r.verdict).toBe('clean');
      expect(r.written).toBeTruthy();
      expect(r.maps.runs[0]).toMatchObject({file: null, differs: said});
      const reply = replyText(r).split('\n');
      expect(reply).toContain(`drift · map map: footprint-story's map flow did not build the map the page draws — ${said} (the page draws the deck's map; report it to footprint-story)`);
      expect(reply).toContain('map map: its record was not kept, so log --why cannot answer for it');
      expect(reply.some((line) => line.startsWith('maps: map —'))).toBe(false);   // nothing to ask
      await expect(logTool(dir, {home, run: '1', why: 'at', map: 'map'})).rejects.toThrow(`run 1's map map kept no record (it could not be written, or its map flow did not finish: ${said}), so it cannot say why`);
    }
    expect(readdirSync(folderOf(home, dir)).filter((n) => /\.map-/.test(n))).toEqual([]);
    const [last] = keptRuns(folderOf(home, dir));
    expect(last.calls[MAP_FLOW]).toMatchObject({count: 1, timeout: 1});
  });

  it('a kept run is read as a file anyone may have written: a map name that is no map\'s moves no other map off its record', async () => {
    const home = tempDir(), dir = tempDeck({'deck.json': '{"title":"T","maps":{"one":"one.html","two":"two.html"}}', 'one.html': HAND, 'two.html': BUILT,
      'clicks.html': '<section data-label="A" data-map="one"><step data-in="a b"><h2>One</h2></step></section><section data-label="B" data-map="two"><step data-in="a w b"><h2>Two</h2></step></section>'});
    await runDeck(dir, {home});
    expect(await logTool(dir, {home, run: '1', why: 'placed', map: 'two'})).toMatch(/^placed = "build"/);
    const [kept] = keptRuns(folderOf(home, dir)), file = path.join(folderOf(home, dir), `${kept.id}.json`), data = JSON.parse(readFileSync(file, 'utf8'));
    writeFileSync(file, JSON.stringify({...data, maps: [{...data.maps[0], name: '../x\nverdict = 1'}, data.maps[1]]}));
    expect(await logTool(dir, {home, run: '1', why: 'placed', map: 'two'})).toMatch(/^placed = "build"/);
    await expect(logTool(dir, {home, run: '1', why: 'placed', map: 'one'})).rejects.toThrow('run 1 has no map "one": its isometric maps are two');
  });

  it('a run asked by its id is named by it; an id no kept run has says so; a kept failure cannot forge a line', async () => {
    const home = tempDir(), dir = oneMap(MAP, 'a', 'flat');
    const r = await runDeck(dir, {home});
    await expect(logTool(dir, {home, run: r.id, why: 'at', map: 'flat'})).rejects.toThrow(`run ${r.id} kept no map: its deck has no isometric map`);
    await expect(logTool(dir, {home, run: r.id, why: ''})).rejects.toThrow(`(storydeck log --run ${r.id} shows what each stage wrote)`);
    expect(await logTool(dir, {home, run: r.id, why: 'nothing'})).toBe(`nothing: no stage of this run wrote it (storydeck log --run ${r.id} shows what each stage wrote)`);
    expect(() => logTool(dir, {home, run: '2026-01-01T00-00-00-000Z-build.abcdef', why: 'at'})).toThrow('--run is a run\'s number in the list (1 the newest, to 1) or its id; no kept run has id "2026-01-01T00-00-00-000Z-build.abcdef"');
    expect(() => logTool(dir, {home, run: 'x\ny'})).toThrow('no kept run has id "x y"');
    const file = path.join(folderOf(home, dir), `${r.id}.json`), data = JSON.parse(readFileSync(file, 'utf8'));
    writeFileSync(file, JSON.stringify({...data, verdict: 'failed', flat: [], failure: 'boom\nverdict = "forged"\u2028x'}));
    const said = await logTool(dir, {home, run: '1', why: 'at', map: 'flat'}).catch((e) => e.message);
    expect(said).toBe('run 1 kept no map: it could not finish (boom verdict = "forged" x)');
    expect(logTool(dir, {home, run: '1'}).split('\n').some((line) => line.startsWith('verdict'))).toBe(false);
  });

  it('a map is offered by a name the command line takes: quoted past letters and digits, never one it reads as a flag', () => {
    expect(['map', 'my-map', '-x', '--x', 'x'.repeat(101), 'a b'].map(mapArg)).toEqual(['map', '\'my-map\'', '\'-x\'', null, null, null]);
    const runs = [{name: '--x', file: '/r/0', control: {}, keys: []}, {name: 'my-map', file: '/r/1', control: {}, keys: []}];
    expect(mapLines({runs, skipped: 0}, 'the-id').at(-1)).toBe('maps: --x, my-map — why a block stands where it does: storydeck log --run the-id --why at --map \'my-map\'');
    expect(mapLines({runs: runs.slice(0, 1), skipped: 0}, 'the-id')).toEqual([]);   // nothing the command line takes: nothing offered
  });

  it('a run kept before 0.34.0 says it kept no map records, never "no map"', async () => {
    const home = tempDir(), dir = tempDeck(exampleFiles());
    await runDeck(dir, {home});
    const [kept] = keptRuns(folderOf(home, dir)), file = path.join(folderOf(home, dir), `${kept.id}.json`);
    const {maps: _maps, flat: _flat, ...old} = JSON.parse(readFileSync(file, 'utf8'));
    writeFileSync(file, JSON.stringify(old));
    await expect(logTool(dir, {home, run: '1', why: 'at', map: 'map'})).rejects.toThrow('run 1 was kept before 0.34.0, which kept no map records: run the build again, then ask that run');
    expect(await logTool(dir, {home, run: '1', why: 'verdict'})).toMatch(/^verdict = "clean"/);   // its own record still answers
  });

  it('a record that cannot be written never costs the run: the map is still built and compared, and the reply says so', async () => {
    const eng = await engine(), scope = {$call: (target, fn) => fn()};
    const {built} = loadDeck(oneMap(HAND, 'a b')).compiled.maps.map;
    const run = (mapRecord) => ({engine: eng, options: {}, mapRecord});
    const nowhere = await flowMaps(scope, run(() => path.join(tempDir(), 'gone', 'x.record.jsonl')), [{name: 'map', built}]);
    expect(nowhere.runs[0]).toMatchObject({name: 'map', file: null});
    expect(nowhere.runs[0].differs).toBeUndefined();
    expect(Object.keys(nowhere.runs[0].control).length).toBeGreaterThan(0);
    const refused = await flowMaps(scope, run(() => { throw new Error('no folder'); }), [{name: 'map', built}]);
    expect(refused.runs[0]).toMatchObject({file: null});
    expect(mapLines(refused, 'the-id')).toEqual(['map map: its record was not kept, so log --why cannot answer for it']);
    expect(mapLines(refused, null)).toEqual([]);   // a run not kept offers nothing to ask
  });

  it('whatever goes wrong around a map\'s run is that map\'s failure, said: never a throw out of the stage', async () => {
    const {built} = loadDeck(oneMap(HAND, 'a b')).compiled.maps.map, scope = {$call: (target, fn) => fn()};
    const broken = await flowMaps(scope, {engine: {}, mapRecord: () => null}, [{name: 'map', built}]);
    expect(broken.runs[0]).toMatchObject({name: 'map', file: null, differs: expect.stringMatching(/^the map flow failed where the deck built the map: /)});
  });

  it('builds at most MAPS_MOST maps a run, and says how many more were not', async () => {
    const eng = await engine(), scope = {$call: (target, fn) => fn()};
    const {built} = loadDeck(oneMap(HAND, 'a b')).compiled.maps.map;
    let runs = 0;
    const mapFlow = async (spec, policy, options) => { runs += 1; return runMapFlow(spec, policy, options); };
    const out = await flowMaps(scope, {engine: eng, options: {mapFlow}, mapRecord: () => null}, Array.from({length: MAPS_MOST + 3}, (_, k) => ({name: `m${k}`, built})));
    expect(runs).toBe(MAPS_MOST);
    expect(out.skipped).toBe(3);
    expect(mapLines(out, 'id')).toContain(`maps: 3 more not built again (a run builds the first ${MAPS_MOST})`);
  });
});

describe('firstDifference: where two maps first part', () => {
  it('names the path and both values, or null when they are equal', () => {
    expect(firstDifference({at: [[0, 1]]}, {at: [[0, 1]]})).toBeNull();
    expect(firstDifference({view: {tile: [120, 60]}}, {view: {tile: [96, 48]}})).toBe('view.tile[0]: 120 here, 96 in the deck\'s');
    expect(firstDifference({a: 1}, {a: 1, b: 2})).toBe('b: undefined here, 2 in the deck\'s');
    expect(firstDifference([1], {0: 1})).toBe('the map: [1] here, {"0":1} in the deck\'s');
    expect(firstDifference({s: 'x'.repeat(100)}, {s: ''})).toMatch(/^s: "x{58}… here, "" in the deck's$/);
  });
});

describe('the map record kept with its run', () => {
  it('goes with its run when the oldest runs are dropped', async () => {
    const {RUNS_KEPT} = await import('./log.js');
    const home = tempDir(), dir = oneMap(HAND, 'a b');
    await runDeck(dir, {home});
    const [first] = keptRuns(folderOf(home, dir));
    for (let i = 0; i < RUNS_KEPT; i++) await runDeck(dir, {home, mapFlow: async () => undefined});
    expect(existsSync(path.join(folderOf(home, dir), `${first.id}.map-0.record.jsonl`))).toBe(false);
    expect(readdirSync(folderOf(home, dir)).filter((n) => /\.map-/.test(n))).toEqual([]);
  });
});
