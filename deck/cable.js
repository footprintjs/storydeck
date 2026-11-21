// cable — a wire between two isometric pieces, laid along the floor. Plain numbers in, plain numbers out.
//
// The way is the kit's (footprint-story/isometric · routes): it leaves a block at one of the two feet a viewer sees,
// runs along the floor's tile lines, turns square, goes round what stands in its way, keeps off floor a block hides
// when it can, and comes into the other block at a foot that is seen; a request and its answer lie in two lanes. A film
// lays the same wires the same way. This file puts that way on the slide — its points in slide px — and says what
// happened to it in words. Its line, stopped for its head and its corners rounded, is the kit's `cableWay` (StoryDeck's
// rule, moved there in 0.30.1), asked by transforms.js.
//
// WHY the kit and not a curve of our own (0.18.0 drew one curve between two fixed feet): one curve cannot go round a
// block, so a block in front of another, or close beside it, got no cable, and a cable to a block two steps away ran
// behind the block between. A way found on the floor's own lattice has none of those cases.
//
// A wire has no cable when the kit finds no way (its `why` says which: two heights, no free place at a foot, walled
// in); it is then drawn straight, from outline to outline (transforms.js). A wire that should run straight anyway
// says so with a bend of 0 ("a to b 0").
import {hairpins, routes, CABLE, MOST_ROUTES, NO_ROUTE} from 'footprint-story/isometric';

// The cable's numbers (how far its ends stand off a foot, its corners' rounding) and where its label stands on it are
// footprint-story/isometric's (CABLE; labelPlace, held, walkWay, LABEL_PLACES), so a deck and a film put a cable and its
// label in the same place (moved there in 0.30.0): CABLE.clear px off the foot, corners CABLE.corner of a tile — under
// the half tile two lanes lie apart, so a request's corner and its answer's do not meet.
const {clear: CLEAR, corner: CORNER} = CABLE;

/**
 * The wires of a map, laid along the floor: tiles in, tiles out — nothing of a slide yet. `links`: one entry a wire,
 * [from, to] by piece name, or null for a wire that is not laid; `solids`: every block and cylinder of the map, each
 * {name, at: [col, row, lift], size: [wide, deep, high], kind} — those that share a name too: a wire cannot end at one
 * of them, and must still go round it. Gives, in the same order, null for a wire that was not asked (or an end that
 * is not the one piece of its name), and else {route, lift}: `route` what the kit says of it (its points in tiles,
 * its feet, its bends, what it passes behind — or `why` it has none), `lift` the height of the floor it lies on.
 *
 * The kit knows each piece by a number of ours, not by its name: two pieces may share a name, and a name may be any
 * text a deck holds (the kit keeps names to 200 characters, and would refuse the whole map for one).
 */
export function layRoutes(links, solids, keep = []) {
  const idOf = new Map(), twice = new Set();
  solids.forEach(({name}, i) => { if (idOf.has(name)) twice.add(name); else idOf.set(name, String(i)); });
  for (const name of twice) idOf.delete(name);
  // an end is a piece's name, or {name, port}: a port of that piece
  const nameOf = (end) => (typeof end === 'string' ? end : end.name), kitEnd = (end) => (typeof end === 'string' || end.port === null ? idOf.get(nameOf(end)) : {thing: idOf.get(end.name), port: end.port});
  const asked = links.map((link, i) => (link && idOf.has(nameOf(link[0])) && idOf.has(nameOf(link[1])) ? i : -1)).filter((i) => i >= 0);
  const laid = links.map(() => null);
  if (!asked.length) return laid;
  const things = solids.map(({at, size, kind, ports}, i) => ({name: String(i), at, size, round: kind === 'cylinder', ...(ports?.length ? {ports} : {})}));
  const first = asked.slice(0, MOST_ROUTES);   // the kit lays so many
  // floor kept clear (keepClear.js): a cost to the kit, never a wall; asked only when a map keeps some, so every other map lays as before
  const found = routes(things, first.map((i) => links[i].map(kitEnd)), keep.length ? {keep: keep.map(({at, size, name}) => ({at, size, name}))} : undefined);
  const liftOf = (end) => solids[Number(idOf.get(nameOf(end)))].at[2] ?? 0;
  // the kit's words, with the deck's names back in them
  first.forEach((i, k) => { laid[i] = {route: {...found[k], from: nameOf(links[i][0]), to: nameOf(links[i][1]), ...(found[k].behind && {behind: found[k].behind.map((id) => solids[Number(id)].name)}), ...(found[k].under && {under: [...new Set(found[k].under.map((id) => keep.find((stretch) => stretch.name === id)?.piece ?? String(id)))]})}, lift: liftOf(links[i][0])}; });
  // a wire past what the kit lays stays the straight wire it was, and says why
  for (const i of asked.slice(MOST_ROUTES)) laid[i] = {route: {from: nameOf(links[i][0]), to: nameOf(links[i][1]), points: null, why: NO_ROUTE.work}, lift: liftOf(links[i][0])};
  return laid;
}

/** The floor points laid routes reach, [[col, row, lift], …]: what the floor and the picture are fitted to beside the blocks. */
export const reachOf = (laid) => laid.flatMap((entry) => (entry?.route.points ? (entry.route.path ?? entry.route.points.map(([col, row]) => [col, row, entry.lift])).map(([col, row, height]) => [col, row, height ?? entry.lift]) : []));

/**
 * Laid routes (layRoutes) put on the slide. `floor(col, row, lift)`: where a floor point is on the slide, [x, y].
 * Gives, in the same order, null for a wire that was not laid, and else {points, radius, tile, route}: `points` its
 * way on the slide from 6 px off one foot to 6 px off the other ([[x, y], …], null when it has none), `radius` its
 * corners' rounding in px, `tile` a tile along the floor in px, `route` as it was laid.
 */
export function cablesOn(laid, floor) {
  const origin = floor(0, 0, 0), tile = Math.hypot(floor(1, 0, 0)[0] - origin[0], floor(1, 0, 0)[1] - origin[1]);   // a tile along the floor, in slide px
  return laid.map((entry) => {
    if (!entry) return null;
    const {route, lift} = entry;
    if (!route.points) return {points: null, radius: 0, tile, route};
    // the whole way: out of a port at its height and down, along the floor, and up into the other (route.path)
    const path = route.path ?? route.points.map(([col, row]) => [col, row, lift]), points = path.map(([col, row, height]) => floor(col, row, height));
    // an end at a foot stands 6 px off it, along its own run; an end at a port is the port itself
    const off = (p, towards) => { const far = Math.hypot(towards[0] - p[0], towards[1] - p[1]) || 1, by = Math.min(CLEAR, far / 2); return [p[0] + (towards[0] - p[0]) * by / far, p[1] + (towards[1] - p[1]) * by / far]; };
    const ports = route.ports ?? [null, null];
    if (!ports[0]) points[0] = off(points[0], points[1]);
    if (!ports[1]) points[points.length - 1] = off(points.at(-1), points.at(-2));
    // each port end: how many points its lead holds (the port, the point out of its side when it is above the floor, the floor
    // point), whether its side faces the viewer, and the lead's length in px — what the floor's own measures start after
    const riser = (p) => p[2] > lift + 1e-9;
    const ends = [0, 1].map((k) => (ports[k] ? {port: ports[k], seen: route.feet[k] === 'right' || route.feet[k] === 'left', count: riser(k ? path.at(-1) : path[0]) ? 3 : 2} : null));
    const length = (list) => list.slice(1).reduce((sum, p, i) => sum + Math.hypot(p[0] - list[i][0], p[1] - list[i][1]), 0);
    return {points, radius: CORNER * tile, tile, route, ends, lead: ends[0] ? length(points.slice(0, ends[0].count)) : 0};
  });
}

/**
 * The cables of a map, laid and put on the slide in one call (layRoutes, cablesOn). `shapes`: a Map from a name to its
 * one piece — a wire ends only at such a piece; `solids`: every block and cylinder (all of `shapes` when not given).
 */
export function cables(links, shapes, floor, solids = [...shapes.values()]) {
  const named = solids.map((piece) => ({...piece, name: piece.name ?? [...shapes].find(([, shape]) => shape === piece)?.[0] ?? ''}));
  return cablesOn(layRoutes(links.map((link) => (link && shapes.has(link[0]) && shapes.has(link[1]) ? link : null)), named), floor);
}

/**
 * What there is to say of a wire's way, as the build notes it — '' when it lies well. The build knows why a wire is
 * as it is; kept beside the page (compile.js · maps[name].ways), `check` can tell whoever writes the deck (a person,
 * or a model) in words, with the fix, where a picture would have to be looked at and guessed from.
 *   "behind logs cache; crosses 2; shared; turns 5"    a cable: what it passes behind, how many it crosses, …
 *   "straight heights"                                 no cable: the key of the kit's reason (NO_ROUTE)
 * A name is written so that no letter of it can be read as part of the note (a name may hold a ";").
 */
export function wayNote(route) {
  if (!route.points) return `straight ${Object.keys(NO_ROUTE).find((key) => NO_ROUTE[key] === route.why) ?? 'way'}`;
  // a port on a back side starts (or ends) the cable behind its own block: said as that, not as a block to move
  const back = [0, 1].filter((k) => route.ports?.[k] && /^back-/.test(route.feet[k])).map((k) => (k ? route.to : route.from));
  const behind = route.behind.filter((name) => !back.includes(name));
  const pins = hairpins(route.path ?? [], route.ports ?? []);
  const under = route.under ?? [];
  return [back.length && `back ${back.map(encodeURIComponent).join(' ')}`, behind.length && `behind ${behind.map(encodeURIComponent).join(' ')}`, route.crosses && `crosses ${route.crosses}`, route.shared && 'shared', pins.length && `hairpin ${pins.join(' ')}`, under.length && `under ${under.map(encodeURIComponent).join(' ')}`, route.bends > 3 && `turns ${route.bends}`].filter(Boolean).join('; ');
}

/**
 * The hairpins `check` has words for (footprint-story/isometric · hairpins says where a cable doubles back: leaving its
 * first port, coming into its last, or a tight U on the floor). WHY a list here: these are the words a note may hold
 * that readWay says — a word of a newer kit says nothing until the deck has words for it.
 */
const HAIRPIN_WORDS = ['start', 'end', 'start-hook', 'end-hook', 'middle'];

const CROSSINGS_SAID = 3;   // wires cross in every diagram: a wire's crossings are said from three on
const STRAIGHT = {
  heights: ['info', 'the two stand at different heights'],
  foot: ['warn', 'one of the two has no free place at a foot that can be seen — move the blocks round it away, or make it wider (data-size)'],
  way: ['warn', 'there is no way along the floor between them — leave floor free round them'],
  work: ['info', 'the map is too big to lay every wire along the floor'],
  wide: ['info', 'the blocks stand too far apart for the smallest of them to lay wires between'],
  name: ['info', 'one of its names is no block here'],
  self: ['info', 'it joins a block to itself'],
  port: ['warn', 'one of its ports has no way out: another block stands right in front of it, or the floor there is closed — move that block, or the port'],
  portName: ['info', 'one of its ports is no port of its block'],
};
/**
 * A note of a wire's way as what `check` says: [{level: 'warn' | 'info', message}], each with its fix. `from`, `to`: the
 * names the wire joins. An unknown word in a note says nothing (a page written by a newer build).
 */
export function readWay(note, from, to) {
  const out = [], said = (level, message) => out.push({level, message});
  for (const part of String(note).split(';').map((p) => p.trim()).filter(Boolean)) {
    const [word, ...rest] = part.split(/\s+/);
    if (word === 'straight' && STRAIGHT[rest[0]]) said(STRAIGHT[rest[0]][0], `is drawn straight, through the air, not along the floor: ${STRAIGHT[rest[0]][1]}`);
    const names = rest.map((name) => { try { return decodeURIComponent(name); } catch { return name; } });
    if (word === 'behind' && rest.length) said('warn', `passes behind ${names.join(', ')}: that stretch of it is hidden — move ${rest.length === 1 ? 'it' : 'them'} or the two blocks so there is floor to see between, or draw the wire straight (data-arrow="${from} to ${to} 0")`);
    if (word === 'back' && rest.length) said('info', `plugs into a port on the back of ${names.join(', ')}: that stretch of it runs behind ${rest.length === 1 ? 'that block' : 'those blocks'}, hidden`);
    if (word === 'shared') said('warn', 'lies on another wire for want of room: a foot of a block has a place for three wires — make the block wider (data-size), or take a wire out');
    if (word === 'crosses' && /^\d+$/.test(rest[0] ?? '') && Number(rest[0]) >= CROSSINGS_SAID) said('info', `crosses ${rest[0]} other wires`);
    if (word === 'turns' && /^\d+$/.test(rest[0] ?? '')) said('info', `turns ${rest[0]} times on its way`);
    if (word === 'under' && rest.length) said('warn', `runs under ${names.join(', ')}, kept clear of cables: there was no way round on the floor that was not much longer — move ${rest.length === 1 ? 'it' : 'them'}, or the blocks, so there is floor round ${rest.length === 1 ? 'it' : 'them'}`);
    for (const at of word === 'hairpin' ? rest : []) {
      if (!HAIRPIN_WORDS.includes(at)) continue;   // a word of a newer build says nothing
      const [end, hook] = at.split('-'), name = end === 'start' ? from : to;
      if ((end === 'start' || end === 'end') && !hook) said('warn', `doubles back on itself where it leaves ${name}: that port faces away from where the cable goes — put the port on the side of ${name} that faces the way the cable runs, or turn that block`);
      if ((end === 'start' || end === 'end') && hook === 'hook') said('info', `makes a short loop near its port on ${name} — moving the port along its side may straighten it`);
      if (at === 'middle') said('warn', 'doubles back on itself on the floor, a tight U-turn round something in its way — move the blocks so there is a straighter way, or draw the wire straight');
    }
  }
  return out;
}

