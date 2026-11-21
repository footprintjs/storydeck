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
// is declared, and cannot see a speed-up nobody declared. The rules and the default words are footprint-story's
// (differsProblem, differsLines, timeProblem …), the same ones StoryReel's differs.mjs holds: a deck and a film say it
// alike. What stays here is reading the attributes as a browser reads them and saying each refusal in the deck's words.
import {normSpeech, foldDiffers, timeProblem, differsLines, differsProblem, differsEnglish, DIFFERS_MOST, DIFFERS_SAID_MOST, DIFFERS_TIME_MOST, DIFFERS_ANALOGY} from 'footprint-story';
import {readAttributes} from '../pieceRules.js';
import {decodeEntities, esc} from './html.js';

const NAMES = ['data-differs-time', 'data-differs-scale', 'data-differs-analogy', 'data-differs-shown', 'data-differs-said'];

/** A value as a browser reads it, with spaces and control characters made one space: a declaration's words stay on one line wherever they are printed. */
const folded = (value) => foldDiffers(decodeEntities(value));

function words(value, name, where) {
  const text = folded(value);
  if (!text) throw new Error(`${where}: ${name} is empty — say it in words, or leave it out`);
  if (text.length > DIFFERS_MOST) throw new Error(`${where}: ${name} is ${text.length} characters, more than a label can hold in a glance (${DIFFERS_MOST}) — shorten it, and say the rest in the notes`);
  return text;
}

/** An analogy's words, checked with the room its label leaves them. */
function readAnalogy(value, where) {
  const text = words(value, 'data-differs-analogy', where), room = DIFFERS_MOST - DIFFERS_ANALOGY.length;
  if (text.length > room) throw new Error(`${where}: data-differs-analogy is ${text.length} characters, more than its label can hold in a glance (${room}, after "${DIFFERS_ANALOGY.trim()}") — shorten it, and say the rest in the notes`);
  return text;
}

/** A time factor from its attribute, checked by the kit's rule (timeProblem) and refused in the deck's words. */
function readTime(value, where) {
  const factor = Number(folded(value)), what = `${where}: data-differs-time=${JSON.stringify(value)} — it is how many times faster the picture runs than the real thing (30; 0.04 is 25 times slower)`;
  const problem = folded(value) ? timeProblem(factor) : 'not-a-factor';
  if (problem === 'not-a-factor') throw new Error(what);
  if (problem === 'real-time') throw new Error(`${what}: it reads as 1 time, and 1 is real time, so leave it out (a factor that shows is 1.01 or more, or 0.99 or less)`);
  if (problem === 'past-range') throw new Error(`${what}: past ${DIFFERS_TIME_MOST} times either way no viewer reads the number, so say it in words in data-differs-scale`);
  return factor;
}

/** The phrases data-differs-said names, each checked and folded ("A | B": one per statement); null when it names none. Two alike are the kit's to find (differsProblem). */
function readSaid(value, where) {
  if (value === null) return null;
  return value.split('|').map((one) => {
    const text = folded(one);
    if (!normSpeech(text)) throw new Error(`${where}: data-differs-said is empty — name the phrase of the part's notes that says how it differs, one per statement ("A | B")`);
    if (text.length > DIFFERS_SAID_MOST) throw new Error(`${where}: data-differs-said is ${text.length} characters, more than a phrase (${DIFFERS_SAID_MOST}) — name the few words that say it`);
    return text;
  });
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
  const lines = shown?.trim().toLowerCase() === 'false' ? [] : shown === null ? differsLines(out) : shown.split('|').map((line) => words(line, 'data-differs-shown', where));
  const phrases = readSaid(of('data-differs-said'), where), broken = differsProblem(out, lines, phrases);
  if (broken?.problem === 'said-twice') throw new Error(`${where}: data-differs-said names the same phrase twice — one per statement`);
  if (broken?.problem === 'unsaid') throw new Error(`${where}: data-differs-shown="false", so the notes must say it — name their phrase in data-differs-said`);
  if (broken?.problem === 'unstated') {
    const {named, statements, says} = broken;
    throw new Error(`${where}: it declares ${statements === 2 ? `both ${named.join(' and ')}` : `${named.slice(0, -1).join(', ')} and ${named.at(-1)}`} and says only ${says} thing — give each its own line in data-differs-shown ("A | B") or its own phrase in data-differs-said ("A | B"), so ${statements === 2 ? 'neither' : 'none'} goes unstated`);
  }
  if (broken?.problem === 'contradicts') throw new Error(`${where}: data-differs-shown says ${broken.figure} where data-differs-time says ${factor} — leave shown out for the default words, or write the number declared (and with anything else too, the time's line first)`);
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
  if (!differs) return;
  const english = differsEnglish(differs, differs.shown, lang);
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
