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
