// pieceRules — the one rule for which elements of a map are its pieces, and where a piece's place is written. Shared by
// focusHtml.js (readPieces and drawFocus: the pieces a page draws, and their boxes) and deck/edit.js (a piece moved in
// the dev page, written back into its map's source), so the two cannot disagree on which piece is which or where it
// stands. Internal: the package's door to it is focusHtml.js.

/** An attribute in a run of attributes, ` name="value"` or ` name='value'`; the first one found is the attribute. */
export const attrRule = (name) => new RegExp(`\\s${name}=(["'])(.*?)\\1`);

/** An attribute's value, and where that value starts in the run: {value, at, length}, or null. */
export function attrValue(attrs, name) {
  const m = attrRule(name).exec(attrs);
  return m ? {value: m[2], at: m.index + name.length + 3, length: m[2].length} : null;
}

/** A CSS length in px (or a bare 0) in an inline style, where its number is, and its unit: {value, at, length, unit}, or null. */
export function styleLength(style, prop) {
  const m = new RegExp(`((?:^|;)\\s*${prop}\\s*:\\s*)(-?[\\d.]+)(px)?\\s*(?:;|$)`).exec(style);
  return m && (m[3] || Number(m[2]) === 0) ? {value: Number(m[2]), at: m.index + m[1].length, length: m[2].length, unit: m[3] ?? ''} : null;
}

/**
 * Every opening tag whose attributes hold `rule` (a RegExp), in order: [{start, end, tag, before, m, after}] — `m` the
 * rule's match in the attributes, `before`/`after` the attributes around it, `end` just past the tag's ">". A tag ends
 * at its first ">". One pass: every tag is matched once, and the text after the last ">", where no tag can finish, is
 * never searched — a map of unfinished tags costs no more than its length.
 */
export function tagsWith(html, rule) {
  const out = [];
  for (const t of html.slice(0, html.lastIndexOf('>') + 1).matchAll(/<([a-zA-Z][\w-]*)\b([^>]*)>/g)) {
    const m = rule.exec(t[2]);
    if (m) out.push({start: t.index, end: t.index + t[0].length, tag: t[1], before: t[2].slice(0, m.index), m, after: t[2].slice(m.index + m[0].length)});
  }
  return out;
}

/** The opening tags that carry `attr` (data-k), in order: [{start, end, tag, before, quote, value, after}]. */
export function pieceTags(html, attr = 'data-k') {
  return tagsWith(html, attrRule(attr)).map(({m, ...t}) => ({...t, quote: m[1], value: m[2]}));
}

const SPACE = new Set([' ', '\t', '\n', '\r', '\f']);

/**
 * A tag's attributes (the text between its name and its ">") as a browser reads them, in order: [{name, at, valueAt,
 * value}] — the name lower-cased, `at` where it starts, `valueAt` where its value starts (-1 without one) — or null when
 * a quoted value never closes (a ">" inside it: the tag goes on past where a scan ends it). A browser keeps the first of
 * two attributes with one name.
 */
export function readAttributes(text) {
  const out = [], n = text.length;
  let i = 0;
  while (i < n) {
    while (i < n && (SPACE.has(text[i]) || text[i] === '/')) i += 1;
    if (i >= n) break;
    const at = i;
    i += 1;   // a name starts with anything but a space or "/" — even "="
    while (i < n && !SPACE.has(text[i]) && text[i] !== '/' && text[i] !== '=') i += 1;
    const name = text.slice(at, i).toLowerCase();
    let j = i;
    while (j < n && SPACE.has(text[j])) j += 1;
    if (text[j] !== '=') { out.push({name, at, valueAt: -1, value: ''}); i = j; continue; }
    j += 1;
    while (j < n && SPACE.has(text[j])) j += 1;
    if (text[j] === '"' || text[j] === "'") {
      const close = text.indexOf(text[j], j + 1);
      if (close < 0) return null;
      out.push({name, at, valueAt: j + 1, value: text.slice(j + 1, close)});
      i = close + 1;
    } else {
      let k = j;
      while (k < n && !SPACE.has(text[k])) k += 1;
      out.push({name, at, valueAt: j, value: text.slice(j, k)});
      i = k;
    }
  }
  return out;
}

/**
 * A tag's own attribute `name` (lower case, letters and dashes), as a browser reads the tag — so a mention of the name
 * inside another attribute's value is never taken for it — cut out of the run of attributes:
 *   {value, quote, before, after, twice}   written name="value" or name='value' (twice: the tag carries it again)
 *   {bare: true, value, twice}             there, but written another way (no quotes, no value, another case)
 *   null                                   the tag has no such attribute
 *   undefined                              a quote in the tag never closes: nothing in it can be trusted
 */
export function ownAttribute(run, name) {
  const read = readAttributes(run);
  if (!read) return undefined;
  const found = read.filter((a) => a.name === name), a = found[0];
  if (!a) return null;
  const m = new RegExp(`^${name}=(["'])(.*?)\\1`).exec(run.slice(a.at));
  if (!m) return {bare: true, value: a.value, twice: found.length > 1};
  return {value: m[2], quote: m[1], before: run.slice(0, a.at).replace(/[\s/]$/, ''), after: run.slice(a.at + m[0].length), twice: found.length > 1};
}

/**
 * The element's end: where its own closing tag is, counting those of its kind inside it. Throws when it is never closed.
 * One pass: each tag's ">" is looked for once and the search goes on past it, so a file of unfinished tags costs no more
 * than its length.
 */
export function closeOf(html, tag, from, where) {
  const scan = new RegExp(`<(/?)${tag}\\b`, 'gi');
  scan.lastIndex = from;
  let depth = 1;
  for (let m = scan.exec(html); m; m = scan.exec(html)) {
    const gt = html.indexOf('>', m.index);
    if (gt < 0) break;
    depth += m[1] ? -1 : 1;
    if (!depth) return {at: m.index, end: gt + 1};
    scan.lastIndex = gt + 1;
  }
  throw new Error(`${where}: its <${tag}> is never closed — end it with </${tag}>`);
}
