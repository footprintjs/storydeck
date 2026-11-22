// motionPlan — an isometric map's moves, click by click: each `data-move` entry (motionRead.js) made into one of
// footprint-story's intents on the slide, every move decided by footprint-story's intent decider (`planIntents`: the
// model, the duration from a law, the curve), and sampled at any moment of its click. Nothing about how a body moves
// is decided here, and no curve is worked out again: the deck only says where things are — a block's place, a target
// by its block's name, what it lands on — in slide px, and motionDraw.js writes the samples as keyframes.
//
//   planMotions(map, clicks, {canvas}) → {moves, intents, planned, record, findings, poseAt, hidden, run}
//
// A block moves by its FOOT (the middle of its footprint, at its lift). A fall drops it onto the highest top under it,
// else the floor; a throw, a settle and a reach end with its foot on `to` (a block's top, where that block stands when
// the click begins, or tiles); a hang ties a rope to its TOP and swings it to rest below the pin (`from`); a slide goes
// along the level it rests on to `to`, planned side on in the upright plane through its way (sideFoot). Every move of
// a click begins when the click's view has arrived, each block from where the clicks before left it; a block resting
// on top of one that moves is refused, never left on nothing. The same places, words and refusals as StoryReel's
// isometric motion (its motion.mjs), so a map moved in a deck and in a film moves the same.
import {planIntents, sampleMove} from 'footprint-story/human';
import {DECK_CRITICS} from './motionRead.js';
import {orderAt} from './isoSpec.js';
import {footOf, topOf, cornerOf, landingUnder, overTop, ridesOn, offSlide, footTiles, sweptThrough, posed, nameBox, overlapsBox} from './motionPlace.js';

const named = (model, name) => model === name || model?.name === name;
const frozen = (v) => { if (v && typeof v === 'object' && !Object.isFrozen(v)) { Object.freeze(v); Object.values(v).forEach(frozen); } return v; };
const round3 = (v) => Math.round(v * 1000) / 1000;
const tilesText = (t) => `"${t.map((v) => round3(v)).join(' ')}"`;
const LEVEL = 1e-6;
const onWords = (u) => (u.block ? `"${u.block.name}"'s top (lift ${round3(u.lift)})` : 'the floor');

/**
 * Where a side-on sample puts the body's foot, in tiles (`x` along the way in the world's px, `y` its foot's height): a
 * lift within a billionth of the level it keeps is that level, and under the floor is the floor. A number rule
 * StoryReel holds too (motion-side.mjs · sideFoot): one of the candidates to move into footprint-story.
 */
function sideFoot({origin, heading, unit, levels}, sample) {
  const along = sample.x / unit, lift = -sample.y / unit;
  return [origin[0] + along * heading[0], origin[1] + along * heading[1], levels.find((l) => Math.abs(l - lift) < 1e-9) ?? Math.max(0, lift)];
}

/**
 * A slide: along the level the block rests on (the floor, or the top of a block — its middle over it at both ends) to
 * `to`, at that level, planned side on in the world's own px (a tile's true length, grid.tile[0] / √2), where the floor
 * is level and gravity is down as the model takes them — on the slide a floor seen from a corner runs at a slant.
 * footprint-story picks the start speed that rests it exactly on `to`. (StoryReel's motion-side.mjs, its slide row.)
 */
function slideRow(e, {foot, at, piece, target, others, unit}) {
  const under = landingUnder(at, piece.size, others), name = piece.name;
  if (Math.abs(foot[2] - under.lift) > LEVEL) throw new Error(`${e.who}: a slide goes along what "${name}" rests on, and it stands in the air at lift ${round3(foot[2])} (under it is ${onWords(under)}) — let it fall first ("${name} fall"), or throw it ("${name} throw to …")`);
  if (!overTop(foot, under)) throw new Error(`${e.who}: "${name}" rests on the edge of ${onWords(under)}, its middle past it — a slide along it would leave it at once: stand it on the top (data-at), or let it fall`);
  const to = target(e.to, 'to');
  if (Math.abs(to[2] - under.lift) > LEVEL) throw new Error(`${e.who}: a slide keeps to the level it starts on, ${onWords(under)}, and to is at lift ${round3(to[2])} — give to at its level ("${round3(to[0])} ${round3(to[1])}${under.lift > LEVEL ? ` ${round3(under.lift)}` : ''}"), or throw it there ("${name} throw to …")`);
  const d = [to[0] - foot[0], to[1] - foot[1]], length = Math.hypot(d[0], d[1]);
  if (length < LEVEL) throw new Error(`${e.who}: to is where it stands — a slide goes somewhere along the floor: give a place apart from it`);
  const there = landingUnder(cornerOf(to, piece.size), piece.size, others);
  if (there.block !== under.block || !overTop(to, under)) throw new Error(`${e.who}: its way runs off ${onWords(under)} — at to ${tilesText(to)} its middle is past the top's edge, and a slide keeps to its level: a to on that top, or throw it ("${name} throw to …")`);
  const y = -unit * under.lift || 0;   // || 0: on the floor, 0 and never −0
  return {intent: {from: [0, y], to: [unit * length, y]}, end: [to[0], to[1], under.lift], tie: 'foot', leans: under.block ? [under.block] : [],
    side: {origin: [foot[0], foot[1]], heading: [d[0] / length, d[1] / length], unit, levels: [under.lift]}};
}

/**
 * Each `do` as one of footprint-story's intents: (entry, place) → {intent, end, tie, leans, side?}. `place` is what the
 * map knows when the click begins: `px(tiles)` puts a place on the slide, `foot` where the block's foot stands, `at`
 * its corner, `target(place, key)` a written place in tiles (a block's top where it stands now), `others` the other
 * blocks where they stand. `end` is where the foot stands after (null for a hang: only its swing knows), `tie` the point
 * the samples move, `leans` the blocks the move relies on standing still. One row a word, as StoryReel's INTENT_OF.
 */
export const INTENT_OF = Object.freeze({
  fall: (e, {px, foot, at, piece, others}) => {
    const land = landingUnder(at, piece.size, others);
    if (!(foot[2] > land.lift + LEVEL)) throw new Error(`${e.who}: a fall drops the block from where it stands, and it stands on ${onWords(land)} already — lift it first (data-at="${round3(at[0])} ${round3(at[1])} ${round3(land.lift + 3)}"), or throw it ("${piece.name} throw to …")`);
    const end = [foot[0], foot[1], land.lift];
    return {intent: {from: px(foot), floor: px(end)[1]}, end, tie: 'foot', leans: land.block ? [land.block] : []};
  },
  throw: (e, {px, foot, target}) => {
    const to = target(e.to, 'to'), end = px(to);
    // a bouncing throw lands on a floor: the line its target stands on (footprint-story refuses one that starts below it)
    return {intent: {from: px(foot), to: end, ...(named(e.model, 'bounce') ? {floor: end[1]} : {})}, end: to, tie: 'foot', leans: e.to.block ? [e.to.block] : []};
  },
  hang: (e, {px, foot, piece, target}) => {
    const pin = target(e.from, 'from'), top = [foot[0], foot[1], foot[2] + piece.size[2]];
    if (!(pin[2] > top[2] + LEVEL)) throw new Error(`${e.who}: from is its pin, at lift ${round3(pin[2])} — a block hangs below its pin, and its top is at lift ${round3(top[2])}: lift the pin above it (from ${round3(pin[0])} ${round3(pin[1])} ${round3(top[2] + 3)})`);
    return {intent: {from: px(pin), to: px(top)}, end: null, tie: 'top', leans: e.from.block ? [e.from.block] : []};
  },
  settle: (e, {px, foot, target}) => { const to = target(e.to, 'to'); return {intent: {from: px(foot), to: px(to)}, end: to, tie: 'foot', leans: e.to.block ? [e.to.block] : []}; },
  // a reach to a block aims at its top: Fitts's law reads the target's width, the top face's width across the slide
  reach: (e, {px, foot, target, topWidth}) => {
    const to = target(e.to, 'to');
    return {intent: {from: px(foot), to: px(to), ...(e.to.block ? {target: topWidth(e.to.block)} : {})}, end: to, tie: 'foot', leans: e.to.block ? [e.to.block] : []};
  },
  slide: slideRow,
});

/** footprint-story's refusal in the deck's words: its "human: " off, the move named in front when it does not say it. */
function refusal(e, entry) {
  const said = String(e?.message ?? e).replace(/^human: /, '');
  return new Error(entry && !said.startsWith(entry.who) ? `${entry.who}: ${said}` : said, {cause: e});
}

/**
 * The moves placed click by click, in the order written: each made into an intent from where every block stands when
 * its click begins (the moves of the clicks before ended, and the ones written before it on its own click). Returns
 * {intents, spans}: `spans[i]` the foot's way in tiles ({from, to, end}), its tie, leans and side.
 */
function placeMoves(map, moves, canvas) {
  const {grid} = map, px = (t) => { const p = grid.at(t[0], t[1], t[2] ?? 0); return [p.x, p.y]; }, unit = grid.tile[0] / Math.SQRT2;
  const topWidth = (b) => (b.kind === 'cylinder' ? b.box.w : Math.max(1, grid.at(b.at[0] + b.size[0], b.at[1], 0).x - grid.at(b.at[0], b.at[1] + b.size[1], 0).x));
  const all = [...map.blocks, ...map.obstacles];
  const now = new Map(all.map((b) => [b, [...b.at]])), lastOf = new Map(), intents = [], spans = [];
  for (const [i, m] of moves.entries()) {
    const piece = m.piece, last = lastOf.get(piece);
    if (last !== undefined && now.get(piece) === null) throw new Error(`${m.who}: "${piece.name}" hangs since ${moves[last].who} — a hang ends wherever its swing settles, so it is a block's last move: take this one out, or move it before the hang`);
    const at = now.get(piece), foot = footOf(at, piece.size);
    const target = (place, key) => {
      if (place.tiles) {
        const off = offSlide(px(place.tiles), canvas);
        if (off) throw new Error(`${m.who}: ${key} ${tilesText(place.tiles)} is off the slide (${off}) — ${key === 'from' ? 'give a pin the slide shows (a lower lift, or tiles nearer the blocks)' : 'give tiles on the floor the slide shows'}`);
        return place.tiles;
      }
      const there = now.get(place.block);
      if (there === null) throw new Error(`${m.who}: ${key} names "${place.block.name}", which hangs since ${moves[lastOf.get(place.block)].who} — where its swing rests is not known before it is planned: aim at tiles instead ("4 2")`);
      return topOf(there, place.block.size);
    };
    const others = all.filter((b) => b !== piece && now.get(b) !== null).map((b) => ({block: b, at: now.get(b)}));
    // a block resting on this one's top would be left on nothing: refused, naming both — only the author knows whether it goes too
    const rider = others.find((o) => ridesOn(o, piece, at));
    if (rider) throw new Error(`${m.who}: it moves "${piece.name}" from under "${rider.block.name}", which rests on its top${lastOf.has(rider.block) ? ` since ${moves[lastOf.get(rider.block)].who}` : ''}, and would leave it on nothing — move "${rider.block.name}" off first (a move for it on an earlier click), or move "${piece.name}" before "${rider.block.name}" lands there`);
    const made = INTENT_OF[m.do](m, {px, foot, at, piece, target, others, topWidth, unit});
    intents.push({do: m.do, name: piece.name, who: m.who, ...made.intent, ...(m.wrap.length ? {wrap: m.wrap} : {}), ...(m.model !== null ? {model: m.model} : {})});
    spans.push({from: foot, to: made.end ?? [...target(m.from, 'from').slice(0, 2), 0], end: made.end, tie: made.tie, leans: made.leans, ...(made.side ? {side: made.side} : {})});
    now.set(piece, made.end ? cornerOf(made.end, piece.size) : null);
    lastOf.set(piece, i);
  }
  return {intents, spans};
}

/** How often a move is sampled for the pass-through and slide checks, and the most samples a move takes (StoryReel's numbers). */
const SAMPLE_RATE = 30, SAMPLES_MOST = 900;
/** The moments of its click a move is checked at: its start, its end, and SAMPLE_RATE a second between. */
export const checkTimes = (m) => { const n = Math.min(SAMPLES_MOST, Math.max(2, Math.ceil(m.seconds * SAMPLE_RATE))); return Array.from({length: n + 1}, (_, k) => (k / n) * m.seconds); };

/**
 * The moves planned. `map`: the built map as the deck reads it ({grid, blocks: [{name, kind, at, size, box, outline,
 * say, fit, small}], obstacles: [{name, at, size}]}); `clicks`: this map's clicks in order, each {n, moves} (moves as
 * motionRead.js reads them). Throws in the move's name when a block does what it cannot, a move relies on a block that
 * moves on its click, an accepted critic is not one its move is checked by, its way leaves the slide, or footprint-story
 * refuses an intent.
 */
export function planMotions(map, clicks, {canvas, smallSize = 18}) {
  const moves = clicks.flatMap((c, ci) => c.moves.map((m) => ({...m, ci, n: c.n})));
  const {intents, spans} = placeMoves(map, moves, canvas);
  frozen(intents);
  let planned;
  try { planned = planIntents(intents, {frame: [...canvas]}); } catch (e) {
    // a refusal that names no move (a model's option out of range): each intent alone finds the one it is about
    throw refusal(e, moves.find((m, i) => { try { planIntents([intents[i]], {frame: [...canvas]}); return false; } catch { return true; } }));
  }
  const placed = moves.map((m, i) => ({...m, k: i, seconds: planned.durations[i].seconds, move: planned.moves[i], ...spans[i]}));
  for (const [i, m] of placed.entries()) {
    // the blocks a move relies on stand still while it runs: a move on the same click that moves one is refused
    for (const b of m.leans) {
      const other = placed.find((o) => o.ci === m.ci && o.piece === b);
      if (other) throw new Error(`${m.who}: it relies on "${b.name}" standing still, and ${other.who} moves it on the same click — move one of them on the next click`);
    }
    // an accepted critic is one this move is checked by: a name it is not would accept nothing, silently
    const checks = [...planned.moves[i].checks, ...DECK_CRITICS];
    for (const name of m.accept) if (!checks.includes(name)) throw new Error(`${m.who}: accept names "${name}", which its move (${planned.choices[i].model}) is not checked by — its critics are ${checks.join(', ')}`);
    // a slide's rest is known before it is planned: footprint-story must end it there, or the block would jump at its end
    if (m.side) {
      const end = sideFoot(m.side, sampleMove(m.move, m.seconds));
      if (end.some((v, k) => Math.abs(v - m.end[k]) > 1e-6)) throw new Error(`${m.who}: footprint-story planned this slide to end at tiles ${tilesText(end)}, not at its to ${tilesText(m.end)} — the deck cannot draw both: report it to footprint-story`);
    }
  }
  const poseAt = poseAtOf(placed, map, clicks.length);
  keepOnSlide(map, placed, poseAt, canvas);
  const through = throughFindings(map, placed, poseAt), covered = coversOf(map, placed, poseAt, clicks.length, smallSize);
  return {moves: placed, intents, planned, ...recordsOf(placed, planned, [...through, ...covered.findings]), poseAt, hidden: covered.hidden, run: runOf(intents, planned, canvas)};
}

/**
 * Where a block is drawn at moment `t` of click `ci`: null while it stands as built, else its pose — `dx`, `dy` (how
 * far the tie point has come from where the block was built), `pivot` (that point, as built), `sx`, `sy` (a bounce's
 * squash: 1 when none), `rope` (a hang's points, the pin first) and `at` (where it stands now in tiles, its corner).
 * Before its click's move it is where its last move left it; a move's end is the place it was planned to end on,
 * exactly (worked back from the slide, a block resting on a top could come out a billionth under it).
 */
function poseAtOf(moves, map, clickCount) {
  const {grid} = map, px = (t) => { const p = grid.at(t[0], t[1], t[2] ?? 0); return [p.x, p.y]; }, footAt = footTiles(grid);
  const tracks = new Map();
  for (const m of moves) tracks.set(m.piece, [...(tracks.get(m.piece) ?? []), m]);
  const built = new Map([...tracks.keys()].map((b) => [b, {foot: px(footOf(b.at, b.size)), top: px(topOf(b.at, b.size))}]));
  return (piece, ci, t) => {
    const list = tracks.get(piece);
    if (!list || ci < 0 || ci >= clickCount) return null;
    const own = list.find((x) => x.ci === ci), m = own ?? list.findLast((x) => x.ci < ci);
    if (!m) return null;
    const at = own ? Math.min(m.seconds, Math.max(0, t)) : m.seconds, s = sampleMove(m.move, at);
    const {foot, top} = built.get(piece), pivot = m.tie === 'top' ? top : foot;
    const ended = at >= m.seconds && m.end !== null;
    const place = ended ? m.end : m.side ? sideFoot(m.side, s) : footAt([s.x, s.y + (m.tie === 'top' ? foot[1] - top[1] : 0)], m, Math.min(1, at / m.seconds));
    const [dx, dy] = m.side ? [px(place)[0] - foot[0], px(place)[1] - foot[1]] : [s.x - pivot[0], s.y - pivot[1]];
    return {dx, dy, pivot, sx: s.sx ?? 1, sy: s.sy ?? 1, ...(m.tie === 'top' ? {rope: s.points} : {}), at: cornerOf(place, piece.size)};
  };
}

/**
 * Every move kept on the slide as it is drawn: its block's outline and a hang's rope at each sample. Refused naming
 * the move, the moment, how far off and where its foot is then — a block drawn off the slide is a picture nobody sees.
 * A block the map itself draws off the slide (a grid written in numbers can) is the map's to say, not its move's.
 */
function keepOnSlide(map, moves, poseAt, canvas) {
  for (const m of moves) {
    if (m.piece.outline.some((p) => offSlide(p, canvas))) continue;
    for (const t of checkTimes(m)) {
      const pose = poseAt(m.piece, m.ci, t), drawn = m.piece.outline.map((p) => posed(p, pose));
      const block = drawn.map((p) => offSlide(p, canvas)).find(Boolean), rope = block ? null : (pose.rope ?? []).map((p) => offSlide(p, canvas)).find(Boolean);
      if (!block && !rope) continue;
      const fix = m.tie === 'top' ? 'a pin nearer the blocks, or lower (from)' : 'a nearer to, or one lower on the slide';
      throw new Error(`${m.who}: its way leaves the slide — at ${round3(t)} s ${block ? 'the block' : 'its rope'} is ${block ?? rope} (its foot at tiles ${tilesText(footOf(pose.at, m.piece.size))}) — ${fix}`);
    }
  }
}

/** Where each block stands at moment t of click ci (its pose's place, else as built): what the checks and the order read. */
export const placeAtOf = (poseAt) => (b, ci, t) => poseAt(b, ci, t)?.at ?? [...b.at];

/**
 * The deck's own critic, `deck:contact`: a move whose block goes into another on its way, swept between each two
 * samples (motionPlace · sweptThrough), each other block where it stands then (moving too, on its click). WHY the
 * deck's, not footprint-story's contact critic: that one reads boxes on the slide, where a block's picture overlaps
 * blocks it is nowhere near — only the map's tiles say what a block passes through. One finding a move, at its deepest.
 */
function throughFindings(map, moves, poseAt) {
  const placeAt = placeAtOf(poseAt), all = [...map.blocks, ...map.obstacles];
  return moves.flatMap((m) => {
    const times = checkTimes(m), rest = all.filter((b) => b !== m.piece);
    let worst = null;
    for (let k = 1; k < times.length; k += 1) {
      const [t0, t1] = [times[k - 1], times[k]];
      const hit = sweptThrough(m.piece.size, placeAt(m.piece, m.ci, t0), placeAt(m.piece, m.ci, t1), rest.map((b) => ({block: b, from: placeAt(b, m.ci, t0), to: placeAt(b, m.ci, t1)})));
      if (hit && (!worst || hit.depth > worst.depth)) worst = {...hit, t: t0 + hit.share * (t1 - t0)};
    }
    if (!worst) return [];
    const fix = m.tie === 'top' ? `move "${worst.block.name}" out of its swing, or its pin (from) so it swings clear` : m.do === 'throw' ? `throw it to a place clear of "${worst.block.name}", or move "${worst.block.name}" out of its way` : `move it round "${worst.block.name}": a to clear of it, or throw it over ("${m.piece.name} throw to …")`;
    return [{k: m.k, critic: 'deck:contact', level: 'warn', what: `at ${round3(worst.t)} s it goes ${round3(worst.depth)} tiles into "${worst.block.name}" — it passes through a block`, fix}];
  });
}

/**
 * The names a block that moved hides AT REST: on each click, a block named on its top whose words a moved block, resting
 * in front of it, is drawn over — hidden from the moment that block comes to rest there (the click's start when it
 * rested there already) until it moves on. One passing over a name in flight is a moment of natural occlusion, drawn as
 * it is. The box a name takes is worked out from the built map's numbers only (motionPlace · nameBox), so every host
 * decides the same. `hidden`: Map(ci → [{block, by, from}]); `findings`: each move that comes to rest over a name.
 */
function coversOf(map, moves, poseAt, clickCount, smallSize) {
  const placeAt = placeAtOf(poseAt), movers = [...new Set(moves.map((m) => m.piece))];
  const named = map.blocks.map((b) => ({block: b, box: nameBox(b.fit ?? {}, b.small, b.say, smallSize)})).filter((n) => n.box);
  const all = [...map.blocks, ...map.obstacles];
  // in front of: later in the map steps' own paint order of everything where it rests at the click's end (isoSpec · orderAt)
  const rankAt = (ci) => { const order = orderAt(all.map((b) => ({kind: b.kind, at: placeAt(b, ci, Infinity), size: b.size})), map.view); return new Map(order.map((i, r) => [all[i], r])); };
  const hiddenBy = (n, ci, rank) => {
    const end = Infinity, own = poseAt(n.block, ci, end), box = own ? [posed([n.box[0], n.box[1]], own), posed([n.box[2], n.box[3]], own)].flat() : n.box;
    return movers.find((p) => {
      const pose = p !== n.block ? poseAt(p, ci, end) : null;
      return Boolean(pose) && overlapsBox(p.outline.map((q) => posed(q, pose)), box) && rank().get(p) > rank().get(n.block);
    }) ?? null;
  };
  const hidden = new Map(), findings = [];
  for (let ci = 0; ci < clickCount; ci += 1) {
    const list = [];
    let ranks = null;
    const rank = () => (ranks ??= rankAt(ci));   // asked only when a moved block's outline meets a name
    for (const n of named) {
      const by = hiddenBy(n, ci, rank);
      if (!by) continue;
      const own = moves.find((m) => m.ci === ci && m.piece === by);
      list.push({block: n.block, by, from: own ? own.seconds : 0});
      if (own) findings.push({k: own.k, critic: 'deck:covers', level: 'warn', what: `it comes to rest over "${n.block.name}"'s name ("${n.block.fit.lines.join(' ')}"), which is hidden from then`,
        fix: `land it clear of the name (to: tiles beside "${n.block.name}", or a corner of its top), or accept it when it is meant (accept deck:covers)`});
    }
    if (list.length) hidden.set(ci, list);
  }
  return {hidden, findings};
}

/**
 * What the map's record keeps of the moves (`record`: each move's click, model, how it was chosen, its reason, its
 * seconds and the critics it accepts — footprint-story's data but the last) and the findings — footprint-story's
 * critics' and the deck's own — each naming its move and the fix. A finding of a critic its move accepts keeps its
 * words and is marked `accepted`: shown as accepted advice, never as a fault.
 */
function recordsOf(moves, planned, own) {
  const record = moves.map((m, i) => frozen({click: m.n, who: m.who, piece: m.piece.name, do: m.do, seconds: round3(m.seconds), model: planned.choices[i].model, by: planned.choices[i].by,
    reason: planned.moves[i].reason, wrappers: [...planned.durations[i].wrappers], ...(m.accept.length ? {accepted: [...m.accept]} : {})}));
  const said = [...planned.findings.map((f) => ({k: f.intent, critic: f.critic, level: f.level, what: f.message.startsWith(`${moves[f.intent].who}: `) ? f.message.slice(moves[f.intent].who.length + 2) : f.message, fix: f.fix})), ...own];
  const findings = said.sort((a, b) => a.k - b.k).map((f) => {
    const m = moves[f.k];
    return frozen({click: m.n, who: m.who, critic: f.critic, level: m.accept.includes(f.critic) ? 'accepted' : f.level, what: f.what, fix: f.fix});
  });
  return {record: frozen(record), findings: frozen(findings)};
}

/**
 * The same intents through footprint-story's intent decider as a footprintjs chart (runHumanFlow), so the run's record
 * answers why (run/motions.js): `differs` null, or where its result parts from the compile's. Loaded when first run.
 */
function runOf(intents, planned, canvas) {
  return async ({sink, recorders = []} = {}) => {
    const [{runHumanFlow}, {firstDifference}] = await Promise.all([import('footprint-story/humanflow'), import('./run/maps.js')]);
    const {result, snapshot} = await runHumanFlow(intents, {frame: [...canvas], ...(sink ? {sink} : {}), recorders});
    return {snapshot, differs: firstDifference(result, planned)};
  };
}
