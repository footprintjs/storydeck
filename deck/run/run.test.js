// @vitest-environment node
import {afterEach, describe, it, expect} from 'vitest';
import {existsSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {readRecordFile} from 'footprintjs/sinks';
import {runDeck, runMermaid} from './run.js';
import {replyText} from './reply.js';
import {CALL_LIMITS, limitOf} from './measure.js';
import {keptRuns, runsFolder} from './log.js';
import {deckRoot} from '../paths.js';
import {STARTER} from '../init.js';
import {tempDeck, tempDir, cleanDecks} from '../test/helpers.js';

afterEach(cleanDecks);

/** A deck whose headlines are over the word limit: four warnings. */
const wordy = () => tempDeck({...STARTER, 'deck.json': '{"title":"T","checks":{"maxWords":2}}'});
const runsOf = (home, dir) => keptRuns(runsFolder(home, deckRoot(dir)).dir);

/** A browser port that answers from memory: what each click's measure finds, and what it was asked. */
function fakeDriver({found = () => [], open = async () => {}, measure = null} = {}) {
  const asked = [];
  return {asked, pages: [],
    async open(url) { asked.push('open'); this.pages.push(readFileSync(fileURLToPath(url), 'utf8')); await open(url); },
    async measure(n) { asked.push(`measure ${n}`); return measure ? measure(n) : found(n); },
    async close() { asked.push('close'); }};
}

describe('runDeck: one run of a deck', () => {
  it('a check reads the deck against every rule and writes nothing; a build is the same run, and writes the page', async () => {
    const dir = tempDeck(), home = tempDir();
    const checked = await runDeck(dir, {home});
    expect(checked).toMatchObject({kind: 'check', verdict: 'clean', errors: 0, warnings: 0, clicks: 6, measured: false, written: null, round: 0});
    expect(existsSync(path.join(dir, 'index.html'))).toBe(false);
    const built = await runDeck(dir, {home, write: true});
    expect(built).toMatchObject({kind: 'build', verdict: 'clean', written: {clicks: 6, slides: 6, data: null}});
    expect(readFileSync(built.written.file, 'utf8')).toMatch(/^<!doctype html>/);
  });

  it('says every choice it made, with the rule that chose and the value it read', async () => {
    const dir = wordy(), home = tempDir();
    await runDeck(dir, {home, write: true});
    const [run] = runsOf(home, dir), words = run.lines.join('\n');
    expect(words).toContain('[Condition]: No rules matched, fell back to default "The deck compiles": check rules.');
    expect(words).toContain('[Condition]: It evaluated Rule 0 "No measure was asked for": layoutAsked false eq false ✓, and chose not asked.');
    expect(words).toContain('[Condition]: No rules matched, fell back to default "The page is written": write page.');
    expect(words).toContain('[Condition]: It evaluated Rule 1 "There is a warning to fix": warnings 4 gt 0 ✓, and chose fix.');
    expect(run.stages.map((s) => s.stage)).toEqual(['read deck', 'compiles?', 'check rules', 'maps made', 'read notes', 'measure asked?', 'not asked', 'write asked?', 'write page', 'count problems', 'verdict', 'fix']);
  });

  it('a deck that does not compile is the verdict "broken": one problem, nothing written, and the run stops there', async () => {
    const dir = tempDeck({...STARTER, 'deck.json': '{"title":"T","oops":1}'}), home = tempDir();
    const r = await runDeck(dir, {home, write: true, layout: true, driver: fakeDriver()});
    expect(r).toMatchObject({verdict: 'broken', errors: 1, warnings: 0, written: null, measured: false, round: 1});
    expect(r.problems).toEqual([expect.objectContaining({level: 'error', rule: 'compile', message: expect.stringMatching(/^deck\.json has "oops"/)})]);
    expect(existsSync(path.join(dir, 'index.html'))).toBe(false);
    expect(runsOf(home, dir)[0].stages.map((s) => s.stage)).toEqual(['read deck', 'compiles?', 'broken']);   // no later stage ran
  });

  it('a folder that is no deck is broken too, and keeps nothing: there is no deck to keep a run for', async () => {
    const home = tempDir(), r = await runDeck(path.join(tempDir(), 'nowhere'), {home});
    expect(r).toMatchObject({verdict: 'broken', problems: [expect.objectContaining({rule: 'compile', message: expect.stringMatching(/is not a folder/)})]});
    expect(r.unkept).toBeUndefined();
    expect(existsSync(path.join(home, 'runs'))).toBe(false);
  });

  it('rounds of fixing: each run says what changed since the one before, and a clean run closes the series', async () => {
    const dir = wordy(), home = tempDir();
    const first = await runDeck(dir, {home});
    expect(first).toMatchObject({verdict: 'fix', warnings: 4, round: 1, first: {errors: 0, warnings: 4}, since: null, closed: null});
    const same = await runDeck(dir, {home});
    expect(same).toMatchObject({round: 2, since: {fixed: 0, new: 0}, first: {errors: 0, warnings: 4}});
    writeFileSync(path.join(dir, 'deck.json'), '{"title":"T","checks":{"maxWords":4}}');   // an edit that fixes some
    const better = await runDeck(dir, {home, write: true});
    expect(better.warnings).toBeLessThan(4);
    expect(better).toMatchObject({verdict: 'fix', round: 3, since: {fixed: 4 - better.warnings, new: 0}});
    writeFileSync(path.join(dir, 'deck.json'), '{"title":"T"}');
    const done = await runDeck(dir, {home, write: true});
    expect(done).toMatchObject({verdict: 'clean', round: 0, closed: {rounds: 3, first: {errors: 0, warnings: 4}}, since: {fixed: better.warnings, new: 0}});
    expect(await runDeck(dir, {home})).toMatchObject({verdict: 'clean', round: 0, closed: null});   // nothing to close a second time
  });
});

describe('runDeck: the browser, as an adapter', () => {
  it('measures every click through named calls, and its findings join the rule problems', async () => {
    const dir = wordy(), home = tempDir();
    const driver = fakeDriver({found: (n) => (n === 2 ? [{kind: 'spills', piece: 'server', text: 'Server', dx: 12, dy: 0}] : [])});
    const r = await runDeck(dir, {home, layout: true, driver});
    expect(driver.asked).toEqual(['open', 'measure 1', 'measure 2', 'measure 3', 'measure 4', 'measure 5', 'measure 6', 'close']);
    expect(r).toMatchObject({verdict: 'fix', measured: true, warnings: 5, layoutNote: null});
    expect(r.problems.filter((p) => p.rule === 'words')).toHaveLength(4);   // the rules' own problems are still there
    expect(r.problems.find((p) => p.rule === 'spills')).toMatchObject({level: 'warn', click: 2, message: expect.stringContaining('text spills out of "server" by 12 px wide')});
    const [run] = runsOf(home, dir);
    expect(run.calls).toMatchObject({'browser.open': {count: 1, ok: 1}, 'browser.measure': {count: 6, ok: 6, failed: 0, timeout: 0}, 'browser.close': {count: 1, ok: 1}});
    expect(run.lines.join('\n')).toContain('[Condition]: No rules matched, fell back to default "Every click was measured": measure/measured.');
  });

  it('what a browser found stays open until a browser measures again: a build without a measure does not call it fixed', async () => {
    const dir = tempDeck(), home = tempDir(), spill = [{kind: 'spills', piece: 'server', text: 'Server', dx: 12, dy: 0}];
    const found = await runDeck(dir, {home, write: true, layout: true, driver: fakeDriver({found: (n) => (n === 2 ? spill : [])})});
    expect(found).toMatchObject({verdict: 'fix', warnings: 1, round: 1, carried: 0});
    const plain = await runDeck(dir, {home, write: true});   // nothing was edited, and nothing is measured
    expect(plain).toMatchObject({verdict: 'clean', warnings: 0, carried: 1, round: 2, closed: null, since: {fixed: 0, new: 0}});
    expect(replyText(plain).split('\n')[0]).toBe('clean so far — 1 problem a browser found before was not measured again (--layout measures)');
    expect(replyText(plain, {measure: 'layout: true'}).split('\n').at(-1)).toBe('since the last run: nothing changed · round 2');
    const again = await runDeck(dir, {home, write: true, layout: true, driver: fakeDriver({found: (n) => (n === 2 ? spill : [])})});
    expect(again).toMatchObject({verdict: 'fix', round: 3, carried: 0, since: {fixed: 0, new: 0}});   // still there, as the reply said it might be
    const gone = await runDeck(dir, {home, write: true, layout: true, driver: fakeDriver()});
    expect(gone).toMatchObject({verdict: 'clean', round: 0, carried: 0, since: {fixed: 1, new: 0}, closed: {rounds: 3, first: {errors: 0, warnings: 1}}});
    expect(replyText(gone).split('\n')[0]).toBe('clean — nothing to fix');
  });

  it('a measure that stopped is that run\'s own error: the next run carries nothing of it, and a stop is never one problem twice', async () => {
    const dir = tempDeck(), home = tempDir(), failing = () => fakeDriver({open: async () => { throw new Error('did not open'); }});
    const stopped = await runDeck(dir, {home, layout: true, driver: failing()});
    expect(stopped).toMatchObject({verdict: 'fix', errors: 1, measured: false, round: 1, carried: 0});
    const twice = await runDeck(dir, {home, layout: true, driver: failing()});
    expect(twice).toMatchObject({verdict: 'fix', errors: 1, round: 2, carried: 0, since: {fixed: 0, new: 1}});
    expect(replyText(twice)).not.toContain('a browser found before');
    // no browser to find, or no measure asked for: nothing a browser found is open, so the run is clean and the series closes
    expect(await runDeck(dir, {home, layout: true})).toMatchObject({verdict: 'clean', carried: 0, round: 0, closed: {rounds: 2, first: {errors: 1, warnings: 0}}});
    expect(replyText(await runDeck(dir, {home})).split('\n')[0]).toBe('clean — nothing to fix');
  });

  it('a browser that does not close when asked is one error naming the call, and the run still answers', async () => {
    const dir = tempDeck(), home = tempDir(), driver = fakeDriver();
    driver.close = () => new Promise(() => {});
    const r = await runDeck(dir, {home, layout: true, driver, limits: {'browser.close': 40}});   // the other calls keep their own limits
    expect(r.problems).toEqual([expect.objectContaining({rule: 'layout', message: expect.stringContaining('the layout check stopped: browser.close did not answer within 40 ms')})]);
    expect(runsOf(home, dir)[0].calls).toMatchObject({'browser.measure': {count: 6, ok: 6}, 'browser.close': {count: 1, timeout: 1}});
  });

  it('every call has a limit, whatever a caller gives: its own when that is a time, else the one this folder sets', () => {
    expect(limitOf({'browser.open': 50}, 'browser.open')).toBe(50);
    expect(limitOf({'browser.open': 50}, 'browser.measure')).toBe(CALL_LIMITS['browser.measure']);   // a limit left out is never no limit
    for (const not of [undefined, null, 'soon', 0, -5, NaN, Infinity]) expect(limitOf({'browser.close': not}, 'browser.close')).toBe(CALL_LIMITS['browser.close']);
    expect(limitOf(undefined, 'browser.open')).toBe(120_000);
  });

  it('says in its record where the browser came from, and whether the page carries the person\'s voice', async () => {
    const dir = tempDeck(), home = tempDir();
    await runDeck(dir, {home, layout: true, driver: fakeDriver()});
    const words = runsOf(home, dir)[0].lines.join('\n');
    expect(words).toContain('Write browserFrom = "given by the caller"');
    expect(words).toContain('Write voiceAsked = false');
  });

  it('names the click whose measure took longest', async () => {
    const dir = tempDeck(), home = tempDir();
    const driver = fakeDriver({measure: (n) => new Promise((done) => setTimeout(() => done([]), n === 4 ? 60 : 1))});
    await runDeck(dir, {home, layout: true, driver});
    expect(runsOf(home, dir)[0].calls['browser.measure']).toMatchObject({count: 6, slowest: 4});
  });

  it('the page the browser opens is the page that is written: an edit while the run measures is not in it', async () => {
    const dir = tempDeck(), home = tempDir();
    const driver = fakeDriver({open: async () => { writeFileSync(path.join(dir, 'deck.json'), '{"title":"Changed while measuring"}'); }});
    const r = await runDeck(dir, {home, layout: true, write: true, driver});
    expect(driver.pages).toHaveLength(1);
    expect(readFileSync(r.written.file, 'utf8')).toBe(driver.pages[0]);   // one reading: checked, measured and written
    expect(driver.pages[0]).not.toContain('Changed while measuring');
  });

  it('a call that never answers ends at its time limit: the measure stops as one error, the browser is closed, the run goes on', async () => {
    const dir = tempDeck(), home = tempDir();
    const driver = fakeDriver({measure: (n) => (n === 3 ? new Promise(() => {}) : [])});
    const r = await runDeck(dir, {home, layout: true, write: true, driver, limits: {'browser.open': 1000, 'browser.measure': 40, 'browser.close': 1000}});
    expect(driver.asked.at(-1)).toBe('close');
    expect(driver.asked).not.toContain('measure 4');
    expect(r).toMatchObject({verdict: 'fix', errors: 1, measured: false});
    expect(r.problems).toEqual([expect.objectContaining({level: 'error', rule: 'layout', message: expect.stringMatching(/^the layout check stopped: browser\.measure did not answer within 40 ms — the page did not settle in the browser/)})]);
    expect(r.written).toMatchObject({clicks: 6});   // the page is still written: a build says what to fix, it does not hold the page back
    expect(runsOf(home, dir)[0].calls['browser.measure']).toMatchObject({count: 3, ok: 2, timeout: 1});
  });

  it('a browser that fails to open stops the measure the same way, and leaves no folder of its own behind', async () => {
    const dir = tempDeck(), home = tempDir();
    let opened;
    const driver = fakeDriver({open: async (url) => { opened = path.dirname(fileURLToPath(url)); throw new Error('browserType.launch: Executable does not exist\nlots more'); }});
    const r = await runDeck(dir, {home, layout: true, driver});
    expect(r.problems).toEqual([expect.objectContaining({rule: 'layout', message: expect.stringContaining('the layout check stopped: browserType.launch: Executable does not exist —')})]);
    expect(driver.asked).toEqual(['open', 'close']);
    expect(existsSync(opened)).toBe(false);
  });

  it('with no browser to find, the run says why and goes on unmeasured: the adapter ends, the run does not', async () => {
    const dir = tempDeck(), home = tempDir();
    const r = await runDeck(dir, {home, layout: true, write: true});
    expect(r).toMatchObject({verdict: 'clean', measured: false, layoutNote: expect.stringMatching(/^layout not checked: it needs Playwright installed beside StoryDeck/), written: {clicks: 6}});
    expect(runsOf(home, dir)[0].lines.join('\n')).toContain('"No browser was found": browserFound false eq false ✓');
  });
});

describe('runDeck: what it keeps, and what it never lets cost the answer', () => {
  it('keeps the run in words, and the record itself beside it: every commit and every call', async () => {
    const dir = tempDeck(), home = tempDir();
    await runDeck(dir, {home, layout: true, driver: fakeDriver()});
    const [run] = runsOf(home, dir), record = readRecordFile(run.record);
    expect(record.unreadable).toEqual([]);
    const kinds = record.entries.map((e) => e.kind), notes = record.entries.filter((e) => e.kind === 'note');
    expect(kinds.filter((k) => k === 'opened')).toHaveLength(2);   // the run, and the adapter mounted in it
    // two notes a call — one as it starts, one as it ends — so a run cut short still says which call it was in
    expect(notes.filter((n) => n.note === 'attempt-start').map((n) => n.data.target)).toEqual(['browser.open', ...Array(6).fill('browser.measure'), 'browser.close']);
    expect(notes.filter((n) => n.note === 'attempt').map((n) => n.data.record.outcome)).toEqual(Array(8).fill('ok'));
    expect(kinds.at(-1)).toBe('closed');
  });

  it('a page that may not be written stops the run with the same reason a build always gave, and the run is kept as failed', async () => {
    const dir = tempDeck(), home = tempDir(), victim = path.join(tempDir(), 'victim');
    writeFileSync(victim, 'keep');
    symlinkSync(victim, path.join(dir, 'index.html'));
    const error = await runDeck(dir, {home, write: true}).catch((e) => e);
    expect(error.message).toMatch(/index\.html is a link — the build writes a file, never through a link/);
    expect(error.run.state).toMatchObject({compiled: true, clicks: 6});   // what it got to
    expect(readFileSync(victim, 'utf8')).toBe('keep');
    expect(runsOf(home, dir)[0]).toMatchObject({verdict: 'failed', failure: expect.stringContaining('index.html is a link'), round: 0});
    // it is no round of fixing the deck: with the link gone, the next run is clean and closes nothing
    rmSync(path.join(dir, 'index.html'));
    expect(await runDeck(dir, {home})).toMatchObject({verdict: 'clean', round: 0, closed: null});
  });

  it('a kept run that says less than it should never costs the next run its answer', async () => {
    const dir = tempDeck(), home = tempDir(), {dir: folder} = runsFolder(home, deckRoot(dir));
    writeFileSync(path.join(folder, '2026-01-01T00-00-00-000Z-check.abcdef.json'), JSON.stringify({v: 1, verdict: 'fix', round: 2}));   // a series, and not what it began with
    const r = await runDeck(dir, {home});
    expect(r).toMatchObject({verdict: 'clean', closed: {rounds: 2, first: {errors: 0, warnings: 0}}});
    expect(replyText(r)).toBe('clean — nothing to fix\nclean after 2 rounds of fixing (it began with 0 to fix)');
  });

  it('a build that carries the person\'s voice says how many clicks have it', async () => {
    const dir = tempDeck(), r = await runDeck(dir, {home: tempDir(), write: true, voice: true});
    expect(r.written).toMatchObject({clicks: 6, voice: {have: 0, wanted: 6}});   // no clip was made yet: the page says the words in the browser's voice
  });

  it('keeps nothing when asked not to, and says why when it cannot: a StoryDeck folder inside the deck', async () => {
    const dir = tempDeck(), home = tempDir();
    expect((await runDeck(dir, {home, keep: false})).unkept).toBeUndefined();
    expect(existsSync(path.join(home, 'runs'))).toBe(false);
    const inside = await runDeck(dir, {home: path.join(dir, '.storydeck')});
    expect(inside).toMatchObject({verdict: 'clean', unkept: expect.stringMatching(/is inside the deck folder — set STORYDECK_HOME elsewhere/)});
    expect(readdirSync(dir)).not.toContain('.storydeck');   // nothing of the person's lands in a deck
  });

  it('its README draws the charts as the engine draws them', async () => {
    const drawn = await runMermaid(), readme = readFileSync(new URL('./README.md', import.meta.url), 'utf8');
    const blocks = [...readme.matchAll(/```mermaid\n([\s\S]*?)\n```/g)].map((m) => m[1]);
    expect(blocks).toEqual([drawn.run, drawn.measure]);   // a chart that changes changes its drawing
    expect(drawn.run).toContain('measure_asked --> measure');
  });
});

describe('run · how a map was made is on the record', () => {
  it('who placed the blocks, the tile, the cables, and what the build could not do — nothing for a deck with no isometric map', async () => {
    const {mapsMade} = await import('./stages.js'), {compileDeck} = await import('../compile.js'), {sourceOf} = await import('../test/helpers.js');
    const iso = (name, more = '') => `<div data-k="${name}" data-iso="block"${more}><b>${name}</b></div>`;
    const deck = (map) => compileDeck(sourceOf({clicks: '<section data-label="S" data-map="map"><step data-in="*"><h2>All</h2></step></section>', maps: {map}}));
    // placed by the build, three wires, one of them between two heights
    const scope = {};
    mapsMade(scope, {loaded: {compiled: deck(`${iso('a')}${iso('b')}${iso('c', ' data-size="2 2 1"')}<i data-k="w1" class="wire" data-arrow="a to b"></i><i data-k="w2" class="wire" data-arrow="b to c"></i>`)}});
    expect(scope.maps).toEqual({map: {placed: 'build', tile: expect.any(Number), cables: 2}});
    // placed by hand, with a wire the floor has no way for and a name too long for its block
    const hand = {}, grid = '<i data-iso-grid="120 at 960 240"></i>';
    mapsMade(hand, {loaded: {compiled: deck(`${grid}<div data-k="a" data-iso="block" data-at="0 4"><b>Supercalifragilisticexpialidocious</b></div><div data-k="up" data-iso="block" data-at="6 0 2"><b>Up</b></div><i data-k="w" class="wire" data-arrow="a to up"></i>`)}});
    expect(hand.maps).toEqual({map: {placed: 'hand', tile: 120, cables: 0, said: [['w', 'straight heights']], tight: ['a']}});
    // no isometric map: nothing written
    const flat = {};
    mapsMade(flat, {loaded: {compiled: deck('<div data-k="a" class="box" style="left:0px;top:0px;width:100px;height:50px">a</div>')}});
    expect(flat).toEqual({});
  });
});
