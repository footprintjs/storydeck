// pptx — a deck as a PowerPoint file: one slide per click, its settled picture, its notes, its clip. Node.
//
//   await exportPptx({ url: 'file:///…/deck.html', steps, out: 'out/talk.pptx', driver: deckStageDriver({ chromium }) });
//   // → out/talk.pptx — a slide per click: the picture full-bleed, the notes as speaker notes, the label as the
//   //   (off-page) title; with clips, each slide plays its clip and moves on: a narrated deck that runs by itself
//
// The export is a footprintjs flowchart, so every run leaves a record that explains it (`narrative`, also on a
// refusal's error): PlanClicks → GatherClips → CheckClips? → TimeTheDeck → ShootPictures → CheckPictures? →
// WriteParts → Zip → CheckPackage → Verdict? → Deliver. Each `?` is a decide() whose evidence names what it
// weighed — a clip that is missing, unplayable, longer than `maxClip` or never voiced; a click without a 16:9 PNG;
// a package that does not read back as planned — and a refusal names each click and its fix. The browser is
// video.js's port ({ open, step, freeze, seek, shot, close }; `deckStageDriver` from footprint-storydeck/video), so
// a deck that films exports. The parts (pptxParts), the ZIP (zip) and the read-back (checkPptx) are plain
// functions, also exported. footprintjs is imported when an export runs, never by the deck's browser runtime.
import { Buffer } from 'node:buffer';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { clipFor } from 'footprint-narration/voice';
import { narrationText, writtenText } from './narration.js';
import { planVideo } from './video.js';
import { pptxParts, pngSize, plainText, AUDIO } from './pptxParts.js';
import { zip } from './zip.js';
import { checkPptx } from './pptxCheck.js';

export { pptxParts } from './pptxParts.js';
export { zip, unzip } from './zip.js';
export { checkPptx } from './pptxCheck.js';

const NUM = (n) => String(n).padStart(3, '0');
const extOf = (file) => path.extname(file ?? '').slice(1).toLowerCase();
/** A click's notes in a deck: narration-html's notesData entry ({ now }), one string, or a list of them. */
const notesOf = (click) => click.notes?.now ?? click.notes ?? '';

/** The steps to export: `steps` as given, or made from the `deck`'s clicks; a step without a clip of its own asks `voice` for one. */
function stepsFrom({ steps, deck, voice }) {
  if (Boolean(steps) === Boolean(deck)) {
    throw new TypeError(`exportPptx: give \`steps\` (as renderVideo takes them) or \`deck\` (the clicks with their notes)${steps ? ', not both' : ''}`);
  }
  if (!Array.isArray(steps ?? deck)) throw new TypeError(`exportPptx: \`${steps ? 'steps' : 'deck'}\` is not a list — give one entry per click`);
  if (voice && (!voice.cache || !voice.profile)) throw new TypeError('exportPptx: `voice` needs { cache, profile } — the clip cache folder and the profile the clips were voiced with');
  const rules = { spell: voice?.spell, say: voice?.say };
  const list = steps ?? deck.map((c) => ({ label: c.label, headline: c.headline, written: writtenText(notesOf(c)), spoken: narrationText(notesOf(c), rules) }));
  return voice ? list.map((s) => ('clip' in s ? s : { ...s, clip: clipFor(s.spoken ?? '', voice) })) : list;
}

/**
 * Each click as a slide: its number, title (headline, else label, else "Slide n"), notes as written, words as
 * spoken, clip, and — when any click has a clip — how long it stays (s: its clip, or `noclip` without one, plus
 * `gap`; video.js · planVideo's timing without the lead-in). Without clips no slide advances by itself: the speaker clicks.
 */
function planClicks(list, { gap, noclip, only }) {
  const plan = planVideo(list, { gap, noclip, only, lead: 0 }), voiced = plan.some((c) => c.clip);
  return plan.map((c) => {
    const s = list[c.n - 1], title = plainText(s.headline || s.label || '').replace(/\s+/g, ' ').trim();
    return {
      n: c.n, title: title || `Slide ${c.n}`, notes: plainText(c.written).replace(/\r\n?/g, '\n'), spoken: c.spoken,
      clip: c.clip && { key: c.clip.key ?? null, audio: c.clip.audio, duration: c.clip.duration },
      advance: voiced ? Math.round(c.length * 1000) / 1000 : null,
    };
  });
}

/** What is wrong with the clicks' sound, by kind — each line names the click and the fix. */
function weighClips(clicks, maxClip) {
  const voiced = clicks.some((c) => c.clip), found = { missing: [], unplayable: [], tooLong: [], unvoiced: [] };
  for (const c of clicks) {
    const clip = c.clip, d = clip?.duration;
    if (!clip) {
      if (voiced && c.spoken.trim()) found.unvoiced.push(`click ${c.n} says words but has no clip — voice it (footprint-narration/voice · voiceClips), or give its step its clip`);
    } else if (!clip.audio || !existsSync(clip.audio)) {
      found.missing.push(`click ${c.n}: its clip ${clip.audio} is not there — voice it again (footprint-narration/voice · voiceClips)`);
    } else if (!AUDIO[extOf(clip.audio)]) {
      found.unplayable.push(`click ${c.n}: its clip is .${extOf(clip.audio)} — PowerPoint plays .wav, .m4a and .mp3 (convert it with ffmpeg)`);
    } else if (!(d > 0) || !Number.isFinite(d)) {
      found.unplayable.push(`click ${c.n}: its clip has no length (duration ${d}) — voice it again, so its cache records one`);
    } else if (d > maxClip) {
      found.tooLong.push(`click ${c.n}: its clip lasts ${d} s, over maxClip (${maxClip} s) — split its notes across clicks, or raise maxClip`);
    }
  }
  return found;
}

/** The rules a deck's clips are refused by, each naming what it saw; none fires when every clip is ready. */
const clipRules = (maxClip) => [
  { when: { clipsMissing: { gt: 0 } }, then: 'refuse-clips', label: 'A clip\'s sound file is not there' },
  { when: { clipsUnplayable: { gt: 0 } }, then: 'refuse-clips', label: 'A clip PowerPoint cannot play' },
  { when: { clipsTooLong: { gt: 0 } }, then: 'refuse-clips', label: `A clip lasts over maxClip (${maxClip} s)` },
  { when: { clipsUnvoiced: { gt: 0 } }, then: 'refuse-clips', label: 'A click says words with no clip, in a voiced deck' },
];

/** Each click's settled picture, through the driver: made forward, its entrance played to its end (at most maxEntrance ms), one PNG. */
async function settledPictures(driver, url, clicks, dir, { maxEntrance, log }) {
  rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true });
  const files = [];
  try {
    await driver.open(url);   // inside the try: a page that fails to open still closes its browser
    for (const c of clicks) {
      await driver.step(c.n);
      await driver.seek(Math.min(maxEntrance, await driver.freeze()));
      const file = path.join(dir, `c${NUM(c.n)}.png`);
      await driver.shot(file);
      files.push(file);
      log(`picture: click ${c.n}`);
    }
  } finally {
    await driver.close();
  }
  return files;
}

/** Each picture weighed: there, a PNG, 16:9. Returns its size per click, and a line per click without a usable one. */
function weighPictures(clicks, files) {
  const pictures = [], problems = [];
  clicks.forEach((c, i) => {
    const size = existsSync(files[i]) ? pngSize(readFileSync(files[i])) : undefined;
    if (size === undefined) problems.push(`click ${c.n}: the driver's shot() left no picture at ${files[i]} — check the driver (shot(file) must write the page's picture there)`);
    else if (!size) problems.push(`click ${c.n}: its picture is not a PNG — the driver's shot(file) must write a PNG (Playwright does, for a .png path)`);
    else if (Math.abs(size.width / size.height - 16 / 9) > 0.01) problems.push(`click ${c.n}: its picture is ${size.width}×${size.height}, not 16:9 — give the driver a 16:9 viewport (deckStageDriver's default is 1920×1080)`);
    pictures.push({ n: c.n, width: size?.width ?? null, height: size?.height ?? null });
  });
  return { pictures, problems };
}

/** The package as read back, against the plan: a slide per click, each with its title, notes, picture, sound and time. */
function mismatches(slides, clicks) {
  if (slides.length !== clicks.length) return [`the package has ${slides.length} slides for ${clicks.length} clicks`];
  return clicks.flatMap((c, i) => {
    const s = slides[i], at = `slide ${i + 1} (click ${c.n})`;
    return [
      s.title !== c.title && `${at}: its title reads "${s.title}", not "${c.title}"`,
      s.notes !== c.notes && `${at}: its notes do not read as the click's`,
      !s.pictures.length && `${at}: it has no picture`,
      s.audio.length !== (c.clip ? 1 : 0) && `${at}: it carries ${s.audio.length} sounds, for ${c.clip ? 'one clip' : 'no clip'}`,
      s.advance !== c.advance && `${at}: it advances after ${s.advance} s, not ${c.advance}`,
    ].filter(Boolean);
  });
}

/** A refusal: the problems the record holds under `key`, each with its fix, after `what`. */
const refusal = (key, what) => (scope) => {
  throw new Error(`exportPptx: ${what}: ${scope[key].join('; ')}`);
};

// The stages. Each reads what the record holds and writes what it decided; the bytes (pictures, parts) stay in
// the work folder and in `ctx.box`, out of the record.

function planStage(scope, ctx) {
  const list = stepsFrom(ctx), clicks = planClicks(list, ctx);
  if (!clicks.length) throw new RangeError(`exportPptx: nothing to export — no click in ${ctx.only ? `[${ctx.only.join(', ')}]` : 'the deck'} (it has ${list.length})`);
  scope.clicks = clicks;
  scope.voiced = clicks.filter((c) => c.clip).length;
}

function gatherStage(scope, ctx) {
  const found = weighClips(scope.$getValue('clicks'), ctx.maxClip);
  scope.clipsMissing = found.missing.length;
  scope.clipsUnplayable = found.unplayable.length;
  scope.clipsTooLong = found.tooLong.length;
  scope.clipsUnvoiced = found.unvoiced.length;
  scope.clipProblems = [...found.missing, ...found.unplayable, ...found.tooLong, ...found.unvoiced];
}

function timeStage(scope) {
  const clicks = scope.$getValue('clicks');
  scope.runtime = clicks.some((c) => c.clip) ? Math.round(clicks.reduce((s, c) => s + c.advance, 0) * 1000) / 1000 : null;
}

async function shootStage(scope, ctx) {
  const clicks = scope.$getValue('clicks'), files = await settledPictures(ctx.driver, ctx.url, clicks, ctx.pictures, ctx);
  const { pictures, problems } = weighPictures(clicks, files);
  scope.pictures = pictures;
  scope.unpictured = problems.length;
  scope.pictureProblems = problems;
}

function writeStage(scope, ctx) {
  const slides = scope.$getValue('clicks').map((c) => ({
    title: c.title, notes: c.notes, advance: c.advance, picture: readFileSync(path.join(ctx.pictures, `c${NUM(c.n)}.png`)),
    audio: c.clip && { data: readFileSync(c.clip.audio), ext: extOf(c.clip.audio), duration: c.clip.duration, key: c.clip.key ?? `click ${c.n}` },
  }));
  ctx.box.parts = pptxParts({ slides, title: ctx.title, lang: ctx.lang });
  scope.parts = ctx.box.parts.map((p) => ({ name: p.name, bytes: Buffer.byteLength(p.data) }));
}

function zipStage(scope, ctx) {
  const data = zip(ctx.box.parts);
  ctx.box.parts = null;
  writeFileSync(ctx.packed, data);
  scope.package = { bytes: data.length, entries: scope.$getValue('parts').length };
  ctx.log(`zip: ${data.length} bytes`);
}

function checkStage(scope, ctx) {
  const { slides, problems } = checkPptx(readFileSync(ctx.packed)), found = [...problems, ...mismatches(slides, scope.$getValue('clicks'))];
  scope.packageProblems = found;
  scope.broken = found.length;
}

function deliverStage(scope, ctx) {
  mkdirSync(path.dirname(ctx.file), { recursive: true });
  copyFileSync(ctx.packed, ctx.file);
  scope.delivered = ctx.file;
  ctx.log(`pptx: ${ctx.file}`);
}

/** The engine's own lines go to `log` (a refusal is thrown to the caller, so it is not printed twice). */
const quiet = () => {};
const quietLogger = (log) => ({ info: quiet, log: quiet, debug: quiet, error: quiet, warn: (...words) => log(`footprintjs: ${words.map(String).join(' ')}`) });

/** The export as a flowchart: each stage a step of the record, each `decide()` a verdict with its evidence. */
function exportChart(ctx) {
  const { flowChart, decide } = ctx;
  return flowChart('PlanClicks', (scope) => planStage(scope, ctx), 'plan-clicks', { description: 'Each click as a slide: its title, notes, clip and time' })
    .setLogger(quietLogger(ctx.log))
    .addFunction('GatherClips', (scope) => gatherStage(scope, ctx), 'gather-clips', 'Each clip found and weighed: its file, its kind, its length')
    .addDeciderFunction('CheckClips', (scope) => decide(scope, clipRules(ctx.maxClip), { branch: 'time', label: 'Every clip is there, playable and within maxClip' }),
      'check-clips', 'Is every clip there, playable and short enough?')
      .addFunctionBranch('time', 'TimeTheDeck', timeStage, 'How long the deck runs by itself (null: the speaker clicks)')
      .addFunctionBranch('refuse-clips', 'RefuseClips', refusal('clipProblems', 'a clip is not ready'), 'Refuse, naming each clip and its fix')
      .end()
    // footprintjs takes no decider straight after another's end(): a plain stage stands between them
    .addFunction('ShootPictures', (scope) => shootStage(scope, ctx), 'shoot-pictures', 'The settled picture of each click, through the driver')
    .addDeciderFunction('CheckPictures', (scope) => decide(scope, [{ when: { unpictured: { gt: 0 } }, then: 'refuse-pictures', label: 'A click has no usable picture' }],
      { branch: 'write', label: 'Every click has a 16:9 PNG' }), 'check-pictures', 'Has every click a usable picture?')
      .addFunctionBranch('write', 'WriteParts', (scope) => writeStage(scope, ctx), 'The parts: slides, notes, media, masters, theme, content types')
      .addFunctionBranch('refuse-pictures', 'RefusePictures', refusal('pictureProblems', 'a click has no usable picture'), 'Refuse, naming each click and its fix')
      .end()
    .addFunction('Zip', (scope) => zipStage(scope, ctx), 'zip', 'The parts in one ZIP')
    .addFunction('CheckPackage', (scope) => checkStage(scope, ctx), 'check-package', 'The package read back: well-formed, typed, linked, a slide per click')
    .addDeciderFunction('Verdict', (scope) => decide(scope, [{ when: { broken: { gt: 0 } }, then: 'refuse-package', label: 'The package failed its check' }],
      { branch: 'deliver', label: 'The package reads back whole' }), 'verdict', 'Did the package pass its check?')
      .addFunctionBranch('deliver', 'Deliver', (scope) => deliverStage(scope, ctx), 'The checked package copied to out')
      .addFunctionBranch('refuse-package', 'RefusePackage', refusal('packageProblems', 'the package failed its check, so nothing was written to out (name a `work` folder to keep it)'),
        'Refuse, naming each problem')
      .end()
    .build();
}

/** Where the file goes: `out` itself when it ends in .pptx, else <name>.pptx in the folder `out`. */
const fileOf = (out, name) => (/\.pptx$/i.test(out) ? path.resolve(out) : path.join(path.resolve(out), `${name}.pptx`));
const narrativeOf = (executor) => executor.getNarrativeEntries().map((e) => e.text);

/**
 * Exports the deck at `url` as a .pptx: one slide per click (`steps`, as renderVideo takes them, or `deck`, the clicks
 * with their notes — `voice` ({ cache, profile, spell?, say? }) finds a click's clip when its step gives none). With
 * clips, each slide plays its clip and advances after it plus `gap` (a click without one after `noclip` plus `gap`). The
 * pictures are made in `work` (its pictures/ is replaced) — by default a temporary folder, removed afterwards. A
 * click whose clip or picture is not usable, or a package that does not read back, is refused, naming the fix, and
 * nothing is written to `out`. Returns { file, slides, voiced, runtime (s the deck runs by itself, or null), bytes,
 * clicks, narrative }; a refusal's error carries the `narrative` too.
 */
export async function exportPptx({ url, steps, deck, voice, out, name = 'deck', title, lang = 'en-US', driver, gap = 0.6, noclip = 2.5, maxClip = 300,
  maxEntrance = 4000, only = null, work, log = () => {} }) {
  if (!url) throw new TypeError('exportPptx: no url — give the deck page, e.g. file:///…/deck.html');
  if (!driver) throw new TypeError('exportPptx: no driver — give one, e.g. deckStageDriver({ chromium }) from footprint-storydeck/video');
  if (!out) throw new TypeError('exportPptx: no out — give a folder (the file is <name>.pptx in it) or a path ending in .pptx');
  const { flowChart, FlowChartExecutor, decide } = await import('footprintjs');
  const file = fileOf(out, name);
  const ctx = { flowChart, decide, url, steps, deck, voice, file, title: title ?? path.basename(file, path.extname(file)), lang, driver, gap, noclip, maxClip,
    maxEntrance, only, log, box: {} };
  const executor = new FlowChartExecutor(exportChart(ctx));
  executor.enableNarrative();
  // the work folder last, so nothing before the try can leave a temporary one behind; the stages read it as they run
  const own = !work, dir = own ? mkdtempSync(path.join(tmpdir(), 'storydeck-pptx-')) : path.resolve(work);
  Object.assign(ctx, { pictures: path.join(dir, 'pictures'), packed: path.join(dir, path.basename(file)) });
  try {
    mkdirSync(dir, { recursive: true });
    await executor.run();
  } catch (error) {
    if (error instanceof Error) error.narrative = narrativeOf(executor);
    throw error;
  } finally {
    if (own) rmSync(dir, { recursive: true, force: true });
  }
  const { clicks, voiced, runtime, package: pkg } = executor.getSnapshot().sharedState;
  return { file, slides: clicks.length, voiced, runtime, bytes: pkg.bytes, clicks, narrative: narrativeOf(executor) };
}
