// @vitest-environment node
import {afterEach, describe, it, expect} from 'vitest';
import {existsSync, mkdirSync, readFileSync, readdirSync, statSync, symlinkSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {COUNTED, MOST, RUNS_KEPT, callCounts, countCall, keepRun, keptRuns, lastFinished, problemKeys, progress, runFiles, runsFolder} from './log.js';
import {tempDeck, tempDir, cleanDecks} from '../test/helpers.js';
import {deckRoot} from '../paths.js';

afterEach(cleanDecks);

const problem = (level, rule, label = null) => ({level, rule, click: label ? 1 : null, label, message: 'm'});
const aRun = (over = {}) => ({kind: 'check', verdict: 'clean', problems: [], layoutProblems: [], errors: 0, warnings: 0, infos: 0, clicks: 6, measured: false, written: false, ms: 12,
  stages: [{stage: 'read deck', ms: 3}], calls: {}, lines: [{type: 'stage', text: 'Stage 1: read deck.'}, {type: 'step', text: 'Write clicks = 6'}], engine: [], ...over});
const folder = () => { const home = tempDir(), root = deckRoot(tempDeck()); return {home, root, dir: runsFolder(home, root).dir}; };
/** Keep one run at a moment of its own (a name sorts by its time). */
const keepAt = (dir, minute, run) => { const at = new Date(Date.UTC(2026, 0, 1, 0, minute)); return keepRun(dir, runFiles(dir, run.kind, at), run, at); };

describe('where a deck\'s runs are kept', () => {
  it('with the person, in a folder of the deck\'s own, readable by them alone', () => {
    const {home, root, dir} = folder();
    expect(dir).toMatch(new RegExp(`^${home.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/runs/[0-9a-f]{16}$`));
    expect(runsFolder(home, root).dir).toBe(dir);                        // the same deck, the same folder
    expect(runsFolder(home, deckRoot(tempDeck())).dir).not.toBe(dir);    // another deck, another
    if (process.platform !== 'win32') expect(statSync(dir).mode & 0o777).toBe(0o700);
    keepAt(dir, 1, aRun());
    const [name] = readdirSync(dir);
    if (process.platform !== 'win32') expect(statSync(path.join(dir, name)).mode & 0o777).toBe(0o600);
  });

  it('never inside the deck, and never through a link that leads out of the person\'s folder', () => {
    const deck = tempDeck(), root = deckRoot(deck);
    expect(runsFolder(path.join(deck, '.storydeck'), root)).toEqual({why: expect.stringMatching(/is inside the deck folder — set STORYDECK_HOME elsewhere/)});
    expect(existsSync(path.join(deck, '.storydeck'))).toBe(false);
    const home = tempDir(), elsewhere = tempDir();
    symlinkSync(elsewhere, path.join(home, 'runs'));
    expect(runsFolder(home, root)).toEqual({why: expect.stringMatching(/is not a folder of your own/)});
  });

  it('names a run by its moment and its kind, two in one millisecond apart', () => {
    const at = new Date('2026-03-04T05:06:07.089Z'), a = runFiles('/x', 'build', at), b = runFiles('/x', 'build', at);
    expect(a.id).toMatch(/^2026-03-04T05-06-07-089Z-build\.[0-9a-f]{6}$/);
    expect(a.file).toBe(`/x/${a.id}.json`);
    expect(a.record).toBe(`/x/${a.id}.record.jsonl`);
    expect(a.id).not.toBe(b.id);
  });
});

describe('a kept run', () => {
  it('reads back as it was kept: its counts, its stages, its calls, the run in words', () => {
    const {dir} = folder();
    keepAt(dir, 1, aRun({kind: 'build', verdict: 'fix', problems: [problem('warn', 'words', 'Title'), problem('error', 'hidden-loop', 'Back'), problem('info', 'no-notes')],
      errors: 1, warnings: 1, infos: 1, measured: true, written: true, calls: {'browser.measure': {count: 6, ok: 6, failed: 0, timeout: 0, p50: 4, max: 60, slowest: 4}}}));
    const [run] = keptRuns(dir);
    expect(run).toMatchObject({kind: 'build', verdict: 'fix', errors: 1, warnings: 1, infos: 1, clicks: 6, measured: true, written: true, ms: 12, round: 1,
      first: {errors: 1, warnings: 1}, closed: null, since: null, failure: null, stages: [{stage: 'read deck', ms: 3}],
      calls: {'browser.measure': {count: 6, ok: 6, failed: 0, timeout: 0, p50: 4, max: 60, slowest: 4}}});
    expect(run.keys).toEqual([['words|Title', 1], ['hidden-loop|Back', 1]]);   // what there is to fix; a note is not
    expect(run).toMatchObject({layout: [], carried: 0});
    expect(run.lines).toEqual(['Stage 1: read deck.', '  Write clicks = 6']);
    expect(run.record).toBe(path.join(dir, `${run.id}.record.jsonl`));
  });

  it('keeps the newest RUNS_KEPT: an older run goes with its record, and a record with no run goes in its turn', () => {
    const {dir} = folder();
    const orphan = runFiles(dir, 'check', new Date(Date.UTC(2025, 0, 1)));
    writeFileSync(orphan.record, '{}\n');   // a run that never finished: its record, and nothing else
    writeFileSync(path.join(dir, 'notes.txt'), 'not a run');
    for (let i = 0; i < RUNS_KEPT + 2; i++) {
      const at = new Date(Date.UTC(2026, 0, 1, 0, i)), files = runFiles(dir, 'check', at);
      writeFileSync(files.record, '{}\n');
      keepRun(dir, files, aRun(), at);
    }
    const names = readdirSync(dir);
    expect(names.filter((n) => n.endsWith('.json'))).toHaveLength(RUNS_KEPT);
    expect(names.filter((n) => n.endsWith('.record.jsonl'))).toHaveLength(RUNS_KEPT);
    expect(names).not.toContain(path.basename(orphan.record));
    expect(names).toContain('notes.txt');   // only what this module wrote is ever removed
    expect(keptRuns(dir)[0].at).toBe(new Date(Date.UTC(2026, 0, 1, 0, RUNS_KEPT + 1)).toISOString());   // newest first
  });

  it('holds a long run within its bounds: lines cut and counted out, the counts always kept', () => {
    const {dir} = folder();
    keepAt(dir, 1, aRun({lines: Array.from({length: MOST.lines + 50}, (_, i) => ({type: 'step', text: `${i} ${'x'.repeat(MOST.chars * 2)}\nsecond line`}))}));
    const [run] = keptRuns(dir);
    expect(run.lines).toHaveLength(MOST.lines);
    expect(run.lines.every((l) => l.length <= MOST.chars && !l.includes('\n'))).toBe(true);
    // words and labels in a script of three bytes a character can pass the most a run holds: its words go, its counts stay
    const many = Array.from({length: MOST.keys}, (_, i) => problem('warn', 'words', `${i}${'字'.repeat(200)}`));
    const huge = aRun({verdict: 'fix', warnings: many.length, problems: many,
      lines: Array.from({length: MOST.lines}, () => ({type: 'step', text: '字'.repeat(MOST.chars)})), stages: Array.from({length: 90}, () => ({stage: 's'.repeat(500), ms: 1}))});
    keepAt(dir, 2, huge);
    expect(statSync(path.join(dir, readdirSync(dir).filter((n) => n.endsWith('.json')).sort().at(-1))).size).toBeLessThanOrEqual(MOST.bytes);
    const [kept] = keptRuns(dir);
    expect({verdict: kept.verdict, warnings: kept.warnings, lines: kept.lines.length, keys: kept.keys.length}).toEqual({verdict: 'fix', warnings: MOST.keys, lines: 0, keys: 50});
    expect(kept.stages).toHaveLength(64);
    expect(kept.stages[0].stage).toHaveLength(80);
  });
});

describe('what is read back is read as a file anyone may have put there', () => {
  const NAME = '2026-01-01T00-00-00-000Z-check.abcdef.json';

  it('takes only files named as its own, plain, bounded, and of its shape', () => {
    const {dir} = folder(), outside = path.join(tempDir(), 'secret.json');
    writeFileSync(outside, JSON.stringify({v: 1, verdict: 'clean'}));
    symlinkSync(outside, path.join(dir, NAME));                                             // a link named as a run
    writeFileSync(path.join(dir, NAME.replace('abcdef', 'abcdeg')), 'not json');
    writeFileSync(path.join(dir, NAME.replace('abcdef', 'abcdeh')), JSON.stringify({v: 2, verdict: 'clean'}));   // another shape
    writeFileSync(path.join(dir, NAME.replace('abcdef', 'abcdei')), JSON.stringify({v: 1, verdict: 'clean', lines: 'x'.repeat(MOST.bytes)}));
    writeFileSync(path.join(dir, 'run.json'), JSON.stringify({v: 1, verdict: 'clean'}));     // not a run's name
    mkdirSync(path.join(dir, NAME.replace('abcdef', 'abcdej')));                             // a folder named as a run
    expect(keptRuns(dir)).toEqual([]);
  });

  it.skipIf(process.platform === 'win32')('a pipe put at a run\'s name does not hold the reader', () => {
    const {dir} = folder();
    execFileSync('mkfifo', [path.join(dir, NAME)]);   // opening a pipe waits for its other end, unless told not to
    expect(keptRuns(dir)).toEqual([]);
  });

  it('takes each field by its type: what is not a count is no count, what is not text is no text', () => {
    const {dir} = folder();
    writeFileSync(path.join(dir, NAME), JSON.stringify({v: 1, verdict: 'fix', kind: 'rm -rf', errors: -4, warnings: '12', infos: 1.5, clicks: 1e99, round: {a: 1}, first: 'no',
      since: {fixed: 'many', new: 2}, closed: [1], keys: [['a|b', 2], 'x', [3, 4], ['c|d', -1]], layout: {spills: 9}, carried: '3', stages: [{stage: 7, ms: 'x'}, null], calls: {'browser.measure': {count: 'six', slowest: '4'}, x: null},
      lines: ['ok', 5, {text: 'no'}, 'y'.repeat(MOST.chars * 3)], engine: 'loud', failure: {message: 'x'}, at: 12}));
    const [run] = keptRuns(dir);
    expect(run).toMatchObject({kind: 'check', verdict: 'fix', errors: 0, warnings: 0, infos: 0, clicks: 0, round: 0, first: null, since: {fixed: 0, new: 2},
      closed: {rounds: 0, first: {errors: 0, warnings: 0}}, keys: [['a|b', 2], ['c|d', 0]], layout: [], carried: 0, stages: [{stage: '', ms: 0}, {stage: '', ms: 0}], engine: [], failure: '', at: ''});
    expect(run.calls).toEqual({'browser.measure': {count: 0, ok: 0, failed: 0, timeout: 0, p50: 0, max: 0, slowest: 0}, x: {count: 0, ok: 0, failed: 0, timeout: 0, p50: 0, max: 0, slowest: 0}});
    expect(run.lines).toEqual(['ok', '', '', 'y'.repeat(MOST.chars)]);
  });

  it('a run in a series always says what the series began with, whatever its file left out', () => {
    const {dir} = folder();
    writeFileSync(path.join(dir, NAME), JSON.stringify({v: 1, verdict: 'fix', round: 2}));   // no `first`, no `keys`
    expect(keptRuns(dir)[0]).toMatchObject({round: 2, first: {errors: 0, warnings: 0}, keys: [], layout: []});
    const stand = keepAt(dir, 5, aRun());   // the next clean run closes that series, and has counts to say it with
    expect(stand).toMatchObject({round: 0, closed: {rounds: 2, first: {errors: 0, warnings: 0}}});
  });
});

describe('where a run stands in a deck\'s fixing', () => {
  const count = (keys) => keys.reduce((n, [, c]) => n + c, 0);
  /** A run as progress takes it: what the rules found (`keys`), and what a browser found if it measured (`layoutKeys`). */
  const now = (verdict, keys = [], {measured = false, layoutKeys = [], errors = 0} = {}) => ({verdict, keys, layoutKeys, measured, errors, warnings: count(keys) + count(layoutKeys) - errors});
  const after = (stand, run) => ({...stand, keys: run.keys});   // a run as the next one finds it kept

  it('a first run with something to fix opens a series; each next one is a round; a clean run closes it', () => {
    const a = now('fix', [['words|a', 2]]), one = progress(null, a);
    expect(one).toEqual({round: 1, first: {errors: 0, warnings: 2}, closed: null, since: null, layout: [], carried: 0});
    const b = now('fix', [['words|a', 1], ['view-far|b', 1]]), two = progress(after(one, a), b);
    expect(two).toEqual({round: 2, first: {errors: 0, warnings: 2}, closed: null, since: {fixed: 1, new: 1}, layout: [], carried: 0});
    const c = now('clean'), done = progress(after(two, b), c);
    expect(done).toEqual({round: 0, first: null, closed: {rounds: 2, first: {errors: 0, warnings: 2}}, since: {fixed: 2, new: 0}, layout: [], carried: 0});
    expect(progress(after(done, c), now('clean'))).toMatchObject({round: 0, first: null, closed: null, since: {fixed: 0, new: 0}});
    expect(progress(after(done, c), now('broken', [['compile|', 1]], {errors: 1}))).toMatchObject({round: 1, first: {errors: 1, warnings: 0}});   // a new series
  });

  it('what a browser found stays open until a browser measures again: a run that did not measure never counts it as fixed', () => {
    const a = now('fix', [], {measured: true, layoutKeys: [['spills|Title', 1]]}), found = progress(null, a);
    expect(found).toMatchObject({round: 1, first: {errors: 0, warnings: 1}, layout: [['spills|Title', 1]], carried: 0});
    // nothing was edited, and this run did not measure: its own rules find nothing, and the spill is still counted open
    const b = now('clean'), unmeasured = progress(after(found, a), b);
    expect(unmeasured).toEqual({round: 2, first: {errors: 0, warnings: 1}, closed: null, since: {fixed: 0, new: 0}, layout: [['spills|Title', 1]], carried: 1});
    expect(progress(after(unmeasured, b), now('clean'))).toMatchObject({round: 3, closed: null, carried: 1});   // however many times
    // a measure that finds it gone closes the series, and only then
    const fixed = progress(after(unmeasured, b), now('clean', [], {measured: true}));
    expect(fixed).toEqual({round: 0, first: null, closed: {rounds: 2, first: {errors: 0, warnings: 1}}, since: {fixed: 1, new: 0}, layout: [], carried: 0});
    // a measure that finds another instead says one went and one came
    expect(progress(after(unmeasured, b), now('fix', [], {measured: true, layoutKeys: [['outside|Back', 1]]}))).toMatchObject({round: 3, since: {fixed: 1, new: 1}, layout: [['outside|Back', 1]], carried: 0});
  });

  it('a measure that stopped found nothing about the deck: its error is that run\'s own — new each time, never carried, never fixed', () => {
    const a = now('fix', [], {measured: true, layoutKeys: [['spills|Title', 1]]}), found = progress(null, a);
    const b = {...now('fix', [], {errors: 1}), warnings: 0, stopKeys: [['layout|', 1]]}, stopped = progress(after(found, a), b);
    expect(stopped).toMatchObject({round: 2, since: {fixed: 0, new: 1}, layout: [['spills|Title', 1]], carried: 1});   // the spill is still the one thing known open
    expect(progress(after(stopped, b), b)).toMatchObject({round: 3, since: {fixed: 0, new: 1}, layout: [['spills|Title', 1]], carried: 1});   // it stops again: again its own error
    expect(progress(after(stopped, b), now('clean'))).toMatchObject({round: 3, since: {fixed: 0, new: 0}, carried: 1, closed: null});   // a run that does not measure: the stop is not "fixed"
    expect(progress(after(stopped, b), now('clean', [], {measured: true}))).toMatchObject({round: 0, since: {fixed: 1, new: 0}, closed: {rounds: 2}});
    // on a deck no browser ever found anything on, a stopped measure leaves nothing open behind it
    const alone = progress(null, b);
    expect(alone).toMatchObject({round: 1, layout: [], carried: 0});
    expect(progress(after(alone, b), now('clean'))).toMatchObject({round: 0, carried: 0, since: {fixed: 0, new: 0}, closed: {rounds: 1, first: {errors: 1, warnings: 0}}});
  });

  it('a run before it that says less than it should still gives counts to stand on', () => {
    expect(progress({round: 3, first: null, keys: [], layout: []}, now('clean'))).toMatchObject({closed: {rounds: 3, first: {errors: 0, warnings: 0}}});
    expect(progress({round: 3, keys: []}, now('fix', [['words|a', 1]]))).toMatchObject({round: 4, first: {errors: 0, warnings: 0}, since: {fixed: 0, new: 1}});
  });

  it('a run that could not finish stands nowhere: the deck\'s fixing goes on from the run before it', () => {
    const {dir} = folder();
    const open = keepAt(dir, 1, aRun({verdict: 'fix', warnings: 1, problems: [problem('warn', 'words', 'a')]}));
    expect(open).toMatchObject({round: 1, first: {errors: 0, warnings: 1}});
    expect(keepAt(dir, 2, aRun({kind: 'build', verdict: 'failed', failure: 'index.html is a link'}))).toEqual({round: 0, first: null, closed: null, since: null, layout: [], carried: 0});
    expect(keptRuns(dir).map((r) => r.verdict)).toEqual(['failed', 'fix']);   // kept, to be read
    expect(lastFinished(dir)).toMatchObject({verdict: 'fix', round: 1});
    expect(keepAt(dir, 3, aRun())).toMatchObject({round: 0, closed: {rounds: 1, first: {errors: 0, warnings: 1}}, since: {fixed: 1, new: 0}});   // one round, not two
    expect(lastFinished(folder().dir)).toBe(null);
  });

  it('tells problems apart by rule and label, and counts only what there is to fix', () => {
    expect(problemKeys([problem('warn', 'words', 'a'), problem('warn', 'words', 'a'), problem('error', 'compile'), problem('info', 'no-notes'), problem('warn', 'words', 'b')]))
      .toEqual([['words|a', 2], ['compile|', 1], ['words|b', 1]]);
  });

  it('for any two runs, what was fixed and what is new account for every problem (2,000 seeded pairs)', () => {
    let s = 20261119;
    const next = () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const some = (rules) => Array.from({length: next() < 0.3 ? 0 : Math.floor(next() * 7)}, () => problem(next() < 0.3 ? 'error' : 'warn', rules[Math.floor(next() * rules.length)], ['a', 'b', null][Math.floor(next() * 3)]));
    const seen = {measuredBoth: 0, unmeasuredNow: 0, same: 0, nothing: 0};
    for (let i = 0; i < 2000; i++) {
      const rulesBefore = some(['words', 'view-far', 'no-change']), browserBefore = some(['spills', 'outside']);
      const same = next() < 0.1, measured = next() < 0.5;
      const rulesNow = same ? rulesBefore : some(['words', 'view-far', 'no-change']), browserNow = measured ? (same ? browserBefore : some(['spills', 'outside'])) : [];
      const prev = {round: 1, first: {errors: 0, warnings: 0}, keys: problemKeys(rulesBefore), layout: problemKeys(browserBefore)};
      const stand = progress(prev, {verdict: rulesNow.length + browserNow.length ? 'fix' : 'clean', keys: problemKeys(rulesNow), layoutKeys: problemKeys(browserNow), measured, errors: 0, warnings: 0});
      const openBefore = rulesBefore.length + browserBefore.length, openNow = rulesNow.length + count(stand.layout);
      expect(openBefore - stand.since.fixed).toBe(openNow - stand.since.new);   // what stayed open is one number, counted from either side
      expect(stand.carried).toBe(measured ? 0 : browserBefore.length);
      if (!measured) expect(stand.layout).toEqual(problemKeys(browserBefore));   // carried whole: none fixed, none new
      if (!measured && browserBefore.length) expect(stand.closed).toBe(null);   // never closed while a browser's finding is unanswered
      if (same && measured) expect(stand.since).toEqual({fixed: 0, new: 0});
      seen[same ? 'same' : !openBefore && !openNow ? 'nothing' : measured ? 'measuredBoth' : 'unmeasuredNow'] += 1;
    }
    for (const n of Object.values(seen)) expect(n).toBeGreaterThan(20);   // every kind of pair was really tried
  });
});

describe('how often each tool was called', () => {
  it('counts each call of a tool it knows, and nothing else', () => {
    const {home, root, dir} = folder(), at = new Date('2026-05-06T07:08:09.000Z');
    for (const tool of ['outline', 'review', 'review', 'build', 'dev', 'constructor', '__proto__']) countCall(home, root, tool, at);
    expect(callCounts(dir)).toEqual({since: at.toISOString(), tools: {outline: 1, review: 2, build: 1}});
    expect(COUNTED).toContain('log');
    countCall(home, root, 'check', new Date('2027-01-01T00:00:00.000Z'));
    expect(callCounts(dir)).toMatchObject({since: at.toISOString(), tools: {check: 1}});   // counted since the first, whatever came later
    expect(readdirSync(dir).filter((n) => n.endsWith('.tmp'))).toEqual([]);
  });

  it('a count that cannot be kept is not kept, and a count file of another shape counts from nothing', () => {
    const deck = tempDeck(), root = deckRoot(deck);
    expect(() => countCall(path.join(deck, '.storydeck'), root, 'build')).not.toThrow();
    expect(existsSync(path.join(deck, '.storydeck'))).toBe(false);
    const {home, root: other, dir} = folder();
    writeFileSync(path.join(dir, 'calls.json'), JSON.stringify({v: 1, since: 5, tools: {build: 'lots', review: -2, outline: 3, evil: 9}}));
    expect(callCounts(dir)).toEqual({since: null, tools: {outline: 3}});
    countCall(home, other, 'outline');
    expect(callCounts(dir).tools).toEqual({outline: 4});
    expect(JSON.parse(readFileSync(path.join(dir, 'calls.json'), 'utf8')).tools).toEqual({outline: 4});   // what was not a count is gone
  });
});
