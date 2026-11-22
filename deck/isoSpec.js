// isoSpec — a map's pieces, as iso.js reads them from the deck's HTML, handed to footprint-story's map steps
// (footprint-story/isometric · buildIsoMap, under ISO_MAP_POLICIES.deck), and the built map read back in the deck's
// own names. Plain data in, plain data out: no HTML here.
//
// WHY the steps are the kit's: a deck and a film build a map the same way — place the blocks, lay the wires, fit the
// floors, choose the grid, fit the names, place the floor labels, paint the nearest last — and since footprint-story
// 0.25.0 that is one list of named steps both call (its src/isometric/README.md, "A whole map, built as named
// steps"). Before 0.33.0 the deck had its own copy of that order (deck/iso.js · place, gridOf, fitName and the wires
// laid by cable.js · layRoutes). This file is what its README calls the tool's adapter: what the steps cannot read in
// the deck's HTML it works out here; nothing the steps decide is decided again.
//
// What the adapter does (the kit's list, src/isometric/README.md · "What a tool's adapter does"):
//   - a piece is handed under a name of its own (specNames): its first name when no other piece has it and it is at
//     most 64 letters, else a name made for it — and everything the map says by name is read back in the deck's names;
//   - a wire is handed only where the steps can use it: one laid along the floor (to a port, or a foot), and — when the
//     build places the blocks — the first wire between each two blocks, as `straight` (all `arrange` reads of it). A
//     wire to a flat piece, to a name two pieces share, or to its own block is never handed;
//   - a floor's at is its first two numbers, a sized floor with none stands at [0, 0];
//   - the usual grid is handed in numbers (usualGrid), and the area only where it is one;
//   - the 1024 wires the kit lays are the first 1024; one past them is the straight wire it always was, and says so.
// A refusal of the steps names the piece by the deck's own words (`who`: the piece as iso.js names it), so it needs no
// rewording; two the deck said in its own words before are said so still (deckWords).
import {buildIsoMap, ISO_MAP_LIMITS, ISO_MAP_POLICIES, MOST_ROUTES, NO_ROUTE} from 'footprint-story/isometric';

/** The deck's numbers for its maps: the kit's policy, pinned against StoryDeck 0.32.0's own map code. */
export const DECK = ISO_MAP_POLICIES.deck;
/** The grid a map that places its own blocks and writes none is drawn on: a tile 120 px, its far corner mid-slide, 240 px down. */
export const usualGrid = (canvas) => ({tile: 120, origin: [(canvas ?? [1920, 1080])[0] / 2, 240]});
/** The map, as a refusal of the steps names it. */
const MAP = 'this map';
/** A plain value frozen at every level: the spec, lists and objects of numbers and words (a copy is frozen, never the deck's pieces). */
const frozen = (v) => { if (v && typeof v === 'object' && !Object.isFrozen(v)) { Object.freeze(v); Object.values(v).forEach(frozen); } return v; };

const letters = (text) => [...text].length;
/**
 * The deck's words for a piece, as a refusal names it: whole when the kit takes them, else cut, with "…". The kit
 * counts a `who` in UTF-16 units (at most 200: footprint-story/isometric · mapSpec.js · whoOf), so it is cut by them,
 * a whole character at a time — a name of 100 emoji is 200 units, and its words longer still.
 */
function whoOf(where) {
  if (where.length <= ISO_MAP_LIMITS.who) return where;
  let cut = '';
  for (const ch of where) { if (cut.length + ch.length > ISO_MAP_LIMITS.who - 1) break; cut += ch; }
  return `${cut}…`;
}
/** A piece's name in a refusal as 0.32.0 showed it (the kit's `shown`): at most 60 units, then "…". */
const shortName = (name) => (name.length > 60 ? `${name.slice(0, 60)}…` : name);

/**
 * A name of its own for each piece, in the order given: its first name when no other piece has it and the kit takes
 * it (1 to 64 letters), else a name made from it that no piece has. WHY: the steps know one piece by one name, and a
 * deck may give two pieces one name (by hand: a wire then cannot end at either) or a longer one.
 */
export function specNames(names) {
  const count = new Map();
  for (const name of names) count.set(name, (count.get(name) ?? 0) + 1);
  const used = new Set(names.filter((name) => count.get(name) === 1 && letters(name) <= ISO_MAP_LIMITS.name));
  return names.map((name, i) => {
    if (count.get(name) === 1 && used.has(name)) return name;
    let made = `${[...name].slice(0, 40).join('')}~${i}`;
    while (used.has(made)) made += '~';
    used.add(made);
    return made;
  });
}

/**
 * The deck's words for a refusal of the steps. The kit names the piece by its `who` (the deck's words), so its own
 * reason is said as it is, without the kit's "isometric: ". Two refusals the deck had words of its own for, which its
 * tests and docs say, are said in those words still: blocks the build cannot place, and a floor fitted too big. Where
 * the kit names a piece by its name in the spec and not by its `who` (a placing refusal says which block), a name made
 * for it (specNames: a shared or a long name) is put back as the deck wrote it — `renamed`: [[made, deck's name]] — so
 * a deck writer never reads a name they did not write — cut as 0.32.0 cut a name in a refusal (shortName).
 */
function deckWords(e, renamed = []) {
  const named = (text) => renamed.reduce((out, [made, name]) => out.split(JSON.stringify(made)).join(`"${shortName(name)}"`), text);
  const said = String(e?.message ?? e).replace(/^isometric: /, '');
  if (said.startsWith(`${MAP}: the blocks cannot be placed from their wires: `) && e.cause) {
    return new Error(named(`the build cannot place this map's blocks: ${String(e.cause.message ?? e.cause).replace(/^isometric: /, '')} — or give every block its data-at`), {cause: e});
  }
  // the build places blocks by at most so many wires (every wire laid along the floor, and the first between each two
  // blocks): past them, the deck's fix as well as the steps'
  const wires = new RegExp(`^${MAP}'s wires holds at most (\\d+), and this one has (\\d+) — split the map in two$`).exec(said);
  if (wires) return new Error(`the build cannot place this map's blocks: it places them by at most ${wires[1]} wires — every wire laid along the floor, and the first between each two blocks — and this map has ${wires[2]} such wires — split the map in two, or give every block its data-at`, {cause: e});
  const big = /^([^]*): fitted round its blocks the floor would be (\d+) by (\d+) tiles, and a floor is at most (\d+) a side — give it an at and a size of its own, or take it out$/.exec(said);
  if (big) return new Error(`${big[1]}: fitted round this map's blocks the floor would be ${big[2]} by ${big[3]} tiles, and a floor is at most ${big[4]} a side — take the floor out, or give it a data-at and a data-size of its own (it is ground: it need not lie under every block)`, {cause: e});
  return new Error(named(said), {cause: e});
}

/**
 * The wires handed to the steps, from the map's wires between pieces (`links`, [[from, to]] by the deck's names, in
 * the order written) and those that lie along the floor (`ends`, one entry a link: [fromEnd, toEnd] with {name, port},
 * or null). `idOf`: the spec's name for a piece's name, when that name is one piece's. Gives {wires, laid}: `laid`
 * one entry a link — the index of its wire in `wires` when it is laid, 'self' or 'work' when it is not handed for
 * that reason, else null.
 */
function handedWires(links, ends, idOf, byBuild) {
  const wires = [], laid = links.map(() => null), pairs = new Set();
  const pair = (a, b) => JSON.stringify([a, b].sort());
  let asked = 0;
  links.forEach((link, i) => {
    const end = ends[i];
    if (end) {
      // the kit lays so many: one past them stays the straight wire it was (and, when the build places, still places)
      if (asked >= MOST_ROUTES) laid[i] = 'work';
      // the steps refuse a wire from a block to itself: it is not handed, and its way is none, for the kit's reason
      else if (end[0].name === end[1].name) laid[i] = 'self';
      asked += 1;
      if (laid[i] === null) {
        laid[i] = wires.length;
        pairs.add(pair(end[0].name, end[1].name));
        wires.push({from: {block: idOf.get(end[0].name), port: end[0].port}, to: {block: idOf.get(end[1].name), port: end[1].port}, straight: false});
        return;
      }
    }
    // the build places the blocks from the first wire between each two (arrange reads no other, and no wire to a piece it does not place)
    if (!byBuild || link[0] === link[1] || !idOf.has(link[0]) || !idOf.has(link[1]) || pairs.has(pair(link[0], link[1]))) return;
    pairs.add(pair(link[0], link[1]));
    wires.push({from: {block: idOf.get(link[0]), port: null}, to: {block: idOf.get(link[1]), port: null}, straight: true});
  });
  return {wires, laid};
}

/**
 * A map built by the steps, from its pieces as the deck read them, each already checked in the deck's words:
 *   blocks    [{name, kind, at|null, size, label, rule, group, ports, who}]   (at null for all of them: the build places them)
 *   floors    [{name, at|null, size|null, label, icon, group, who}]
 *   obstacles [{name, at, size, ports, who}]   (the footprints)
 *   keep      [{at, size, name, piece}]   (floor kept clear, in tiles; `piece` the deck's name of the words over it)
 *   links, ends   the wires (handedWires)
 *   grid      {tile, origin, rise?} as written, 'fit', or null;   canvas, area   the slide and where a fitted picture goes
 *   style     the map's row of style choices (isoStyle.js · readStyle), or null: today's look
 * Gives {map, spec, ids: {blocks, floors, obstacles}, routes}: `map` the built map (buildIsoMap: frozen plain data),
 * `spec` the very spec buildIsoMap was handed, frozen at every level — WHY kept: the run hands this spec to the map flow
 * (run/maps.js), so the record is of the map the page draws, never of one made again — `ids` the spec's name of each
 * piece, `routes` one entry a link — {route, lift} for a wire laid (or not: its why), else null, as cable.js · cablesOn
 * reads them, the deck's names back in the kit's words.
 */
export function builtMap({blocks = [], floors = [], obstacles = [], keep = [], links = [], ends = links.map(() => null), grid = null, canvas = null, area = null, style = null}) {
  const names = specNames([...blocks, ...floors, ...obstacles].map((p) => p.name));
  const ids = {blocks: names.slice(0, blocks.length), floors: names.slice(blocks.length, blocks.length + floors.length), obstacles: names.slice(blocks.length + floors.length)};
  // a name a wire can end at: one standing piece's (two that share it are no end)
  const standing = [...blocks.map((p, i) => [p.name, ids.blocks[i]]), ...obstacles.map((p, i) => [p.name, ids.obstacles[i]])], count = new Map();
  for (const [name] of standing) count.set(name, (count.get(name) ?? 0) + 1);
  const idOf = new Map(standing.filter(([name]) => count.get(name) === 1));
  const byBuild = blocks.some((p) => p.at === null);
  const {wires, laid} = handedWires(links, ends, idOf, byBuild);
  // a copy, frozen at every level, is what the steps are handed: the pieces' own lists stay the deck's to use
  const spec = frozen(structuredClone({
    who: MAP,
    blocks: blocks.map((p, i) => ({name: ids.blocks[i], kind: p.kind, at: p.at, size: p.size, label: p.label ?? null, rule: p.rule ?? null, group: p.group ?? null, ports: p.ports ?? [], who: whoOf(p.who)})),
    floors: floors.map((f, i) => ({name: ids.floors[i], at: f.size ? (f.at ?? [0, 0]).slice(0, 2) : null, size: f.size, label: f.label ?? null, icon: Boolean(f.icon), group: f.group ?? null, who: whoOf(f.who)})),
    obstacles: obstacles.map((o, i) => ({name: ids.obstacles[i], at: o.at, size: o.size, ports: o.ports ?? [], who: whoOf(o.who)})),
    keep: keep.map(({at, size, name}) => ({at, size, name})), wires, grid, usualGrid: usualGrid(canvas), area,
    // the map's style as its writer named it (isoStyle.js · readStyle): handed only when written, so the spec of a map
    // with none — and the record of it — is as before
    ...(style ? {style} : {}),
  }));
  let map;
  try { map = buildIsoMap(spec, DECK); } catch (e) {
    const pieces = [...blocks, ...floors, ...obstacles];
    throw deckWords(e, names.flatMap((made, i) => (made === pieces[i].name ? [] : [[made, pieces[i].name]])));
  }
  // each name the kit says, as the deck's: a block's or a footprint's, and the words a wire runs under
  const deckName = new Map([...blocks.map((p, i) => [ids.blocks[i], p.name]), ...obstacles.map((o, i) => [ids.obstacles[i], o.name])]);
  const at = new Map([...blocks.map((p, i) => [p.name, map.at[i]]), ...obstacles.map((o) => [o.name, o.at])]);
  const liftOf = (name) => at.get(name)?.[2] ?? 0;
  const routes = links.map((link, i) => {
    const how = laid[i];
    if (how === null) return null;
    const [from, to] = ends[i].map((end) => end.name), lift = liftOf(from);
    if (how === 'self' || how === 'work') return {route: {from, to, points: null, why: how === 'self' ? NO_ROUTE.self : NO_ROUTE.work}, lift};
    const r = map.routes[how];
    return {route: {...r, from, to, ...(r.behind && {behind: r.behind.map((id) => deckName.get(id))}), ...(r.under && {under: [...new Set(r.under.map((k) => keep.find((s) => s.name === k)?.piece ?? k))]})}, lift};
  });
  return {map, spec, ids, routes};
}

/**
 * The wires of some pieces that already stand, laid along the floor by the steps: what cable.js · cables lays for a
 * caller that hands no ways (the build hands its own: iso.js · isoDrawn). `links`: one entry a wire, [from, to] by
 * piece name (or {name, port}), or null; `solids`: every block, cylinder and footprint, {name, kind, at, size, ports}
 * — those that share a name too, which a wire cannot end at and must still go round. Gives one entry a link: null, or
 * {route, lift}.
 */
export function layRoutes(links, solids) {
  const blocks = [], obstacles = [];
  for (const s of solids) (s.kind === 'footprint' ? obstacles : blocks).push({name: s.name, kind: s.kind, at: s.at, size: s.size, ports: s.ports ?? [], who: `"${s.name}"`});
  const count = new Map();
  for (const {name} of solids) count.set(name, (count.get(name) ?? 0) + 1);
  const end = (e) => (typeof e === 'string' ? {name: e, port: null} : {name: e.name, port: e.port ?? null});
  const ends = links.map((link) => (link && link.every((e) => count.get(end(e).name) === 1) ? link.map(end) : null));
  if (!ends.some(Boolean)) return links.map(() => null);
  return builtMap({blocks, obstacles, links: links.map((link) => (link ? link.map((e) => end(e).name) : [])), ends}).routes;
}
