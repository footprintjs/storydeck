import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { clipKey, clipFor, sentenceStarts, pickSteps, voiceClips, chatterboxKit, embedClips } from './voice';
import { narrationText } from './narration';

// The settings of a real profile (no audio): its keys must keep matching the clips a deck already has.
const PROFILE = {
  id: 'me', exaggeration: 0.5, cfgWeight: 0.5, seed: 7, sentenceGapSeconds: 0.3,
  takes: { 'The end.': { seed: 17114, note: 'default take came out clipped (0.24 s, letters 0.0); this take scored minWord 0.93, letters 1.0' } },
};

let dir;
beforeEach(() => { dir = mkdtempSync(path.join(tmpdir(), 'sd-voice-')); });
afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

describe('voice · the cache key', () => {
  it('keeps the keys of clips voiced before (a deck\'s 198 clips must still match)', () => {
    const golden = [
      [['To give the agent a ledger in the UI, we first need to see how the UI works today. So let’s start with what we already have.'], '6601f43cc082'],
      [['The second design lets the page offer its own tools. It’s called WebMCP. MCP is a direct API connection for the AI; WebMCP puts that inside the web page. It’s a proposal from engineers at Google and Microsoft, and the details are still changing, so let’s look at the design.'], 'bb591fd40fa1'],
      [['Which brings me to the central challenge: when is an action complete? Answer that, and Action Binding falls out. To give the agent a “done” signal, we first need to see why apps lost it. So, a short history of the web, in three steps, from about 2000 to today.'], '735cd41dbbe4'],
      [['Now put an LLM in your place. Its tools are its books. It picks which to call, sometimes sure, sometimes on a hunch. So where is its ledger?'], '603dfe55ab88'],
    ];
    for (const [notes, key] of golden) expect(clipKey(narrationText(notes), PROFILE)).toBe(key);
  });

  it('changes with the words and with the voice settings, not with fields outside the recipe', () => {
    const k = clipKey('Hello.', PROFILE);
    expect(clipKey('Hello!', PROFILE)).not.toBe(k);
    expect(clipKey('Hello.', { ...PROFILE, seed: 8 })).not.toBe(k);
    expect(clipKey('Hello.', { ...PROFILE, description: 'anything' })).toBe(k);
    expect(clipKey('Hello.', { id: 'me' })).toMatch(/^[0-9a-f]{12}$/);
  });
});

describe('voice · clips in the cache', () => {
  it('finds a cached clip (its .wav, else its .m4a) and nothing for a text not voiced or empty', () => {
    const key = clipKey('Hi.', PROFILE);
    writeFileSync(path.join(dir, `${key}.json`), JSON.stringify({ text: 'Hi.', duration: 1.5, sentences: [0.1] }));
    expect(clipFor('Hi.', { cache: dir, profile: PROFILE })).toEqual({ key, audio: path.join(dir, `${key}.m4a`), duration: 1.5, sentences: [0.1] });
    writeFileSync(path.join(dir, `${key}.wav`), 'wav');
    expect(clipFor('Hi.', { cache: dir, profile: PROFILE }).audio).toBe(path.join(dir, `${key}.wav`));
    expect(clipFor('Other.', { cache: dir, profile: PROFILE })).toBe(null);
    expect(clipFor('', { cache: dir, profile: PROFILE })).toBe(null);
  });

  it('starts each sentence at its first word', () => {
    const words = [{ start: 0.1 }, { start: 0.4 }, { start: 1.2 }, { start: 1.9 }, { start: 2.4 }];
    expect(sentenceStarts('Two words. Then three more!', words)).toEqual([0.1, 1.2]);
    expect(sentenceStarts('One. Two.', [{ start: 0.2 }])).toEqual([0.2, 0]);   // a word the aligner lost: 0
  });

  it('reads which clicks to work on', () => {
    expect(pickSteps('1-3,7')).toEqual(new Set([1, 2, 3, 7]));
    expect(pickSteps('')).toBe(null);
    expect(pickSteps(undefined)).toBe(null);
  });
});

describe('voice · voicing a deck', () => {
  /** A fake engine: writes a file per scene and remembers what it was asked. */
  const fakeEngine = () => {
    const calls = [];
    return {
      calls, name: 'fake',
      synthesize(scenes, { work }) {
        calls.push(scenes.map((s) => s.text));
        return scenes.map((s) => {
          const audio = path.join(work, `${s.id}.wav`);
          writeFileSync(audio, `audio of ${s.text}`);
          return { id: s.id, audio, duration: s.text.length / 10, words: s.text.split(/\s+/).map((_, i) => ({ start: i * 0.5 })) };
        });
      },
    };
  };

  it('voices only what is not cached, once per text, in batches, each cached as it is done', async () => {
    const cache = path.join(dir, 'cache'), engine = fakeEngine(), lines = [];
    const texts = ['One. Two.', '', 'Three.', 'One. Two.', 'Four.', 'Five.', 'Six.'];
    const done = await voiceClips(texts, { cache, profile: PROFILE, engine, batch: 2, work: path.join(dir, 'work'), log: (l) => lines.push(l) });
    expect(done).toEqual({ wanted: 6, todo: 5, voiced: 5 });
    expect(engine.calls).toEqual([['One. Two.', 'Three.'], ['Four.', 'Five.'], ['Six.']]);
    const clip = clipFor('One. Two.', { cache, profile: PROFILE });
    expect(clip.duration).toBe(0.9);
    expect(clip.sentences).toEqual([0, 0.5]);
    expect(readFileSync(clip.audio, 'utf8')).toBe('audio of One. Two.');
    expect(lines[0]).toBe('6 clicks with words · 5 to voice · the rest are cached');
    // a second run voices nothing; an edited note voices that click alone
    const again = await voiceClips(texts, { cache, profile: PROFILE, engine, work: path.join(dir, 'work') });
    expect(again.voiced).toBe(0);
    texts[4] = 'Four, edited.';
    await voiceClips(texts, { cache, profile: PROFILE, engine, work: path.join(dir, 'work') });
    expect(engine.calls.at(-1)).toEqual(['Four, edited.']);
  });

  it('works on the picked clicks only, and by default in a work folder beside the cache', async () => {
    const cache = path.join(dir, 'cache'), engine = fakeEngine();
    const done = await voiceClips(['A.', 'B.', 'C.'], { cache, profile: PROFILE, engine, only: new Set([2]) });
    expect(done).toEqual({ wanted: 3, todo: 1, voiced: 1 });
    expect(engine.calls).toEqual([['B.']]);
    expect(existsSync(path.join(dir, 'work'))).toBe(true);
  });

  it('skips a batch another run already voiced', async () => {
    const cache = path.join(dir, 'cache'), engine = fakeEngine();
    mkdirSync(cache, { recursive: true });
    let n = 0;
    const racing = { name: 'race', synthesize(scenes, opts) {   // while voicing the first batch, another run caches the second
      if (n++ === 0) writeFileSync(path.join(cache, `${clipKey('C.', PROFILE)}.json`), JSON.stringify({ text: 'C.', duration: 1, sentences: [0] }));
      return engine.synthesize(scenes, opts);
    } };
    const done = await voiceClips(['A.', 'B.', 'C.'], { cache, profile: PROFILE, engine: racing, batch: 2, work: path.join(dir, 'w') });
    expect(engine.calls).toEqual([['A.', 'B.']]);
    expect(done.voiced).toBe(2);
  });
});

describe('voice · the Chatterbox kit adapter', () => {
  it('runs the kit on a storyboard and reads its timings', () => {
    const work = path.join(dir, 'work'), seen = [];
    mkdirSync(work, { recursive: true });
    const run = (cmd, args, opts) => {
      seen.push({ cmd, args, cwd: opts.cwd, offline: opts.env.HF_HUB_OFFLINE });
      writeFileSync(path.join(work, 'timings.json'), JSON.stringify({ scenes: [{ id: 'kabc', audio: 'kabc.wav', duration: 2.5, words: [{ start: 0.1 }] }] }));
      return { status: 0 };
    };
    const engine = chatterboxKit({ kit: '/kit', run, env: {} });
    const out = engine.synthesize([{ id: 'kabc', text: 'Hello there.' }], { work });
    expect(engine.name).toBe('chatterbox');
    expect(out).toEqual([{ id: 'kabc', audio: path.join(work, 'kabc.wav'), duration: 2.5, words: [{ start: 0.1 }] }]);
    expect(seen[0]).toEqual({ cmd: '/kit/.venv-voice/bin/python', args: ['scripts/voice/tts_chatterbox.py', '--storyboard', path.join(work, 'storyboard.json'), '--profile', 'voices/me.voice.json', '--device', 'mps', '--out', work], cwd: '/kit', offline: '1' });
    expect(JSON.parse(readFileSync(path.join(work, 'storyboard.json'), 'utf8'))).toEqual({ scenes: [{ id: 'kabc', narration: 'Hello there.' }] });
  });

  it('says so when the kit fails, and keeps a scene without words', () => {
    const work = path.join(dir, 'work');
    mkdirSync(work, { recursive: true });
    expect(() => chatterboxKit({ kit: '/kit', run: () => ({ status: 2 }), env: { HF_HUB_OFFLINE: '0' } }).synthesize([], { work })).toThrow(/voice kit failed \(exit 2\)/);
    const run = () => { writeFileSync(path.join(work, 'timings.json'), JSON.stringify({ scenes: [{ id: 'k1', audio: 'a.wav', duration: 1 }] })); return { status: 0 }; };
    expect(chatterboxKit({ kit: '/kit', run }).synthesize([{ id: 'k1', text: 'x' }], { work })[0].words).toEqual([]);
  });
});

describe('voice · clips inside one page', () => {
  it('embeds each clip once (as .m4a, made from the .wav when missing) with the click → clip map', () => {
    const k1 = clipKey('One.', PROFILE), k2 = clipKey('Two.', PROFILE);
    writeFileSync(path.join(dir, `${k1}.json`), JSON.stringify({ text: 'One.', duration: 1, sentences: [0] }));
    writeFileSync(path.join(dir, `${k1}.m4a`), 'M4A-1');
    writeFileSync(path.join(dir, `${k2}.json`), JSON.stringify({ text: 'Two.', duration: 2, sentences: [0.1] }));
    writeFileSync(path.join(dir, `${k2}.wav`), 'WAV-2');
    const made = [];
    const run = (cmd, args) => { made.push(args.at(-1)); writeFileSync(args.at(-1), 'M4A-2'); return { status: 0 }; };
    const { tags, have, wanted } = embedClips(['One.', '', 'Two.', 'One.', 'Not voiced.'], { cache: dir, profile: PROFILE, run });
    expect([have, wanted]).toEqual([3, 4]);
    expect(made).toEqual([path.join(dir, `${k2}.m4a`)]);
    const map = JSON.parse(/<script type="application\/json" id="deck-voice">(.*?)<\/script>/.exec(tags)[1]);
    expect(map).toEqual({ steps: [k1, null, k2, k1, null], clips: { [k1]: { d: 1, s: [0] }, [k2]: { d: 2, s: [0.1] } } });
    expect(tags).toContain(`id="vc-${k1}">${Buffer.from('M4A-1').toString('base64')}<`);
    expect(tags.match(/id="vc-/g)).toHaveLength(2);
  });

  it('gives no tags when no click has a clip, and none for a clip it cannot make an .m4a of', () => {
    const k = clipKey('One.', PROFILE);
    writeFileSync(path.join(dir, `${k}.json`), JSON.stringify({ text: 'One.', duration: 1, sentences: [0] }));
    expect(embedClips(['One.'], { cache: dir, profile: PROFILE, run: () => ({ status: 1 }) })).toEqual({ tags: '', have: 0, wanted: 1 });
    expect(embedClips(['', ''], { cache: dir, profile: PROFILE })).toEqual({ tags: '', have: 0, wanted: 0 });
  });
});
