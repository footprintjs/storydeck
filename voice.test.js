import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { clipKey } from 'footprint-narration/voice';
import { embedClips } from './voice';

// The settings of a real profile (no audio). The cache itself is footprint-narration's (and tested there).
const PROFILE = {
  id: 'me', exaggeration: 0.5, cfgWeight: 0.5, seed: 7, sentenceGapSeconds: 0.3,
  takes: { 'The end.': { seed: 17114, note: 'default take came out clipped (0.24 s, letters 0.0); this take scored minWord 0.93, letters 1.0' } },
};

let dir;
beforeEach(() => { dir = mkdtempSync(path.join(tmpdir(), 'sd-voice-')); });
afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

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

  it('gives no tags when no click has a clip, and none for a clip it cannot make an .m4a of (ffmpeg failing, or missing)', () => {
    const k = clipKey('One.', PROFILE);
    writeFileSync(path.join(dir, `${k}.json`), JSON.stringify({ text: 'One.', duration: 1, sentences: [0] }));
    expect(embedClips(['One.'], { cache: dir, profile: PROFILE, run: () => ({ status: 1 }) })).toEqual({ tags: '', have: 0, wanted: 1 });
    expect(embedClips(['One.'], { cache: dir, profile: PROFILE, run: () => ({ status: null, error: new Error('spawnSync ffmpeg ENOENT') }) })).toEqual({ tags: '', have: 0, wanted: 1 });
    expect(embedClips(['One.'], { cache: dir, profile: PROFILE, run: () => ({ status: 0 }) })).toEqual({ tags: '', have: 0, wanted: 1 });   // it said yes, wrote nothing
    expect(embedClips(['', ''], { cache: dir, profile: PROFILE })).toEqual({ tags: '', have: 0, wanted: 0 });
  });
});
