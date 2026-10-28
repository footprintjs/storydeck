// transforms — the drawing helpers a deck's HTML may use, applied before its pieces are read. Plain strings in,
// plain strings out; no deck code runs, so a dev server never executes what it serves.
//
//   <i data-k="wire1" class="wire pkt" data-arrow="252 352 318 352"></i>   a wire: an SVG arrow in slide pixels
//   <i data-k="req" class="wire" data-arrow="client to server"></i>         a wire between two pieces, edge to edge
//   <i class="ic" data-icon="server"></i>                                  a drawn identity: icons/server.svg inline
//
// A wire is `x1 y1 x2 y2` and an optional bend (px off the straight line, + to the left of travel), or the pieces it
// joins, `from to to` and an optional bend ("client to server 24"; words, as a ">" would end the tag): it runs from the edge of one's box to the edge of the other's, so a piece
// moved takes its wires with it, and two wires between the same pieces (a request and its answer) each keep a lane of
// their own. A wire between pieces carries data-ends="from to", so a click can light a piece and what it touches
// (focus.js · expandNames: `data-on="gw+"`). Either way it is a quadratic curve with an arrow head, in an <svg> placed and sized to hold it, so it is a focus piece like any other (its
// data-k and class are kept, and "wire" is added to its class). Class "pkt" adds a packet that rides the curve itself
// on a path click (hidden at rest, so print, a jump and reduced motion show the plain wire); a wire that comes in draws
// itself, start to tip.

import {stripComments} from './html.js';
import {readPieces} from '../focusHtml.js';

const fixed = (v) => +v.toFixed(1);
/** A wire written by the pieces it joins: "from to to [bend]". */
const BETWEEN = /^\s*(\S+)\s+to\s+(\S+)(?:\s+(-?\d+(?:\.\d+)?))?\s*$/;
/** The pieces a wire's data-arrow joins, [from, to] — or null for a wire written in numbers. */
export const wireEnds = (spec) => { const m = BETWEEN.exec(spec); return m ? [m[1], m[2]] : null; };
const LANE = 80;   // px between two wires joining the same pieces, at most (less when a box is too small to hold them)
const GAP = 6;     // px between a wire's end and the box it leaves or reaches

/** One wire's SVG: the element's own attributes kept, a box that holds the curve, the curve, the head, and its packet. */
function wireSvg(attrs, spec) {
  const parts = spec.trim().split(/[\s,]+/).map(Number);
  if ((parts.length !== 4 && parts.length !== 5) || parts.some((n) => !Number.isFinite(n))) {
    throw new Error(`data-arrow="${spec}": a wire is the pieces it joins, "from to to" ("client to server"), or "x1 y1 x2 y2" in slide px — either with an optional bend`);
  }
  const [x1, y1, x2, y2, bend = 0] = parts;
  const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1;
  const cx = (x1 + x2) / 2 - (dy / len) * bend, cy = (y1 + y2) / 2 + (dx / len) * bend;
  const tl = Math.hypot(x2 - cx, y2 - cy) || 1, ux = (x2 - cx) / tl, uy = (y2 - cy) / tl, hs = 18;
  const pad = 20, X = Math.min(x1, x2, cx) - pad, Y = Math.min(y1, y2, cy) - pad;
  const W = Math.max(x1, x2, cx) + pad - X, H = Math.max(y1, y2, cy) + pad - Y, f = fixed;
  const ex = x2 - ux * hs * 0.8, ey = y2 - uy * hs * 0.8;
  const d = `M${f(x1 - X)} ${f(y1 - Y)} Q${f(cx - X)} ${f(cy - Y)} ${f(ex - X)} ${f(ey - Y)}`;
  const tip = [x2 - X, y2 - Y], back = [tip[0] - ux * hs, tip[1] - uy * hs], nx = -uy * hs * 0.6, ny = ux * hs * 0.6;
  const head = `<path class="head" d="M${f(tip[0])} ${f(tip[1])}L${f(back[0] + nx)} ${f(back[1] + ny)}L${f(back[0] - nx)} ${f(back[1] - ny)}Z"/>`;
  let at = attrs.replace(/\sclass="([^"]*)"/, (_, c) => ` class="${/(^|\s)wire(\s|$)/.test(c) ? c : `wire ${c}`}"`);
  if (!/\sclass="/.test(at)) at += ' class="wire"';
  // the packet rides the curve itself (deck.css · sdPkt): its control point and its end, from where it starts
  const pkt = /\bpkt\b/.test(at)
    ? `<rect class="pkt" x="${f(x1 - X - 8)}" y="${f(y1 - Y - 6)}" width="16" height="12" rx="3" style="--cdx:${f(cx - x1)}px;--cdy:${f(cy - y1)}px;--pdx:${f(ex - x1)}px;--pdy:${f(ey - y1)}px"/>`
    : '';
  // which way it runs, start to tip, as a CSS angle (0 up, 90 right): a wire coming in shows itself that way (deck.css · sdReveal)
  const angle = f((Math.atan2(dx, -dy) * 180) / Math.PI);
  return `<svg${at} style="left:${f(X)}px;top:${f(Y)}px;width:${f(W)}px;height:${f(H)}px;--sd-angle:${angle}deg" viewBox="0 0 ${f(W)} ${f(H)}" aria-hidden="true"><path d="${d}"/>${head}${pkt}</svg>`;
}

/**
 * Every empty <i …></i> whose attributes hold `rule`, in order: [{start, end, before, m, after}] — `m` the rule's match.
 * One pass: an attempt ends at the next "<" or ">", so a deck of unfinished <i …> tags, or one tag repeating an
 * attribute, costs no more than its length.
 */
function emptyI(html, rule) {
  const out = [];
  for (const t of html.matchAll(/<i\b([^<>]*)><\/i>/g)) {
    const m = rule.exec(t[1]);
    if (m) out.push({start: t.index, end: t.index + t[0].length, before: t[1].slice(0, m.index), m, after: t[1].slice(m.index + m[0].length)});
  }
  return out;
}

/** The empty tags `found` in `html`, each replaced by `draw(found, index)`. */
function replaceEach(html, found, draw) {
  let out = '', from = 0;
  found.forEach((f, i) => { out += html.slice(from, f.start) + draw(f, i); from = f.end; });
  return out + html.slice(from);
}

/** How far a ray from p (inside the box) along the unit vector u runs before it leaves the box. */
function exit(b, [px, py], [ux, uy]) {
  const tx = ux > 0 ? (b.x + b.w - px) / ux : ux < 0 ? (b.x - px) / ux : Infinity;
  const ty = uy > 0 ? (b.y + b.h - py) / uy : uy < 0 ? (b.y - py) / uy : Infinity;
  return Math.min(tx, ty);
}

/**
 * Each wire written between pieces as its numbers, "x1 y1 x2 y2 bend" (others: null). A piece is found by its first
 * data-k name and must be placed (inline left, top, width and height); several pieces with that first name are one
 * box around them. Wires joining the same two pieces are spread across the line between their middles, LANE apart at
 * most and always inside both boxes, each keeping to its left (a request going right above its answer coming back,
 * whatever the pieces are called), in the order written; each then runs from the edge of one box to the edge of the
 * other, GAP clear of both.
 */
function wiresBetween(html, found) {
  const read = found.map((f) => BETWEEN.exec(f.m[1]));
  if (!read.some(Boolean)) return read;
  const {pieces} = readPieces(html), placed = pieces.filter((p) => p.box && p.box.w > 0 && p.box.h > 0);
  const boxOf = (name, spec) => {
    const boxes = placed.filter((p) => p.keys[0] === name).map((p) => p.box);
    if (!boxes.length) {
      const names = [...new Set(placed.map((p) => p.keys[0]))];
      throw new Error(`data-arrow="${spec}": no piece "${name}" with a box (data-k, and an inline left, top, width and height)${names.length ? ` — the placed pieces are ${names.slice(0, 20).join(', ')}${names.length > 20 ? ', …' : ''}` : ''}`);
    }
    const x0 = Math.min(...boxes.map((b) => b.x)), y0 = Math.min(...boxes.map((b) => b.y));
    return {x: x0, y: y0, w: Math.max(...boxes.map((b) => b.x + b.w)) - x0, h: Math.max(...boxes.map((b) => b.y + b.h)) - y0};
  };
  // a pair's wires across its line, in its own direction (its names in order): those running that way first, on their
  // left of it, then those running back — on their own left
  const pairOf = (m) => [m[1], m[2]].sort().join('\u0000'), lanes = new Map();
  read.forEach((m, i) => { if (m) lanes.set(pairOf(m), [...(lanes.get(pairOf(m)) ?? []), i]); });
  for (const [key, ids] of lanes) {
    const along = (i) => read[i][1] === key.split('\u0000')[0];
    lanes.set(key, [...ids.filter(along), ...ids.filter((i) => !along(i))]);
  }
  return read.map((m, i) => {
    if (!m) return null;
    const spec = found[i].m[1];
    if (m[1] === m[2]) throw new Error(`data-arrow="${spec}": a wire joins two pieces, not "${m[1]}" to itself`);
    // in the pair's own direction (its names in order), so the wires both ways share one set of lanes
    const [a, b] = [m[1], m[2]].sort(), A = boxOf(a, spec), B = boxOf(b, spec);
    const ca = [A.x + A.w / 2, A.y + A.h / 2], cb = [B.x + B.w / 2, B.y + B.h / 2], len = Math.hypot(cb[0] - ca[0], cb[1] - ca[1]);
    if (len === 0) throw new Error(`data-arrow="${spec}": "${a}" and "${b}" share a middle — place them apart, or give the wire numbers`);
    const u = [(cb[0] - ca[0]) / len, (cb[1] - ca[1]) / len], n = [-u[1], u[0]];
    // half the box measured across the line: a lane closer to the middle than this, less 8 px, crosses the box, so its
    // ends are found on the box's edges (exit: from any point of such a line, as the line leaves the box)
    const across = (box) => (Math.abs(n[0]) * box.w + Math.abs(n[1]) * box.h) / 2;
    const lane = lanes.get(pairOf(m)), k = lane.indexOf(i), most = Math.max(0, Math.min(across(A), across(B)) - 8);
    const step = lane.length > 1 ? Math.min(LANE, (2 * most) / (lane.length - 1)) : 0, off = (k - (lane.length - 1) / 2) * step;
    const pa = [ca[0] + n[0] * off, ca[1] + n[1] * off], pb = [cb[0] + n[0] * off, cb[1] + n[1] * off];
    const ta = exit(A, pa, u) + GAP, tb = exit(B, pb, [-u[0], -u[1]]) + GAP;
    if (len - ta - tb < 12) throw new Error(`data-arrow="${spec}": "${a}" and "${b}" are too close for a wire between them (they touch or overlap) — move them apart, or give the wire numbers`);
    const start = [pa[0] + u[0] * ta, pa[1] + u[1] * ta], end = [pb[0] - u[0] * tb, pb[1] - u[1] * tb];
    const [from, to] = m[1] === a ? [start, end] : [end, start];
    return [...from, ...to, Number(m[3] ?? 0)].map(fixed).join(' ');
  });
}

/**
 * Every wire as written — <i … data-arrow="x1 y1 x2 y2 [bend]" …></i>, or "from to to [bend]" — in order: [{start, end, before, m, after}], `m[1]`
 * its spec. The one rule, so what wires() draws is what an edit moves (edit.js).
 */
export const wireTags = (html) => emptyI(html, /\sdata-arrow="([^"<>]+)"/);

/** Every <i data-arrow="…"></i> as its wire; one written between pieces runs between their boxes and carries data-ends. */
export function wires(html) {
  const found = wireTags(html), between = wiresBetween(html, found);
  return replaceEach(html, found, ({before, m, after}, i) => {
    if (!between[i]) return wireSvg(before + after, m[1]);
    const [, from, to] = BETWEEN.exec(m[1]);
    return wireSvg(` data-ends="${from} ${to}"${before}${after}`, between[i]);
  });
}

/** An icon file's drawing: {viewBox, body} from a whole <svg …>…</svg>. */
export function readIcon(name, svg) {
  const text = stripComments(svg).replace(/^\s*<\?xml[^>]*>/, '').trim();
  // its first <svg …> and the </svg> that ends the file, each found once: a file of unfinished tags stays linear
  const start = text.search(/<svg\b/), open = start < 0 ? -1 : text.indexOf('>', start), close = text.length - '</svg>'.length;
  if (open < 0 || !text.endsWith('</svg>') || close <= open) throw new Error(`icon "${name}": an icon file is one <svg viewBox="…">…</svg>`);
  const viewBox = /\sviewBox=(["'])([^"']+)\1/.exec(text.slice(start + 4, open))?.[2];
  if (!viewBox) throw new Error(`icon "${name}": its <svg> has no viewBox — give it one (e.g. viewBox="0 0 64 64")`);
  return {viewBox, body: text.slice(open + 1, close).trim()};
}

/** Every <i … data-icon="name"></i> as that icon's SVG, keeping the element's other attributes. */
export function icons(html, set = {}) {
  return replaceEach(html, emptyI(html, /\sdata-icon="([\w-]+)"/), ({before, m, after}) => {
    const icon = Object.hasOwn(set, m[1]) ? set[m[1]] : null;
    if (!icon) {
      const known = Object.keys(set);
      throw new Error(`no icon "${m[1]}" (${known.length ? `there are ${known.join(', ')}` : 'the deck has no icons'}) — add icons/${m[1]}.svg`);
    }
    return `<svg${before}${after} viewBox="${icon.viewBox}" aria-hidden="true">${icon.body}</svg>`;
  });
}

/** The built-in helpers, in the order they run: icons first (a wire never holds one), then wires. */
export function applyTransforms(html, {icons: set = {}} = {}) {
  return wires(icons(html, set));
}
