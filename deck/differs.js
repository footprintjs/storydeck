// differs — a part that differs from the real thing says so. A picture is believed: a process run 30 times faster, or a
// part drawn far larger than it is, reads as how the thing is unless the deck says otherwise. A part declares how it
// differs, and the deck says it on the slide, in the notes (what the voice says), or both:
//
//   <section data-label="Inside" data-differs-time="30" data-differs-scale="The dots are drawn far larger than real"
//            data-differs-said="thirty times faster">
//
//   data-differs-time    how many times faster it runs than the real thing (30; 0.04 is 25 times slower)
//   data-differs-scale   what is out of scale, in words
//   data-differs-analogy what stands in for what: everyday things standing in for the real ones ("An analogy: …" on the slide)
//   data-differs-shown   the words on the slide ("A | B" for two labels), or "false" for the notes alone (default: from the two above)
//   data-differs-said    the phrase of the part's notes that says it ("A | B" for one per statement; check refuses a phrase they do not hold)
//
// Every statement declared has a line or a phrase of its own, so none goes unstated. Values are read as a browser reads
// them: &amp; is &, &gt; is > (a bare > ends the tag, so it is refused), &#124; is a | that does not split. It reads what
// is declared, and cannot see a speed-up nobody declared. The same rule and words as StoryReel's differs.mjs: a deck and
// a film say it alike.
import {normSpeech} from 'footprint-story';
import {readAttributes} from '../pieceRules.js';
import {decodeEntities, esc} from './html.js';

/** The longest statement a label holds: a label is read in a glance, and the rest belongs in the notes. */
export const DIFFERS_MOST = 70;
/** The longest phrase data-differs-said names: the few words of the notes that say it, not a passage. */
export const DIFFERS_SAID_MOST = 120;
/** How far a time factor goes, faster or slower: past it no viewer reads the number, so it belongs in words (scale). */
export const DIFFERS_TIME_MOST = 1e9;
const NAMES = ['data-differs-time', 'data-differs-scale', 'data-differs-analogy', 'data-differs-shown', 'data-differs-said'];

const plain = (x) => String(+x.toFixed(x >= 10 ? 0 : 2));
/** A time factor in words: 30 → "Time shown 30 times faster"; 0.04 → "Time shown 25 times slower". */
export const timeWords = (time) => (time > 1 ? `Time shown ${plain(time)} times faster` : `Time shown ${plain(1 / time)} times slower`);
/** What an analogy's label says: "An analogy: everyday things stand in for the real ones". */
const ANALOGY = 'An analogy: ';
export const analogyWords = (text) => `${ANALOGY}${text}`;
/** The values a number may have and still be the declared factor: as written, and as the time words say it. */
const factorsOf = (time) => (time > 1 ? [time, +plain(time)] : [time, 1 / time, +plain(1 / time)]);

/** A value as a browser reads it, with spaces and control characters made one space: a declaration's words stay on one line wherever they are printed. */
const folded = (value) => decodeEntities(value).replace(/[\s\p{Cc}]+/gu, ' ').trim();

function words(value, name, where) {
  const text = folded(value);
  if (!text) throw new Error(`${where}: ${name} is empty — say it in words, or leave it out`);
  if (text.length > DIFFERS_MOST) throw new Error(`${where}: ${name} is ${text.length} characters, more than a label can hold in a glance (${DIFFERS_MOST}) — shorten it, and say the rest in the notes`);
  return text;
}

/** An analogy's words, checked with the room its label leaves them. */
function readAnalogy(value, where) {
  const text = words(value, 'data-differs-analogy', where), room = DIFFERS_MOST - ANALOGY.length;
  if (text.length > room) throw new Error(`${where}: data-differs-analogy is ${text.length} characters, more than its label can hold in a glance (${room}, after "${ANALOGY.trim()}") — shorten it, and say the rest in the notes`);
  return text;
}

/** A time factor from its attribute, checked: a number a label can say, neither real time nor past what a viewer reads. */
function readTime(value, where) {
  const factor = Number(folded(value)), what = `${where}: data-differs-time=${JSON.stringify(value)} — it is how many times faster the picture runs than the real thing (30; 0.04 is 25 times slower)`;
  if (!(folded(value) && Number.isFinite(factor) && factor > 0)) throw new Error(what);
  if (plain(factor > 1 ? factor : 1 / factor) === '1') throw new Error(`${what}: it reads as 1 time, and 1 is real time, so leave it out (a factor that shows is 1.01 or more, or 0.99 or less)`);
  if (factor > DIFFERS_TIME_MOST || factor < 1 / DIFFERS_TIME_MOST) throw new Error(`${what}: past ${DIFFERS_TIME_MOST} times either way no viewer reads the number, so say it in words in data-differs-scale`);
  return factor;
}

/** The phrases data-differs-said names, checked and folded ("A | B": one per statement); null when it names none. */
function readSaid(value, where) {
  if (value === null) return null;
  const phrases = value.split('|').map((one) => {
    const text = folded(one);
    if (!normSpeech(text)) throw new Error(`${where}: data-differs-said is empty — name the phrase of the part's notes that says how it differs, one per statement ("A | B")`);
    if (text.length > DIFFERS_SAID_MOST) throw new Error(`${where}: data-differs-said is ${text.length} characters, more than a phrase (${DIFFERS_SAID_MOST}) — name the few words that say it`);
    return text;
  });
  if (new Set(phrases.map(normSpeech)).size < phrases.length) throw new Error(`${where}: data-differs-said names the same phrase twice — one per statement`);
  return phrases;
}

/** The numbers written in a line, as digits (a digit inside a word, as in "H2O", is none of them). */
const figures = (line) => line.match(/(?<![\p{L}\p{N}])\d+(?:[.,]\d+)*/gu) ?? [];
/** A written number's values, whichever way a language writes it: 1,000 and 1.000 may be a thousand, 1,5 and 1.5 one and a half. */
const readings = (run) => [run.replace(/,/g, ''), run.replace(/\./g, ''), run.replace(/\./g, '').replace(',', '.')].map(Number);

/**
 * A number in the line that says the time, when it is not the declared factor: the line contradicts the declaration.
 * With time alone every line says it; with anything else too the first of two or more does (a line for each, the time
 * first); a single line beside a phrase cannot be told.
 */
function contradicting({time, scale, analogy}, lines) {
  if (time === undefined) return null;
  const says = scale === undefined && analogy === undefined ? lines : lines.length >= 2 ? [lines[0]] : [];
  return says.flatMap(figures).find((run) => !readings(run).some((v) => factorsOf(time).includes(v))) ?? null;
}

const DIFFERS_NAME = /^data-differs(-|$)/;
/** A <section> that says how it differs, when a ">" in a value cut its tag short: `attrs` is what the scan took for its attributes, `rest` what follows. */
const cutShort = (attrs, rest) => readAttributes(attrs) === null && /(^|\s)data-differs/i.test(attrs + rest.slice(0, Math.max(0, rest.indexOf('>'))));

/**
 * A part's declaration from its attributes, checked, each refusal naming the fix: {time?, scale?, shown: [the labels'
 * words], said?: [the phrases]}, or null when it declares none. `rest`: the text after the tag, where the rest of a tag
 * that a ">" in a value cut short would be.
 */
export function readDiffers(attrs, where, rest = '') {
  if (cutShort(attrs, rest)) throw new Error(`${where}: a ">" inside an attribute's value ends the tag, so its data-differs-* cannot be read — write &gt; for it`);
  const given = (readAttributes(attrs) ?? []).filter((a) => DIFFERS_NAME.test(a.name));
  if (!given.length) return null;
  const other = given.find((a) => !NAMES.includes(a.name));
  if (other) throw new Error(`${where}: ${other.name} is not a way to say how a part differs — the attributes are ${NAMES.join(', ')}`);
  const of = (name) => given.find((a) => a.name === name)?.value ?? null;
  const time = of('data-differs-time'), scale = of('data-differs-scale'), analogy = of('data-differs-analogy'), shown = of('data-differs-shown');
  const factor = time === null ? undefined : readTime(time, where);
  if (time === null && scale === null && analogy === null) throw new Error(`${where}: say how the part differs: data-differs-time (how many times faster it runs), data-differs-scale (what is out of scale, in words), data-differs-analogy (what stands in for what), or more than one`);
  const out = {...(factor === undefined ? {} : {time: factor}), ...(scale === null ? {} : {scale: words(scale, 'data-differs-scale', where)}), ...(analogy === null ? {} : {analogy: readAnalogy(analogy, where)})};
  const lines = shown?.trim().toLowerCase() === 'false' ? [] : shown === null ? [...(factor === undefined ? [] : [timeWords(factor)]), ...(out.scale ? [out.scale] : []), ...(out.analogy ? [analogyWords(out.analogy)] : [])]
    : shown.split('|').map((line) => words(line, 'data-differs-shown', where));
  const phrases = readSaid(of('data-differs-said'), where);
  if (!lines.length && !phrases) throw new Error(`${where}: data-differs-shown="false", so the notes must say it — name their phrase in data-differs-said`);
  const named = [...(factor === undefined ? [] : ['time']), ...(out.scale === undefined ? [] : ['scale']), ...(out.analogy === undefined ? [] : ['an analogy'])], statements = named.length, says = new Set(lines).size + (phrases?.length ?? 0);
  if (says < statements) throw new Error(`${where}: it declares ${statements === 2 ? `both ${named.join(' and ')}` : `${named.slice(0, -1).join(', ')} and ${named.at(-1)}`} and says only ${says} thing — give each its own line in data-differs-shown ("A | B") or its own phrase in data-differs-said ("A | B"), so ${statements === 2 ? 'neither' : 'none'} goes unstated`);
  const wrong = contradicting(out, lines);
  if (wrong !== null) throw new Error(`${where}: data-differs-shown says ${wrong} where data-differs-time says ${factor} — leave shown out for the default words, or write the number declared (and with anything else too, the time's line first)`);
  return {...out, shown: lines, ...(phrases ? {said: phrases} : {})};
}

/** A <step> cannot say how it differs: a part does. Refuses one that tries, naming where it goes. */
export function refuseStepDiffers(attrs, where) {
  const named = (readAttributes(attrs) ?? []).some((a) => DIFFERS_NAME.test(a.name)) || (readAttributes(attrs) === null && /(^|\s)data-differs/i.test(attrs));
  if (named) throw new Error(`${where}: a <step> cannot say how it differs — put data-differs-* on its <section>: a part says it on each of its slides`);
}

/**
 * The default time and analogy words are English: a deck in another language gives its own (data-differs-shown), or
 * false for the notes alone. A part's scale is its author's own words.
 */
export function refuseEnglishWords(differs, lang, where) {
  if (!differs || !lang || /^en\b/i.test(lang)) return;
  const english = [...(differs.time === undefined ? [] : [timeWords(differs.time)]), ...(differs.analogy === undefined ? [] : [analogyWords(differs.analogy)])].find((line) => differs.shown.includes(line));
  if (english) throw new Error(`${where}: "${english}" is English and the deck is in "${lang}" — give the words in its language (data-differs-shown), or "false" for the notes alone`);
}

/** The labels on a slide, or nothing: chrome, so they neither zoom with the map nor count as the slide's words. */
export const differsHtml = (d) => (d?.shown.length ? `<div class="differs" data-chrome>${d.shown.map((line) => `<span>${esc(line)}</span>`).join('')}</div>` : '');

/** What a label looks like: on the kicker's row, right-aligned. The page carries it only when a part shows one (page.js), so a deck that declares nothing is byte for byte as before. */
export const DIFFERS_CSS = `/* a part that differs from the real thing says so (deck/differs.js): labels on the kicker's row, right-aligned, clear of the theme toggle */
:where(.differs) { position: absolute; right: 110px; top: 44px; z-index: 4; display: flex; gap: 10px; justify-content: flex-end; max-width: 75%; flex-wrap: wrap; }
:where(.differs span) { padding: 8px 16px; border-radius: 20px; background: var(--fg, #14181f); color: var(--bg, #ffffff); font: 700 20px/1.2 var(--sans, system-ui, sans-serif); }`;

/**
 * Whether a part's notes (their words, as text) say the phrase, matched as a film matches a phrase in its narration:
 * words in order, case, spacing and punctuation aside, starting and ending where words do, so "fast" is not in "breakfast".
 */
export function saidInNotes(phrase, notes) {
  const needle = normSpeech(phrase);
  if (!needle) return false;
  const starts = new Set(), ends = new Set();
  let content = '';
  for (const word of notes.split(/\s+/)) {
    const w = normSpeech(word);
    if (!w) continue;
    starts.add(content.length);
    content += w;
    ends.add(content.length);
  }
  for (let at = content.indexOf(needle); at >= 0; at = content.indexOf(needle, at + 1)) if (starts.has(at) && ends.has(at + needle.length)) return true;
  return false;
}
