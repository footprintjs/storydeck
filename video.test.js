import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { planVideo, framesConcat, audioArgs, encodeArgs, renderVideo, deckStageDriver, ffmpegMajor } from './video';

const clip = (key, duration, sentences = [0]) => ({ key, audio: `/cache/${key}.wav`, duration, sentences });
const STEPS = [
  { label: 'Intro', written: 'Hello. There.', spoken: 'Hello. There.', clip: clip('k1', 3, [0, 1.5]) },
  { label: 'Part 1 · Two ways in', written: '', spoken: '', clip: null },
  { label: 'Part 1 · Two ways in · 1', written: 'On 2000.', spoken: 'On two thousand.', clip: clip('k2', 2) },
  { label: 'Title', written: 'Title.', spoken: 'Title.', clip: clip('k3', 12) },
];

let dir;
beforeEach(() => { dir = mkdtempSync(path.join(tmpdir(), 'sd-video-')); });
afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

describe('video · the timeline', () => {
  it('gives each click its clip plus a gap, the first a lead-in, one without a clip a fixed wait', () => {
    const plan = planVideo(STEPS);
    const r = (x) => Math.round(x * 1000) / 1000;   // seconds, to the millisecond
    expect(plan.map((c) => [c.n, c.lead, r(c.length), r(c.start)])).toEqual([[1, 0.6, 4.2, 0], [2, 0, 3.1, 4.2], [3, 0, 2.6, 7.3], [4, 0, 12.6, 9.9]]);
    expect(planVideo(STEPS, { gap: 0, lead: 1, noclip: 5 }).map((c) => c.length)).toEqual([4, 5, 2, 12]);
  });

  it('renders a strip of clicks, the first of it with the lead-in', () => {
    const plan = planVideo(STEPS, { only: [2, 3] });
    expect(plan.map((c) => [c.n, c.lead, Math.round(c.start * 1000) / 1000])).toEqual([[2, 0.6, 0], [3, 0, 3.7]]);
    expect(planVideo([{}]).map((c) => [c.written, c.spoken, c.clip])).toEqual([['', '', null]]);
  });

  it('lists the pictures: each entrance frame for one frame\'s time, the last held to the click\'s end', () => {
    const plan = planVideo(STEPS.slice(0, 2), { gap: 0.5, lead: 0 });
    const text = framesConcat(plan, [['/f/a0.png', '/f/a1.png', '/f/a2.png'], ['/f/b0.png']], { fps: 10 });
    const at = (f) => [`file '${f}'`, 'option framerate 10'];   // each picture read at the video's rate
    expect(text).toBe(['ffconcat version 1.0',
      ...at('/f/a0.png'), 'duration 0.100000', ...at('/f/a1.png'), 'duration 0.100000', ...at('/f/a2.png'), 'duration 3.300000',
      ...at('/f/b0.png'), 'duration 3.000000', ...at('/f/b0.png'), ''].join('\n'));
    // ffmpeg reads a relative entry from the list's own folder: every entry is absolute, its quotes escaped
    const quoted = framesConcat(planVideo([{}]), [["rel/it's.png"]]);
    expect(quoted).toContain(`file '${path.resolve('rel')}/it'\\''s.png'`);
    // a clip shorter than its entrance: the click waits for the entrance (and a breath)
    const short = planVideo([{ clip: clip('s', 0.1) }], { gap: 0, lead: 0 });
    framesConcat(short, [Array.from({ length: 11 }, (_, k) => `f${k}.png`)], { fps: 10 });
    expect(short[0].length).toBeCloseTo(1.4);
  });
});

describe('video · ffmpeg\'s arguments', () => {
  it('pads each click\'s clip after its lead to the click\'s length; silence for a click without one', () => {
    const [first, none] = planVideo(STEPS);
    expect(audioArgs(first, 'c1.wav')).toEqual(['-y', '-loglevel', 'error', '-i', '/cache/k1.wav', '-af', 'adelay=600:all=1,apad', '-t', '4.200000', '-ar', '48000', '-ac', '1', '-c:a', 'pcm_s16le', 'c1.wav']);
    expect(audioArgs(none, 'c2.wav')).toEqual(['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=mono', '-t', '3.100000', '-c:a', 'pcm_s16le', 'c2.wav']);
  });

  it('encodes in from black and out to black, trimmed to the length', () => {
    const args = encodeArgs({ frames: 'f.ffconcat', narration: 'n.wav', out: 'v.mp4', length: 100 });
    expect(args).toContain('fps=30,format=yuv420p,fade=t=in:st=0:d=0.5,fade=t=out:st=99.000:d=1');
    expect(args.slice(-3)).toEqual(['-t', '100.000', 'v.mp4']);
    expect(encodeArgs({ frames: 'f', narration: 'n', out: 'o', length: 10, fps: 25, crf: 20 })).toEqual(expect.arrayContaining(['-crf', '20', 'afade=t=out:st=9.000:d=1']));
  });
});

/** A browser stand-in: a click's entrance lasts what `ends` says; every frame is a small file. */
function fakeDriver(ends = {}) {
  const log = [];
  let n = 0;
  return {
    log,
    open: vi.fn(async (url) => log.push(`open ${url}`)),
    step: vi.fn(async (k) => { n = k; log.push(`step ${k}`); }),
    freeze: vi.fn(async () => ends[n] ?? 0),
    seek: vi.fn(async (ms) => log.push(`seek ${Math.round(ms)}`)),
    shot: vi.fn(async (file) => writeFileSync(file, 'png')),
    close: vi.fn(async () => log.push('close')),
  };
}
/** ffmpeg stand-in: records its arguments and writes the file each call would. */
function fakeRun(fail, version = 'ffmpeg version 7.1 Copyright (c) 2000-2024 the FFmpeg developers') {
  const calls = [];
  const run = (cmd, args) => {
    if (args[0] === '-version') return { status: 0, stdout: version };
    calls.push(args); writeFileSync(args.at(-1), 'out'); return { status: fail?.(args) ? 1 : 0 };
  };
  return { run, calls };
}

describe('video · rendering', () => {
  it('renders frames, the narration, the video, captions, chapters, a thumbnail and the timeline', async () => {
    const driver = fakeDriver({ 1: 100, 3: 0, 4: 60 }), { run, calls } = fakeRun(), lines = [];
    const work = path.join(dir, 'work'), out = path.join(dir, 'out');
    const done = await renderVideo({
      url: 'file:///deck.html', steps: STEPS, out, work, name: 'talk', driver, run, fps: 20, log: (l) => lines.push(l),
      chapters: (c) => (/^Part \d+ · /.test(c.label) && !/ · \d+$/.test(c.label) ? c.label : c.label === 'Title' ? 'The title' : null),
      thumbnail: (c) => c.label === 'Title',
    });
    // click 1: an entrance of 100 ms at 20 fps → frames at 0, 50, 100 ms
    expect(driver.log.slice(0, 5)).toEqual(['open file:///deck.html', 'step 1', 'seek 0', 'seek 50', 'seek 100']);
    expect(driver.close).toHaveBeenCalled();
    expect(lines[0]).toBe('frames: click 1 · 3');
    expect(done.video).toBe(path.join(out, 'talk.mp4'));
    expect(readdirSync(out).sort()).toEqual(['captions.srt', 'captions.vtt', 'chapters.txt', 'talk.mp4', 'thumbnail.jpg', 'timeline.json']);
    expect(done.length).toBeCloseTo(4.2 + 3.1 + 2.6 + 12.6);
    expect(done.cues).toBe(4);                                                    // 2 + 0 + 1 + 1
    // YouTube's rule: chapters 4–5 s apart are not chapters; the title, inside the first 10 s, takes 0:00 — and fewer than three is none
    expect(done.chapters.kept).toEqual([{ at: 0, title: 'The title' }]);
    expect(done.chapters.changes.map((c) => c.kind)).toEqual(['replaced', 'replaced', 'moved']);
    expect(done.chapters.problems).toEqual(['YouTube shows chapters only when there are at least three']);
    expect(readFileSync(path.join(out, 'chapters.txt'), 'utf8')).toBe('');
    expect(readFileSync(path.join(out, 'captions.srt'), 'utf8')).toContain('00:00:00,600 --> 00:00:02,100\nHello.');
    expect(readFileSync(path.join(out, 'captions.srt'), 'utf8')).toContain('On 2000.');   // as written: one sentence, one start
    expect(readFileSync(path.join(out, 'captions.vtt'), 'utf8')).toMatch(/^WEBVTT\n\n1\n00:00:00\.600 --> 00:00:02\.100\nHello\.\n/);
    expect(JSON.parse(readFileSync(path.join(out, 'timeline.json'), 'utf8'))[3]).toEqual({ n: 4, label: 'Title', start: 9.9, length: 12.6, clip: 'k3' });
    expect(readFileSync(path.join(work, 'frames.ffconcat'), 'utf8')).toContain(`file '${path.join(work, 'frames', 'c001-002.png')}'`);
    // ffmpeg: four sounds, the narration, the video, the thumbnail (from the title's settled frame)
    expect(calls).toHaveLength(7);
    expect(calls[5].at(-1)).toBe(path.join(out, 'talk.mp4'));
    expect(calls[6]).toEqual(['-y', '-loglevel', 'error', '-i', path.join(work, 'frames', 'c004-002.png'), '-vf', 'scale=1280:720', '-q:v', '2', path.join(out, 'thumbnail.jpg')]);
    expect(readFileSync(path.join(work, 'audio.ffconcat'), 'utf8')).toContain(`file '${path.join(work, 'audio', 'c001.wav')}'`);
  });

  it('starts the chapters with the intro when no click names 0:00, and caps an entrance', async () => {
    const driver = fakeDriver({ 1: 99999 }), { run } = fakeRun();
    const done = await renderVideo({ url: 'u', steps: STEPS.slice(0, 1), out: dir, driver, run, fps: 1, maxEntrance: 2000, intro: 'Start' });
    expect(driver.seek.mock.calls.map(([ms]) => ms)).toEqual([0, 1000, 2000]);
    expect(done.chapters.changes).toEqual([{ kind: 'dropped', title: 'Start', at: 0 }]);   // a 4.2 s video: no chapter lasts 10 s
    expect(done.chapters.text).toBe('');
    expect(done.chapters.problems).toContain('YouTube shows chapters only when there are at least three');
    expect(existsSync(path.join(dir, 'thumbnail.jpg'))).toBe(false);
  });

  it('writes the chapters YouTube will show: the first at 0:00, each 10 s or more', async () => {
    const long = (label, key) => ({ label, written: 'A line.', spoken: 'A line.', clip: clip(key, 12) });
    const steps = [long('Title', 'a'), long('Part 1', 'b'), long('Part 1 · aside', 'c'), long('Part 2', 'd')];
    const done = await renderVideo({ url: 'u', steps, out: dir, driver: fakeDriver(), run: fakeRun().run, chapters: (c) => (/^Part \d$/.test(c.label) ? c.label : null) });
    expect(done.chapters.lines).toEqual(['0:00 Intro', '0:13 Part 1', '0:38 Part 2']);
    expect(readFileSync(path.join(dir, 'chapters.txt'), 'utf8')).toBe('0:00 Intro\n0:13 Part 1\n0:38 Part 2\n');
    expect(done.chapters.changes).toEqual([]);
  });

  it('closes the browser and says which step failed when ffmpeg or a click fails', async () => {
    const { run } = fakeRun((args) => args.at(-1).endsWith('.mp4'));
    await expect(renderVideo({ url: 'u', steps: STEPS.slice(0, 1), out: dir, driver: fakeDriver(), run })).rejects.toThrow('ffmpeg failed: the video');
    const broken = fakeDriver();
    broken.step.mockRejectedValueOnce(new Error('click 1: the deck is on 2'));
    await expect(renderVideo({ url: 'u', steps: STEPS.slice(0, 1), out: dir, driver: broken, run: fakeRun().run })).rejects.toThrow('the deck is on 2');
    expect(broken.close).toHaveBeenCalled();
  });
});

describe('video · what can go wrong', () => {
  it('makes its frames in a temporary folder by default, removed afterwards; `out` gets the final files only', async () => {
    const out = path.join(dir, 'out');
    mkdirSync(path.join(out, 'audio'), { recursive: true });
    writeFileSync(path.join(out, 'audio', 'mine.wav'), 'the caller\'s');           // a folder of the caller's, never wiped
    const seen = [];
    const driver = fakeDriver();
    driver.shot.mockImplementation(async (file) => { seen.push(file); writeFileSync(file, 'png'); });
    await renderVideo({ url: 'u', steps: STEPS.slice(0, 1), out, driver, run: fakeRun().run });
    expect(seen[0].startsWith(path.join(dir, 'out'))).toBe(false);
    expect(existsSync(path.dirname(path.dirname(seen[0])))).toBe(false);          // the temporary folder is gone
    expect(readFileSync(path.join(out, 'audio', 'mine.wav'), 'utf8')).toBe('the caller\'s');
  });

  it('takes a relative `out` and `work` from where it runs', async () => {
    const was = process.cwd();
    process.chdir(dir);
    try {
      const { run, calls } = fakeRun();
      const done = await renderVideo({ url: 'u', steps: STEPS.slice(0, 1), out: 'rel/out', work: 'rel/work', driver: fakeDriver(), run });
      expect(done.video).toBe(path.join(process.cwd(), 'rel', 'out', 'deck.mp4'));
      expect(readFileSync(path.join(dir, 'rel', 'work', 'frames.ffconcat'), 'utf8')).toContain(`file '${path.join(process.cwd(), 'rel', 'work', 'frames')}`);
      expect(calls.every((args) => path.isAbsolute(args.at(-1)))).toBe(true);
    } finally {
      process.chdir(was);
    }
  });

  it('fails when ffmpeg cannot run at all (missing, or killed) — never a video that is not there', async () => {
    const missing = () => ({ status: null, error: new Error('spawnSync ffmpeg ENOENT') });
    const idle = fakeDriver();
    await expect(renderVideo({ url: 'u', steps: STEPS.slice(0, 1), out: dir, driver: idle, run: missing }))
      .rejects.toThrow('ffmpeg failed: is it installed? (spawnSync ffmpeg ENOENT)');
    expect(idle.open).not.toHaveBeenCalled();                                       // found out before a browser opens
    const killed = () => ({ status: null, signal: 'SIGKILL' });
    await expect(renderVideo({ url: 'u', steps: STEPS.slice(0, 1), out: dir, driver: fakeDriver(), run: killed })).rejects.toThrow('(signal SIGKILL)');
    // ffmpeg runs, then one step fails
    const later = (cmd, args) => (args[0] === '-version' ? { status: 0, stdout: 'ffmpeg version 6.1.1' } : { status: null, error: new Error('spawnSync ffmpeg ENOENT') });
    await expect(renderVideo({ url: 'u', steps: STEPS.slice(0, 1), out: dir, driver: fakeDriver(), run: later }))
      .rejects.toThrow('ffmpeg failed: the sound of click 1 (spawnSync ffmpeg ENOENT)');
  });

  it('needs ffmpeg 5.0 or newer (its concat lists read each picture at a frame rate ffmpeg 4 cannot parse)', async () => {
    const old = fakeRun(null, 'ffmpeg version 4.4.2-0ubuntu0.22.04.1 Copyright (c) 2000-2021');
    await expect(renderVideo({ url: 'u', steps: STEPS.slice(0, 1), out: dir, driver: fakeDriver(), run: old.run })).rejects.toThrow('renderVideo needs ffmpeg 5.0 or newer (found 4.x)');
    expect(ffmpegMajor(fakeRun(null, 'ffmpeg version n6.1 Copyright').run)).toBe(6);
    expect(ffmpegMajor(fakeRun(null, 'ffmpeg version N-112345-gabcdef Copyright').run)).toBe(null);   // a build from git: no version to read
    await expect(renderVideo({ url: 'u', steps: STEPS.slice(0, 1), out: dir, driver: fakeDriver(), run: fakeRun(null, 'ffmpeg version N-1-g2').run })).resolves.toBeTruthy();
  });

  it('closes the browser when the deck does not open, and opens none for an empty range', async () => {
    const broken = fakeDriver();
    broken.open.mockRejectedValueOnce(new Error('no deck-stage on the page'));
    await expect(renderVideo({ url: 'u', steps: STEPS, out: dir, driver: broken, run: fakeRun().run })).rejects.toThrow('no deck-stage');
    expect(broken.close).toHaveBeenCalled();
    const idle = fakeDriver();
    await expect(renderVideo({ url: 'u', steps: STEPS, out: dir, driver: idle, run: fakeRun().run, only: [12, 5] })).rejects.toThrow('nothing to render: no click in [12, 5] (it has 4)');
    await expect(renderVideo({ url: 'u', steps: [], out: dir, driver: idle, run: fakeRun().run })).rejects.toThrow('nothing to render: no click in the deck (it has 0)');
    expect(idle.open).not.toHaveBeenCalled();
  });
});

// on CI (which installs ffmpeg) this never skips: a missing ffmpeg there is a failure, not a pass
const hasFfmpeg = spawnSync('ffmpeg', ['-version']).status === 0;
describe.skipIf(!hasFfmpeg && !process.env.CI)('video · with the real ffmpeg', () => {
  it('is ffmpeg 5.0 or newer', () => {
    expect(ffmpegMajor() ?? 5).toBeGreaterThanOrEqual(5);
  });

  it('keeps every entrance frame at 30 fps, in order (an image read at its own 1/25 s would drop and double them)', () => {
    const frames = path.join(dir, "it's frames");                                   // a quote in the path, too
    mkdirSync(frames);
    const files = Array.from({ length: 30 }, (_, k) => {
      const file = path.join(frames, `f${String(k).padStart(2, '0')}.png`);
      const v = (40 + k * 6).toString(16).padStart(2, '0');                        // each frame its own grey
      spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', `color=c=0x${v}${v}${v}:s=16x16`, '-frames:v', '1', file]);
      return file;
    });
    const plan = planVideo([{ clip: clip('k', 1) }], { gap: 0, lead: 0 });
    const list = path.join(dir, 'frames.ffconcat');
    writeFileSync(list, framesConcat(plan, [files], { fps: 30 }));
    const out = spawnSync('ffmpeg', ['-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-vf', 'fps=30,format=gray', '-frames:v', '30', '-f', 'rawvideo', '-'], { maxBuffer: 1 << 20 });
    expect(out.status).toBe(0);
    const greys = Array.from({ length: 30 }, (_, k) => out.stdout[k * 256]);       // one 16×16 grey frame after another
    // frame k shows picture k (its grey, give or take the colour conversion's rounding): none dropped, none doubled
    expect(greys.map((g, k) => Math.abs(g - (40 + k * 6)) <= 2)).toEqual(Array(30).fill(true));
    expect(greys.every((g, k) => k === 0 || g > greys[k - 1])).toBe(true);
  });
});

describe('video · the deck-stage driver', () => {
  /** Playwright's chromium, faked: page.evaluate runs the page function against a stand-in document. */
  function fakeChromium() {
    const anims = [
      { pause: vi.fn(), effect: { getComputedTiming: () => ({ endTime: 700 }) }, currentTime: 0 },
      { pause: vi.fn(), effect: { getComputedTiming: () => ({ endTime: Infinity }) }, currentTime: 0 },
    ];
    const stage = { index: 0, goTo: vi.fn((i) => { stage.index = i; }), shadowRoot: { getAnimations: () => [anims[1]], append: vi.fn() } };
    const doc = { querySelector: () => stage, getAnimations: () => [anims[0]], createElement: () => ({}) };
    const page = {
      goto: vi.fn(), waitForFunction: vi.fn(), addStyleTag: vi.fn(), waitForTimeout: vi.fn(), screenshot: vi.fn(),
      keyboard: { press: vi.fn(async () => { stage.index += 1; }) },
      evaluate: vi.fn(async (fn, arg) => {
        const saved = { document: globalThis.document, raf: globalThis.requestAnimationFrame };
        globalThis.document = doc; globalThis.requestAnimationFrame = (cb) => cb();
        try { return await fn(arg); } finally { globalThis.document = saved.document; globalThis.requestAnimationFrame = saved.raf; }
      }),
    };
    const browser = { newPage: vi.fn(async () => page), close: vi.fn() };
    return { chromium: { launch: vi.fn(async () => browser) }, page, browser, stage, anims };
  }

  it('opens the page with motion on and the room\'s chrome hidden', async () => {
    const f = fakeChromium();
    const driver = deckStageDriver({ chromium: f.chromium, executablePath: '/chrome', hide: ['.hint'] });
    await driver.open('file:///deck.html');
    expect(f.chromium.launch).toHaveBeenCalledWith({ executablePath: '/chrome' });
    expect(f.browser.newPage).toHaveBeenCalledWith({ viewport: { width: 1920, height: 1080 }, reducedMotion: 'no-preference' });
    expect(f.page.addStyleTag).toHaveBeenCalledWith({ content: '.hint{display:none!important}' });
    expect(f.stage.shadowRoot.append).toHaveBeenCalled();
    await deckStageDriver({ chromium: f.chromium, hide: [] }).open('u');
    expect(f.chromium.launch).toHaveBeenLastCalledWith({});
    expect(f.page.addStyleTag).toHaveBeenCalledTimes(1);
  });

  it('makes a click forward, pauses every animation, steps them and takes a frame', async () => {
    const f = fakeChromium();
    const driver = deckStageDriver({ chromium: f.chromium });
    await driver.open('u');
    await driver.step(1);                                   // the first click: as the deck opens
    expect(f.page.keyboard.press).not.toHaveBeenCalled();
    f.stage.index = 0;
    await driver.step(3);                                   // a jump to click 2, then one step on
    expect(f.stage.goTo).toHaveBeenCalledWith(1);
    expect(f.page.keyboard.press).toHaveBeenCalledWith('ArrowRight');
    expect(await driver.freeze()).toBe(700);                // the looping one does not count
    expect(f.anims.every((a) => a.pause.mock.calls.length === 1)).toBe(true);
    await driver.seek(350);
    expect(f.anims.map((a) => a.currentTime)).toEqual([350, 350]);
    await driver.shot('/f.png');
    expect(f.page.screenshot).toHaveBeenCalledWith({ path: '/f.png' });
    await driver.close();
    expect(f.browser.close).toHaveBeenCalled();
    f.stage.index = 5;
    f.page.keyboard.press.mockImplementationOnce(async () => {});
    await expect(driver.step(2)).rejects.toThrow('click 2: the deck is on 1');
  });
});
