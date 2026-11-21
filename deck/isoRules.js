// isoRules — the deck's own rules for an isometric map, said in its words before the map is built (iso.js · isoDrawn):
// who places the blocks, what a floor needs, where a fitted picture goes, and each piece as the grid reads it.
//
// WHY apart from the steps: footprint-story's map steps (buildIsoMap) check what they are handed too, in their own
// words. These are the deck's refusals — written in its attributes (data-at, data-size, data-iso-grid, deck.json
// "area") and pinned by its tests and docs — so they are asked first, and the steps never meet a map the deck would
// refuse. Nothing here places, fits or lays anything: that is the steps' (isoSpec.js).
import {isometric} from 'footprint-story/isometric';

const quoted = (pieces) => pieces.map((p) => `"${p.name}"`).join(', ');
/** The grid a piece is checked against before the map is built: what the grid refuses of a piece does not depend on its tile. */
const UNIT = isometric();

/**
 * A piece as the grid reads it, refused here in the deck's words, naming the piece: a size or a place that is none, a
 * cylinder that is not round, a floor that is not whole tiles. Asked before the map is built, so the steps never meet
 * a piece the deck would refuse, and say nothing of it in words of their own. A block the build places is read at
 * [0, 0]; a floor with no size is fitted, and has nothing to read yet.
 */
function checkShape(p) {
  try {
    if (p.kind !== 'floor') UNIT[p.kind]({at: p.at ?? [0, 0], size: p.size});
    else if (p.size !== null) {
      if (p.size.length !== 2) throw new Error(`isometric: a floor's size is "cols rows" — not "${p.size.join(' ')}"`);
      UNIT.floor({cols: p.size[0], rows: p.size[1], at: (p.at ?? [0, 0]).slice(0, 2)});
    }
  } catch (e) {
    throw new Error(`${p.where}: ${e.message.replace(/^isometric: /, '')}`, {cause: e});
  }
}

/**
 * The deck's own rules for who places a map's blocks, said in its words before the map is built; gives whether the
 * build places them. All placed by the map, or all by the build from its wires — never some of each; and the build
 * places them only when nothing on the floor is placed by hand (a footprint, floor kept clear) and each has a first
 * name of its own (the wires name them by it). Placing them is the steps' (footprint-story/isometric · buildIsoMap ·
 * place: `arrange`, or `arrangeByGroup` when a block has a group).
 */
export function checkPlacing(solid, feet, clear) {
  const unplaced = solid.filter((p) => p.at === null);
  if (unplaced.length && unplaced.length < solid.length) {
    throw new Error(`${quoted(unplaced)} ${unplaced.length === 1 ? 'has' : 'have'} no data-at and ${quoted(solid.filter((p) => p.at !== null))} ${solid.length - unplaced.length === 1 ? 'has' : 'have'} one: the build places a map's blocks from its wires only when it places them all — take data-at off the others, or give every block one (a block with none stood at "0 0" before 0.17.0)`);
  }
  const byBuild = unplaced.length > 0;
  // a footprint stands where its piece's style puts it: the build cannot place blocks round a picture it does not move
  if (byBuild && clear.length) throw new Error(`${quoted(unplaced)} ${unplaced.length === 1 ? 'has' : 'have'} no data-at, and ${clear[0].where} keeps the floor under it clear where its own style puts it: the build places a map's blocks only when nothing on the floor is placed by hand — give every block its data-at`);
  if (byBuild && feet.length) throw new Error(`${quoted(unplaced)} ${unplaced.length === 1 ? 'has' : 'have'} no data-at, and ${feet[0].where} stands where its own style puts it: the build places a map's blocks only when nothing on the floor is placed by hand — give every block its data-at`);
  if (byBuild) {
    // a piece is known by the first name in its data-k: the wires say it, and the build places by it
    const twice = solid.map((p) => p.name).find((name, i, all) => all.indexOf(name) !== i);
    if (twice !== undefined) throw new Error(`the build places a map's blocks by the first name in their data-k, and two are called "${twice}" — give each a first name of its own, or give every block its data-at`);
  }
  for (const p of solid) checkShape(p);
  return byBuild;
}

/** The deck's own rules for a floor, said in its words before the map is built: one with no size is fitted round blocks that stand on it. */
export function checkFloors(floors, solid, feet) {
  for (const floor of floors) {
    checkShape(floor);
    if (floor.size !== null) continue;
    if (floor.at !== null) throw new Error(`${floor.where}: a floor with a data-at needs its data-size too ("8 5") — or write neither, and the build fits the floor round the blocks`);
    if (!solid.length && !feet.length) throw new Error(`${floor.where}: a floor with no data-size is fitted round the blocks that stand on it, and this map has none — give it a data-size ("8 5")`);
    if (floor.group !== null && !solid.some((p) => p.group === floor.group)) throw new Error(`${floor.where}: its group "${floor.group}" has no block — give blocks data-iso-group="${floor.group}", or take the group off the floor`);
  }
}

/**
 * Where a fitted picture goes, checked in the deck's words when the picture is fitted: the slide's area, [x0, y0, x1,
 * y1] (deck.json "area"), or the whole slide. Gives the area the steps are handed: null when it is none and nothing is
 * fitted into it (a picture on a written or the usual grid never reads it).
 */
export function areaOf(solid, {fitted, canvas, area}) {
  const [w, h] = canvas ?? [1920, 1080], into = area ?? [0, 0, w, h];
  const fine = Array.isArray(into) && into.length === 4 && into.every(Number.isFinite) && into[2] > into[0] && into[3] > into[1];
  if (!fitted) return fine ? into : null;
  if (!solid.length) throw new Error('data-iso-grid="fit": the grid is fitted to the blocks, and this map has none — add a block, or write the grid in numbers ("120 at 960 240")');
  // each number as it is (NaN as NaN, where JSON would say null)
  if (!fine) throw new Error(`a fitted picture goes into the slide's area, [x0, y0, x1, y1] in slide px with x1 past x0 and y1 past y0 (deck.json "area") — not ${Array.isArray(into) ? `[${into.map(String).join(', ')}]` : JSON.stringify(into)}`);
  return into;
}
