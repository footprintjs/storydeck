// video — a narrated deck as a video: every click on screen while its clip plays. Node, with ffmpeg 5.0+ on the path.
//
//   const steps = notes.map((n, i) => ({ label: labels[i], written: writtenText(n), spoken, clip: clipFor(spoken, …) }));   // clipFor: footprint-narration/voice
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
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { captionCues, captionFile, readCaptions, youtubeChapters } from 'footprint-narration';

const NUM = (n) => String(n).padStart(3, '0');
/** A file in an ffconcat list: absolute (ffmpeg reads a relative one from the list's folder), its quotes escaped. */
const entry = (file) => `file '${path.resolve(file).replace(/'/g, "'\\''")}'`;
/** Why a spawned process failed, or null when it ran and exited 0 (a missing binary or a signal is a failure). */
const failure = (done) => (done?.error ? done.error.message : done?.signal ? `signal ${done.signal}` : done?.status !== 0 ? `exit ${done?.status}` : null);

/**
 * The timeline: each step (`{ label, written, spoken, clip }`, clip as footprint-narration/voice's clipFor gives it) as a
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
 * Each picture is read at the video's frame rate (an image's own timebase is 1/25 s: at 30 fps it would drop
 * one frame in six and double another).
 */
export function framesConcat(plan, shots, { fps = 30 } = {}) {
  const lines = ['ffconcat version 1.0'], picture = (f) => [entry(f), `option framerate ${fps}`];
  plan.forEach((c, i) => {
    const files = shots[i], animated = (files.length - 1) / fps;
    c.length = Math.max(c.length, animated + 1 / fps + 0.3);
    files.forEach((f, k) => lines.push(...picture(f), `duration ${k < files.length - 1 ? (1 / fps).toFixed(6) : (c.length - animated).toFixed(6)}`));
  });
  lines.push(...picture(shots.at(-1).at(-1)));   // the concat demuxer needs the last picture again to keep its duration
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

/**
 * ffmpeg's major version, from `ffmpeg -version` (null when it does not say, as a build from git does). Throws
 * when ffmpeg cannot run at all.
 */
export function ffmpegMajor(run = spawnSync) {
  const done = run('ffmpeg', ['-version'], { encoding: 'utf8' }), why = failure(done);
  if (why) throw new Error(`ffmpeg failed: is it installed? (${why})`);
  const m = /ffmpeg version n?(\d+)\./i.exec(String(done.stdout ?? ''));
  return m ? Number(m[1]) : null;
}

/** Runs ffmpeg (or a fake with spawnSync's shape) and throws on failure — a missing ffmpeg included. */
function ffmpeg(run, args, what) {
  const why = failure(run('ffmpeg', args, { stdio: 'inherit' }));
  if (why) throw new Error(`ffmpeg failed: ${what} (${why})`);
}

/** The frames of every click, through the driver: entrance stepped at `fps`, then one held frame. */
async function frames(driver, url, plan, dir, { fps, maxEntrance, log }) {
  rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true });
  const shots = [];
  try {
    await driver.open(url);   // inside the try: a page that fails to open still closes its browser
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
function narration(run, plan, work) {
  const dir = path.join(work, 'audio');
  rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true });
  const list = plan.map((c) => {
    const file = path.join(dir, `c${NUM(c.n)}.wav`);
    ffmpeg(run, audioArgs(c, file), `the sound of click ${c.n}`);
    return entry(file);
  });
  const concat = path.join(work, 'audio.ffconcat'), wav = path.join(work, 'narration.wav');
  writeFileSync(concat, ['ffconcat version 1.0', ...list].join('\n') + '\n');
  ffmpeg(run, ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', concat, '-c', 'copy', wav], 'the narration');
  return wav;
}

/**
 * Renders the video into `out`: <name>.mp4, captions.srt/.vtt, chapters.txt, thumbnail.jpg, timeline.json.
 * `chapters(click)` names the clicks where a chapter starts (a title, or null; the first chapter at 0:00
 * defaults to `intro`, or 'Intro' when that is blank); `thumbnail(click)` picks the click whose settled frame is the thumbnail. The frames and
 * sounds are made in `work` (its frames/ and audio/ are replaced) — by default a temporary folder, removed
 * afterwards; name one to keep them. The chapters go by YouTube's rule (footprint-narration · youtubeChapters):
 * chapters.txt holds the list YouTube will show — empty when fewer than three would stand — and `chapters` says
 * what the rule changed. Returns { video, length, cues, chapters: { lines, text, kept, changes, problems }, plan }.
 */
export async function renderVideo({ url, steps, out, name = 'deck', driver, run = spawnSync, fps = 30, gap, lead, noclip, only, maxEntrance = 4000,
  chapters = () => null, intro = 'Intro', thumbnail = () => false, work, log = () => {} }) {
  const plan = planVideo(steps, { gap, lead, noclip, only });
  if (!plan.length) throw new Error(`nothing to render: no click in ${only ? `[${only.join(', ')}]` : 'the deck'} (it has ${steps.length})`);
  // the concat lists read each picture at the video's frame rate (`option framerate`), which ffmpeg 4 cannot parse
  const major = ffmpegMajor(run);
  if (major !== null && major < 5) throw new Error(`renderVideo needs ffmpeg 5.0 or newer (found ${major}.x)`);
  out = path.resolve(out);
  mkdirSync(out, { recursive: true });
  const own = !work, dir = own ? mkdtempSync(path.join(tmpdir(), 'storydeck-video-')) : path.resolve(work);
  try {
    mkdirSync(dir, { recursive: true });
    return await render({ url, plan, out, name, driver, run, fps, maxEntrance, chapters, intro, thumbnail, work: dir, log });
  } finally {
    if (own) rmSync(dir, { recursive: true, force: true });
  }
}

async function render({ url, plan, out, name, driver, run, fps, maxEntrance, chapters, intro, thumbnail, work, log }) {
  const shots = await frames(driver, url, plan, path.join(work, 'frames'), { fps, maxEntrance, log });
  const concat = path.join(work, 'frames.ffconcat');
  writeFileSync(concat, framesConcat(plan, shots, { fps }));
  const wav = narration(run, plan, work), length = plan.reduce((s, c) => s + c.length, 0), video = path.join(out, `${name}.mp4`);
  ffmpeg(run, encodeArgs({ frames: concat, narration: wav, out: video, length, fps }), 'the video');
  const srt = captionFile(captionCues(plan), 'srt');
  writeFileSync(path.join(out, 'captions.srt'), srt);
  writeFileSync(path.join(out, 'captions.vtt'), captionFile(captionCues(plan), 'vtt'));
  // a chapter's title: words (a finite number is its digits); anything else — null, blank, NaN — names no chapter
  const named = (title) => (typeof title === 'number' ? (Number.isFinite(title) ? String(title) : '') : typeof title === 'string' ? title.trim() : '');
  const marks = plan.map((c) => ({ at: c.start, title: named(chapters(c)) })).filter((m) => m.title);
  if (!marks.length || marks[0].at > 0) marks.unshift({ at: 0, title: named(intro) || 'Intro' });
  const list = youtubeChapters(marks, { length });
  writeFileSync(path.join(out, 'chapters.txt'), list.lines.length ? `${list.text}\n` : '');
  const cover = plan.findIndex((c) => thumbnail(c));
  if (cover >= 0) ffmpeg(run, ['-y', '-loglevel', 'error', '-i', shots[cover].at(-1), '-vf', 'scale=1280:720', '-q:v', '2', path.join(out, 'thumbnail.jpg')], 'the thumbnail');
  writeFileSync(path.join(out, 'timeline.json'), JSON.stringify(plan.map(({ n, label, start, length: l, clip }) => ({ n, label, start: +start.toFixed(3), length: +l.toFixed(3), clip: clip?.key ?? null })), null, 1));
  return { video, length, cues: readCaptions(srt).length, chapters: list, plan };
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
        // Click n − 1's motion, ended: arriving there forward (a strip's first click) starts its entrances and apart's
        // springs, and 250 ms of real time would leave click n to set off from wherever they had got to.
        await page.evaluate(() => {
          const stage = document.querySelector('deck-stage');
          for (const a of [...document.getAnimations(), ...(stage?.shadowRoot?.getAnimations() ?? [])]) {
            try { a.finish(); } catch { /* an endless animation has no end to go to */ }
          }
        });
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
    /**
     * Click n (1-based) as it settles, measured: jump there (a jump lands at once), finish what still moves, and
     * report text that spills out of its box and lit pieces outside the slide — [{kind, piece, text, dx, dy}] (the
     * layout check, deck/layout.js, reads it).
     */
    async measure(n) {
      await page.evaluate((i) => document.querySelector('deck-stage').goTo(i), n - 1);
      await settle();
      return page.evaluate(measureSlide);
    },
    close: () => browser?.close(),
  };
}

/** Runs in the page: what spills on the slide shown (see deckStageDriver · measure). */
export function measureSlide() {
  const stage = document.querySelector('deck-stage');
  for (const a of [...document.getAnimations(), ...(stage?.shadowRoot?.getAnimations() ?? [])]) {
    try { a.finish(); } catch { /* an endless animation has no end */ }
  }
  const slide = stage ? [...stage.children].filter((s) => s.tagName === 'SECTION')[stage.index] : null;
  if (!slide) return [];
  const W = Number(stage.getAttribute('width') || 1920), H = Number(stage.getAttribute('height') || 1080);
  const box = slide.getBoundingClientRect(), scale = box.width / W || 1;
  // A piece by its first data-k name; an element outside every piece by its class (".kicker") or its tag.
  const pieceOf = (el) => el.closest('[data-k]')?.getAttribute('data-k')?.trim().split(/\s+/)[0]
    ?? (el.classList.length ? `.${el.classList[0]}` : el.tagName.toLowerCase());
  const textOf = (el) => (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60);
  const shown = (el) => {
    for (let e = el; e && e !== slide; e = e.parentElement) {
      const cs = getComputedStyle(e);
      if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) < 0.05) return false;
    }
    return true;
  };
  const out = [];
  for (const el of slide.querySelectorAll('*')) {
    if (el.namespaceURI === 'http://www.w3.org/2000/svg') continue;   // a drawing sizes itself by its viewBox
    if (![...el.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim())) continue;
    const cs = getComputedStyle(el);
    if (cs.display === 'inline' || cs.overflowX === 'auto' || cs.overflowX === 'scroll' || el.clientWidth === 0 || !shown(el)) continue;
    // A glyph's own overhang (a tight line-height, an italic) is not a spill: a line spills by most of a line.
    const size = parseFloat(cs.fontSize) || 16;
    const dx = el.scrollWidth - el.clientWidth, dy = el.scrollHeight - el.clientHeight;
    if (dx > 2 || dy > Math.max(2, size * 0.35)) out.push({ kind: 'spills', piece: pieceOf(el), text: textOf(el), dx: dx > 2 ? dx : 0, dy: dy > Math.max(2, size * 0.35) ? dy : 0 });
  }
  for (const el of slide.querySelectorAll('.sd-on, [data-chrome]')) {
    if (!shown(el)) continue;
    const r = el.getBoundingClientRect();
    const x0 = (r.left - box.left) / scale, y0 = (r.top - box.top) / scale, x1 = (r.right - box.left) / scale, y1 = (r.bottom - box.top) / scale;
    const dx = Math.max(0, -x0, x1 - W), dy = Math.max(0, -y0, y1 - H);
    if (dx > 2 || dy > 2) out.push({ kind: 'outside', piece: pieceOf(el), text: textOf(el), dx: Math.round(dx), dy: Math.round(dy) });
  }
  return out;
}
