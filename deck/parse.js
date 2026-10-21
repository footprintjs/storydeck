// parse — a deck's clicks file read into parts and clicks: plain data, no file system.
//
//   <section data-label="1 · The route" data-kicker="1 · The route" data-map="map">   one part of the story
//     <step data-in="client wire server" data-on="server" data-focus="zoom">         one click on the map
//       <h2>The request reaches the server</h2>                                       its headline
//       <aside class="notes">What the presenter says.</aside>                         its notes (N · P · L)
//     </step>
//   </section>
//   <section data-label="Summary" data-kicker="Summary">…any slide HTML…</section>  a plain slide: one click
//
// A part is strict about what it holds, so nothing an author wrote is dropped without a word: a step holds its
// headline and its notes, and anything else in it is refused, naming where it goes instead (on the map). The file is
// scanned once (html.js · elements): a <section> or <step> left open is refused at once, naming it.
import {elements, stripComments} from './html.js';

const HEADLINE = /<h2\b[^>]*>([\s\S]*?)<\/h2>/;
const NOTES_CLASS = /\sclass=(["'])(?:[^"']*\s)?notes(?:\s[^"']*)?\1/;

/** An attribute's value in a run of attributes (double or single quoted), or null. */
export function attrOf(attrs, name) {
  return new RegExp(`\\s${name}=(["'])(.*?)\\1`).exec(attrs)?.[2] ?? null;
}

/** HTML as the words it shows: tags out (a block or a line break leaves a space; inline tags leave none), entities read, white space folded. */
export function plainText(html) {
  const ENTITY = {amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' '};
  return html.replace(/<(?:br|\/?(?:p|div|li|ul|ol|h[1-6]|tr|td|th|section|aside|blockquote|header|footer|figure|figcaption))\b[^>]*>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&(#\d+|#x[\da-f]+|\w+);/gi, (m, e) => (e[0] === '#' ? String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : Number(e.slice(1))) : ENTITY[e.toLowerCase()] ?? m))
    .replace(/\s+/g, ' ').trim();
}

/** The number of words a reader reads in a piece of HTML. */
export const wordCount = (html) => (plainText(html).match(/[\p{L}\p{N}][\p{L}\p{N}'’.,%-]*/gu) ?? []).length;

/**
 * The notes taken out of some HTML: {html: the HTML without them, notes: one plain paragraph per <aside class="notes">}.
 * Scanned once; any other <aside> stays where it is.
 */
export function takeNotes(html) {
  const open = /<aside\b([^>]*)>/gi, lower = html.toLowerCase(), notes = [];
  let kept = '', from = 0;
  for (let m = open.exec(html); m; m = open.exec(html)) {
    if (!NOTES_CLASS.test(m[1])) continue;
    const shut = lower.indexOf('</aside>', m.index + m[0].length);
    if (shut < 0) throw new Error(`<aside${m[1]}> is never closed — end the notes with </aside>`);
    notes.push(plainText(html.slice(m.index + m[0].length, shut)));
    kept += html.slice(from, m.index);
    from = shut + '</aside>'.length;
    open.lastIndex = from;
  }
  return {html: kept + html.slice(from), notes: notes.filter(Boolean)};
}

/** The HTML with the given [start, end) ranges taken out. */
const without = (html, ranges) => ranges.reduceRight((out, r) => out.slice(0, r.start) + out.slice(r.end), html);

const where = (label) => `"${label}"`;

/** One click on a map: its attributes (for focus.js · readStep), its headline (HTML) and its notes. */
function readMapStep(label, k, attrs, inner) {
  const {html, notes} = takeNotes(inner);
  const headline = HEADLINE.exec(html)?.[1].trim() ?? '';
  const rest = html.replace(HEADLINE, '').trim();
  if (rest) {
    throw new Error(`${where(label)} click ${k + 1}: a <step> holds its <h2> headline and its <aside class="notes">; `
      + `"${plainText(rest).slice(0, 60) || rest.slice(0, 60)}" is neither — draw it on the map as a piece (data-k) and bring it in with data-in`);
  }
  return {attrs, headline, notes};
}

/**
 * The parts of a deck, in order, from its clicks file. A part with data-map is told on that map, one click per
 * <step>; a part without one is a plain slide (one click). Labels are unique; every part has one.
 */
export function parseClicks(html) {
  const source = stripComments(html);
  const parts = [];
  const seen = new Set();
  const sections = elements(source, 'section');
  const stray = plainText(without(source, sections));
  if (stray) throw new Error(`text outside a <section>: "${stray.slice(0, 60)}" — every slide is a <section data-label="…">`);
  for (const {attrs, inner: body} of sections) {
    const label = attrOf(attrs, 'data-label');
    if (!label || !label.trim()) throw new Error(`a <section> has no data-label: <section${attrs}> — give each part a label, unique in the deck`);
    if (seen.has(label)) throw new Error(`two parts are labelled ${where(label)} — labels name the clicks, so each is unique`);
    seen.add(label);
    const kicker = attrOf(attrs, 'data-kicker') ?? '';
    const map = attrOf(attrs, 'data-map');
    if (map === null) {
      if (/<step\b/i.test(body)) throw new Error(`${where(label)} has <step> clicks but no data-map — name the map they are told on (data-map="map")`);
      const {html: inner, notes} = takeNotes(body);
      parts.push({label, kicker, map: null, body: inner, notes});
      continue;
    }
    if (!map.trim()) throw new Error(`${where(label)}: data-map is empty — name a map (a file in the deck, e.g. data-map="map")`);
    let steps;
    try { steps = elements(body, 'step'); } catch (e) { throw new Error(`${where(label)}: ${e.message}`, {cause: e}); }
    if (!steps.length) throw new Error(`${where(label)} is told on map "${map}" but has no <step> — a map part is one click per <step>`);
    const outside = plainText(takeNotes(without(body, steps)).html);
    if (outside) throw new Error(`${where(label)}: "${outside.slice(0, 60)}" is outside every <step> — put a headline or notes inside the step they belong to`);
    parts.push({label, kicker, map: map.trim(), steps: steps.map(({attrs: a, inner}, k) => readMapStep(label, k, a, inner))});
  }
  if (!parts.length) throw new Error('the clicks file has no <section> — a deck is one <section data-label="…"> per part');
  return parts;
}
