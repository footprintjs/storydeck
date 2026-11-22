// motionDraw — an isometric map's planned moves (motionPlan.js) written into its slides: on each click every block that
// has moved rests where its last move left it, and the moves of the click play as CSS keyframes made from
// footprint-story's own samples. Nothing is worked out again: each keyframe is a sample (sampleMove) at its moment, the
// numbers written to a millionth of a px.
//
//   motionView(plan, map, {id}) → {css, click(ci), moved(ci)}
//
// THE CARRIERS, one honest one for each way a deck is shown:
//   - the page: a block's words and faces sit in a wrapper (iso.js · `.iso-motion`) whose inline `transform` is its
//     rest on that click; the click's move is a CSS animation of that transform (and of the block's paint level, and
//     a hang's rope), played only on a forward click into the slide, after its view has arrived (var(--sd-arrive-at)),
//     never on a jump, a step back, under reduced motion or with motion off (the gate focus.css uses) — those land at
//     rest. The keyframes are linear between samples 60 a second.
//   - a video: the same animations; its frame stepper pauses and steps every animation (video.js), so a move is
//     filmed at the video's own frames, as in the room.
//   - a PDF (print) and a PowerPoint: a still picture, so each click shows its moves AT REST, where they end — never a
//     frame in between (the animations live under `@media screen`, and the PowerPoint export finishes the moves before
//     it takes the picture: video.js · deckStageDriver · rest). The map's record says so (`motion.carriers`).
//
// WHY a wrapper and not the block's own element: a click's focus moves a piece by its `translate` and `scale` (focus.css
// · .sd-moved), and a move must never replace those; inside the element the move composes with them.
//
// THE PAINT LEVEL. A block that moves is drawn at the level its place gives it among the blocks that stand still
// (the map steps' own `order`, asked again at each keyframe: isoSpec.js · orderAt), so landed behind a block it is
// drawn behind it. The still ones
// keep their built order, spread `stride` apart (iso.js: stride = movers + 2), so between two of them there is a level
// for the lead into a port (one above a block) and one for each block that moves.
import {sampleMove} from 'footprint-story/human';
import {placeAtOf} from './motionPlan.js';
import {orderAt} from './isoSpec.js';

/** Keyframes a second: linear between them, so a curve drawn from them is within a sixtieth of a second of its samples. */
export const KEYFRAME_RATE = 60;
/** The most keyframes one move writes: past 30 s of move, fewer a second (footprint-story refuses a physics plan over 30 s). */
export const KEYFRAMES_MOST = 1800;
/** The digits a keyframe's numbers keep: a millionth of a px, so each one is its sample (a test pins 1e-6). */
const num = (v) => { const r = +v.toFixed(6); return String(Object.is(r, -0) ? 0 : r); };
const pct = (k, n) => `${num((k / n) * 100)}%`;
const secs = (v) => `${num(v)}s`;

/** The moments of its click a move is written at: its start, its end and KEYFRAME_RATE a second between. */
export const keyTimes = (seconds) => { const n = Math.min(KEYFRAMES_MOST, Math.max(2, Math.ceil(seconds * KEYFRAME_RATE))); return Array.from({length: n + 1}, (_, k) => (k / n) * seconds); };

/**
 * A pose as the wrapper's transform, the wrapper's corner being its box's (transform-origin 0 0): the pivot `P` (in the
 * box) scaled by (sx, sy) and moved by (dx, dy) — translate(P·(1 − s) + d) scale(s). One list of functions for every
 * keyframe, so each part runs linearly between two samples.
 */
export function transformOf(pose, box) {
  if (!pose) return 'translate(0px, 0px) scale(1, 1)';
  const px = pose.pivot[0] - box.x, py = pose.pivot[1] - box.y;
  return `translate(${num(px * (1 - pose.sx) + pose.dx)}px, ${num(py * (1 - pose.sy) + pose.dy)}px) scale(${num(pose.sx)}, ${num(pose.sy)})`;
}

/**
 * A hang's rope as links, each a line one px long turned and stretched onto its stretch of the rope (`points`, the
 * pin first, in slide px; `box` the block's box): [transform] a link. WHY links and not one polyline: a polyline's
 * points are not a property CSS animates everywhere, a transform is — so a rope swings in every browser and the
 * video's stepper steps it. Each angle is taken nearest the one before (`was`), so a link never spins the long way.
 */
function linksOf(points, box, was = null) {
  return points.slice(1).map(([x, y], j) => {
    const [x0, y0] = points[j], len = Math.hypot(x - x0, y - y0);
    let a = Math.atan2(y - y0, x - x0);
    if (was) a += 2 * Math.PI * Math.round((was[j].a - a) / (2 * Math.PI));
    return {a, css: `translate(${num(x0 - box.x)}px, ${num(y0 - box.y)}px) rotate(${num(a)}rad) scale(${num(len)}, 1)`};
  });
}

/** The rope's element inside its block's element, its links at `links` (each a transform), the j-th marked for its animation when `id` is given. */
const ropeSvg = (links, id) => `<svg class="iso-rope" aria-hidden="true">${links.map((l, j) => `<line x2="1" vector-effect="non-scaling-stroke"${id ? ` data-sd-rope="${id}-${j}"` : ''} style="transform:${l.css}"/>`).join('')}</svg>`;

/**
 * The view of a map's moves on the page. `plan`: motionPlan.js · planMotions; `map`: the built map as motionPlan reads
 * it, each block with its `level` and `box`; `id`: the map's name, so two maps' keyframes never share a name.
 * `click(ci)` gives {movers: Map(index → {transform, z, move?, zMove?, rope?}), hide: [{index, show?}]} for click ci;
 * `moved(ci)` how far each block that has moved stands from its built place at the end of click ci (its box, for the
 * view that frames it). `css`: the keyframes and the rules that play them.
 */
export function motionView(plan, map, {id}) {
  const placeAt = placeAtOf(plan.poseAt);
  const movers = [...new Set(plan.moves.map((m) => m.piece))], still = [...map.blocks.filter((b) => !movers.includes(b)), ...map.obstacles];
  /** Each mover's paint level at moment t of click ci: above the still block nearest in front of it, one apart from another mover in that gap. */
  const levelsAt = (ci, t) => {
    const items = [...still.map((b) => ({b, at: b.at, still: true})), ...movers.map((b) => ({b, at: placeAt(b, ci, t), still: false}))];
    const order = orderAt(items.map((x) => ({kind: x.b.kind, at: x.at, size: x.b.size})), map.view).map((i) => items[i]), out = new Map(), taken = new Map();
    let base = 0;
    for (const x of order) {
      // the highest still level drawn before it: never under a block it stands in front of
      if (x.still) { base = Math.max(base, x.b.level); continue; }
      const rank = taken.get(base) ?? 0;
      taken.set(base, rank + 1);
      out.set(x.b, base + 2 + rank);
    }
    return out;
  };
  const css = [], keyed = new Map();
  for (const m of plan.moves) {
    const key = `${id}-${m.k}`, times = keyTimes(m.seconds), n = times.length - 1;
    const poses = times.map((t) => plan.poseAt(m.piece, m.ci, t)), zs = times.map((t) => levelsAt(m.ci, t).get(m.piece));
    css.push(`@keyframes sdIsoMove-${key} {${poses.map((p, k) => ` ${pct(k, n)} { transform: ${transformOf(p, m.piece.box)}; }`).join('')} }`);
    const zMoves = zs.some((z) => z !== zs[0]);
    // a level jumps, never runs through the levels between (step-end: each held until the next keyframe)
    if (zMoves) css.push(`@keyframes sdIsoZ-${key} {${zs.map((z, k) => ` ${pct(k, n)} { z-index: ${z}; }`).join('')} }`);
    let rope = null;
    if (m.tie === 'top') {
      let was = null;
      const frames = poses.map((p) => (was = linksOf(p.rope, m.piece.box, was)));
      rope = frames[0].length;
      for (let j = 0; j < rope; j += 1) css.push(`@keyframes sdIsoRope-${key}-${j} {${frames.map((f, k) => ` ${pct(k, n)} { transform: ${f[j].css}; }`).join('')} }`);
    }
    keyed.set(m, {key, zMoves, rope});
  }
  // the moves that come to rest over a name on their own click: only those keep it shown while they run
  const shows = new Set([...plan.hidden].flatMap(([ci, list]) => list.filter((h) => h.from > 0).map((h) => plan.moves.find((m) => m.ci === ci && m.piece === h.by))));
  const gate = ':where(section[data-label][data-deck-active]:not([data-sd-instant]):not([data-deck-static])';
  const play = plan.moves.flatMap((m) => {
    const {key, zMoves, rope} = keyed.get(m), timing = `${secs(m.seconds)} linear var(--sd-arrive-at, 0s) both`;
    return [`  ${gate} [data-sd-move="${key}"]) { animation: sdIsoMove-${key} ${timing}; }`,
      ...(zMoves ? [`  ${gate} [data-sd-move-z="${key}"]) { animation: sdIsoZ-${key} ${secs(m.seconds)} step-end var(--sd-arrive-at, 0s) both; }`] : []),
      ...Array.from({length: rope ?? 0}, (_, j) => `  ${gate} [data-sd-rope="${key}-${j}"]) { animation: sdIsoRope-${key}-${j} ${timing}; }`),
      // a name a block comes to rest over stays shown while that block moves, hidden from its rest on (inline)
      ...(shows.has(m) ? [`  ${gate} [data-sd-show="${key}"]) { animation: sdIsoShow ${secs(m.seconds)} linear var(--sd-arrive-at, 0s) backwards; }`] : [])];
  });
  const sheet = `/* map "${id}": its blocks' moves, footprint-story's samples as keyframes (deck/motionDraw.js) */\n${css.join('\n')}\n@media screen and (prefers-reduced-motion: no-preference) {\n${play.join('\n')}\n}`;
  const click = (ci) => {
    const end = levelsAt(ci, Infinity), out = new Map();
    for (const b of movers) {
      const own = plan.moves.find((m) => m.ci === ci && m.piece === b), pose = plan.poseAt(b, ci, Infinity), k = map.blocks.indexOf(b);
      const ropeAt = pose?.rope ? ropeSvg(linksOf(pose.rope, b.box), own?.tie === 'top' ? keyed.get(own).key : null) : null;
      out.set(k, {transform: transformOf(pose, b.box), z: end.get(b), ...(own ? {move: keyed.get(own).key, ...(keyed.get(own).zMoves ? {zMove: keyed.get(own).key} : {})} : {}), ...(ropeAt ? {rope: ropeAt} : {})});
    }
    const hide = (plan.hidden.get(ci) ?? []).map((h) => {
      const own = plan.moves.find((m) => m.ci === ci && m.piece === h.by);
      return {index: map.blocks.indexOf(h.block), ...(own && h.from > 0 ? {show: keyed.get(own).key} : {})};
    });
    return {movers: out, hide};
  };
  const moved = (ci) => new Map(movers.map((b) => [b.name, plan.poseAt(b, ci, Infinity)]).filter(([, p]) => p).map(([name, p]) => [name, {dx: p.dx, dy: p.dy}]));
  return {css: sheet, click, moved};
}

/** The look a page adds for maps whose blocks move: the wrapper at its box, a rope in the faces' ink, and the one keyframe that keeps a name shown. */
export const MOTION_CSS = `/* isometric blocks that move by intent (deck/motionDraw.js) */
:where(section[data-label] .iso-motion) { position: absolute; inset: 0; transform-origin: 0 0; }
:where(section[data-label] .iso-rope) { position: absolute; left: 0; top: 0; width: 1px; height: 1px; overflow: visible; pointer-events: none; }
:where(section[data-label] .iso-rope line) { stroke: var(--iso-line, var(--iso-ink, #14181f)); stroke-width: var(--iso-line-width, 2.5px); stroke-linecap: round; transform-origin: 0 0; transform-box: view-box; }
@keyframes sdIsoShow { from { visibility: visible; } to { visibility: visible; } }`;

/** One more declaration at the end of a tag's style attribute (the tag's text as written; a later declaration wins). */
function withStyle(tag, decl) {
  const m = /\sstyle=(["'])([\s\S]*?)\1/.exec(tag);
  if (!m) return tag.replace(/\/?>$/, (end) => ` style="${decl}"${end}`);
  const body = m[2].trim().replace(/;$/, '');
  return tag.slice(0, m.index) + ` style=${m[1]}${body ? `${body};` : ''}${decl}${m[1]}` + tag.slice(m.index + m[0].length);
}
/** An attribute added to a tag (before its end). */
const withAttr = (tag, attr) => tag.replace(/\s*(\/?)>$/, (_, slash) => ` ${attr}${slash ? ' /' : ''}>`);

/**
 * A map's slide HTML (drawn by iso.js with its movers marked: `data-sd-mover`, `data-sd-moving`, `data-sd-say`) dressed
 * for one click (`view` = motionView(…).click(ci)): each mover's rest and its click's animation, its rope, and the names
 * covered at rest hidden. Every tag is found by the index the build gave it, so a name two pieces share never misleads.
 */
export function motionHtml(html, view) {
  return html.replace(/<(span|div|[a-z][\w-]*)\b[^>]*\sdata-sd-(mover|moving|say)="(\d+)"[^>]*>/g, (tag, _, kind, index) => {
    const k = Number(index), mv = view.movers.get(k);
    if (kind === 'say') {
      const hide = view.hide.find((h) => h.index === k);
      return hide ? withStyle(hide.show ? withAttr(tag, `data-sd-show="${hide.show}"`) : tag, 'visibility:hidden') : tag;
    }
    if (!mv) return tag;
    if (kind === 'moving') return withStyle(mv.zMove ? withAttr(tag, `data-sd-move-z="${mv.zMove}"`) : tag, `z-index:${mv.z}`);
    return `${mv.rope ?? ''}${withStyle(mv.move ? withAttr(tag, `data-sd-move="${mv.move}"`) : tag, `transform:${mv.transform}`)}`;
  });
}
