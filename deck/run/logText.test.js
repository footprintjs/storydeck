// @vitest-environment node
import {describe, it, expect} from 'vitest';
import {LINES_SHOWN, listText, runText} from './logText.js';
import {plural} from './words.js';

const kept = (over = {}) => ({id: 'x', record: '/home/runs/d/x.record.jsonl', at: '2026-11-19T19:40:03.123Z', kind: 'build', verdict: 'clean', errors: 0, warnings: 0, infos: 0, clicks: 6,
  measured: false, written: true, ms: 41, round: 0, first: null, closed: null, since: null, keys: [], stages: [], calls: {}, failure: null, lines: [], engine: [], ...over});

describe('a deck\'s runs as text', () => {
  it('says so when none is kept, with the calls that were counted', () => {
    expect(listText([], {since: null, tools: {}}, {kept: 30})).toBe('no runs kept yet: storydeck check and storydeck build each leave one');
    expect(listText([], {since: 'x', tools: {outline: 2}}, {kept: 30})).toBe('no runs kept yet: storydeck check and storydeck build each leave one\ntool calls: outline 2');
  });

  it('lists them newest first: verdict, round, what changed, how the fixing went, how often each tool was called', () => {
    const runs = [
      kept({closed: {rounds: 2, first: {errors: 1, warnings: 4}}, since: {fixed: 3, new: 0}, measured: true}),
      kept({kind: 'check', verdict: 'fix', errors: 1, warnings: 2, round: 2, first: {errors: 1, warnings: 4}, since: {fixed: 2, new: 0}, at: '2026-11-19T19:39:00.000Z'}),
      kept({kind: 'check', verdict: 'fix', errors: 1, warnings: 4, round: 1, first: {errors: 1, warnings: 4}, at: '2026-11-19T19:38:00.000Z', clicks: 1}),
      kept({verdict: 'failed', failure: 'index.html is a link', round: 1, at: '2026-11-19T19:30:00.000Z'}),
      kept({kind: 'check', verdict: 'broken', errors: 1, round: 1, at: '2026-11-19T19:20:00.000Z'}),
    ];
    expect(listText(runs, {since: 'x', tools: {build: 9, review: 30}}, {kept: 30}).split('\n')).toEqual([
      '5 runs kept (the newest 30 are)',
      '1 series of fixing closed: 2 rounds each on average, beginning with 5 to fix',
      'tool calls: build 9, review 30',
      ' 1  2026-11-19 19:40:03  build  clean — nothing to fix · clean after 2 rounds · 6 clicks · measured · 41 ms',
      ' 2  2026-11-19 19:39:00  check  fix 3 — 1 error, 2 warnings · round 2 · 2 fixed, 0 new · 6 clicks · 41 ms',
      ' 3  2026-11-19 19:38:00  check  fix 5 — 1 error, 4 warnings · round 1 · 1 click · 41 ms',
      ' 4  2026-11-19 19:30:00  build  failed — index.html is a link · round 1 · 6 clicks · 41 ms',
      ' 5  2026-11-19 19:20:00  check  broken — the deck does not compile · round 1 · 6 clicks · 41 ms',
      'one run in full: storydeck log --run <its number>']);
  });

  it('one run in full: each stage\'s time, each tool\'s calls, what the engine warned of, and the run in words', () => {
    const run = kept({measured: true, stages: [{stage: 'read deck', ms: 12}, {stage: 'verdict', ms: 0}], engine: ['a stage wrote nothing'],
      calls: {'browser.open': {count: 1, ok: 1, failed: 0, timeout: 0, p50: 812, max: 812, slowest: null},
        'browser.measure': {count: 57, ok: 55, failed: 1, timeout: 1, p50: 40, max: 310, slowest: 12}},
      lines: ['Stage 1: The process began with read deck.', '  Step 1: Write clicks = 57']});
    expect(runText(run, 2).split('\n')).toEqual([
      '2  2026-11-19 19:40:03  build  clean — nothing to fix · 6 clicks · measured · 41 ms',
      'stages: read deck 12 ms · verdict 0 ms',
      'calls:',
      '  browser.open × 1: 812 ms',
      '  browser.measure × 57: half within 40 ms, the slowest 310 ms at click 12 — 1 failed, 1 timed out',
      'the engine warned:',
      '  a stage wrote nothing',
      'the run in words:',
      'Stage 1: The process began with read deck.',
      '  Step 1: Write clicks = 57',
      'the record itself: /home/runs/d/x.record.jsonl (one JSON line an entry: footprintjs/sinks · readRecordFile reads it)']);
  });

  it('shows the first lines of a long run, and every one when asked', () => {
    const run = kept({lines: Array.from({length: LINES_SHOWN + 7}, (_, i) => `line ${i}`)});
    const short = runText(run, 1).split('\n');
    expect(short.filter((l) => l.startsWith('line '))).toHaveLength(LINES_SHOWN);
    expect(short).toContain('… and 7 more lines: --all shows every one');
    expect(runText(run, 1, {all: true}).split('\n').filter((l) => l.startsWith('line '))).toHaveLength(LINES_SHOWN + 7);
    expect(runText(kept(), 1).split('\n')).toHaveLength(2);   // a run with nothing kept but its counts: its line, and where its record is
  });

  it('counts with the word that fits', () => {
    expect([plural(1, 'click'), plural(2, 'click'), plural(0, 'round'), plural(1, 'series'), plural(3, 'series')]).toEqual(['1 click', '2 clicks', '0 rounds', '1 series', '3 series']);
  });
});
