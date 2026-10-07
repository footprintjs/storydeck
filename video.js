// video — a narrated deck as a video: every click on screen while its clip plays. Node, with ffmpeg on the path.
//
//   const steps = notes.map((n, i) => ({ label: labels[i], written: writtenText(n), spoken, clip: clipFor(spoken, …) }));
//   await renderVideo({ url: 'file:///…/deck.html', steps, out: 'out/video', driver: deckStageDriver({ chromium }) });
//   // → out/video/deck.mp4 · captions.srt · captions.vtt · chapters.txt · thumbnail.jpg · timeline.json
//
// Every click is made forward, as in the room, so its entrance plays; then every animation on the page is paused
// and stepped frame by frame (deterministic: the same deck renders the same frames), until the last entrance
// ends; that frame is held for the rest of the clip. Motion that loops (a running path) stops there. A click
// lasts its clip plus `gap`; the first one starts after `lead` (a fade in from black); a click without a clip
// stays `noclip` seconds. The browser is a port — { open(url), step(n), freeze() → ms the entrances last,
// seek(ms), shot(file), close() } — and `deckStageDriver` drives storydeck's own <deck-stage> with Playwright
// (pass its `chromium`). ffmpeg runs through `run` (spawnSync's shape), so both can be faked.
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { captionCues, toSrt, toVtt, chapterList } from './narration.js';

const NUM = (n) => String(n).padStart(3, '0');

/**
 * The timeline: each step (`{ label, written, spoken, clip }`, clip as storydeck/voice's clipFor gives it) as a
 * click with its number n (1-based), lead and length (s). `only` ([first, last], 1-based) renders a strip.
 */
export function planVideo(steps, { gap = 0.6, lead = 0.6, noclip = 2.5, only = null } = {}) {
  const [first, last] = only ?? [1, steps.length];
  const plan = [];
  steps.forEach((s, i) => {
    const n = i + 1;
    if (n < first || n > last) return;
    const l = n === first ? lead : 0;
    plan.push({ n, label: s.label, written: s.written ?? '', spoken: s.spoken ?? '', clip: s.clip ?? null, lead: l, length: l + (s.clip ? s.clip.duration : noclip) + gap });
  });
  return timed(plan);
}

/** Each click's start, from the lengths before it. */
function timed(plan) {
  let at = 0;
  for (const c of plan) { c.start = at; at += c.length; }
  return plan;
}

/**
 * The picture as an ffconcat list: each frame of a click's entrance for 1/fps s, its last frame held until the
 * click ends (a clip shorter than its entrance makes the click wait for it). Updates the plan's lengths/starts.
 */
export function framesConcat(plan, shots, { fps = 30 } = {}) {
  const lines = ['ffconcat version 1.0'];
  plan.forEach((c, i) => {
    const files = shots[i], animated = (files.length - 1) / fps;
    c.length = Math.max(c.length, animated + 1 / fps + 0.3);
    files.forEach((f, k) => lines.push(`file '${f}'`, `duration ${k < files.length - 1 ? (1 / fps).toFixed(6) : (c.length - animated).toFixed(6)}`));
  });
  lines.push(`file '${shots.at(-1).at(-1)}'`);   // the concat demuxer needs the last picture again to keep its duration
  timed(plan);
  return `${lines.join('\n')}\n`;
}

/** ffmpeg's arguments for one click's sound: its clip after its lead, padded with silence to its length. */
export function audioArgs(c, file) {
  const len = c.length.toFixed(6);
  return c.clip
    ? ['-y', '-loglevel', 'error', '-i', c.clip.audio, '-af', `adelay=${Math.round(c.lead * 1000)}:all=1,apad`, '-t', len, '-ar', '48000', '-ac', '1', '-c:a', 'pcm_s16le', file]
    : ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=mono', '-t', len, '-c:a', 'pcm_s16le', file];
}

/** ffmpeg's arguments for the video: the frames and the narration, in from black, out to black, H.264 + AAC. */
export function encodeArgs({ frames, narration, out, length, fps = 30, crf = 18 }) {
  const end = (length - 1).toFixed(3);
  return ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', frames, '-i', narration,
    '-vf', `fps=${fps},format=yuv420p,fade=t=in:st=0:d=0.5,fade=t=out:st=${end}:d=1`, '-af', `afade=t=out:st=${end}:d=1`,
    '-c:v', 'libx264', '-preset', 'slow', '-crf', String(crf), '-c:a', 'aac', '-b:a', '192k', '-ar', '48000',
    '-movflags', '+faststart', '-t', length.toFixed(3), out];
}

/** Runs ffmpeg (or a fake with spawnSync's shape) and throws on failure. */
function ffmpeg(run, args, what) {
  const done = run('ffmpeg', args, { stdio: 'inherit' });
  if (done?.status) throw new Error(`ffmpeg failed: ${what}`);
}

/** The frames of every click, through the driver: entrance stepped at `fps`, then one held frame. */
async function frames(driver, url, plan, dir, { fps, maxEntrance, log }) {
  rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true });
  await driver.open(url);
  const shots = [];
  try {
    for (const c of plan) {
      await driver.step(c.n);
      const end = Math.min(maxEntrance, await driver.freeze()), count = Math.max(1, Math.ceil(end / (1000 / fps)) + 1);
      const files = [];
      for (let k = 0; k < count; k++) {
        await driver.seek(Math.min(end, (k * 1000) / fps));
        const file = path.join(dir, `c${NUM(c.n)}-${NUM(k)}.png`);
        await driver.shot(file);
        files.push(file);
      }
      shots.push(files);
      log(`frames: click ${c.n} · ${files.length}`);
    }
  } finally {
    await driver.close();
  }
  return shots;
}

/** The narration track: each click's sound, then all of them in order. */
function narration(run, plan, out) {
  const dir = path.join(out, 'audio');
  rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true });
  const list = plan.map((c) => {
    const file = path.join(dir, `c${NUM(c.n)}.wav`);
    ffmpeg(run, audioArgs(c, file), `the sound of click ${c.n}`);
    return `file '${file}'`;
  });
  const concat = path.join(out, 'audio.ffconcat'), wav = path.join(out, 'narration.wav');
  writeFileSync(concat, ['ffconcat version 1.0', ...list].join('\n') + '\n');
  ffmpeg(run, ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', concat, '-c', 'copy', wav], 'the narration');
  return wav;
}

/**
 * Renders the video. `chapters(click)` names the clicks where a chapter starts (a title, or null; the first
 * chapter at 0:00 defaults to `intro`); `thumbnail(click)` picks the click whose settled frame is the thumbnail.
 * Returns { video, length, cues, chapters: { text, problems }, plan }.
 */
export async function renderVideo({ url, steps, out, name = 'deck', driver, run = spawnSync, fps = 30, gap, lead, noclip, only, maxEntrance = 4000,
  chapters = () => null, intro = 'Intro', thumbnail = () => false, log = () => {} }) {
  mkdirSync(out, { recursive: true });
  const plan = planVideo(steps, { gap, lead, noclip, only });
  const shots = await frames(driver, url, plan, path.join(out, 'frames'), { fps, maxEntrance, log });
  const concat = path.join(out, 'frames.ffconcat');
  writeFileSync(concat, framesConcat(plan, shots, { fps }));
  const wav = narration(run, plan, out), length = plan.reduce((s, c) => s + c.length, 0), video = path.join(out, `${name}.mp4`);
  ffmpeg(run, encodeArgs({ frames: concat, narration: wav, out: video, length, fps }), 'the video');
  const cues = captionCues(plan);
  writeFileSync(path.join(out, 'captions.srt'), toSrt(cues));
  writeFileSync(path.join(out, 'captions.vtt'), toVtt(cues));
  const marks = plan.map((c) => ({ at: c.start, title: chapters(c) })).filter((m) => m.title);
  if (!marks.length || marks[0].at > 0) marks.unshift({ at: 0, title: intro });
  const list = chapterList(marks, { length });
  writeFileSync(path.join(out, 'chapters.txt'), `${list.text}\n`);
  const cover = plan.findIndex((c) => thumbnail(c));
  if (cover >= 0) ffmpeg(run, ['-y', '-loglevel', 'error', '-i', shots[cover].at(-1), '-vf', 'scale=1280:720', '-q:v', '2', path.join(out, 'thumbnail.jpg')], 'the thumbnail');
  writeFileSync(path.join(out, 'timeline.json'), JSON.stringify(plan.map(({ n, label, start, length: l, clip }) => ({ n, label, start: +start.toFixed(3), length: +l.toFixed(3), clip: clip?.key ?? null })), null, 1));
  return { video, length, cues: cues.length, chapters: list, plan };
}

/**
 * The driver for storydeck's <deck-stage> pages, with Playwright (pass its `chromium`). A click is made
 * forward — a jump to the click before it, then one step on — and `hide` keeps the room's chrome out of
 * the frame (the deck's toolbar always; key hints and panels by selector).
 */
export function deckStageDriver({ chromium, executablePath, viewport = { width: 1920, height: 1080 }, hide = ['.fs-btn', '.notes-panel', '.train-panel'] }) {
  let browser, page;
  const settle = () => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  return {
    async open(url) {
      browser = await chromium.launch(executablePath ? { executablePath } : {});
      page = await browser.newPage({ viewport, reducedMotion: 'no-preference' });
      await page.goto(url);
      await page.waitForFunction(() => customElements.get('deck-stage') && document.querySelector('deck-stage')?.shadowRoot && document.fonts.status === 'loaded');
      if (hide.length) await page.addStyleTag({ content: `${hide.join(',')}{display:none!important}` });
      await page.evaluate(() => { const s = document.createElement('style'); s.textContent = '.overlay{display:none!important}'; document.querySelector('deck-stage').shadowRoot.append(s); });
    },
    async step(n) {
      if (n > 1) {
        await page.evaluate((i) => document.querySelector('deck-stage').goTo(i), n - 2);
        await page.waitForTimeout(250);
        await page.keyboard.press('ArrowRight');
      }
      await settle();
      const at = await page.evaluate(() => document.querySelector('deck-stage').index + 1);
      if (at !== n) throw new Error(`click ${n}: the deck is on ${at}`);
    },
    freeze: () => page.evaluate(() => {
      const stage = document.querySelector('deck-stage');
      const all = [...new Set([...document.getAnimations(), ...(stage?.shadowRoot?.getAnimations() ?? [])])];
      all.forEach((a) => a.pause());
      window.__sdFrozen = all;
      const ends = all.map((a) => a.effect?.getComputedTiming().endTime).filter((t) => Number.isFinite(t));
      return Math.max(0, ...ends);
    }),
    async seek(ms) { await page.evaluate((t) => { for (const a of window.__sdFrozen ?? []) a.currentTime = t; }, ms); await settle(); },
    shot: (file) => page.screenshot({ path: file }),
    close: () => browser?.close(),
  };
}
