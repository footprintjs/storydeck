// edit — the two edits a person makes in the dev page, written back into the deck's own files. Pure: text in, text
// out; dev.js reads and writes the files (through paths.js).
//
//   nudgePiece(mapHtml, {name, nth}, dx, dy)   a piece moved by Alt-drag, found by its name (nth: which piece of that
//                                              name) — its inline left/top, or a wire's data-arrow, shifted; every
//                                              other byte of the file kept
//   feedbackLine(…) · readFeedback(md)         a note left on a click, as a checklist line in feedback.md — the agent
//                                              reads the open ones (`storydeck feedback`), and ticks them when done
//
// A piece is found by the rules the page was drawn by, never a second reading of the map: pieceRules.js (which tags are
// pieces, where a left/top is written) and transforms.js · wireRule (which pieces are wires).
import {attrValue, pieceTags, styleLength} from '../pieceRules.js';
import {commentRanges} from './html.js';
import {wireRule} from './transforms.js';

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
 * The pieces of a map's source, in order: {start, end, tag, before, after, name, nth, commented} — `name` its first
 * data-k name, `nth` which piece of that name it is (0 for the first), `commented` when a comment sits in its tag.
 */
export function sourcePieces(html) {
  const blank = blankComments(html), seen = new Map();
  return pieceTags(blank).map(({start, end, tag, before, value, after}) => {
    const name = value.trim().split(/\s+/)[0], nth = seen.get(name) ?? 0;
    seen.set(name, nth + 1);
    return {start, end, tag, before, after, name, nth, commented: blank.slice(start, end) !== html.slice(start, end)};
  });
}

/** Where a piece's inline `prop` (left or top) is written, as a place in the whole text: {value, at, length}, or null. */
function placeOf(piece, prop) {
  // its style is the first one among its attributes, before its data-k and then after it — as readPieces reads it
  const runs = [[piece.before, piece.start + 1 + piece.tag.length], [piece.after, piece.end - 1 - piece.after.length]];
  for (const [attrs, from] of runs) {
    const style = attrValue(attrs, 'style');
    if (!style) continue;
    const n = styleLength(style.value, prop);
    return n && Number.isFinite(n.value) ? {...n, at: from + style.at + n.at} : null;
  }
  return null;
}

/** The text edits that move one piece by dx, dy: [[at, length, text]] — or why it cannot move. */
function moveEdits(html, piece, dx, dy) {
  const wire = wireRule('y');
  wire.lastIndex = piece.start;
  const w = wire.exec(html);
  if (w) {
    const parts = w[2].trim().split(/[\s,]+/), nums = parts.map(Number);
    if ((parts.length !== 4 && parts.length !== 5) || nums.some((n) => !Number.isFinite(n))) {
      throw new Error(`"${piece.name}": its data-arrow is not "x1 y1 x2 y2 [bend]" — fix it before moving it`);
    }
    const [x1, y1, x2, y2] = nums;   // the bend is kept as written: a move does not bend a wire
    const spec = [x1 + dx, y1 + dy, x2 + dx, y2 + dy].map(num).concat(parts.slice(4)).join(' ');
    return [[piece.start + '<i'.length + w[1].length + ' data-arrow="'.length, w[2].length, spec]];
  }
  const left = placeOf(piece, 'left'), top = placeOf(piece, 'top');
  if (!left || !top) throw new Error(`"${piece.name}" has no inline left/top in px — a piece without them keeps its place; give it left and top to move it`);
  return [[left.at, left.length, num(left.value + dx)], [top.at, top.length, num(top.value + dy)]];
}

/**
 * A map's source with one piece moved by dx, dy (map px): the piece called `name` (the `nth` of that name, 0 for the
 * first), as the page drew it. A map that changed since the page was built is refused, never edited in the wrong place.
 */
export function nudgePiece(html, {name, nth = 0}, dx, dy) {
  if (![dx, dy].every((v) => Number.isFinite(v) && Math.abs(v) <= MAX_MOVE)) throw new Error(`a move is two numbers of px, at most ${MAX_MOVE} each`);
  const piece = sourcePieces(html).find((p) => p.name === name && p.nth === nth);
  if (!piece) throw new Error(`the map changed since the page was built (no piece "${name}"${nth ? ` #${nth + 1}` : ''}) — the page reloads with the new one`);
  if (piece.commented) throw new Error(`"${name}": a comment sits inside its tag — move it in the file`);
  let out = html;
  for (const [at, length, text] of moveEdits(html, piece, dx, dy).sort((a, b) => b[0] - a[0])) out = out.slice(0, at) + text + out.slice(at + length);
  return out;
}

/** A note on a click as one checklist line: one line of text, no control characters, at most 2000 characters. */
export function feedbackLine({n, label, text, at}) {
  const clean = String(text).replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 2000);
  if (!clean) throw new Error('a note needs words');
  return `- [ ] click ${n} · "${String(label).replace(/["\n\r]/g, '')}" — ${clean} (${at})`;
}

const HEAD = /^- \[([ xX])\] click (\d+) · "([^"]*)" — /;

/** feedback.md read back: [{done, n, label, text, at}], in the order written (lines that are not notes are skipped). */
export function readFeedback(md) {
  const out = [];
  for (const raw of md.split('\n')) {
    const line = raw.trim(), m = HEAD.exec(line);
    if (!m) continue;
    let text = line.slice(m[0].length), at = null;
    // its stamp is the last " (…)", ending the line (a note may hold "(" of its own): found by position, in one pass
    const open = text.endsWith(')') ? text.lastIndexOf(' (') : -1;
    if (open >= 0 && !text.slice(open + 2, -1).includes(')')) { at = text.slice(open + 2, -1); text = text.slice(0, open); }
    out.push({done: m[1] !== ' ', n: Number(m[2]), label: m[3], text, at});
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
