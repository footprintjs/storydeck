// isoStyle — a map's style, as its writer names it: one empty <i> in map.html, read before the map's pieces are, and
// handed to footprint-story's map steps as the spec's `style` (footprint-story/isometric · isoStyle: a row of named
// choices, one per column — shape, shading, line, palette, texture, effects).
//
//   <i data-style="line: ink width 5"></i>                 an outlined look: every face drawn with a 5 px ink line
//   <i data-style="line: none"></i>                        no outline round the faces (a floor keeps its tile lines)
//   <i data-style="line: ink width 4; shading: tones"></i>  columns apart with ";"; a column left out is today's look
//
// A column is "column: choice", then each option the choice takes as its name and its value ("width 5"); `effects` is a
// list, its choices apart with ",". A number is a number, true and false are true and false, any other word a word.
//
// WHY plain words and not JSON: every attribute of a map is plain words written by hand — data-at="3 1",
// data-size="2 2 1.4", data-arrow="you to server", data-iso-grid="120 at 960 240 rise 70" — and so is this one. JSON in
// an attribute needs its quotes written as &quot; or the attribute in single quotes, the first thing a hand or a model
// gets wrong; a CSS-like "name: value; name: value" is read the same by both. WHY options by name ("width 5", not "5"):
// a choice may take more than one, and its name is the word the run's record keeps (`style.options.line.width`), so the
// page and the record say it in one word — as "rise 70" names its number in data-iso-grid.
//
// WHY on an <i> of its own, as data-iso-grid is: a style is the whole map's (the steps paint every piece by one row), so
// it is not on a piece; it is taken out of the map, so it moves no piece's number; and a map that writes no grid (the
// build fits one) still names its style. One a map, refused anywhere else with the fix.
//
// The choices are the kit's, never listed here: a column, a choice or an option it does not have is refused in the
// deck's words, naming the ones there are (the kit's ISO_STYLE_COLUMNS, ISO_STYLE_CHOICES, and isoStyle's own check of
// an option's value). A map with no data-style hands no style, and its page is byte for byte as before.
import {isoStyle, ISO_STYLE_COLUMNS, ISO_STYLE_CHOICES} from 'footprint-story/isometric';
import {ownAttribute, tagsWith} from '../pieceRules.js';
import {decodeEntities} from './html.js';

/** A tag that may carry the attribute: a cheap look, in any case. Whether it does is ownAttribute's to say. */
export const MAYBE_STYLE = /data-style(?![\w-])/i;
const NUMBER = /^-?(?:\d+(?:\.\d*)?|\.\d+)$/;
/** How a style is written, said in each refusal of its form. */
const WRITTEN = '<i data-style="line: ink width 5"></i>';
/** The most letters of a style shown in a refusal: enough to find it. */
const SHOWN = 80;

const quoted = (list) => list.map((n) => `"${n}"`).join(', ');
/** Words as a refusal shows them: on one line (a run of spaces, tabs or line ends one space), then cut. */
const cut = (words) => { const text = words.replace(/\s+/g, ' '); return [...text].length > SHOWN ? `${[...text].slice(0, SHOWN).join('')}…` : text; };

/** A choice and its options as written ("ink width 5"): {name, ...options}, or the name alone when it takes none. */
function readChoice(words, column, where) {
  const [name, ...rest] = words.trim().split(/\s+/);
  if (!name) throw new Error(`${where}: the ${column} names its choice — "${column}: ${ISO_STYLE_CHOICES[column][0] ?? 'name'}"`);
  const there = ISO_STYLE_CHOICES[column];
  // a name with a prefix ("human:sketchy") is a choice a tool hands in (footprint-story/isometric · isoStyle's
  // `choices`), and footprint-story's map steps (buildIsoMap), which build every deck map, take none handed in yet: said
  // plainly, so the writer knows it is not a typo — the painter draws its strokes (isoPaint.js) once the steps take one
  if (!there.includes(name) && /^[a-z][a-z0-9-]*:/.test(name)) throw new Error(`${where}: the ${column} "${cut(name)}" is a choice a tool hands in, and footprint-story's map steps take none handed in yet — there are ${there.length ? quoted(there) : 'none yet'}`);
  if (!there.includes(name)) throw new Error(`${where}: the ${column} has no choice "${cut(name)}" — ${there.length ? `there are ${quoted(there)}` : 'there are none yet'}`);
  if (rest.length % 2) throw new Error(`${where}: an option of the ${column} "${name}" is its name and its value, "width 5" — not "${cut(rest.join(' '))}"`);
  // with no prototype, so an option named __proto__ is an option like any other (the kit then refuses it by name)
  const options = Object.create(null);
  for (let i = 0; i < rest.length; i += 2) {
    const [key, value] = [rest[i], rest[i + 1]];
    if (Object.hasOwn(options, key)) throw new Error(`${where}: the ${column} "${name}" says its ${key} twice — keep one`);
    // a number too long to be one (400 digits reads as Infinity) stays the word it was, so the refusal says what was written
    const number = NUMBER.test(value) ? Number(value) : NaN;
    options[key] = Number.isFinite(number) ? number : value === 'true' ? true : value === 'false' ? false : value;
  }
  return rest.length ? {...options, name} : name;
}

/**
 * A style's words as the kit's row ({line: {name: 'ink', width: 5}}), checked in the deck's words: the form, a column
 * it has not, a column twice, a choice it has not. What a value of an option may be is the kit's check (isoStyle), its
 * words said after the deck's `where`.
 */
export function parseStyle(text, where) {
  const parts = text.split(';').map((p) => p.trim()).filter(Boolean);
  if (!parts.length) throw new Error(`${where}: a style names at least one column, "column: choice" — ${WRITTEN}, or take it out for today's look`);
  const row = {};
  for (const part of parts) {
    const m = /^([^:\s]+)\s*:([^]*)$/.exec(part);
    if (!m) throw new Error(`${where}: each column is written "column: choice", apart with ";" — not "${cut(part)}"`);
    const column = m[1];
    if (!ISO_STYLE_COLUMNS.includes(column)) throw new Error(`${where}: a style's columns are ${ISO_STYLE_COLUMNS.join(', ')} — not "${cut(column)}"`);
    if (Object.hasOwn(row, column)) throw new Error(`${where}: the ${column} is written twice — keep one`);
    // effects is a list: each its own choice, apart with ","
    row[column] = column === 'effects' ? m[2].split(',').map((one) => readChoice(one, column, where)) : readChoice(m[2], column, where);
  }
  try {
    isoStyle(row);
  } catch (e) {
    throw new Error(`${where}: ${String(e.message).replace(/^isometric: /, '').replace(/^the style's /, 'the ')}`, {cause: e});
  }
  return row;
}

/**
 * The map's style and the map without the element that says it: {html, style} — `style` the kit's row, or null when
 * none is written (then `html` is the map as it was, the same string). The element is an empty <i> that carries
 * data-style and nothing else; one a map. Anywhere else (on a piece, beside data-iso-grid) it is refused, with the fix.
 */
export function readStyle(html) {
  const found = [];
  for (const t of tagsWith(html, MAYBE_STYLE)) {
    const run = t.before + t.m[0] + t.after, own = ownAttribute(run, 'data-style');
    if (own === null) continue;   // the words inside another attribute's value: not a style
    // an <I>: the case is the fault, said plainly (a map's elements are written in lower case, as data-iso-grid's <i> is)
    if (t.tag !== 'i' && t.tag.toLowerCase() === 'i') throw new Error(`data-style: a map's style is set on an <i> in lower case — not <${t.tag}>: ${WRITTEN}`);
    if (own === undefined || own.bare || own.twice || t.tag !== 'i' || !html.startsWith('</i>', t.end)) throw new Error(`data-style: a map's style is set on an empty <i> of its own, in lower case and with quotes — ${WRITTEN}${t.tag === 'i' ? '' : ` (it styles the whole map, so it is never on a piece's <${t.tag}>)`}`);
    const rest = (own.before + own.after).trim();
    if (rest) throw new Error(`data-style: the style's <i> carries nothing else (it is not a piece, and is taken out of the map) — write ${WRITTEN} and put "${cut(rest)}" ${/data-iso-grid/i.test(rest) ? 'on an <i> of its own' : 'on a piece'}`);
    // read as a browser reads it: an entity is its letter
    found.push({start: t.start, end: t.end + '</i>'.length, text: decodeEntities(own.value)});
  }
  if (found.length > 1) throw new Error(`data-style: a map has one style, and this one sets ${found.length} — keep one`);
  if (!found.length) return {html, style: null};
  const [{start, end, text}] = found;
  return {html: html.slice(0, start) + html.slice(end), style: parseStyle(text, `data-style="${cut(text)}"`)};
}
