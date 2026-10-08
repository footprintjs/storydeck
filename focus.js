// Focus — what a click is about, and what happens to everything else on the slide.
//
// A slide of this kind is drawn once: a set of named PIECES that keep their places (a diagram, a page,
// a timeline). Each CLICK says which pieces are there and which ones it is about — its SUBJECT; the
// rest of what is shown is the CONTEXT. A FOCUS STRATEGY says how the two are shown. There are four
// kinds, and a click takes one of each at most:
//
//   look     how the context looks     grey (greyed in place — the default) · hide · keep
//   mover    where things go           zoom (the view closes in on the subject) ·
//                                      left · right · up · down (the context steps aside that way, smaller,
//                                      and the subject grows into the room it leaves) ·
//                                      place (named groups moved by the amounts you give — a layout you
//                                      art-direct, still animated from wherever the last click left it)
//   overlay  what lies over the slide  blur (everything outside the subject's frame is blurred; a frame,
//                                      and a label if given, on the subject)
//   order    how the subject comes on  all at once (the default) · path (piece after piece along a route —
//                                      a request travelling node, wire, node — each lighting in turn, with
//                                      a line that names the route if given)
//
// So `'left blur'` is: the context steps aside to the left, greyed, under a blur, and the subject grows on
// the right inside a frame. A deck can bring strategies of its own (`strategies`), of any kind.
//
// The plan is plain data — each piece's state, what changed since the last click, how far it moved —
// so a renderer only draws it: focusHtml.js writes it into slide HTML at build time, and focus.css
// animates only what changed, and only on a forward click (a jump or a step back lands at once).
//
// Coordinates: pieces live on the MAP (their own left/top/width/height). `view` maps the map onto the
// slide (p' = s·p + [x, y]; the identity unless the map is drawn scaled or shifted); `area` is the part
// of the slide (slide pixels) where moved things may go — below a headline, above a footer.

const KINDS = ['look', 'mover', 'overlay', 'order'];

/** A box {x, y, w, h} around a list of boxes (null for none). */
function union(boxes) {
  const known = boxes.filter(Boolean);
  if (!known.length) return null;
  const x0 = Math.min(...known.map(b => b.x)), y0 = Math.min(...known.map(b => b.y));
  const x1 = Math.max(...known.map(b => b.x + (b.w ?? 0))), y1 = Math.max(...known.map(b => b.y + (b.h ?? 0)));
  return {x: x0, y: y0, w: x1 - x0, h: y1 - y0};
}
const centre = b => [b.x + b.w / 2, b.y + b.h / 2];
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const num = (v, d) => (v === undefined || v === null || v === '' ? d : Number(v));
const round = (v, d = 2) => Math.round(v * 10 ** d) / 10 ** d;
/** A group move {o, s, t}: a point p goes to o + s·(p − o) + t. */
const apply = (g, [x, y]) => [g.o[0] + g.s * (x - g.o[0]) + g.t[0], g.o[1] + g.s * (y - g.o[1]) + g.t[1]];
const moveBox = (g, b) => { const [x, y] = apply(g, [b.x, b.y]); return {x, y, w: b.w * g.s, h: b.h * g.s}; };
/** A group that moves box b so that its centre lands on point c, scaled by s. */
const toCentre = (b, s, c) => { const o = centre(b); return {o, s, t: [c[0] - o[0], c[1] - o[1]]}; };

/** The area (slide pixels) in map coordinates, through the inverse of the view. */
function areaOnMap([x0, y0, x1, y1], v) {
  return {x: (x0 - v.x) / v.s, y: (y0 - v.y) / v.s, w: (x1 - x0) / v.s, h: (y1 - y0) / v.s};
}

/**
 * The context steps aside towards `side`, scaled by `scale`, and the subject grows (up to `grow`) into the
 * room it leaves. Options: scale (0.6), gap (40 slide px), grow (1.4), fill (0.9 of the room), least (0.5),
 * align ('center' · 'start' · 'end' across the side); subject and aside name the two groups (default: what
 * the click lights, and the rest shown); move: 'aside' moves only the context (the subject stays put).
 */
function aside(side) {
  return Object.freeze({name: side, kind: 'mover', place({subject, context, area, view, options}) {
    if (!context || !subject) return {};
    const s = num(options.scale, .6), gap = num(options.gap, 40) / (view?.s ?? 1), grow = num(options.grow, 1.4), fill = num(options.fill, .9);
    const w = context.w * s, h = context.h * s, a = area, align = options.align ?? 'center';
    const across = (lo, size, own) => align === 'start' ? lo + gap + own / 2 : align === 'end' ? lo + size - gap - own / 2 : lo + size / 2;
    const at = {left: [a.x + gap + w / 2, across(a.y, a.h, h)], right: [a.x + a.w - gap - w / 2, across(a.y, a.h, h)],
      up: [across(a.x, a.w, w), a.y + gap + h / 2], down: [across(a.x, a.w, w), a.y + a.h - gap - h / 2]}[side];
    const room = {left: {x: a.x + 2 * gap + w, y: a.y, w: a.w - 2 * gap - w, h: a.h}, right: {x: a.x, y: a.y, w: a.w - 2 * gap - w, h: a.h},
      up: {x: a.x, y: a.y + 2 * gap + h, w: a.w, h: a.h - 2 * gap - h}, down: {x: a.x, y: a.y, w: a.w, h: a.h - 2 * gap - h}}[side];
    const fit = Math.min(Math.max(room.w, 1) / Math.max(subject.w, 1), Math.max(room.h, 1) / Math.max(subject.h, 1)) * fill;
    return {context: toCentre(context, s, at), ...(options.move === 'aside' ? {} : {subject: toCentre(subject, clamp(fit, num(options.least, .5), grow), centre(room))})};
  }});
}

/** place's groups: 'names: dx dy scale [@ ox oy] | …' (or a list of such strings). */
function readGroups(v) {
  if (v === undefined || v === null || v === '') throw new Error('focus "place": give groups, \'names: dx dy scale [@ ox oy] | …\'');
  return [].concat(v).flatMap(x => String(x).split('|')).map(g => g.trim()).filter(Boolean).map(g => {
    const m = /^([^:]+):\s*(-?[\d.]+)\s+(-?[\d.]+)(?:\s+(-?[\d.]+))?(?:\s*@\s*(-?[\d.]+)\s+(-?[\d.]+))?$/.exec(g);
    if (!m) throw new Error(`focus "place": a group is 'names: dx dy scale [@ ox oy]', not "${g}"`);
    return {names: m[1].trim().split(/\s+/), dx: Number(m[2]), dy: Number(m[3]), s: m[4] === undefined ? 1 : Number(m[4]), origin: m[5] === undefined ? null : [Number(m[5]), Number(m[6])]};
  });
}

/** Rectangles x y w h from an option: numbers, a string of them, or a list of either. */
function readRects(v) {
  const r = [].concat(v).flatMap(x => String(x).trim().split(/[\s,]+/)).filter(Boolean).map(Number);
  if (!r.length || r.length % 4 || r.some(n => !Number.isFinite(n))) throw new Error(`focus "blur": rect is x y w h (several are fine), not "${v}"`);
  return Array.from({length: r.length / 4}, (_, i) => r.slice(i * 4, i * 4 + 4));
}

/** The built-in strategies, by name. */
export const FOCUS = Object.freeze({
  grey: Object.freeze({name: 'grey', kind: 'look', look: 'grey'}),
  hide: Object.freeze({name: 'hide', kind: 'look', look: 'hide'}),
  keep: Object.freeze({name: 'keep', kind: 'look', look: 'keep'}),
  /** The view closes in on the subject, so it fills `share` (0.7) of the area, never closer than `most` (2.5×). */
  zoom: Object.freeze({name: 'zoom', kind: 'mover', place({subject, area, options}) {
    if (!subject) return {};
    const k = clamp(num(options.share, .7) * Math.min(area.w / Math.max(subject.w, 1), area.h / Math.max(subject.h, 1)), 1, num(options.most, 2.5));
    return {stage: toCentre(subject, k, centre(area))};
  }}),
  left: aside('left'), right: aside('right'), up: aside('up'), down: aside('down'),
  /**
   * Named groups moved by the amounts you give: `groups` is 'names: dx dy scale [@ ox oy] | names: …' — each group
   * moves by dx, dy (slide px) and scales around its own centre, or around the point ox oy (map px) when given.
   */
  place: Object.freeze({name: 'place', kind: 'mover', place({boxOf, view, options}) {
    return {groups: readGroups(options.groups).map(({names, dx, dy, s, origin}) => {
      const box = boxOf(names); if (!box && !origin) return {names, g: null};
      const o = origin ?? centre(box);
      return {names, g: {o, s, t: [dx / view.s, dy / view.s]}};
    })};
  }}),
  /**
   * The subject comes on piece after piece along a route, as a request travels it: `route` names the pieces in
   * order (default — and for an empty `route` too — the click's `on`, or its `in`, in the order written), each lit
   * one lights `step` (0.35) s after the one before and glows as it is reached; `line` is text that names the route
   * ("agent → MCP → gateway"), shown when the route is done, at `lineAt` (x y, slide px; default the area's bottom
   * left). A lit piece not on the route lights at once. A route still empty (`on: ['*']` names no order) is refused.
   */
  path: Object.freeze({name: 'path', kind: 'order', route({names, options}) {
    const step = num(options.step, .35);
    if (!(step >= 0 && step <= 5)) throw new Error(`focus "path": step is the seconds between two pieces of the route (0–5), not "${options.step}"`);
    const route = options.route === undefined || options.route === null ? [] : [].concat(options.route).flatMap(x => String(x).trim().split(/\s+/)).filter(x => x && x !== '*');
    const order = route.length ? route : names;
    if (!order.length) throw new Error('focus "path": the route is empty — write the pieces in the order they light, in `on` or `route` (\'*\' names no order)');
    return {names: order, step, line: options.line ?? '', lineAt: options.lineAt ?? null};
  }}),
  /**
   * Everything outside the frame is blurred. The frame is `rect` (slide px, x y w h; several are fine — the
   * first gets the frame and the label, the others are clear holes too) or, without one, the subject where it
   * ends up, `pad` (24) px around it. `out: 'first'` keeps only the frame clear while the blur leaves (what sat
   * beside it melts into the blur).
   */
  blur: Object.freeze({name: 'blur', kind: 'overlay', cover({subjectOnSlide, options}) {
    const pad = num(options.pad, 24), b = subjectOnSlide;
    const rects = options.rect !== undefined && options.rect !== '' ? readRects(options.rect) : b ? [[b.x - pad, b.y - pad, b.w + 2 * pad, b.h + 2 * pad]] : [];
    if (!rects.length) return null;
    const holes = rects.map(q => q.map(n => Math.round(n)));
    return {rects: holes, label: options.label ?? '', out: options.out === 'first' ? holes.slice(0, 1) : holes};
  }}),
});

/**
 * A click's focus, read: a name ('left'), several ('left blur', or a list), or objects {strategy, …options};
 * `shared` options go to every strategy of the click. Returns [{strategy, options}].
 */
export function readFocus(spec, shared = {}) {
  if (spec === undefined || spec === null || spec === '') return [];
  const list = Array.isArray(spec) ? spec : typeof spec === 'string' ? spec.trim().split(/\s+/) : [spec];
  return list.flatMap(x => typeof x === 'string' ? x.trim().split(/\s+/).filter(Boolean).map(name => ({strategy: name, options: {...shared}}))
    : x && typeof x === 'object' && typeof x.strategy === 'string' ? [{strategy: x.strategy, options: {...shared, ...omit(x, 'strategy')}}]
    : (() => { throw new Error(`a focus is a strategy name, a list of them, or {strategy, …options}; not ${JSON.stringify(x)}`); })());
}
const omit = (o, k) => { const {[k]: _, ...rest} = o; return rest; };

/** The strategies of a click, checked: known names, at most one of each kind. */
function pick(focus, strategies) {
  const all = {...FOCUS, ...strategies}, byKind = {};
  for (const {strategy, options} of focus) {
    const s = all[strategy];
    if (!s) throw new Error(`no focus strategy "${strategy}" (there are ${Object.keys(all).join(', ')})`);
    if (!KINDS.includes(s.kind)) throw new Error(`focus strategy "${strategy}" has kind ${JSON.stringify(s.kind)}: a strategy is a look, a mover, an overlay or an order`);
    if (byKind[s.kind]) throw new Error(`a click takes one ${s.kind} at most: "${byKind[s.kind].name}" and "${strategy}" are both ${s.kind}s`);
    byKind[s.kind] = {s: {...s, name: s.name ?? strategy}, options, name: strategy};
  }
  return byKind;
}

/**
 * What an order's `route()` gave, checked like its kind — a deck's own order is held to what the built-in gives —
 * and read into a new object (the strategy's own is never written to): line '' and lineAt null when it gives none.
 */
function readRoute(r, strategy) {
  const shown = v => (typeof v === 'number' || v === undefined ? String(v) : JSON.stringify(v));
  const refuse = fix => { throw new Error(`focus "${strategy}": ${fix}`); };
  if (!r || typeof r !== 'object') refuse(`route() gives {names, step, line?, lineAt?}, not ${shown(r)}`);
  const {names, step, line, lineAt} = r;
  if (!Array.isArray(names) || names.some(n => typeof n !== 'string')) refuse(`a route's names are a list of piece names, in the order they light — not ${shown(names)}`);
  if (typeof step !== 'number' || !Number.isFinite(step) || step < 0 || step > 5) refuse(`a route's step is the seconds between two turns, a number from 0 to 5 — not ${shown(step)}`);
  if (line !== undefined && typeof line !== 'string') refuse(`a route's line is text that names it, or left out — not ${shown(line)}`);
  if (lineAt !== undefined && lineAt !== null && typeof lineAt !== 'string') refuse(`a route's lineAt is 'x y' in slide px, null, or left out — not ${shown(lineAt)}`);
  return {names: [...names], step, line: line ?? '', lineAt: lineAt ?? null};
}

/** Where a group move puts one piece: its reference point (the centre, or the top-left when it has no size) moves by [dx, dy], and it scales by s around it. */
function placePiece(g, box) {
  if (!g || !box) return null;
  const sized = box.w > 0 && box.h > 0, c = sized ? centre(box) : [box.x, box.y], [x, y] = apply(g, c);
  const move = {dx: round(x - c[0]), dy: round(y - c[1]), s: round(g.s, 4), origin: sized ? 'center' : 'top-left'};
  return move.dx === 0 && move.dy === 0 && move.s === 1 ? null : move;
}
const sameMove = (a, b) => (!a && !b) || (a && b && a.dx === b.dx && a.dy === b.dy && a.s === b.s);
const sameStage = (a, b) => (!a && !b) || (a && b && a.s === b.s && a.x === b.x && a.y === b.y);
const sameCover = (a, b) => JSON.stringify(a?.rects ?? null) === JSON.stringify(b?.rects ?? null) && (a?.label ?? '') === (b?.label ?? '');

/**
 * What changed for one piece since the last click — the only thing that animates. A greyed piece's look
 * counts: one kept in colour that is lit again does not change, one that was hidden comes in, and a greyed
 * piece whose look changes (grey ↔ hide ↔ keep) changes from its old look.
 */
function changeOf(st, was, look, wasLook, entering, before) {
  if (st === 'gone') return was !== 'gone' ? 'leave' : null;
  if (!before) return entering ? 'enter' : 'arrive';
  if (was === 'gone') return 'enter';
  if (was === 'dim' && st === 'on') return wasLook === 'hide' ? 'enter' : wasLook === 'keep' ? null : 'light';
  if (was === 'on' && st === 'dim') return look === 'keep' ? null : 'fade';
  if (was === 'dim' && st === 'dim' && wasLook !== look) return 'relook';
  return null;
}

/**
 * One click. `prev` is the state the last click left (null on a slide's first click when the map arrives
 * fresh). `deck`: {pieces: [{keys, box, twin?}], strategies?, area?, view?, canvas?}. Returns {state, look}:
 * the state to hand the next click, and the look to draw — per piece {state, was, change, look, fromLook, hot,
 * hotIn, move, from, twinOff, twinTurn (stepping aside for a lit twin on a route: the seconds until that twin's
 * turn; else null), path (a lit piece on a route: the seconds until its turn; else null)}, the stage's move, the
 * overlay, the path ({turns, step, done, line, lineAt}, or null) and which strategies were used.
 */
export function focusStep(prev, step, deck) {
  const {pieces, strategies = {}} = deck, canvas = deck.canvas ?? {w: 1920, h: 1080};
  const view = deck.view ?? {s: 1, x: 0, y: 0}, areaSlide = deck.area ?? [0, 0, canvas.w, canvas.h];
  const names = l => (l ?? []).flatMap(x => String(x).trim().split(/\s+/)).filter(Boolean);
  const ins = names(step.in), outs = names(step.out), on = step.on === undefined || step.on === null ? null : names(step.on), hot = names(step.hot);
  const has = (i, l) => l.includes('*') || l.some(x => pieces[i].keys.includes(x));
  const known = (l, what) => { for (const x of l) if (x !== '*' && !pieces.some(p => p.keys.includes(x))) throw new Error(`${what}no piece "${x}" (the pieces are named ${[...new Set(pieces.flatMap(p => p.keys))].join(', ')})`); return l; };
  known([...ins, ...outs, ...(on ?? []), ...hot], '');
  const vis = new Set(prev?.vis ?? []);
  pieces.forEach((_, i) => { if (has(i, ins)) vis.add(i); if (has(i, outs)) vis.delete(i); });
  const states = pieces.map((_, i) => !vis.has(i) ? 'gone' : !on || has(i, on) || (!step.quiet && has(i, ins)) ? 'on' : 'dim');
  // A piece with a twin (a dashed wire under a solid one) steps aside while its twin is lit, so the two never show at once.
  const litTwins = pieces.map((p, i) => p.twin?.length ? pieces.map((_, j) => j).filter(j => j !== i && states[j] === 'on' && p.twin.some(t => pieces[j].keys.includes(t))) : []);
  const twinOff = new Set(pieces.map((_, i) => i).filter(i => states[i] !== 'gone' && litTwins[i].length));
  twinOff.forEach(i => { states[i] = 'gone'; });
  const chosen = pick(readFocus(step.focus, step.options), strategies);
  const look = chosen.look?.s.look ?? 'grey';
  // Movers first: where the subject and the context go. Then the overlay, around the subject where it ends up.
  // By default the subject is what the click lights and the context the rest shown; a mover's `subject` and
  // `aside` options name the two groups instead (a lit page can still step aside for the timeline it holds).
  const all = pieces.map((_, i) => i), mo = chosen.mover?.options ?? {};
  const group = (v, what) => (v === undefined || v === null || v === '' ? null : known(names([].concat(v)), `focus ${what}: `));
  const grows = group(mo.subject, 'subject'), asides = group(mo.aside, 'aside');
  const subjectIdx = grows ? all.filter(i => states[i] !== 'gone' && has(i, grows)) : all.filter(i => states[i] === 'on');
  const contextIdx = (asides ? all.filter(i => states[i] !== 'gone' && has(i, asides)) : all.filter(i => states[i] === 'dim')).filter(i => !subjectIdx.includes(i));
  const inGroup = new Map([...contextIdx.map(i => [i, 'context']), ...subjectIdx.map(i => [i, 'subject'])]);
  const subject = union(subjectIdx.map(i => pieces[i].box)), context = union(contextIdx.map(i => pieces[i].box)), area = areaOnMap(areaSlide, view);
  // boxOf(names): the box around the shown pieces of those names, for a mover that moves named groups (place).
  const boxOf = l => union(all.filter(i => states[i] !== 'gone' && has(i, known(names([].concat(l)), 'focus group: '))).map(i => pieces[i].box));
  const placed = chosen.mover ? chosen.mover.s.place({subject, context, area, view, canvas, boxOf, options: chosen.mover.options}) ?? {} : {};
  // Named groups (later ones win a piece in two of them) take their pieces out of the subject and context groups.
  for (const {names: l, g} of placed.groups ?? []) for (const i of all) if (states[i] !== 'gone' && has(i, l)) inGroup.set(i, g ? {g} : 'still');
  const stage = placed.stage ? {s: round(placed.stage.s, 4), x: round(placed.stage.o[0] * (1 - placed.stage.s) + placed.stage.t[0]), y: round(placed.stage.o[1] * (1 - placed.stage.s) + placed.stage.t[1])} : null;
  const groupOf = i => { const k = inGroup.get(i); return k === 'subject' ? placed.subject : k === 'context' ? placed.context : k?.g ?? null; };
  const moves = pieces.map((p, i) => states[i] === 'gone' ? null : placePiece(groupOf(i), p.box));
  const ends = subject && (placed.stage ?? placed.subject) ? moveBox(placed.stage ?? placed.subject, subject) : subject;
  const subjectOnSlide = ends ? {x: ends.x * view.s + view.x, y: ends.y * view.s + view.y, w: ends.w * view.s, h: ends.h * view.s} : null;
  const cover = chosen.overlay ? chosen.overlay.s.cover({subjectOnSlide, canvas, options: chosen.overlay.options}) : null;
  const looks = pieces.map((_, i) => states[i] === 'dim' ? look : null);
  // An order: the subject piece after piece along a route. The LIT pieces of each name on it take the next turn
  // together — a name with nothing lit takes none, so a greyed piece never waits or glows grey; a piece named twice
  // keeps its first turn.
  const order = chosen.order ? readRoute(chosen.order.s.route({names: (on ?? ins).filter(x => x !== '*'), options: chosen.order.options}), chosen.order.name) : null;
  const turnOf = new Map();
  let turns = 0;
  for (const name of order ? known(order.names, 'focus route: ') : []) {
    const reached = all.filter(i => states[i] === 'on' && pieces[i].keys.includes(name) && !turnOf.has(i));
    reached.forEach(i => turnOf.set(i, turns));
    if (reached.length) turns += 1;
  }
  const delayOf = i => (turnOf.has(i) ? round(turnOf.get(i) * order.step, 3) : null);
  // A piece stepping aside for a lit twin on the route stays until that twin's turn (the first of them to come), then
  // goes — so the wire never goes missing while its twin waits; a lit twin off the route lights at once, and so it goes.
  const twinTurn = i => (litTwins[i].length && litTwins[i].every(j => turnOf.has(j)) ? Math.min(...litTwins[i].map(delayOf)) : null);
  // What changed since the last click: only that moves. A piece that leaves keeps how it looked and where it
  // stood, so it fades out from there instead of jumping home in colour first.
  const before = prev && !step.fresh ? prev : null;
  const hotNow = new Set(all.filter(i => states[i] !== 'gone' && has(i, hot)));
  const out = pieces.map((p, i) => {
    const st = states[i], was = before ? before.states[i] : 'gone', wasLook = before?.looks?.[i] ?? null;
    const change = changeOf(st, was, looks[i], wasLook, has(i, ins), before);
    const leaving = change === 'leave', stood = before?.moves[i] ?? null;
    const from = stood, moved = st !== 'gone' && was !== 'gone' && !!before && !sameMove(from, moves[i]);
    return {state: st, was, change, look: leaving ? wasLook : looks[i], fromLook: change === 'relook' ? wasLook : null,
      hot: hotNow.has(i), hotIn: hotNow.has(i) && (!before || !before.hot.has(i)),
      move: leaving ? stood : st === 'gone' ? null : moves[i], from: moved ? from ?? {dx: 0, dy: 0, s: 1} : null, twinOff: twinOff.has(i),
      twinTurn: leaving && twinOff.has(i) ? twinTurn(i) : null, path: delayOf(i)};
  });
  const stageMoved = !!before && !sameStage(before.stage, stage);
  // The blur: new only when the last click had none (a blur that moves to another subject stays, and only its
  // frame is new); on the first click without it, it melts away from where it was.
  const overlay = cover ? {rects: cover.rects, label: cover.label, phase: before?.cover ? 'in' : 'in-new', frameNew: !before?.cover || !sameCover(before.cover, cover)}
    : before?.cover ? {rects: before.cover.out ?? before.cover.rects, label: '', phase: 'out', frameNew: false} : null;
  return {
    state: {vis, states, moves, stage, hot: hotNow, cover, looks},
    look: {pieces: out, stage: stage || stageMoved ? {move: stage, from: stageMoved ? before.stage ?? {s: 1, x: 0, y: 0} : null} : null, overlay,
      path: turns ? {turns, step: order.step, done: round((turns - 1) * order.step, 3), line: order.line, lineAt: order.lineAt} : null,
      strategies: Object.values(chosen).map(c => c.name), subject: subjectOnSlide},
  };
}

/** Every click of a slide, in order: {looks, end} — end is the state to start the next slide from on the same map. */
export function planFocus(steps, deck, start = null) {
  let state = start;
  const looks = steps.map((step, k) => { const r = focusStep(state, k === 0 && !start ? {...step, fresh: true} : step, deck); state = r.state; return r.look; });
  return {looks, end: state};
}
