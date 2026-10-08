// voice — a deck's clips inside one page. Node.
//
//   const { tags, have, wanted } = embedClips(texts, { cache, profile });   // the clips inside one HTML file
//
// The voice itself — the clip cache keyed by what is said, the voice port and the Chatterbox kit adapter — is
// footprint-narration's (Node door 'footprint-narration/voice': voiceClips, clipFor, clipKey, chatterboxKit,
// pickSteps). What is the deck's own is carrying the clips in the page for listenRuntime.
import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { clipFor } from 'footprint-narration/voice';

/** Why a spawned process failed, or null when it ran and exited 0 (a missing binary or a signal is a failure). */
const failure = (done) => (done?.error ? done.error.message : done?.signal ? `signal ${done.signal}` : done?.status !== 0 ? `exit ${done?.status}` : null);

/**
 * The clips for a single-file page: each click's cached clip as a base64 <script> tag (an .m4a, made from the
 * .wav once), and a JSON map from click to clip (id deck-voice) that `listenRuntime` reads. A click whose words
 * changed since it was voiced gets no clip — the page falls back to the browser's voice there.
 * Returns { tags, have, wanted } (tags is '' when no click has a clip).
 */
export function embedClips(texts, { cache, profile, run = spawnSync }) {
  cache = path.resolve(cache);
  const steps = [], clips = {}, tags = [];
  for (const text of texts) {
    const clip = clipFor(text, { cache, profile });
    if (!clip) { steps.push(null); continue; }
    const m4a = path.join(cache, `${clip.key}.m4a`);
    if (!existsSync(m4a)) {
      const done = run('ffmpeg', ['-y', '-loglevel', 'error', '-i', path.join(cache, `${clip.key}.wav`), '-c:a', 'aac', '-b:a', '48k', '-ac', '1', m4a]);
      if (failure(done) || !existsSync(m4a)) { steps.push(null); continue; }   // no ffmpeg, or it failed: the browser's voice there
    }
    if (!clips[clip.key]) {
      clips[clip.key] = { d: clip.duration, s: clip.sentences };
      tags.push(`<script type="application/octet-stream" id="vc-${clip.key}">${readFileSync(m4a).toString('base64')}</script>`);
    }
    steps.push(clip.key);
  }
  const have = steps.filter(Boolean).length, wanted = texts.filter(Boolean).length;
  return { tags: have ? `<script type="application/json" id="deck-voice">${JSON.stringify({ steps, clips }).replace(/</g, '\\u003c')}</script>\n${tags.join('\n')}` : '', have, wanted };
}
