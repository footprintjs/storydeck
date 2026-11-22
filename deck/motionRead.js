// motionRead — a click's moves, as its <step> writes them, read and checked. Plain words in, plain data out; nothing is
// planned (motionPlan.js) or drawn (motionDraw.js) here.
//
//   <step data-in="box" data-move="box fall">                                    one move: a block and what it does
//   <step data-move="ball throw to server wrap anticipate; crate slide to 4 2">  two moves, apart with ";"
//   <step data-move="lamp hang from 5 2 6">                                      a place is a block's name or tiles
//   <step data-move="box settle to db model spring accept arc">                  a model, and a critic's finding kept
//
// A move is "<piece> <do>", then any of: `to <place>` (where it ends), `from <place>` (a hang's pin), `wrap <wrapper>
// [option number …] …`, `model <name> [option value …]`, `accept <critic> …`. A place is a block's name, or "col row"
// (a third number lifts it) in tiles — never pixels: the build works the pixels out from the built map.
//
// WHY the words are footprint-story's (`footprint-story/human`): the author writes intent only, and the tool that
// knows how bodies move decides the model, the duration and the curve; the same words StoryReel's isometric `motion`
// takes (its motion-read.mjs), so a map moved into a film says the same. WHY plain words, not JSON: every attribute is
// written by hand or by a model, and JSON in an attribute is the first thing either gets wrong (isoStyle.js's reason).
import {HUMAN_CRITICS, HUMAN_DOS, MOST_INTENTS, MOST_WRAPPERS, WRAPPER_NAMES} from 'footprint-story/human';

/**
 * The deck's own critics, beside footprint-story's: `deck:contact`, a move whose block passes through another block
 * (motionPlan.js · throughFindings), and `deck:covers`, a move that comes to rest over another block's name. Named
 * under the deck's prefix, as footprint-story names a tool's own (StoryReel's are `reel:contact`, `reel:covers`).
 */
export const DECK_CRITICS = Object.freeze(['deck:contact', 'deck:covers']);
const CRITIC_NAMES = Object.freeze([...HUMAN_CRITICS, ...DECK_CRITICS]);

/**
 * What a block on a slide may do, and the places each takes: `to` where it ends, `from` a hang's pin. WHY these six:
 * each moves a whole upright block from one place to another, and its model gives a place at every moment. A roll and
 * a tumble turn the body (`TURNS`), `draw`, `write` and `sketch` move a pen (`PEN_DOS`): each refused, saying why.
 */
export const MOTION_DOS = Object.freeze({
  fall: Object.freeze({to: false, from: false}),
  throw: Object.freeze({to: true, from: false}),
  hang: Object.freeze({to: false, from: true}),
  settle: Object.freeze({to: true, from: false}),
  reach: Object.freeze({to: true, from: false}),
  slide: Object.freeze({to: true, from: false}),
});
/**
 * The footprint-story moves a deck cannot draw truly yet, with why and the fix. WHY refused rather than drawn some
 * other way: a roll turns a ball on its rim (StoryDeck has no ball), and a tumble turns a block end over end, which
 * needs its faces drawn turned in three dimensions (StoryReel's turn.mjs); a block drawn upright while it rolls or
 * tumbles would show a move nobody made — a move the page cannot show truly is said, never faked.
 */
const TURNS = Object.freeze({
  roll: 'a roll turns a ball on its rim, and StoryDeck has no ball yet (a film draws one: StoryReel\'s kind "ball") — slide it (slide to …), or throw it (throw to …)',
  tumble: 'a tumble turns a block end over end, and StoryDeck draws a block only upright — slide it (slide to …), or throw it (throw to …)',
});
const PEN_DOS = Object.freeze(['draw', 'write', 'sketch']);
const KEYWORDS = Object.freeze(['to', 'from', 'wrap', 'model', 'accept']);
/** The most moves one map holds: footprint-story plans at most this many intents in one list, and a map's moves are one list. */
export const MOST_MOVES = MOST_INTENTS;
/** The most letters a data-move value has: past it the build refuses before it reads a word (64 moves of plain words fit well under). */
export const MOST_MOVE_LETTERS = 8000;

const NUMBER = /^-?(?:\d+(?:\.\d*)?|\.\d+)$/;
const either = (names) => names.map((n) => `"${n}"`).join(', ').replace(/, ([^,]*)$/, ' or $1');
const shown = (v) => { const s = String(v); return JSON.stringify(s.length > 40 ? `${s.slice(0, 39)}…` : s); };

/**
 * A place: a block's name ({block}) or tiles ({tiles: [col, row, lift]}) — the tokens after its keyword, and how many it
 * took. `self` is the moving block (a move onto itself is refused).
 */
function placeOf(words, key, who, {blocks, self}) {
  const first = words[0];
  if (first === undefined || KEYWORDS.includes(first)) throw new Error(`${who}: ${key} is a block's name ("${blocks.find((b) => b !== self)?.name ?? 'server'}") or tiles on the floor ("4 2", a third number lifting it)`);
  if (!NUMBER.test(first)) {
    const block = blocks.find((b) => b.name === first);
    if (!block) throw new Error(`${who}: ${key} names ${shown(first)}, which is no block of this map — the blocks are ${blocks.map((b) => b.name).join(', ')}; or give tiles ("4 2")`);
    if (block === self) throw new Error(`${who}: ${key} names the block itself — name another block, or give tiles ("4 2")`);
    return {place: {block}, took: 1};
  }
  let n = 0;
  while (n < 3 && words[n] !== undefined && NUMBER.test(words[n])) n += 1;
  if (n < 2) throw new Error(`${who}: ${key} in tiles is "col row" (a third number lifts it) — not "${words.slice(0, n).join(' ')}" alone`);
  const tiles = words.slice(0, n).map(Number);
  if (tiles.some((v) => Math.abs(v) > 1e6)) throw new Error(`${who}: ${key} "${words.slice(0, n).join(' ')}" is far off any floor — give tiles near the blocks`);
  if (n === 3 && tiles[2] < 0) throw new Error(`${who}: ${key}'s lift is how high above the floor, 0 or more — not ${tiles[2]}`);
  return {place: {tiles: [tiles[0], tiles[1], tiles[2] ?? 0]}, took: n};
}

/** A value of an option as footprint-story takes it: a number, true or false, or a word. */
const valueOf = (w) => (NUMBER.test(w) ? Number(w) : w === 'true' ? true : w === 'false' ? false : w);

/** Option pairs after a name, up to the next keyword (or, in a wrap, the next wrapper): {options, took}. */
function optionsOf(words, who, what, stop) {
  const options = {};
  let k = 0;
  while (k < words.length && !KEYWORDS.includes(words[k]) && !stop(words[k])) {
    const name = words[k], value = words[k + 1];
    if (NUMBER.test(name)) throw new Error(`${who}: ${what} takes its options as "name value" pairs ("share 0.3") — "${name}" is a number with no name before it`);
    if (value === undefined || KEYWORDS.includes(value)) throw new Error(`${who}: ${what}'s option "${name}" has no value — write "${name} <value>"`);
    if (Object.hasOwn(options, name)) throw new Error(`${who}: ${what} names its option "${name}" twice — name each once`);
    options[name] = valueOf(value);
    k += 2;
  }
  return {options, took: k};
}

/** One move's words, checked: {index, who, piece, do, to, from, wrap, model, accept}. */
function readMove(text, i, where, map) {
  const words = text.trim().split(/\s+/), who = `${where}[${i}]`;
  const {blocks} = map, name = words[0], piece = blocks.find((b) => b.name === name);
  if (!piece) {
    const said = map.others.get(name);
    throw new Error(`${who}: "${name}" ${said ?? 'is no piece of this map'} — a move moves an isometric block or cylinder: ${blocks.length ? blocks.map((b) => b.name).join(', ') : 'this map has none (data-iso="block")'}`);
  }
  const named = `${who} ("${name}")`;
  if (piece.twice) throw new Error(`${named}: two isometric pieces are called "${name}" — give the one that moves a name of its own (data-k)`);
  // a cable is laid on the floor to where its block stands: it would not follow the block, and its end would hang in the air
  const wire = map.links.find(([a, b]) => a === name || b === name);
  if (wire) throw new Error(`${named}: a wire joins "${name}" (${wire[0]} to ${wire[1]}): it is laid to where "${name}" stands and would not follow it — move a block no wire joins, or take the wire off`);
  // a callout stands beside its piece where it was built, so it would point at the place the block left
  const callout = map.callouts.find((c) => c.target === name);
  if (callout) throw new Error(`${named}: the callout "${callout.name}" points at "${name}" where it was built, and would not follow it — move a block no callout points at, or point the callout at another piece`);
  const doWord = words[1], dos = either(Object.keys(MOTION_DOS));
  if (doWord === undefined) throw new Error(`${named}: say what it does after its name — ${dos} ("${name} fall")`);
  if (!Object.hasOwn(MOTION_DOS, doWord)) {
    if (Object.hasOwn(TURNS, doWord)) throw new Error(`${named}: ${TURNS[doWord]}`);
    if (PEN_DOS.includes(doWord)) throw new Error(`${named}: "${doWord}" moves a pen's point along a line, not a block — a block takes ${dos}`);
    if (Object.hasOwn(HUMAN_DOS, doWord)) throw new Error(`${named}: "${doWord}" is footprint-story's, and not yet a block's on a slide — a block takes ${dos}`);
    throw new Error(`${named}: what it does is ${dos} (footprint-story's words) — not ${shown(doWord)}`);
  }
  const takes = MOTION_DOS[doWord], out = {index: i, who: named, piece, do: doWord, to: null, from: null, wrap: [], model: null, accept: []};
  const seen = new Set();
  for (let k = 2; k < words.length;) {
    const key = words[k];
    if (!KEYWORDS.includes(key)) throw new Error(`${named}: after "${name} ${doWord}" come ${KEYWORDS.map((w) => `"${w} …"`).join(', ')} — not ${shown(key)}`);
    if (seen.has(key)) throw new Error(`${named}: it says "${key}" twice — say it once`);
    seen.add(key);
    const rest = words.slice(k + 1);
    if (key === 'to' || key === 'from') {
      if (!takes[key]) throw new Error(`${named}: a ${doWord} takes no ${key} — ${doWord === 'fall' ? 'it falls straight down onto what is under it' : doWord === 'hang' ? 'it swings to rest below its pin (from)' : 'it starts where the block stands (to says where it ends)'}: take "${key} …" out`);
      const {place, took} = placeOf(rest, key, named, {blocks, self: piece});
      out[key] = place;
      k += 1 + took;
    } else if (key === 'wrap') {
      let took = 0;
      while (took < rest.length && !KEYWORDS.includes(rest[took])) {
        const wrapper = rest[took];
        if (!WRAPPER_NAMES.includes(wrapper)) throw new Error(`${named}: wrap names footprint-story's wrappers, ${either(WRAPPER_NAMES)} — not ${shown(wrapper)}`);
        const opts = optionsOf(rest.slice(took + 1), named, `wrap ${wrapper}`, (w) => WRAPPER_NAMES.includes(w));
        out.wrap.push({wrapper, ...opts.options});
        took += 1 + opts.took;
      }
      if (!out.wrap.length) throw new Error(`${named}: wrap names a wrapper after it — ${either(WRAPPER_NAMES)}`);
      if (out.wrap.length > MOST_WRAPPERS) throw new Error(`${named}: wrap takes at most ${MOST_WRAPPERS} wrappers — not ${out.wrap.length}`);
      k += 1 + took;
    } else if (key === 'model') {
      const model = rest[0];
      if (model === undefined || KEYWORDS.includes(model)) throw new Error(`${named}: model names one of footprint-story's models ("bounce"), with its options after it if you like ("model coulomb kinetic 0.4")`);
      const opts = optionsOf(rest.slice(1), named, `model ${model}`, () => false);
      // the model's name and options are footprint-story's to check: its refusal comes back in this move's name
      out.model = Object.keys(opts.options).length ? {name: model, ...opts.options} : model;
      k += 2 + opts.took;
    } else {
      let took = 0;
      while (took < rest.length && !KEYWORDS.includes(rest[took])) {
        const critic = rest[took];
        if (!CRITIC_NAMES.includes(critic)) throw new Error(`${named}: accept names ${shown(critic)}, which is no critic — the critics are ${CRITIC_NAMES.join(', ')}`);
        if (out.accept.includes(critic)) throw new Error(`${named}: accept names "${critic}" twice — name each once`);
        out.accept.push(critic);
        took += 1;
      }
      if (!out.accept.length) throw new Error(`${named}: accept names the critics whose findings this move keeps ("accept arc")`);
      k += 1 + took;
    }
  }
  for (const key of ['to', 'from']) {
    if (takes[key] && !out[key]) throw new Error(`${named}: a ${doWord} needs ${key === 'to' ? `to, where it ends: a block's name ("${name} ${doWord} to ${blocks.find((b) => b !== piece)?.name ?? 'server'}")` : `from, the pin it hangs from: a block's name, or tiles in the air ("${name} hang from 4 2 6")`} or tiles`);
  }
  return out;
}

/**
 * A step's data-move, read: [] when it has none. `where` names it in a refusal ("data-move"); `map` is what the map
 * holds: {blocks: [{name, kind, twice?}], others: Map(name → what it is), links: [[from, to]], callouts: [{name, target}]}.
 * A piece moves once a click: two moves of one block on one click are refused (the second goes on the next click).
 */
export function readMoves(value, where, map) {
  if (value === null || value === undefined) return [];
  if (value.length > MOST_MOVE_LETTERS) throw new Error(`${where}: a click's moves are at most ${MOST_MOVE_LETTERS} letters — not ${value.length}: put some on the next click`);
  const texts = value.split(';');
  if (texts.some((t) => !t.trim())) throw new Error(`${where}: a click's moves are "<block> <do> …", apart with ";" — ${value.trim() ? 'one of them is empty' : 'it says none'} (data-move="box fall; ball throw to server")`);
  const moves = texts.map((t, i) => readMove(t, i, where, map));
  for (const [i, m] of moves.entries()) {
    const before = moves.findIndex((o) => o.piece === m.piece);
    if (before !== i) throw new Error(`${m.who}: "${m.piece.name}" already moves on this click (${where}[${before}]) — a block makes one move a click: put this one on the next click`);
  }
  return moves;
}
