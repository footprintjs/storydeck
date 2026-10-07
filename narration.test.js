import { describe, it, expect } from 'vitest';
import { clipKey } from 'footprint-narration/voice';
import { narrationText, writtenText } from './narration';

// The settings of a real profile (no audio): the keys of clips a deck already has.
const PROFILE = {
  id: 'me', exaggeration: 0.5, cfgWeight: 0.5, seed: 7, sentenceGapSeconds: 0.3,
  takes: { 'The end.': { seed: 17114, note: 'default take came out clipped (0.24 s, letters 0.0); this take scored minWord 0.93, letters 1.0' } },
};

describe('narration · what the deck says', () => {
  it('keeps the keys of clips voiced before: a note says what it said (a deck\'s 198 clips must still match)', () => {
    const golden = [
      [['To give the agent a ledger in the UI, we first need to see how the UI works today. So let’s start with what we already have.'], '6601f43cc082'],
      [['The second design lets the page offer its own tools. It’s called WebMCP. MCP is a direct API connection for the AI; WebMCP puts that inside the web page. It’s a proposal from engineers at Google and Microsoft, and the details are still changing, so let’s look at the design.'], 'bb591fd40fa1'],
      [['Which brings me to the central challenge: when is an action complete? Answer that, and Action Binding falls out. To give the agent a “done” signal, we first need to see why apps lost it. So, a short history of the web, in three steps, from about 2000 to today.'], '735cd41dbbe4'],
      [['Now put an LLM in your place. Its tools are its books. It picks which to call, sometimes sure, sometimes on a hunch. So where is its ledger?'], '603dfe55ab88'],
    ];
    for (const [notes, key] of golden) expect(clipKey(narrationText(notes), PROFILE)).toBe(key);
  });

  it('drops [draft] marks, joins notes and collapses white space, then says the text by footprint-narration\'s rules', () => {
    expect(narrationText(['First.', '[draft] A bridge — then on · and → on.'])).toBe('First. A bridge, then on, and, on.');
    expect(narrationText(['[draft] - a bridge.'])).toBe('a bridge.');
    expect(narrationText(['  spaced\n\nout  '])).toBe('spaced out');
    expect(narrationText(undefined)).toBe('');
    expect(narrationText('p95 over 1,250 ms & the UI')).toBe('p ninety-five over one,two hundred fifty ms and the U I');
    expect(writtenText(['One.', '[draft]  Two  —  three.'])).toBe('One. Two — three.');
    expect(writtenText(null)).toBe('');
  });

  it('takes a deck\'s own spell and say lists', () => {
    expect(narrationText('An LLM and a UI.', { spell: { LLM: 'L L M' } })).toBe('An L L M and a UI.');
    expect(narrationText('x = 1', { say: { '=': 'is' } })).toBe('x is one');
    expect(narrationText('x = 1', { say: {} })).toBe('x, one');
    expect(() => narrationText('Win', { spell: { Win: 'Windows 11' } })).toThrow(/say it|in words/);
  });
});
