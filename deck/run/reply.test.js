// @vitest-environment node
import {describe, it, expect} from 'vitest';
import {MOST_LISTED, replyText, verdictLine} from './reply.js';

const problem = (level, rule, click, message = `${rule} here — fix it`) => ({level, rule, click, label: click ? `c${click}` : null, message});
const run = (over = {}) => ({kind: 'check', verdict: 'clean', problems: [], errors: 0, warnings: 0, infos: 0, clicks: 6, measured: false, layoutNote: null, written: null, ms: 9, ...over});

describe('a run\'s reply', () => {
  it('begins with the verdict, in a few words', () => {
    expect(verdictLine(run())).toBe('clean — nothing to fix');
    expect(verdictLine(run({verdict: 'fix', errors: 1, warnings: 2}))).toBe('fix 3 — 1 error, 2 warnings');
    expect(verdictLine(run({verdict: 'fix', errors: 0, warnings: 1}))).toBe('fix 1 — 0 errors, 1 warning');
    expect(verdictLine(run({verdict: 'broken', errors: 1}))).toBe('broken — the deck does not compile');
    expect(verdictLine(run({kind: 'build', verdict: 'broken', errors: 1}))).toBe('broken — the deck does not compile, so no page was written');
  });

  it('then only what there is to fix, worst first, each with its click and its fix', () => {
    const problems = [problem('info', 'no-notes', null), problem('warn', 'words', 4), problem('error', 'hidden-loop', 9), problem('warn', 'spills', 2)];
    expect(replyText(run({verdict: 'fix', errors: 1, warnings: 2, infos: 1, problems}))).toBe([
      'fix 3 — 1 error, 2 warnings',
      'error click 9 "c9" · hidden-loop: hidden-loop here — fix it',
      'warn  click 2 "c2" · spills: spills here — fix it',
      'warn  click 4 "c4" · words: words here — fix it',
      'info  deck · no-notes: no-notes here — fix it'].join('\n'));
    expect(replyText(run())).toBe('clean — nothing to fix');
  });

  it('stays short: past the first problems the rest are counted by rule, until every one is asked for', () => {
    const problems = [...Array.from({length: MOST_LISTED + 9}, (_, i) => problem('warn', 'words', i + 1)), ...Array.from({length: 5}, (_, i) => problem('info', 'never-shown', i + 1))];
    const short = replyText(run({verdict: 'fix', warnings: 39, problems})).split('\n');
    expect(short).toHaveLength(1 + MOST_LISTED + 1);
    expect(short.at(-1)).toBe('… and 14 more (words 9, never-shown 5) — fix these first, or list every one with --all');
    expect(replyText(run({verdict: 'fix', warnings: 39, problems}), {more: 'all: true'})).toMatch(/list every one with all: true$/);
    expect(replyText(run({verdict: 'fix', warnings: 39, problems}), {all: true}).split('\n')).toHaveLength(1 + problems.length);
  });

  it('past the first problems, notes alone are counted without being called something to fix', () => {
    const problems = [...Array.from({length: MOST_LISTED}, (_, i) => problem('warn', 'words', i + 1)), ...Array.from({length: 3}, (_, i) => problem('info', 'never-shown', i + 1))];
    expect(replyText(run({verdict: 'fix', warnings: MOST_LISTED, problems})).split('\n').at(-1)).toBe('… and 3 more (never-shown 3) — list every one with --all');
  });

  it('a run that found nothing while a browser\'s finding went unmeasured is not called clean', () => {
    expect(verdictLine(run({carried: 1}))).toBe('clean so far — 1 problem a browser found before was not measured again (--layout measures)');
    expect(verdictLine(run({carried: 3}), 'layout: true')).toBe('clean so far — 3 problems a browser found before were not measured again (layout: true measures)');
    expect(verdictLine(run({carried: 0}))).toBe('clean — nothing to fix');
    const fixing = run({verdict: 'fix', warnings: 1, problems: [problem('warn', 'words', 1)], carried: 2, round: 2, since: {fixed: 0, new: 1}});
    expect(replyText(fixing, {measure: 'layout: true'}).split('\n')).toEqual(['fix 1 — 0 errors, 1 warning', 'warn  click 1 "c1" · words: words here — fix it',
      'and 2 problems a browser found before were not measured again (layout: true measures)', 'since the last run: 1 new · round 2']);
    expect(verdictLine(run({verdict: 'broken', errors: 1, carried: 2}))).toBe('broken — the deck does not compile');   // first things first
  });

  it('then what was written, as a build has always said it', () => {
    const written = {file: '/decks/talk/index.html', bytes: 91 * 1024, clicks: 6, slides: 6, data: null};
    expect(replyText(run({kind: 'build', written}), {cwd: '/decks'})).toBe('clean — nothing to fix\n✓ talk/index.html · 6 clicks · 91 KB · 9 ms');
    expect(replyText(run({kind: 'build', written: {...written, data: '/decks/talk/deck-data.json', voice: {have: 6, wanted: 6}}}), {cwd: '/decks/talk'}))
      .toBe('clean — nothing to fix\n✓ index.html · 6 clicks · 91 KB · 9 ms · deck-data.json · your voice on 6 clicks');
    expect(replyText(run({kind: 'build', written: {...written, voice: {have: 1, wanted: 6}}}), {cwd: '/decks/talk'})).toContain(' · your voice on 1 of 6 clicks, the browser\'s on the rest');
    expect(replyText(run({kind: 'build', written: {...written, file: '/decks'}}), {cwd: '/decks'})).toContain('✓ /decks · 6 clicks');   // the folder itself: its path
  });

  it('then where the run stands against the one before it', () => {
    const fixing = {verdict: 'fix', warnings: 2, problems: [problem('warn', 'words', 1), problem('warn', 'words', 2)]};
    expect(replyText(run({...fixing, round: 1, since: null}))).not.toContain('since the last run');   // a first run has no run before it
    expect(replyText(run({...fixing, round: 3, since: {fixed: 2, new: 1}})).split('\n').at(-1)).toBe('since the last run: 2 fixed, 1 new · round 3');
    expect(replyText(run({...fixing, round: 2, since: {fixed: 0, new: 1}})).split('\n').at(-1)).toBe('since the last run: 1 new · round 2');
    expect(replyText(run({...fixing, round: 2, since: {fixed: 0, new: 0}})).split('\n').at(-1)).toBe('since the last run: nothing changed · round 2');
    expect(replyText(run({round: 0, closed: {rounds: 3, first: {errors: 1, warnings: 5}}, since: {fixed: 2, new: 0}}))).toBe('clean — nothing to fix\nclean after 3 rounds of fixing (it began with 6 to fix)');
    expect(replyText(run({round: 0, closed: {rounds: 1, first: {errors: 0, warnings: 1}}}))).toContain('clean after 1 round of fixing (it began with 1 to fix)');
    expect(replyText(run({round: 0, closed: null, since: {fixed: 0, new: 0}}))).toBe('clean — nothing to fix');   // clean before, clean now: nothing to say
  });

  it('and last what it could not do: a measure that was asked for, a run that was not kept', () => {
    expect(replyText(run({layoutNote: 'layout not checked: it needs Playwright', unkept: 'the StoryDeck folder is inside the deck folder'})))
      .toBe('clean — nothing to fix\nlayout not checked: it needs Playwright\nthis run was not kept for storydeck log: the StoryDeck folder is inside the deck folder');
  });
});
