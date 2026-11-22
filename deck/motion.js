// motion — a deck's isometric blocks moved by intent, end to end at compile: the moves each click names (motionRead.js),
// planned once a map by footprint-story (motionPlan.js), and written into that map's slides (motionDraw.js). compile.js
// asks this module four things; a deck that moves nothing never reaches past `moverNames`, so its page is as before.
//
//   <step data-in="box" data-move="box fall">       a click's moves: "<block> <do> [to …] [from …] [wrap …] [model …] [accept …]"
//
// What the compiled deck keeps of it, per map (`maps[name].motion`): the record of each move (footprint-story's model,
// how it was chosen, its reason, its seconds), what the critics found, the carriers (how a page, a video, a print and a
// PowerPoint show a move) and the run that plans the same intents again as a footprintjs chart, for the run's record
// (run/motions.js · `storydeck log --why duration-0 --motion <map>`).
import {attrOf} from './parse.js';
import {readMoves} from './motionRead.js';
import {planMotions} from './motionPlan.js';
import {MOTION_CSS, motionHtml, motionView} from './motionDraw.js';

/**
 * How each way of showing a deck carries a move — said in the map's record, so whoever reads a PDF or a PowerPoint of
 * the deck knows its moves are shown where they end, never a frame between.
 */
export const CARRIERS = Object.freeze({page: 'keyframes', video: 'keyframes, stepped at the video\'s frames', print: 'at rest, where each move ends', pptx: 'at rest, where each move ends, by a driver that can end them (rest(): video.js · deckStageDriver) — the export\'s own record (exportPptx · moves) says how its pictures were taken'});

/**
 * The names each map's clicks move, read cheaply before the map is drawn (the first word of each move): Map(map → Set).
 * The map is drawn knowing them (iso.js wraps their faces and spreads the paint levels); every word is checked later.
 */
export function moverNames(parts) {
  const out = new Map();
  for (const part of parts) {
    if (!part.map) continue;
    for (const s of part.steps) {
      const value = attrOf(s.attrs, 'data-move');
      if (value === null) continue;
      const set = out.get(part.map) ?? new Set();
      for (const text of value.split(';')) { const name = text.trim().split(/\s+/)[0]; if (name) set.add(name); }
      out.set(part.map, set);
    }
  }
  return out;
}

/** What a map holds that a move may name or must stay clear of, in the reader's shape (motionRead.js · readMoves). */
function holdings(map) {
  const {motion} = map, blocks = motion.blocks, others = new Map();
  for (const f of motion.obstacles) others.set(f.name, 'is a footprint: it stands where its own style puts it');
  for (const p of map.pieces) for (const k of p.keys) if (!others.has(k) && !blocks.some((b) => b.name === k)) others.set(k, p.ground ? 'is a floor: the ground the blocks stand on does not move' : 'is not an isometric block');
  return {blocks, others, links: map.links ?? [], callouts: map.callouts};
}

/**
 * Every map's moves read and planned, in the deck's order of clicks: each map with moves gets `motion` (its plan and
 * view). `parts` as parse.js reads them; `maps` as compile.js prepared them; `canvas` the slide's size. Click numbers
 * count every click of the deck, as compile.js numbers them. Throws, naming the part, the click and the move.
 */
export function planDeckMotions(parts, maps, {canvas}) {
  const clicksOf = new Map();
  let n = 0;
  for (const part of parts) {
    if (!part.map) { n += 1; continue; }
    const map = maps[part.map];
    part.steps.forEach((s, k) => {
      n += 1;
      const list = clicksOf.get(map) ?? [];
      const value = attrOf(s.attrs, 'data-move');
      if (value !== null && !map.motion) throw new Error(`"${part.label}" click ${k + 1}: data-move moves isometric blocks, and map "${map.name}" has none — draw the block with data-iso="block"`);
      list.push({n, label: `${part.label} · ${k + 1}`, moves: value === null ? [] : readMoves(value, `"${part.label}" click ${k + 1}: data-move`, holdings(map))});
      clicksOf.set(map, list);
    });
  }
  for (const [map, clicks] of clicksOf) {
    const count = clicks.reduce((s, c) => s + c.moves.length, 0);
    if (!count) continue;
    if (count > 64) throw new Error(`map "${map.name}": its clicks move blocks ${count} times, and footprint-story plans at most 64 moves in one list — tell the rest on a second map`);
    const plan = planMotions(map.motion, clicks, {canvas});
    map.moving = {plan, clicks, view: motionView(plan, map.motion, {id: map.name})};
  }
}

/**
 * The map's pieces as the view of click `ci` frames them: each block that has moved, its box where it rests at the end
 * of that click — so a camera that fits a click frames where the blocks are, not where they were built.
 */
export function piecesAt(map, ci) {
  if (!map.moving) return map.pieces;
  const moved = map.moving.view.moved(ci);
  if (!moved.size) return map.pieces;
  return map.pieces.map((p) => {
    const d = p.box ? moved.get(p.keys[0]) : null;
    return d ? {...p, box: {...p.box, x: p.box.x + d.dx, y: p.box.y + d.dy}} : p;
  });
}

/** A click that moves a block it does not show is refused: the move would play unseen. */
export function checkMovesShown(map, ci, look, where) {
  if (!map.moving) return;
  for (const m of map.moving.plan.moves.filter((x) => x.ci === ci)) {
    const i = map.pieces.findIndex((p) => p.keys[0] === m.piece.name);
    if (i >= 0 && look.pieces[i]?.state === 'gone') throw new Error(`${where}: ${m.who.slice(m.who.indexOf('data-move'))} moves "${m.piece.name}", which this click does not show — bring it in (data-in="${m.piece.name}"), or move it on a click that shows it`);
  }
}

/** The map's slide HTML for click `ci`: as drawn when no block of it moves, else each mover at its rest and its click's moves playing. */
export const slideHtmlAt = (map, ci) => (map.moving ? motionHtml(map.html, map.moving.view.click(ci)) : map.html);

/** The stylesheet the page adds for every map whose blocks move, or null when none does. */
export function motionCss(maps) {
  const moving = Object.values(maps).filter((m) => m.moving);
  return moving.length ? [MOTION_CSS, ...moving.map((m) => m.moving.view.css)].join('\n') : null;
}

/**
 * What the compiled deck keeps of a map's moves: {moves, record, findings, carriers, run} — `run` plans the same intents
 * through footprint-story's chart (motionPlan.js · runOf), for run/motions.js; nothing else here is a function.
 */
export const motionKept = (map) => (map.moving ? {motion: {moves: map.moving.plan.moves.length, record: map.moving.plan.record, findings: map.moving.plan.findings, carriers: CARRIERS, run: map.moving.plan.run}} : {});
