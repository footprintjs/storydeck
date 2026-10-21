// edit — the two edits a person makes in the dev page, written back into the deck's own files. Pure: text in, text
// out; dev.js reads and writes the files (through paths.js) and signs the notes (noteKey.js).
//
//   nudgePiece(mapHtml, {index, name}, dx, dy)   a piece moved by Alt-drag — piece `index` as the build read the map,
//                                                which must be called `name` — its inline left/top, or a wire's
//                                                data-arrow, shifted; every other byte of the file kept
//   cleanNote · feedbackLine · readFeedback      a note left on a click, as a checklist line in feedback.md
//
// A piece is found by the rules the page was drawn by, never a second reading of the map: pieceRules.js (which tags are
// pieces, where a left/top is written) and transforms.js · wireTags (which pieces are wires). And a move is refused
// when a browser would read the piece's tag differently (a quote or a ">" inside a value): it edits only what both see.
import {attrValue, pieceTags, readAttributes, styleLength} from '../pieceRules.js';
import {UNSEEN, commentRanges, stripComments} from './html.js';
import {wireTags} from './transforms.js';

/** The checklist of notes a person leaves on clicks in the dev page, in the deck folder. */
export const FEEDBACK = 'feedback.md';

const MAX_MOVE = 5000;
/** A coordinate as written back: at most two decimals, so no float noise lands in the file. */
const num = (v) => String(Math.round(v * 100) / 100);

/** The text with its comments blanked to spaces, every position kept (the build reads a map with them stripped). */
function blankComments(html) {
  let out = '', from = 0;
  for (const [start, end] of commentRanges(html)) { out += html.slice(from, start) + ' '.repeat(end - start); from = end; }
  return out + html.slice(from);
}

/**
 * The pieces of a map's source, in the build's order: {start, end, tag, before, after, name, commented} — `name` its
 * first data-k name, `commented` when a comment sits inside its tag.
 */
export function sourcePieces(html) {
  const blank = blankComments(html);
  return pieceTags(blank).map(({start, end, tag, before, value, after}) => ({
    start, end, tag, before, after, name: value.trim().split(/\s+/)[0], commented: blank.slice(start, end) !== html.slice(start, end),
  }));
}

/** Where a piece's inline `prop` (left or top) is written: {value, at, length, unit, styleAt} as places in the whole text, or null. */
function placeOf(piece, prop) {
  // its style is the first one among its attributes, before its data-k and then after it — as readPieces reads it
  const runs = [[piece.before, piece.start + 1 + piece.tag.length], [piece.after, piece.end - 1 - piece.after.length]];
  for (const [attrs, from] of runs) {
    const style = attrValue(attrs, 'style');
    if (!style) continue;
    const n = styleLength(style.value, prop);
    return n && Number.isFinite(n.value) ? {...n, at: from + style.at + n.at, styleAt: from + style.at} : null;
  }
  return null;
}

/**
 * The wires as the build draws them, by where each starts in the source: the build finds them in the text without its
 * comments, after the icons (an <i> with an icon is an icon, never a wire) — so this does too, and maps them back.
 */
function wiresBySource(html) {
  const ranges = commentRanges(html), at = new Map();
  let r = 0, removed = 0;
  for (const w of wireTags(stripComments(html))) {
    while (r < ranges.length && w.start >= ranges[r][0] - removed) { removed += ranges[r][1] - ranges[r][0]; r += 1; }
    if (!/\sdata-icon="[\w-]+"/.test(w.before + w.after)) at.set(w.start + removed, w);
  }
  return at;
}

/** The place `name`'s value starts at as a browser reads the piece's tag (the first attribute of that name), or -1. */
function browserValueAt(html, piece, name) {
  const runAt = piece.start + 1 + piece.tag.length, attrs = readAttributes(html.slice(runAt, piece.end - 1));
  const a = attrs?.find((x) => x.name === name);
  return a && a.valueAt >= 0 ? runAt + a.valueAt : -1;
}

/** The text edits that move one piece by dx, dy: [[at, length, text]] — or why it cannot move. */
function moveEdits(html, piece, dx, dy) {
  const ambiguous = () => new Error(`"${piece.name}": a browser reads its tag differently (a quote or a ">" inside a value) — move it in the file`);
  if (browserValueAt(html, piece, 'data-k') !== piece.start + 1 + piece.tag.length + piece.before.length + ' data-k="'.length) throw ambiguous();
  const wire = wiresBySource(html).get(piece.start);
  if (wire) {
    const spec = wire.m[1], parts = spec.trim().split(/[\s,]+/), nums = parts.map(Number);
    if ((parts.length !== 4 && parts.length !== 5) || nums.some((n) => !Number.isFinite(n))) {
      throw new Error(`"${piece.name}": its data-arrow is not "x1 y1 x2 y2 [bend]" — fix it before moving it`);
    }
    const at = piece.start + '<i'.length + wire.before.length + ' data-arrow="'.length;
    if (browserValueAt(html, piece, 'data-arrow') !== at) throw ambiguous();
    const [x1, y1, x2, y2] = nums;   // the bend is kept as written: a move does not bend a wire
    return [[at, spec.length, [x1 + dx, y1 + dy, x2 + dx, y2 + dy].map(num).concat(parts.slice(4)).join(' ')]];
  }
  const left = placeOf(piece, 'left'), top = placeOf(piece, 'top');
  if (!left || !top) throw new Error(`"${piece.name}" has no inline left/top in px — a piece without them keeps its place; give it left and top to move it`);
  if (browserValueAt(html, piece, 'style') !== left.styleAt) throw ambiguous();
  // a bare 0 is the one length CSS takes without a unit: once it is not 0, it is written in px
  return [left, top].map((p, i) => [p.at, p.length, `${num(p.value + (i ? dy : dx))}${p.unit ? '' : 'px'}`]);
}

/**
 * A map's source with one piece moved by dx, dy (map px): piece `index` in the order the build reads the map, which
 * must be called `name`. Every other byte is kept; a piece the edit cannot be sure of is refused, never guessed at.
 */
export function nudgePiece(html, {index, name}, dx, dy) {
  if (![dx, dy].every((v) => Number.isFinite(v) && Math.abs(v) <= MAX_MOVE)) throw new Error(`a move is two numbers of px, at most ${MAX_MOVE} each`);
  const piece = sourcePieces(html)[index];
  if (!piece || piece.name !== name) throw new Error(`the map changed since the page was built (no piece "${name}" at ${index}) — the page reloads with the new one`);
  if (piece.commented) throw new Error(`"${name}": a comment sits inside its tag — move it in the file`);
  let out = html;
  for (const [at, length, text] of moveEdits(html, piece, dx, dy).sort((a, b) => b[0] - a[0])) out = out.slice(0, at) + text + out.slice(at + length);
  return out;
}

/** Text as one plain line: nothing a reader cannot see (html.js · UNSEEN), and no line break or tab. */
const oneLine = (s) => String(s).replace(UNSEEN, ' ').replace(/\s+/g, ' ').trim();

/** A note as written: {n, label, text, at}, each one plain line (the text at most 2000 characters) — or why not. */
export function cleanNote({n, label, text, at}) {
  const clean = oneLine(text).slice(0, 2000);
  if (!clean) throw new Error('a note needs words');
  return {n, label: oneLine(label).replace(/"/g, ''), text: clean, at: oneLine(at).replace(/[()]/g, '')};
}

/** A clean note as its checklist line, signed (`sig`, noteKey.js · signNote) by the dev server that wrote it. */
export const feedbackLine = ({n, label, text, at}, sig) => `- [ ] click ${n} · "${label}" — ${text} (${at}${sig ? ` · k:${sig}` : ''})`;

const HEAD = /^- \[([ xX])\] click (\d+) · "([^"]*)" — /;

/** feedback.md read back: [{done, n, label, text, at, sig}], in the order written (lines that are not notes are skipped). */
export function readFeedback(md) {
  const out = [];
  for (const raw of md.split('\n')) {
    const line = raw.trim(), m = HEAD.exec(line);
    if (!m) continue;
    let text = line.slice(m[0].length), stamp = null;
    // its stamp is the last " (…)", ending the line (a note may hold "(" of its own): found by position, in one pass
    const open = text.endsWith(')') ? text.lastIndexOf(' (') : -1;
    if (open >= 0 && !text.slice(open + 2, -1).includes(')')) { stamp = text.slice(open + 2, -1); text = text.slice(0, open); }
    const signed = stamp === null ? null : / · k:([0-9a-f]{16})$/.exec(stamp);
    out.push({done: m[1] !== ' ', n: Number(m[2]), label: m[3], text, at: signed ? stamp.slice(0, signed.index) : stamp, sig: signed?.[1] ?? null});
  }
  return out;
}

/** feedback.md with one more note: a heading the first time, then the line. */
export function appendFeedback(md, line) {
  if (!md || !md.trim()) return `# Feedback\n\nNotes left on clicks in \`storydeck dev\`. Tick a line (\`- [x]\`) when it is done.\n\n${line}\n`;
  let end = md.length;
  while (md[end - 1] === '\n') end -= 1;   // its blank lines at the end go, so the notes stay one list
  return `${md.slice(0, end)}\n${line}\n`;
}
