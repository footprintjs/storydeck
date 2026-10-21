// pieceRules — the one rule for which elements of a map are its pieces, and where a piece's place is written. Shared by
// focusHtml.js (readPieces: the pieces a page draws, and their boxes) and deck/edit.js (a piece moved in the dev page,
// written back into its map's source), so the two cannot disagree on which piece is which or where it stands.
// Internal: the package's door to it is focusHtml.js.

/** An attribute in a run of attributes, ` name="value"` or ` name='value'`; the first one found is the attribute. */
export const attrRule = (name) => new RegExp(`\\s${name}=(["'])(.*?)\\1`);

/** An attribute's value, and where that value starts in the run: {value, at, length}, or null. */
export function attrValue(attrs, name) {
  const m = attrRule(name).exec(attrs);
  return m ? {value: m[2], at: m.index + name.length + 3, length: m[2].length} : null;
}

/** A CSS length in px (or a bare 0) in an inline style, and where its number is: {value, at, length}, or null. */
export function styleLength(style, prop) {
  const m = new RegExp(`((?:^|;)\\s*${prop}\\s*:\\s*)(-?[\\d.]+)(px)?\\s*(?:;|$)`).exec(style);
  return m && (m[3] || Number(m[2]) === 0) ? {value: Number(m[2]), at: m.index + m[1].length, length: m[2].length} : null;
}

/**
 * The opening tags that carry `attr` (data-k), in order: [{start, end, tag, before, quote, value, after}] — `before` the
 * attributes ahead of ` attr=…`, `after` those behind it, `end` just past the tag's ">". A tag ends at its first ">", so
 * a value holding ">" is not read as one. One pass: every tag is matched once, and the text after the last ">", where
 * no tag can finish, is never searched — a map of unfinished tags costs no more than its length.
 */
export function pieceTags(html, attr = 'data-k') {
  const has = attrRule(attr), out = [];
  for (const m of html.slice(0, html.lastIndexOf('>') + 1).matchAll(/<([a-zA-Z][\w-]*)\b([^>]*)>/g)) {
    const k = has.exec(m[2]);
    if (k) out.push({start: m.index, end: m.index + m[0].length, tag: m[1], before: m[2].slice(0, k.index), quote: k[1], value: k[2], after: m[2].slice(k.index + k[0].length)});
  }
  return out;
}
