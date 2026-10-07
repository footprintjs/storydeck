import { describe, it, expect } from 'vitest';
import { numberWords, SPELL, narrationText, writtenText, sentences, captionCues, stamp, toSrt, toVtt, clock, chapterList } from './narration';

describe('narration · what the voice says', () => {
  it('spells the words a voice misreads as a word (UI, API, APIs) and leaves every other acronym as written', () => {
    expect(narrationText(['To give the agent a ledger in the UI, we first need to see how the UI works today.']))
      .toBe('To give the agent a ledger in the U I, we first need to see how the U I works today.');
    expect(narrationText('MCP is a direct API connection; APIs differ.')).toBe('MCP is a direct A P I connection; A P Is differ.');
    // a cloned voice says these as quick letters; spaced out ("L L M") they came out slow
    expect(narrationText('Now put an LLM in your place, with HCI and MCP.')).toBe('Now put an LLM in your place, with HCI and MCP.');
    expect(narrationText('UIs and GUI stay; xUI too.')).toBe('UIs and GUI stay; xUI too.');   // whole words only
    expect(Object.isFrozen(SPELL)).toBe(true);
  });

  it('takes its own spelling list, so a deck tunes what its voice misreads', () => {
    expect(narrationText('An LLM and a UI.', { spell: { LLM: 'L L M' } })).toBe('An L L M and a UI.');
    expect(narrationText('A C++ build.', { spell: { 'C++': 'C plus plus' } })).toBe('A C++ build.');   // \b cannot end after +: left as is
    expect(narrationText('An a.b case.', { spell: { 'a.b': 'A B' } })).toBe('An A B case.');           // regex characters are escaped
  });

  it('says numbers as words (the aligner knows letters only), p-numbers as "p" and a number; a thousands comma reads as two numbers', () => {
    expect(narrationText('from about 2000 to today, 15 → 3 calls')).toBe('from about two thousand to today, fifteen, three calls');
    expect(narrationText('p95 latency over 1,250 ms')).toBe('p ninety-five latency over one,two hundred fifty ms');
    expect([0, 7, 19, 20, 42, 100, 101, 999, 1000, 2026, 12345].map(numberWords)).toEqual([
      'zero', 'seven', 'nineteen', 'twenty', 'forty-two', 'one hundred', 'one hundred one', 'nine hundred ninety-nine',
      'one thousand', 'two thousand twenty-six', 'twelve thousand three hundred forty-five']);
  });

  it('drops [draft] marks, turns a separator into a pause, and joins notes', () => {
    expect(narrationText(['First.', '[draft] A bridge — then on · and → on.'])).toBe('First. A bridge, then on, and, on.');
    expect(narrationText(['  spaced\n\nout  '])).toBe('spaced out');
    expect(narrationText(undefined)).toBe('');
    expect(writtenText(['One.', '[draft]  Two  —  three.'])).toBe('One. Two — three.');
    expect(writtenText(null)).toBe('');
  });

  it('splits sentences as the voice script does', () => {
    expect(sentences('One. Two? Three! four')).toEqual(['One.', 'Two?', 'Three!', 'four']);
    expect(sentences('  ')).toEqual([]);
    expect(sentences(undefined)).toEqual([]);
  });
});

describe('narration · captions', () => {
  const clip = { duration: 6, sentences: [0.2, 2.5, 4] };

  it('times each sentence from its aligned start to the next one (the last to the end of the clip)', () => {
    const cues = captionCues([{ start: 10, lead: 0.5, written: 'One. Two. Three.', spoken: 'One. Two. Three.', clip }]);
    expect(cues).toEqual([
      { start: 10.7, end: 13, text: 'One.' }, { start: 13, end: 14.5, text: 'Two.' }, { start: 14.5, end: 16.5, text: 'Three.' }]);
  });

  it('shows the words as written when they line up with the clip, else as spoken; skips clicks without a clip', () => {
    const written = captionCues([{ start: 0, written: 'In 2000. The web. Done.', spoken: 'In two thousand. The web. Done.', clip }]);
    expect(written.map((c) => c.text)).toEqual(['In 2000.', 'The web.', 'Done.']);
    const said = captionCues([{ start: 0, written: 'At 3.5 s. Then. Done.', spoken: 'At three. five s. Then. Done.', clip: { duration: 5, sentences: [0, 1, 2, 3] } }]);
    expect(said.map((c) => c.text)).toEqual(['At three.', 'five s.', 'Then.', 'Done.']);
    expect(captionCues([{ start: 0, written: 'x', spoken: 'x', clip: null }, { start: 1, written: 'y', spoken: 'y' }])).toEqual([]);
    // more sentences than the clip has starts: only the timed ones; an empty span is dropped
    expect(captionCues([{ start: 0, written: 'A. B. C.', spoken: 'A. B. C.', clip: { duration: 2, sentences: [0, 2] } }]).map((c) => c.text)).toEqual(['A.']);
  });

  it('writes SRT and WebVTT', () => {
    const cues = [{ start: 0.5, end: 3661.25, text: 'Hello.' }, { start: 3662, end: 3663, text: 'Bye.' }];
    expect(stamp(3661.25)).toBe('01:01:01,250');
    expect(toSrt(cues)).toBe('1\n00:00:00,500 --> 01:01:01,250\nHello.\n\n2\n01:01:02,000 --> 01:01:03,000\nBye.\n');
    expect(toVtt(cues)).toBe('WEBVTT\n\n00:00:00.500 --> 01:01:01.250\nHello.\n\n01:01:02.000 --> 01:01:03.000\nBye.\n');
  });
});

describe('narration · chapters', () => {
  it('writes YouTube chapters in time order', () => {
    expect(clock(0)).toBe('0:00');
    expect(clock(95.9)).toBe('1:35');
    expect(clock(3725)).toBe('1:02:05');
    const { text, problems } = chapterList([{ at: 150, title: 'Part 1' }, { at: 0, title: 'Intro' }, { at: 600, title: 'Part 2' }], { length: 900 });
    expect(text).toBe('0:00 Intro\n2:30 Part 1\n10:00 Part 2');
    expect(problems).toEqual([]);
  });

  it('says what breaks YouTube\'s rules: the first not at 0:00, fewer than three, one shorter than 10 s', () => {
    expect(chapterList([{ at: 5, title: 'A' }, { at: 20, title: 'B' }]).problems).toEqual([
      'the first chapter must start at 0:00', 'YouTube shows chapters only when there are at least three']);
    expect(chapterList([{ at: 0, title: 'A' }, { at: 8, title: 'B' }, { at: 30, title: 'C' }], { length: 35 }).problems).toEqual([
      '"A" is shorter than 10 s', '"C" is shorter than 10 s']);
    expect(chapterList([]).problems).toContain('the first chapter must start at 0:00');
  });
});
