// voice — a deck's narration in a voice: one clip per click, cached by what it says. Node.
//
//   const engine = chatterboxKit({ kit: '../voice-kit' });          // the adapter: a local voice kit
//   await voiceClips(texts, { cache, profile, engine });            // voices only the clicks whose words changed
//   clipFor(texts[i], { cache, profile })                           // → { key, audio, duration, sentences } or null
//   const { tags, have, wanted } = embedClips(texts, { cache, profile });   // the clips inside one HTML file
//
// A clip's key is a hash of its recipe — the voice profile's settings and the exact text — so editing one note
// re-voices that click and nothing else, a clip said on several clicks is voiced once, and an interrupted run
// keeps every batch it finished. The engine is a port: { name, synthesize(scenes, { work }) } — scenes are
// { id, text }, results { id, audio (a file), duration (s), words: [{ start }] }. `chatterboxKit` is one
// adapter; bring another (a cloud voice, a test fake) with the same shape.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, mkdirSync, mkdtempSync, copyFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { sentences } from './narration.js';

/** Why a spawned process failed, or null when it ran and exited 0 (a missing binary or a signal is a failure). */
const failure = (done) => (done?.error ? done.error.message : done?.signal ? `signal ${done.signal}` : done?.status !== 0 ? `exit ${done?.status}` : null);

/** The cache key of a clip: what the voice says and the settings it says it with. Stable across versions. */
export function clipKey(text, profile) {
  const recipe = { id: profile.id, exaggeration: profile.exaggeration, cfgWeight: profile.cfgWeight, seed: profile.seed, gap: profile.sentenceGapSeconds, takes: profile.takes ?? {}, text };
  return createHash('sha1').update(JSON.stringify(recipe)).digest('hex').slice(0, 12);
}

/** The cached clip for a text, or null: its key, its audio file (.wav, else .m4a), its length and sentence starts. */
export function clipFor(text, { cache, profile }) {
  if (!text) return null;
  cache = path.resolve(cache);
  const key = clipKey(text, profile), meta = path.join(cache, `${key}.json`);
  if (!existsSync(meta)) return null;
  const wav = path.join(cache, `${key}.wav`);
  const { duration, sentences: starts } = JSON.parse(readFileSync(meta, 'utf8'));
  return { key, audio: existsSync(wav) ? wav : path.join(cache, `${key}.m4a`), duration, sentences: starts };
}

/** Where each sentence starts: its first word's aligned start (a sentence's words counted by white space). */
export function sentenceStarts(text, words) {
  let w = 0;
  return sentences(text).map((sentence) => { const first = words[w]; w += sentence.split(/\s+/).length; return first ? first.start : 0; });
}

/** "1-3,7" → Set {1, 2, 3, 7}: the clicks to work on (1-based, as in the URL #n); null for all. */
export function pickSteps(spec) {
  if (!spec) return null;
  return new Set(String(spec).split(',').flatMap((s) => { const [a, b = a] = s.split('-').map(Number); return Array.from({ length: b - a + 1 }, (_, i) => a + i); }));
}

/**
 * Voices every click whose clip is not cached: `texts` (one per click, '' for none) → cache/<key>.wav + .json
 * ({ text, duration, sentences }). In batches, each cached as soon as it is done. `only` (a Set of 1-based
 * clicks) narrows it. The engine works in `work` — a folder of its own, emptied before each batch (by default a
 * new temporary folder, removed afterwards). Returns { wanted, todo, voiced }.
 */
export async function voiceClips(texts, { cache, profile, engine, only = null, batch = 4, work, log = () => {} }) {
  if (!Number.isInteger(batch) || batch < 1) throw new RangeError(`batch must be a whole number of clips, 1 or more (got ${batch})`);
  cache = path.resolve(cache);
  mkdirSync(cache, { recursive: true });
  const todo = new Map();
  texts.forEach((text, i) => {
    if (!text || (only && !only.has(i + 1))) return;
    const key = clipKey(text, profile);
    if (!existsSync(path.join(cache, `${key}.json`))) todo.set(key, text);
  });
  const wanted = texts.filter(Boolean).length, keys = [...todo.keys()];
  log(`${wanted} clicks with words · ${todo.size} to voice · the rest are cached`);
  let voiced = 0;
  if (!keys.length) return { wanted, todo: 0, voiced };
  const own = !work, dir = own ? mkdtempSync(path.join(tmpdir(), 'storydeck-voice-')) : path.resolve(work);
  try {
    for (let b = 0; b < keys.length; b += batch) {
      const part = keys.slice(b, b + batch).filter((key) => !existsSync(path.join(cache, `${key}.json`)));   // another run may have voiced it
      if (!part.length) continue;
      rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true });
      const results = await engine.synthesize(part.map((key) => ({ id: `k${key}`, text: todo.get(key) })), { work: dir });
      for (const r of results) {
        const key = r.id.slice(1), text = todo.get(key);
        copyFileSync(r.audio, path.join(cache, `${key}.wav`));
        rmSync(path.join(cache, `${key}.m4a`), { force: true });   // a page's copy of the old take would carry the new timings
        writeFileSync(path.join(cache, `${key}.json`), JSON.stringify({ text, duration: r.duration, sentences: sentenceStarts(text, r.words ?? []) }));
      }
      voiced += results.length;
      log(`clips cached: ${voiced}/${keys.length}`);
    }
  } finally {
    if (own) rmSync(dir, { recursive: true, force: true });
  }
  return { wanted, todo: keys.length, voiced };
}

/**
 * The adapter for a local voice kit (a StoryReel-style folder): its Python environment runs Chatterbox on a
 * storyboard of scenes and writes timings.json (each scene's audio, duration and aligned words). Nothing is
 * uploaded. `kit` holds .venv-voice/, scripts/voice/tts_chatterbox.py, voices/<profile>.voice.json and the
 * profile's reference recording.
 */
export function chatterboxKit({ kit, python = '.venv-voice/bin/python', script = 'scripts/voice/tts_chatterbox.py', profile = 'voices/me.voice.json', device = 'mps', env = process.env, run = spawnSync }) {
  kit = path.resolve(kit);   // the kit runs in its own folder: every path it is handed is absolute
  return {
    name: 'chatterbox',
    synthesize(scenes, { work }) {
      const dir = path.resolve(work), board = path.join(dir, 'storyboard.json');
      writeFileSync(board, JSON.stringify({ scenes: scenes.map((s) => ({ id: s.id, narration: s.text })) }, null, 1));
      const done = run(path.join(kit, python), [script, '--storyboard', board, '--profile', profile, '--device', device, '--out', dir],
        { cwd: kit, stdio: 'inherit', env: { ...env, HF_HUB_OFFLINE: env.HF_HUB_OFFLINE ?? '1' } });
      const why = failure(done);
      if (why) throw new Error(`the voice kit failed (${why}) in ${kit}`);
      const timings = JSON.parse(readFileSync(path.join(dir, 'timings.json'), 'utf8'));
      return timings.scenes.map((s) => ({ id: s.id, audio: path.join(dir, s.audio), duration: s.duration, words: s.words ?? [] }));
    },
  };
}

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
