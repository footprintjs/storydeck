// differs — a part that differs from the real thing says so. A picture is believed: a process run 30 times faster, or a
// part drawn far larger than it is, reads as how the thing is unless the deck says otherwise. A part declares how it
// differs, and the deck says it on the slide, in the notes (what the voice says), or both:
//
//   <section data-label="Inside" data-differs-time="30" data-differs-scale="The dots are drawn far larger than real"
//            data-differs-said="thirty times faster">
//
//   data-differs-time    how many times faster it runs than the real thing (30; 0.04 is 25 times slower)
//   data-differs-scale   what is out of scale, in words
//   data-differs-shown   the words on the slide ("A | B" for two labels), or "false" for the notes alone (default: from the two above)
//   data-differs-said    the phrase of the part's notes that says it (check refuses a phrase they do not hold)
//
// It reads what is declared, and cannot see a speed-up nobody declared. The same rule and words as StoryReel's
// differs.mjs: a deck and a film say it alike.
import {readAttributes} from '../pieceRules.js';
import {esc} from './html.js';

/** The longest statement a label holds: a label is read in a glance, and the rest belongs in the notes. */
export const DIFFERS_MOST = 70;
const NAMES = ['data-differs-time', 'data-differs-scale', 'data-differs-shown', 'data-differs-said'];

const plain = (x) => String(+x.toFixed(x >= 10 ? 0 : 2));
/** A time factor in words: 30 → "Time shown 30 times faster"; 0.04 → "Time shown 25 times slower". */
export const timeWords = (time) => (time > 1 ? `Time shown ${plain(time)} times faster` : `Time shown ${plain(1 / time)} times slower`);

function words(value, name, where) {
  const text = value.trim().replace(/\s+/g, ' ');
  if (!text) throw new Error(`${where}: ${name} is empty — say it in words, or leave it out`);
  if (text.length > DIFFERS_MOST) throw new Error(`${where}: ${name} is ${text.length} characters, more than a label can hold in a glance (${DIFFERS_MOST}) — shorten it, and say the rest in the notes`);
  return text;
}

/** A part's declaration from its attributes, checked, each refusal naming the fix: {time?, scale?, shown: [the labels' words], said?}, or null when it declares none. */
export function readDiffers(attrs, where) {
  const given = (readAttributes(attrs) ?? []).filter((a) => a.name === 'data-differs' || a.name.startsWith('data-differs-'));
  if (!given.length) return null;
  const other = given.find((a) => !NAMES.includes(a.name));
  if (other) throw new Error(`${where}: ${other.name} is not a way to say how a part differs — the attributes are ${NAMES.join(', ')}`);
  const of = (name) => given.find((a) => a.name === name)?.value ?? null;
  const time = of('data-differs-time'), scale = of('data-differs-scale'), shown = of('data-differs-shown'), said = of('data-differs-said');
  const factor = time === null ? null : Number(time);
  if (time !== null && !(time.trim() && Number.isFinite(factor) && factor > 0 && factor !== 1)) throw new Error(`${where}: data-differs-time="${time}" — it is how many times faster the picture runs than the real thing (30; 0.04 is 25 times slower), and 1 is real time, so leave it out`);
  if (time === null && scale === null) throw new Error(`${where}: say how the part differs: data-differs-time (how many times faster it runs), data-differs-scale (what is out of scale, in words), or both`);
  const out = {...(factor === null ? {} : {time: factor}), ...(scale === null ? {} : {scale: words(scale, 'data-differs-scale', where)})};
  const lines = shown === 'false' ? [] : shown === null ? [...(factor === null ? [] : [timeWords(factor)]), ...(out.scale ? [out.scale] : [])]
    : shown.split('|').map((line) => words(line, 'data-differs-shown', where));
  if (said !== null && !said.trim()) throw new Error(`${where}: data-differs-said is empty — name the phrase of the part's notes that says how it differs`);
  if (!lines.length && said === null) throw new Error(`${where}: data-differs-shown="false", so the notes must say it — name their phrase in data-differs-said`);
  return {...out, shown: lines, ...(said === null ? {} : {said: said.trim()})};
}

/** The labels on a slide, or nothing: chrome, so they neither zoom with the map nor count as the slide's words. */
export const differsHtml = (d) => (d?.shown.length ? `<div class="differs" data-chrome>${d.shown.map((line) => `<span>${esc(line)}</span>`).join('')}</div>` : '');

const folded = (text) => text.toLowerCase().replace(/\s+/g, ' ');
/** Whether a part's notes (their words, as text) say the phrase: its words in order, case and spacing aside. */
export const saidInNotes = (phrase, words) => folded(words).includes(folded(phrase));
