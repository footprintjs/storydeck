import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { clipKey } from 'footprint-story/voice';
import { narrationText } from './narration.js';
import { solidPng } from './pptxParts.js';
import { exportPptx, checkPptx, pptxParts, zip, unzip } from './pptx.js';

// the read-back, passed through as it is — unless a test makes it disagree with the plan
const readBack = vi.hoisted(() => ({ edit: null }));
vi.mock('./pptxCheck.js', async (original) => {
  const real = await original();
  return { ...real, checkPptx: (data) => (readBack.edit ? readBack.edit(real.checkPptx(data)) : real.checkPptx(data)) };
});

let dir;
beforeEach(() => { dir = mkdtempSync(path.join(tmpdir(), 'sd-pptx-')); });
afterEach(() => { readBack.edit = null; rmSync(dir, { recursive: true, force: true }); });

/** A real 0.1 s WAV (8 kHz mono), its bytes made a little different per key: each clip its own sound. */
const TONE = readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'tone-0.1s.wav'));
const toneFor = (key) => { const bytes = Buffer.from(TONE); bytes[100] ^= key.charCodeAt(key.length - 1); return bytes; };
/** A clip as footprint-story/voice's clipFor gives it, its sound a small file in the test's folder (`bytes` to give other ones). */
function clip(key, duration, ext = 'wav', bytes = toneFor(key)) {
  const audio = path.join(dir, `${key}.${ext}`);
  writeFileSync(audio, bytes);
  return { key, audio, duration, sentences: [0], words: null };
}
const steps = () => [
  { label: 'Intro', written: 'Hello. There.', spoken: 'Hello. There.', clip: clip('k1', 3) },
  { label: 'Part 1 · Two ways in', written: '', spoken: '', clip: null },
  { label: 'Part 1 · Two ways in · 1', headline: 'Two ways in', written: 'On 2000.', spoken: 'On two thousand.', clip: clip('k2', 2) },
];

/** A browser stand-in: a click's entrance lasts what `ends` says; each picture a small 16:9 PNG (or what `picture` writes). */
function fakeDriver({ ends = {}, picture = (n) => solidPng(192, 108, [n * 40, 0, 0]) } = {}) {
  const log = [];
  let n = 0;
  return {
    log,
    open: vi.fn(async (url) => log.push(`open ${url}`)),
    step: vi.fn(async (k) => { n = k; log.push(`step ${k}`); }),
    freeze: vi.fn(async () => ends[n] ?? 0),
    seek: vi.fn(async (ms) => log.push(`seek ${ms}`)),
    shot: vi.fn(async (file) => { const bytes = picture(n); if (bytes) writeFileSync(file, bytes); log.push(`shot ${path.basename(file)}`); }),
    close: vi.fn(async () => log.push('close')),
  };
}
const read = (file) => checkPptx(readFileSync(file));

describe('pptx · a deck as PowerPoint', () => {
  it('makes a slide per click — its settled picture, its notes, its title — and with clips each plays and moves on', async () => {
    const driver = fakeDriver({ ends: { 1: 700, 3: 99999 } }), lines = [], out = path.join(dir, 'out');
    const done = await exportPptx({ url: 'file:///deck.html', steps: steps(), out, name: 'talk', driver, log: (l) => lines.push(l) });
    expect(driver.log).toEqual(['open file:///deck.html', 'step 1', 'seek 700', 'shot c001.png', 'step 2', 'seek 0', 'shot c002.png', 'step 3', 'seek 4000', 'shot c003.png', 'close']);
    expect(done.file).toBe(path.join(out, 'talk.pptx'));
    expect(readdirSync(out)).toEqual(['talk.pptx']);
    expect(done).toMatchObject({ slides: 3, voiced: 2, runtime: 3.6 + 3.1 + 2.6, bytes: statSync(done.file).size });
    const { slides, problems } = read(done.file);
    expect(problems).toEqual([]);
    expect(slides.map((s) => [s.title, s.notes, s.audio.length, s.advance])).toEqual([
      ['Intro', 'Hello. There.', 1, 3.6], ['Part 1 · Two ways in', '', 0, 3.1], ['Two ways in', 'On 2000.', 1, 2.6],   // the headline before the label
    ]);
    const media = unzip(readFileSync(done.file)).filter((e) => e.name.startsWith('ppt/media/media'));
    expect(media.map((e) => [e.name, Buffer.compare(e.data, toneFor(e.name === 'ppt/media/media1.wav' ? 'k1' : 'k2'))])).toEqual([['ppt/media/media1.wav', 0], ['ppt/media/media2.wav', 0]]);
    expect(lines).toEqual(['picture: click 1', 'picture: click 2', 'picture: click 3', expect.stringMatching(/^zip: \d+ bytes$/), `pptx: ${done.file}`]);
    expect(done.clicks[0]).toEqual({ n: 1, title: 'Intro', notes: 'Hello. There.', spoken: 'Hello. There.', clip: { key: 'k1', audio: path.join(dir, 'k1.wav'), duration: 3 }, advance: 3.6 });
  });

  it('leaves its record: each stage, and each verdict with what it weighed', async () => {
    const done = await exportPptx({ url: 'u', steps: steps(), out: dir, driver: fakeDriver() });
    expect(done.narrative.filter((l) => l.startsWith('[Condition]'))).toEqual([
      '[Condition]: No rules matched, fell back to default "Every clip is there, playable and within maxClip": TimeTheDeck.',
      '[Condition]: No rules matched, fell back to default "Every click has a 16:9 PNG": WriteParts.',
      '[Condition]: No rules matched, fell back to default "The package reads back whole": Deliver.',
    ]);
    expect(done.narrative).toEqual(expect.arrayContaining(['Step 2: Write runtime = 9.3', 'Step 3: Write broken = 0', 'Step 3: Write unpictured = 0']));
    expect(done.narrative.filter((l) => l.startsWith('Stage ')).length).toBe(11);
  });

  it('leaves the speaker to click when no click has a clip', async () => {
    const silent = steps().map((s) => ({ ...s, clip: null }));
    const done = await exportPptx({ url: 'u', steps: silent, out: path.join(dir, 'notes-only.pptx'), driver: fakeDriver() });
    expect(done.file).toBe(path.join(dir, 'notes-only.pptx'));
    expect(done).toMatchObject({ voiced: 0, runtime: null });
    expect(read(done.file).slides.map((s) => [s.advance, s.audio.length])).toEqual([[null, 0], [null, 0], [null, 0]]);
    expect(String(unzip(readFileSync(done.file)).find((e) => e.name === 'docProps/core.xml').data)).toContain('<dc:title>notes-only</dc:title>');
  });

  it('makes the steps from the deck\'s clicks and finds each clip in the voice cache, by the words it says', async () => {
    const profile = { id: 'me' }, cache = path.join(dir, 'cache'), spell = { UI: 'you eye' };
    mkdirSync(cache);
    const voiceOf = (notes, duration) => {
      const key = clipKey(narrationText(notes, { spell }), profile);
      writeFileSync(path.join(cache, `${key}.json`), JSON.stringify({ duration, sentences: [0] }));
      writeFileSync(path.join(cache, `${key}.wav`), toneFor(key));
      return key;
    };
    const deck = [
      { label: 'Title', notes: { now: ['A UI, said.', '[draft] And a bridge.'], earlier: [] } },
      { label: 'Two', headline: 'The second', notes: 'Second words.' },
      { label: 'Quiet' },
      { label: 'Lines', notes: 'A line,\n  then   another.' },
    ];
    const keys = [voiceOf(deck[0].notes.now, 2), voiceOf('Second words.', 1.5), voiceOf(deck[3].notes, 2.5)];
    const done = await exportPptx({ url: 'u', deck, voice: { cache, profile, spell }, out: dir, driver: fakeDriver(), title: 'My talk' });
    expect(done.clicks.map((c) => [c.title, c.notes, c.clip?.key ?? null, c.advance])).toEqual([
      ['Title', 'A UI, said.\nAnd a bridge.', keys[0], 2.6], ['The second', 'Second words.', keys[1], 2.1], ['Quiet', '', null, 3.1],   // noclip plus gap, as planVideo times it
      ['Lines', 'A line,\nthen another.', keys[2], 3.1],
    ]);
    // a paragraph per note and per line, on the notes page too
    const notes = String(unzip(readFileSync(done.file)).find((e) => e.name === 'ppt/notesSlides/notesSlide1.xml').data);
    expect(notes).toContain('<a:t>A UI, said.</a:t></a:r></a:p><a:p><a:r><a:rPr lang="en-US" dirty="0"/><a:t>And a bridge.</a:t>');
    expect(read(done.file).slides.map((s) => s.notes)).toEqual(['A UI, said.\nAnd a bridge.', 'Second words.', '', 'A line,\nthen another.']);
    expect(done.clicks[0].spoken).toContain('you eye');
    expect(String(unzip(readFileSync(done.file)).find((e) => e.name === 'docProps/core.xml').data)).toContain('<dc:title>My talk</dc:title>');
    // a step that carries its own clip (even none) keeps it; one without asks the voice
    const mixed = await exportPptx({ url: 'u', steps: [{ label: 'a', spoken: '', clip: null }, { label: 'b', spoken: 'Second words.', written: 'Second words.' }],
      voice: { cache, profile }, out: path.join(dir, 'mixed'), driver: fakeDriver() });
    expect(mixed.clicks.map((c) => c.clip?.key ?? null)).toEqual([null, keys[1]]);
  });

  it('exports a strip — the clicks in `only` — numbering each by its click', async () => {
    const driver = fakeDriver();
    const done = await exportPptx({ url: 'u', steps: [{}, {}, ...steps()], only: [2, 3], out: dir, driver });
    expect(driver.step.mock.calls.map(([n]) => n)).toEqual([2, 3]);
    expect(done.clicks.map((c) => [c.n, c.title])).toEqual([[2, 'Slide 2'], [3, 'Intro']]);
    expect(read(done.file).slides).toHaveLength(2);
  });

  it('makes its pictures in a temporary folder, removed afterwards — or in `work`, kept; paths may be relative', async () => {
    const seen = [], driver = fakeDriver();
    driver.shot.mockImplementation(async (file) => { seen.push(file); writeFileSync(file, solidPng(16, 9)); });
    await exportPptx({ url: 'u', steps: steps(), out: dir, driver });
    expect(existsSync(path.dirname(path.dirname(seen[0])))).toBe(false);
    const was = process.cwd();
    process.chdir(dir);
    try {
      const done = await exportPptx({ url: 'u', steps: steps(), out: 'rel/out', work: 'rel/work', driver: fakeDriver() });
      expect(done.file).toBe(path.join(process.cwd(), 'rel', 'out', 'deck.pptx'));
      expect(readdirSync(path.join(dir, 'rel', 'work')).sort()).toEqual(['deck.pptx', 'pictures']);
      expect(readdirSync(path.join(dir, 'rel', 'work', 'pictures'))).toEqual(['c001.png', 'c002.png', 'c003.png']);
    } finally {
      process.chdir(was);
    }
  });
});

describe('pptx · what it refuses, and why', () => {
  /** The export's refusal, with its record. */
  async function refusal(options) {
    const driver = options.driver ?? fakeDriver();
    const error = await exportPptx({ url: 'u', out: path.join(dir, 'out'), driver, ...options }).then(() => null, (e) => e);
    expect(error, 'the export was not refused').toBeInstanceOf(Error);
    expect(existsSync(path.join(dir, 'out'))).toBe(false);   // nothing written to out
    return { error, driver, condition: error.narrative?.find((l) => l.startsWith('[Condition]')) };
  }

  it('refuses a clip whose file is gone, before a browser opens', async () => {
    const given = steps();
    rmSync(given[2].clip.audio);
    const { error, driver, condition } = await refusal({ steps: given });
    expect(error.message).toBe(`exportPptx: a clip is not ready: click 3: its clip ${given[2].clip.audio} is not there — voice it again (footprint-story/voice · voiceClips)`);
    expect(condition).toBe('[Condition]: It evaluated Rule 0 "A clip\'s sound file is not there": clipsMissing 1 gt 0 ✓, and chose RefuseClips.');
    expect(driver.open).not.toHaveBeenCalled();
  });

  it('refuses a clip PowerPoint cannot play, or one without a length', async () => {
    const odd = steps();
    odd[0].clip = clip('k9', 2, 'ogg');
    odd[2].clip.duration = NaN;
    const { error, condition } = await refusal({ steps: odd });
    expect(error.message).toBe('exportPptx: a clip is not ready: click 1: its clip is .ogg — PowerPoint plays .wav, .m4a and .mp3 (convert it with ffmpeg); '
      + 'click 3: its clip has no length (duration NaN) — voice it again, so its cache records one');
    expect(condition).toContain('"A clip PowerPoint cannot play": clipsUnplayable 2 gt 0 ✓');
  });

  it('refuses a clip whose bytes are not its kind of sound — empty, or garbage in a .wav — before a browser opens', async () => {
    const odd = steps();
    odd[0].clip = clip('empty', 1, 'wav', Buffer.alloc(0));
    odd[2].clip = clip('garbage', 1, 'wav', Buffer.from('this is not a wave file at all'));
    const { error, driver, condition } = await refusal({ steps: odd });
    expect(error.message).toBe(`exportPptx: a clip is not ready: click 1: its clip ${odd[0].clip.audio} is empty (0 bytes) — voice it again (footprint-story/voice · voiceClips); `
      + `click 3: its clip ${odd[2].clip.audio} is not a .wav file (no RIFF…WAVE) — voice it again, or convert it with ffmpeg`);
    expect(condition).toBe('[Condition]: It evaluated Rule 1 "A clip PowerPoint cannot play": clipsUnplayable 2 gt 0 ✓, and chose RefuseClips.');
    expect(driver.open).not.toHaveBeenCalled();
    expect(error.narrative.some((l) => l.includes('ShootPictures'))).toBe(false);   // refused at CheckClips, before shooting
    const mp3 = steps();
    mp3[0].clip = clip('k1', 1, 'mp3', Buffer.from('RIFF....WAVE: a WAV named .mp3'));
    expect((await refusal({ steps: mp3 })).error.message).toContain('is not a .mp3 file (no ID3, or an MP3 frame sync)');
  });

  it('refuses a clip longer than maxClip, naming the fix', async () => {
    const { error, condition } = await refusal({ steps: steps(), maxClip: 2.5 });
    expect(error.message).toBe('exportPptx: a clip is not ready: click 1: its clip lasts 3 s, over maxClip (2.5 s) — split its notes across clicks, or raise maxClip');
    expect(condition).toBe('[Condition]: It evaluated Rule 2 "A clip lasts over maxClip (2.5 s)": clipsTooLong 1 gt 0 ✓, and chose RefuseClips.');
  });

  it('refuses a click that says words with no clip, in a deck that has a voice', async () => {
    const given = steps();
    given[2].clip = null;
    const { error, condition } = await refusal({ steps: given });
    expect(error.message).toBe('exportPptx: a clip is not ready: click 3: it says words but has no clip — voice it (footprint-story/voice · voiceClips), or give its step its clip');
    expect(condition).toContain('"A click says words with no clip, in a voiced deck": clipsUnvoiced 1 gt 0 ✓');
  });

  it('refuses a click without a usable picture — none, not a PNG, not 16:9 — and closes the browser', async () => {
    const pictures = { 1: null, 2: Buffer.from('\xff\xd8\xff a JPEG, say'), 3: solidPng(40, 30) };
    const { error, driver, condition } = await refusal({ steps: steps(), driver: fakeDriver({ picture: (n) => pictures[n] }) });
    expect(error.message).toMatch(/^exportPptx: a click has no usable picture: click 1: the driver's shot\(\) left no picture at .*c001\.png — check the driver/);
    expect(error.message).toContain('click 2: its picture is not a PNG — the driver\'s shot(file) must write a PNG (Playwright does, for a .png path)');
    expect(error.message).toContain('click 3: its picture is 40×30, not 16:9 — give the driver a 16:9 viewport (deckStageDriver\'s default is 1920×1080)');
    expect(error.narrative).toContain('[Condition]: It evaluated Rule 0 "A click has no usable picture": unpictured 3 gt 0 ✓, and chose RefusePictures.');
    expect(condition).toContain('TimeTheDeck');   // the clips passed first
    expect(driver.close).toHaveBeenCalled();
  });

  it('refuses a package that does not read back as planned, and writes nothing to out', async () => {
    const cases = [
      [(r) => ({ ...r, problems: ['ppt/x.xml: not well-formed'] }), 'ppt/x.xml: not well-formed'],
      [(r) => ({ ...r, slides: r.slides.slice(1) }), 'the package has 2 slides for 3 clicks'],
      [(r) => ({ ...r, slides: r.slides.map((s, i) => (i ? s : { ...s, title: 'Other' })) }), 'slide 1 (click 1): its title reads "Other", not "Intro"'],
      [(r) => ({ ...r, slides: r.slides.map((s, i) => (i ? s : { ...s, notes: '' })) }), 'slide 1 (click 1): its notes do not read as the click\'s'],
      [(r) => ({ ...r, slides: r.slides.map((s, i) => (i ? s : { ...s, pictures: [] })) }), 'slide 1 (click 1): it has no picture'],
      [(r) => ({ ...r, slides: r.slides.map((s, i) => (i !== 1 ? s : { ...s, audio: ['x.wav'] })) }), 'slide 2 (click 2): it carries 1 sounds, for no clip'],
      [(r) => ({ ...r, slides: r.slides.map((s, i) => (i ? s : { ...s, audio: [] })) }), 'slide 1 (click 1): it carries 0 sounds, for one clip'],
      [(r) => ({ ...r, slides: r.slides.map((s, i) => (i ? s : { ...s, advance: 9 })) }), 'slide 1 (click 1): it advances after 9 s, not 3.6'],
    ];
    for (const [edit, problem] of cases) {
      readBack.edit = edit;
      const { error } = await refusal({ steps: steps() });
      expect(error.message).toBe(`exportPptx: the package failed its check, so nothing was written to out (name a \`work\` folder to keep it): ${problem}`);
      expect(error.narrative).toContain('[Condition]: It evaluated Rule 0 "The package failed its check": broken 1 gt 0 ✓, and chose RefusePackage.');
    }
    readBack.edit = (r) => ({ ...r, problems: ['kept'] });
    await refusal({ steps: steps(), work: path.join(dir, 'work') });
    expect(read(path.join(dir, 'work', 'deck.pptx')).problems).toEqual(['kept']);   // the package that failed, kept to look at
  });

  it('refuses a call it cannot start, naming what to give', async () => {
    const driver = fakeDriver();
    await expect(exportPptx({ steps: [], out: dir, driver })).rejects.toThrow('exportPptx: no url — give the deck page, e.g. file:///…/deck.html');
    await expect(exportPptx({ url: 'u', steps: [], out: dir })).rejects.toThrow('exportPptx: no driver — give one, e.g. deckStageDriver({ chromium }) from footprint-storydeck/video');
    await expect(exportPptx({ url: 'u', steps: [], driver })).rejects.toThrow('exportPptx: no out — give a folder (the file is <name>.pptx in it) or a path ending in .pptx');
    await expect(exportPptx({ url: 'u', out: dir, driver })).rejects.toThrow('exportPptx: give `steps` (as renderVideo takes them) or `deck` (the clicks with their notes)');
    await expect(exportPptx({ url: 'u', steps: [], deck: [], out: dir, driver })).rejects.toThrow('or `deck` (the clicks with their notes), not both');
    await expect(exportPptx({ url: 'u', deck: { clicks: [] }, out: dir, driver })).rejects.toThrow('exportPptx: `deck` is not a list — give one entry per click');
    await expect(exportPptx({ url: 'u', deck: [], voice: { profile: { id: 'me' } }, out: dir, driver })).rejects.toThrow('exportPptx: `voice` needs { cache, profile } — the clip cache folder and the profile the clips were voiced with');
    await expect(exportPptx({ url: 'u', steps: steps(), only: [7, 9], out: dir, driver })).rejects.toThrow('exportPptx: nothing to export — no click in [7, 9] (it has 3)');
    await expect(exportPptx({ url: 'u', steps: steps(), lang: 'English', out: dir, driver })).rejects.toThrow('exportPptx: lang "English" is not a language tag — give one like en-US, de or zh-Hant-TW');
    const empty = await exportPptx({ url: 'u', steps: [], out: dir, driver }).catch((e) => e);
    expect(empty.message).toBe('exportPptx: nothing to export — no click in the deck (it has 0)');
    expect(empty.narrative).toEqual(['[Error]: An error occurred at PlanClicks: RangeError: exportPptx: nothing to export — no click in the deck (it has 0).']);
    expect(driver.open).not.toHaveBeenCalled();
  });

  it('refuses to start without footprintjs (an optional peer), naming the install', async () => {
    const driver = fakeDriver(), missing = new Error("Cannot find package 'footprintjs' imported from pptx.js");
    const error = await exportPptx({ url: 'u', steps: steps(), out: path.join(dir, 'out'), driver, load: () => Promise.reject(missing) }).catch((e) => e);
    expect(error.message).toBe('exportPptx needs footprintjs: npm i footprintjs');
    expect(error.cause).toBe(missing);
    expect(driver.open).not.toHaveBeenCalled();
    expect(existsSync(path.join(dir, 'out'))).toBe(false);
    const loaded = await exportPptx({ url: 'u', steps: steps(), out: dir, driver: fakeDriver(), load: () => import('footprintjs') });
    expect(loaded.slides).toBe(3);   // a loader of the caller's own
  });

  it('closes the browser when the page does not open or a click fails, and says which', async () => {
    const broken = fakeDriver();
    broken.open.mockRejectedValueOnce(new Error('no deck-stage on the page'));
    await expect(exportPptx({ url: 'u', steps: steps(), out: dir, driver: broken })).rejects.toThrow('no deck-stage on the page');
    expect(broken.close).toHaveBeenCalledTimes(1);
    const stuck = fakeDriver();
    stuck.step.mockRejectedValueOnce(new Error('click 1: the deck is on 2'));
    const error = await exportPptx({ url: 'u', steps: steps(), out: dir, driver: stuck }).catch((e) => e);
    expect(error.message).toBe('click 1: the deck is on 2');
    expect(error.narrative.at(-1)).toContain('[Error]: An error occurred at ShootPictures');
    expect(stuck.close).toHaveBeenCalledTimes(1);
  });
});

describe('pptx · the door', () => {
  it('hands out the parts, the ZIP and the read-back, for pictures made elsewhere', () => {
    const data = zip(pptxParts({ slides: [{ title: 'One', notes: 'A note.', picture: solidPng(16, 9) }] }));
    expect(read.length).toBe(1);
    expect(checkPptx(data)).toMatchObject({ problems: [], slides: [{ title: 'One', notes: 'A note.' }] });
    expect(unzip(data)[0].name).toBe('[Content_Types].xml');
  });

  it('loads footprintjs only when an export runs: no module of the package imports it as it loads', () => {
    const root = path.dirname(new URL(import.meta.url).pathname);
    const sources = readdirSync(root).filter((f) => /\.(js|jsx)$/.test(f) && !f.includes('.test.') && !f.startsWith('vitest'));
    expect(sources).toEqual(expect.arrayContaining(['index.js', 'pptx.js', 'video.js']));
    for (const file of sources) expect(readFileSync(path.join(root, file), 'utf8'), file).not.toMatch(/^\s*(import|export)\b[^;]*?\bfrom\s+['"]footprintjs(\/[\w-]+)?['"]/m);
    expect(readFileSync(path.join(root, 'pptx.js'), 'utf8')).toContain("load = () => import('footprintjs')");
  });
});

// LibreOffice, where it is installed, opens the file and prints it to PDF: a reader we did not write. Never installed for this.
const hasSoffice = spawnSync('soffice', ['--version']).status === 0;
describe.skipIf(!hasSoffice)('pptx · opened by LibreOffice', () => {
  it('converts to a PDF with a page per slide', async () => {
    const done = await exportPptx({ url: 'u', steps: steps(), out: dir, driver: fakeDriver() });
    const run = spawnSync('soffice', ['--headless', '--convert-to', 'pdf', '--outdir', dir, done.file], { encoding: 'utf8', timeout: 120000 });
    expect(run.status, run.stderr).toBe(0);
    const pdf = readFileSync(path.join(dir, 'deck.pdf'), 'latin1');
    expect(pdf.startsWith('%PDF')).toBe(true);
    expect(pdf.match(/\/Type\s*\/Page[^s]/g)).toHaveLength(3);
  }, 150000);
});
