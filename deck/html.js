// html — the few string rules every deck module shares about HTML: one owner each, so they cannot drift.

/**
 * Where the HTML comments are, [start, end) each, in order — one pass: a "<!--" with no "-->" after it ends the search
 * (no later one can close either), so a file of unclosed comments costs no more than its length.
 */
export function commentRanges(html) {
  const out = [];
  for (let from = 0; ;) {
    const start = html.indexOf('<!--', from);
    const end = start < 0 ? -1 : html.indexOf('-->', start + 4);
    if (end < 0) return out;
    out.push([start, end + 3]);
    from = end + 3;
  }
}
/** HTML without its comments. */
export function stripComments(html) {
  let out = '', from = 0;
  for (const [start, end] of commentRanges(html)) { out += html.slice(from, start); from = end; }
  return out + html.slice(from);
}
/** Text safe in HTML content and in a double-quoted attribute. */
export const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
/** Code safe inside a <script> (no `</script` can close it early). */
export const scriptSafe = (code) => String(code).replace(/<\/(script)/gi, '<\\/$1');
/** CSS safe inside a <style> (no `</style` can close it early). */
export const styleSafe = (css) => String(css).replace(/<\/(style)/gi, '<\\/$1');

/**
 * The elements `<tag …>…</tag>` in some HTML, in order, scanned once (linear: an element left open is refused at once,
 * never searched for again and again). Elements of the same tag do not nest; one left open, or one opened inside
 * another, is refused naming it. Returns [{attrs, inner, start, end}] (end is past the closing tag).
 */
export function elements(html, tag) {
  // Both searches run on the text itself: a lower-cased copy can be longer (İ becomes two code units), and its
  // positions would no longer be the text's.
  const open = new RegExp(`<${tag}\\b`, 'gi'), shutter = closing(tag), close = `</${tag}>`;
  const out = [];
  for (let m = open.exec(html); m; m = open.exec(html)) {
    const tagEnd = html.indexOf('>', m.index);
    if (tagEnd < 0) throw new Error(`a <${tag}> tag is never finished: "${html.slice(m.index, m.index + 60)}" — end it with ">"`);
    const attrs = html.slice(m.index + tag.length + 1, tagEnd);
    shutter.lastIndex = tagEnd + 1;
    const shut = shutter.exec(html);
    const opening = `<${tag}${attrs}>`;
    if (!shut) throw new Error(`${opening.slice(0, 80)} is never closed — end it with ${close}`);
    open.lastIndex = tagEnd + 1;
    const next = open.exec(html);
    if (next && next.index < shut.index) throw new Error(`${opening.slice(0, 80)} is not closed before the next <${tag}> — end it with ${close} (they do not nest)`);
    out.push({attrs, inner: html.slice(tagEnd + 1, shut.index), start: m.index, end: shut.index + shut[0].length});
    open.lastIndex = shut.index + shut[0].length;
  }
  return out;
}

/** A tag's closing tag in any case (`</STEP >` too): a search over the text itself, from its lastIndex. */
export const closing = (tag) => new RegExp(`</${tag}\\s*>`, 'gi');
