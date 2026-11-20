// footprint — a piece the map places by its own style (a picture of a laptop, an icon, a card) that stands on the
// isometric floor all the same:
//
//   <img data-k="lap" src="laptop.svg" data-footprint="0 6 2 1.4 0.3" data-ports="rj45: 2 0.7 0.15" style="left:300px;top:420px;width:180px;height:120px">
//
// data-footprint is the floor it takes, "col row wide deep", in tiles, with its height after it (0 when left out): a
// cable laid along the floor goes round it as it goes round a block, and a wire "lap.rj45 to sw.p1" plugs into one of
// its ports, written as a block's are (data-ports, in its own tiles). It is painted in the floor's order with the
// blocks — a nearer piece over a further one — so its z-index is the build's, and one in its style is refused.
//
// WHY a footprint, not a block: the deck's picture is the device; the floor it takes is what the cables need to know.
// WHY the floor must be in numbers: the piece stands where its style puts it, so a floor fitted to the slide (or blocks
// the build places) would move under it — a fitted grid, or blocks without data-at, are refused beside a footprint.
import {readThing} from 'footprint-story/isometric';
import {closeOf, ownAttribute, readAttributes, tagsWith} from '../pieceRules.js';
import {portsWritten} from './portsWritten.js';

const MAYBE_FOOT = /data-footprint(?![\w-])/i, MAYBE_PORTS = /data-ports(?![\w-])/i;
const NUMBERS = /^\s*-?(?:\d+(?:\.\d*)?|\.\d+)(?:\s+-?(?:\d+(?:\.\d*)?|\.\d+))*\s*$/;
const FORM = 'it is the floor the piece takes, "col row wide deep" in tiles, with its height after it ("0 6 2 1.4 0.3")';
/** Elements that never hold anything (no closing tag): nothing can nest in them. */
const EMPTY = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
/** A value said back in a message: at most 80 characters of it, so a hostile one cannot flood the reply. */
const shown = (v) => (v.length > 80 ? `${v.slice(0, 79)}…` : v);

/** Whether some HTML may hold a footprint, or ports to check: the cheap test before the reading. */
export const mayHoldFootprint = (html) => MAYBE_FOOT.test(html) || MAYBE_PORTS.test(html);

/** Refuses ports on a piece that is neither a block nor a footprint: they would plug nothing in, and say nothing. */
export function refuseLoosePorts(html) {
  for (const {tag, before, m, after} of tagsWith(html, MAYBE_PORTS)) {
    const run = before + m[0] + after;
    if (ownAttribute(run, 'data-ports') && !ownAttribute(run, 'data-iso') && !ownAttribute(run, 'data-footprint')) {
      const name = ownAttribute(run, 'data-k')?.value?.trim().split(/\s+/)[0];
      throw new Error(`${name ? `"${shown(name)}"` : `<${tag}>`}: data-ports are on a block (data-iso="block") or on a piece that stands on the floor (data-footprint="col row wide deep") — give it one, or take its ports out`);
    }
  }
}

/**
 * Every footprint as written, in order, checked: [{start, end, tag, before, after, name, kind: 'footprint', at: [col,
 * row, 0], size: [wide, deep, high], ports, where}] — `before`/`after` the tag's attributes round its style's value.
 * Throws, naming the piece and the fix. Also refuses ports on a piece that is neither a block nor a footprint: they
 * would plug nothing in, and say nothing.
 */
export function readFootprints(html) {
  refuseLoosePorts(html);
  const out = [];
  for (const {start, end, tag, before, m, after} of tagsWith(html, MAYBE_FOOT)) {
    const run = before + m[0] + after, own = ownAttribute(run, 'data-footprint');
    if (own === null) continue;
    if (own === undefined) throw new Error('data-footprint: a quote in its tag is never closed — write a ">" or "<" inside a value as &gt; or &lt;');
    if (own.bare || own.twice) throw new Error('data-footprint: a footprint is written data-footprint="col row wide deep", once, in lower case and with quotes');
    const name = ownAttribute(run, 'data-k')?.value?.trim().split(/\s+/)[0], where = `data-footprint="${shown(own.value)}"`;
    if (!name) throw new Error(`${where}: a footprint is a piece's, so a wire can end at it — give the piece a data-k name`);
    const told = `"${shown(name)}" (${where})`;
    if (ownAttribute(run, 'data-iso')) throw new Error(`${told}: an isometric piece stands on the floor by its own data-at and data-size — take data-footprint off it`);
    // a wire is drawn between pieces and a callout is placed beside one: neither stands on the floor
    for (const [attr, what] of [['data-arrow', 'a wire'], ['data-callout', 'a callout']]) if (ownAttribute(run, attr)) throw new Error(`${told}: ${what} does not stand on the floor — put data-footprint on the piece it is about`);
    if (!NUMBERS.test(own.value)) throw new Error(`${told}: ${FORM}`);
    const v = own.value.trim().split(/\s+/).map(Number);
    if (v.length < 4 || v.length > 5) throw new Error(`${told}: ${FORM}`);
    const at = [v[0], v[1], 0], size = [v[2], v[3], v[4] ?? 0];
    try { readThing({at, size}, 'a footprint'); } catch (e) { throw new Error(`${told}: ${e.message.replace(/^isometric: /, '')}`, {cause: e}); }
    const styled = ownAttribute(run, 'style');
    // its place is its own style's: without a left and a top it is no piece, and the build would have nothing to stand on the floor
    if (!styled || styled.bare || styled.twice) throw new Error(`${told}: a footprint's piece is placed by its own style, written once with quotes ("left:300px;top:420px") — give it one`);
    // a piece is its box: the build finds it, and a wire's end, by its left, top, width and height
    const missing = ['left', 'top', 'width', 'height'].filter((prop) => !new RegExp(`(?:^|;)\\s*${prop}\\s*:`, 'i').test(styled.value));
    if (missing.length) throw new Error(`${told}: a footprint's piece is placed by its own style — give it a ${missing.join(', a ').replace(/, a ([a-z]+)$/, ' and a $1')}`);
    if (/(?:^|;)\s*z-index\s*:/i.test(styled.value)) throw new Error(`${told}: it is painted in the floor's order (a nearer piece over a further one) — take z-index out of its style`);
    const ports = portsWritten(ownAttribute(run, 'data-ports'), 'block', size, told);
    // pieces do not nest: a block or a footprint inside this one would be placed from its box, not from the floor
    // a browser opens <div/> as <div>: only an element that holds nothing, or a self-closed <svg/> (foreign, closed by its slash), is skipped
    if (!EMPTY.has(tag.toLowerCase()) && !(/^svg$/i.test(tag) && /\/\s*$/.test(run))) {
      const {at: close} = closeOf(html, tag, end, told), inner = html.slice(end, close);
      if (/data-(?:iso|footprint)(?![\w-])/i.test(inner) && tagsWith(inner, /data-(?:iso|footprint)(?![\w-])/i).some((t) => ownAttribute(t.before + t.m[0] + t.after, 'data-iso') || ownAttribute(t.before + t.m[0] + t.after, 'data-footprint'))) {
        throw new Error(`${told}: pieces do not nest, and this one holds a block or a footprint — place it beside it`);
      }
    }
    // where the style's value starts in the tag: the build's z-index goes there, and every other byte stays
    const valueAt = readAttributes(run).find((a) => a.name === 'style').valueAt;
    out.push({start, end, tag, run, valueAt, name, kind: 'footprint', at, size, ports, where: told});
  }
  return out;
}

/**
 * The HTML with each footprint's piece given its paint level (`levelOf(foot)`, the floor's order) in its style. Only
 * the style's value changes: the piece's own attributes and words stay as written.
 */
export function paintFootprints(html, feet, levelOf) {
  let out = '', from = 0;
  for (const foot of feet) {
    out += `${html.slice(from, foot.start)}<${foot.tag}${foot.run.slice(0, foot.valueAt)}z-index:${levelOf(foot)};${foot.run.slice(foot.valueAt)}>`;
    from = foot.end;
  }
  return out + html.slice(from);
}
