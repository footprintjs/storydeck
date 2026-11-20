// cable — a wire between two isometric pieces, laid along the floor. Plain numbers in, plain numbers out.
//
// The way is the kit's (footprint-story/isometric · routes): it leaves a block at one of the two feet a viewer sees,
// runs along the floor's tile lines, turns square, goes round what stands in its way, keeps off floor a block hides
// when it can, and comes into the other block at a foot that is seen; a request and its answer lie in two lanes. A film
// lays the same wires the same way. This file puts that way on the slide: its points in slide px, its corners rounded
// (the kit's `rounded`), and where its label stands on it.
//
// WHY the kit and not a curve of our own (0.18.0 drew one curve between two fixed feet): one curve cannot go round a
// block, so a block in front of another, or close beside it, got no cable, and a cable to a block two steps away ran
// behind the block between. A way found on the floor's own lattice has none of those cases.
//
// A wire has no cable when the kit finds no way (its `why` says which: two heights, no free place at a foot, walled
// in); it is then drawn straight, from outline to outline (transforms.js). A wire that should run straight anyway
// says so with a bend of 0 ("a to b 0").
import {routes, rounded, MOST_ROUTES, NO_ROUTE} from 'footprint-story/isometric';

/** How far, in slide px, a cable's ends stand off the foot they touch. */
const CLEAR = 6;
/** A corner's rounding, in tiles along the floor: under the half tile two lanes lie apart, so a request's corner and its answer's do not meet. */
const CORNER = 0.4;
const SAMPLE = 6;   // px between the points asked: of a cable, whether it is under a label; of a label, whether a block is over it
/** The most points a cable is walked in: a cable longer than a slide is asked more coarsely, never at greater cost. */
export const WALK_MOST = 512;

/**
 * The cables of a map. `links`: one entry a wire, [from, to] by piece name, or null for a wire that is no cable;
 * `shapes`: a Map from a name to its one piece, {at: [col, row, lift], size: [wide, deep, high], kind}; `floor(col,
 * row, lift)`: where a floor point is on the slide, [x, y]; `solids`: every block and cylinder of the map, each {name,
 * at, size, kind} — those that share a name too: a wire cannot end at one of them, and must still go round it.
 * Gives, in the same order, null for a wire that was not asked, and else {points, radius, route}: `route` what the
 * kit says of it (its feet, its bends, what it passes behind — or `why` it has none), `points` its way on the slide
 * from 6 px off one foot to 6 px off the other ([[x, y], …], null when it has none), `radius` its corners' rounding.
 *
 * The kit knows each piece by a number of ours, not by its name: two pieces may share a name, and a name may be any
 * text a deck holds (the kit keeps names to 200 characters, and would refuse the whole map for one).
 */
export function cables(links, shapes, floor, solids = [...shapes.values()]) {
  const idOf = new Map(solids.map((piece, i) => [piece, String(i)]));
  const asked = links.map((link, i) => (link && idOf.has(shapes.get(link[0])) && idOf.has(shapes.get(link[1])) ? i : -1)).filter((i) => i >= 0);
  const laid = links.map(() => null);
  if (!asked.length) return laid;
  const things = solids.map(({at, size, kind}, i) => ({name: String(i), at, size, round: kind === 'cylinder'}));
  const first = asked.slice(0, MOST_ROUTES);   // the kit lays so many
  const found = routes(things, first.map((i) => links[i].map((name) => idOf.get(shapes.get(name)))));
  const origin = floor(0, 0, 0), tile = Math.hypot(floor(1, 0, 0)[0] - origin[0], floor(1, 0, 0)[1] - origin[1]);   // a tile along the floor, in slide px
  first.forEach((i, k) => {
    // the kit's words, with the deck's names back in them
    const route = {...found[k], from: links[i][0], to: links[i][1], ...(found[k].behind && {behind: found[k].behind.map((id) => solids[Number(id)].name)})};
    if (!route.points) { laid[i] = {points: null, radius: 0, route}; return; }
    const lift = shapes.get(route.from).at[2], points = route.points.map(([col, row]) => floor(col, row, lift));
    // each end 6 px off its foot, along its own run
    const off = (p, towards) => { const far = Math.hypot(towards[0] - p[0], towards[1] - p[1]) || 1, by = Math.min(CLEAR, far / 2); return [p[0] + (towards[0] - p[0]) * by / far, p[1] + (towards[1] - p[1]) * by / far]; };
    points[0] = off(points[0], points[1]);
    points[points.length - 1] = off(points.at(-1), points.at(-2));
    laid[i] = {points, radius: CORNER * tile, route};
  });
  // a wire past what the kit lays stays the straight wire it was, and says why
  for (const i of asked.slice(MOST_ROUTES)) laid[i] = {points: null, radius: 0, route: {from: links[i][0], to: links[i][1], points: null, why: NO_ROUTE.work}};
  return laid;
}

/**
 * What there is to say of a wire's way, as the build writes it on the wire (data-sd-way) — '' when it lies well. The
 * build knows why a wire is as it is; written on the wire, `check` can tell whoever writes the deck (a person, or a
 * model) in words, with the fix, where a picture would have to be looked at and guessed from.
 *   "behind logs cache; crosses 2; shared; turns 5"    a cable: what it passes behind, how many it crosses, …
 *   "straight heights"                                 no cable: the key of the kit's reason (NO_ROUTE)
 * A name is written so that no letter of it can be read as part of the note (a name may hold a ";").
 */
export function wayNote(route) {
  if (!route.points) return `straight ${Object.keys(NO_ROUTE).find((key) => NO_ROUTE[key] === route.why) ?? 'way'}`;
  return [route.behind.length && `behind ${route.behind.map(encodeURIComponent).join(' ')}`, route.crosses && `crosses ${route.crosses}`, route.shared && 'shared', route.bends > 3 && `turns ${route.bends}`].filter(Boolean).join('; ');
}

const CROSSINGS_SAID = 3;   // wires cross in every diagram: a wire's crossings are said from three on
const STRAIGHT = {
  heights: ['info', 'the two stand at different heights'],
  foot: ['warn', 'one of the two has no free place at a foot that can be seen — move the blocks round it away, or make it wider (data-size)'],
  way: ['warn', 'there is no way along the floor between them — leave floor free round them'],
  work: ['info', 'the map has more wires than are laid along the floor'],
  wide: ['info', 'the blocks stand too far apart for the smallest of them to lay wires between'],
  name: ['info', 'one of its names is no block here'],
  self: ['info', 'it joins a block to itself'],
};
/**
 * A data-sd-way note as what `check` says: [{level: 'warn' | 'info', message}], each with its fix. `from`, `to`: the
 * names the wire joins. An unknown word in a note says nothing (a page written by a newer build).
 */
export function readWay(note, from, to) {
  const out = [], said = (level, message) => out.push({level, message});
  for (const part of String(note).split(';').map((p) => p.trim()).filter(Boolean)) {
    const [word, ...rest] = part.split(/\s+/);
    if (word === 'straight' && STRAIGHT[rest[0]]) said(STRAIGHT[rest[0]][0], `is drawn straight, through the air, not along the floor: ${STRAIGHT[rest[0]][1]}`);
    const names = rest.map((name) => { try { return decodeURIComponent(name); } catch { return name; } });
    if (word === 'behind' && rest.length) said('warn', `passes behind ${names.join(', ')}: that stretch of it is hidden — move ${rest.length === 1 ? 'it' : 'them'} or the two blocks so there is floor to see between, or draw the wire straight (data-arrow="${from} to ${to} 0")`);
    if (word === 'shared') said('warn', 'lies on another wire for want of room: a foot of a block has a place for three wires — make the block wider (data-size), or take a wire out');
    if (word === 'crosses' && /^\d+$/.test(rest[0] ?? '') && Number(rest[0]) >= CROSSINGS_SAID) said('info', `crosses ${rest[0]} other wires`);
    if (word === 'turns' && /^\d+$/.test(rest[0] ?? '')) said('info', `turns ${rest[0]} times on its way`);
  }
  return out;
}

/** A cable's line on the slide: its points, the last pulled `back` px (where an arrow's head begins), its corners rounded — the kit's rounded way. */
export function cableWay({points, radius}, back = 0) {
  const tip = points.at(-1), before = points.at(-2), far = Math.hypot(tip[0] - before[0], tip[1] - before[1]) || 1, by = Math.max(0, Math.min(back, far - 1));   // never past the run's own start, never forwards
  return rounded([...points.slice(0, -1), [tip[0] - (tip[0] - before[0]) * by / far, tip[1] - (tip[1] - before[1]) * by / far]], radius);
}

/** The point `t` (0 to 1) of the way along a cable's line (a rounded way), by length. */
export const cablePoint = (way, t) => way.at(t);

/** A cable's line walked from its start to its end: points SAMPLE px apart at most (further on one longer than WALK_MOST of them). */
export function cableWalk(way) {
  const steps = Math.min(WALK_MOST, Math.max(1, Math.ceil(way.length / SAMPLE)));
  return Array.from({length: steps + 1}, (_, k) => way.at(k / steps));
}

/** Whether a slide point is inside an outline (its points in order round it). */
function inside(outline, [x, y]) {
  let odd = false;
  for (let i = 0, j = outline.length - 1; i < outline.length; j = i++) {
    const [xi, yi] = outline[i], [xj, yj] = outline[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) odd = !odd;
  }
  return odd;
}

/**
 * Points, with the box that holds them: {points, left, top, right, bottom}. What may be in the way is asked by its
 * box first, so on a map of hundreds of cables each one looks only at the few things near it.
 */
export function held(points) {
  let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
  for (const [x, y] of points) { left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y); }
  return {points, left, top, right, bottom};
}
/** Those of `things` (each held) whose box reaches within `far` px of the box round `at`. */
const near = (things, at, half, far = 0) => things.filter((t) => t.right > at[0] - half[0] - far && t.left < at[0] + half[0] + far && t.bottom > at[1] - half[1] - far && t.top < at[1] + half[1] + far);

/** Where a label may stand along its cable: the middle first, then a twentieth further to each side by turns, a fifth to four fifths of the way. */
export const LABEL_PLACES = Object.freeze(Array.from({length: 13}, (_, k) => +(0.5 + (k % 2 ? -1 : 1) * Math.ceil(k / 2) * 0.05).toFixed(2)));
const EDGE = 3;     // px a cable's line keeps off a label's box: half the line and a little air
const TIP = 16;     // px round a cable's tip that its label keeps off: the arrow's head
/**
 * The looks one map's labels may spend between them (labelPlace): a look is one point of a label asked against one
 * side of an outline, or one point of another cable asked against a label. WHY a limit: a deck is text someone
 * wrote, and a build runs on every save — a map of thousands of labelled cables, or a label thousands of letters
 * long, must cost no more than this (about a third of a second), where a careful search of it would take minutes.
 * A map of sixty labelled cables spends a twentieth of it; three hundred on a crowded floor, nearly all.
 */
export const LABEL_LOOKS = 60_000_000;

/**
 * Where a cable's label stands: on the cable itself, as near its middle as it can be with nothing in its way. A cable
 * lies on the floor, so a block standing nearer the viewer is drawn over it and over its label, and beside the middle
 * of a cable there is often a block's face, or the cable's twin. `half`: half the label's width and height; `hides`:
 * what hides a label, each an outline held (`held`) — what each block draws on the slide, and the labels placed
 * before this one; `runs`: the map's cables, each walked (cableWalk), held, and marked with the cable it is (`of`) —
 * this cable's own is passed over. Gives [x, y], the label's middle: the first of LABEL_PLACES where no outline
 * reaches it and no other cable runs through it. Where there is none: the place where the least of it is hidden, of
 * those the one the least of another cable runs through, and of those the earliest.
 *
 * A label keeps off its own cable's two ends as it keeps off a block: its plate over the arrow's head would hide
 * where the cable goes (TIP px round `tip`, half that round the line's start). `cable` is the cable's line (cableWay).
 *
 * `looks`: {left}, the looks the map has left (LABEL_LOOKS at its start); each place asked spends its own. A place
 * that would cost more than is left is not asked, nor any after it: the label takes the best place asked so far, or
 * the cable's middle when none was.
 */
export function labelPlace(cable, half, hides, runs = [], looks = {left: LABEL_LOOKS}, tip = cable.at(1)) {
  const across = Math.max(1, Math.ceil((2 * half[0]) / SAMPLE)), down = Math.max(1, Math.ceil((2 * half[1]) / SAMPLE));
  const round = ([x, y], far) => held([[x - far, y - far], [x + far, y - far], [x + far, y + far], [x - far, y + far]]);
  const ends = [round(tip, TIP), round(cable.start, TIP / 2)];
  let best = null;
  for (const t of LABEL_PLACES) {
    if (hides.length + runs.length > looks.left) break;   // finding what is near is a look at each thing
    const at = cablePoint(cable, t), over = [...near(hides, at, half), ...near(ends, at, half)], lines = near(runs, at, half, EDGE).filter((run) => run.of !== cable);
    const sides = over.reduce((sum, outline) => sum + outline.points.length, 0), steps = lines.reduce((sum, run) => sum + run.points.length, 0);
    const cost = (across + 1) * (down + 1) * sides + steps + hides.length + runs.length;
    if (cost > looks.left) break;
    looks.left -= cost;
    let hidden = 0, crossed = 0;
    for (let i = 0; over.length && i <= across; i++) {
      for (let j = 0; j <= down; j++) {
        const point = [at[0] - half[0] + (2 * half[0] * i) / across, at[1] - half[1] + (2 * half[1] * j) / down];
        if (over.some((outline) => inside(outline.points, point))) hidden += 1;
      }
    }
    for (const run of lines) for (const [x, y] of run.points) if (Math.abs(x - at[0]) < half[0] + EDGE && Math.abs(y - at[1]) < half[1] + EDGE) crossed += 1;
    if (!hidden && !crossed) return at;
    if (!best || hidden < best.hidden || (hidden === best.hidden && crossed < best.crossed)) best = {at, hidden, crossed};
  }
  return best ? best.at : cablePoint(cable, 0.5);
}
