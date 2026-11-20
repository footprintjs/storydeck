// keepClear — floor a cable keeps off, under words that float above it: a device's name, a note, a callout.
//
//   <div data-k="lap-name" class="name" data-keep-clear style="left:660px;top:420px;width:180px;height:36px">Laptop</div>
//
// A piece placed by its own style, marked data-keep-clear: the floor its box covers on the slide is floor kept clear for
// the cables the build lays (footprint-story/isometric · routes, `keep`): a cable goes round its words where there is
// another way, and where there is none runs under them, and `check` (rule wire-way) says which cable runs under which
// piece (whether its way on the slide passes through the box: footprint-story/isometric · crossesBox, asked by
// transforms.js). Kept floor is a cost, never a wall: no cable is left without a way for words.
//
// WHY the floor under the box: a cable lies on the floor, so the words cover it where the floor under them is — the
// points of the floor whose place on the slide falls in the box; the story library works that floor out (floorUnder),
// so a film keeps its wires off the same words. WHY the floor must be in numbers: the piece stands
// where its style puts it, so a floor fitted to the slide would move under it (as for a footprint).
import {floorUnder, NO_UNDER} from 'footprint-story/isometric';
import {ownAttribute, pieceTags} from '../pieceRules.js';
import {readPieces} from '../focusHtml.js';

const MAYBE = /data-keep-clear(?![\w-])/i;
/** The furthest a box may stand from the slide, in px: the floor's own reach (footprint-story · NO_UNDER.far), said in the deck's words. */
const FAR = 1e6;

export const mayKeepClear = (html) => MAYBE.test(html);

/**
 * The pieces marked data-keep-clear, in order: [{name, box: {x, y, w, h}, where}]. Throws, naming the fix, for a mark on
 * a piece with no box of its own (a left, a top, a width and a height in its style).
 */
export function readKeepClear(html) {
  if (!mayKeepClear(html)) return [];
  const tags = [...pieceTags(html)], out = [];
  readPieces(html).pieces.forEach((piece, i) => {
    const run = tags[i].before + tags[i].after, own = MAYBE.test(run) ? ownAttribute(run, 'data-keep-clear') : null;
    if (!own) return;
    const where = `"${piece.keys[0]}" (data-keep-clear)`;
    if (!piece.box || !(piece.box.w > 0 && piece.box.h > 0)) throw new Error(`${where}: the floor kept clear is the floor under the piece's box — give it a left, a top, a width and a height in its style`);
    out.push({name: piece.keys[0], box: {...piece.box}, where});
  });
  // a mark on a tag that is no piece (no data-k) keeps nothing clear: refused, not ignored
  const marked = [...html.matchAll(/<[a-zA-Z][\w-]*\b([^>]*)>/g)].filter((t) => MAYBE.test(t[1]) && ownAttribute(t[1], 'data-keep-clear') && !ownAttribute(t[1], 'data-k')).length;
  if (marked) throw new Error('data-keep-clear: it marks a piece (a data-k name, and a box in its style) — give the element a data-k, or take the mark off');
  return out;
}

/**
 * The floor kept clear under a box on the slide at a height, as the router takes it: [{at: [col, row, lift], size:
 * [wide, deep]}] — footprint-story/isometric · floorUnder (each half-tile square of the floor at `lift` whose drawn
 * diamond meets the box, joined along a row). `grid`: the map's grid; `where` names the piece in a refusal; `budget`
 * {left, most}: the stretches the whole map may still keep, spent here as they are made. Throws, with the fix, in the
 * deck's words, where the kit says there is no floor to keep: a box far off the slide, a box over more floor than a
 * picture needs, or a map past the most stretches it keeps.
 */
export function keptFloor(box, grid, lift = 0, where = 'data-keep-clear', budget = {left: Infinity, most: Infinity}) {
  const {stretches, why, squares} = floorUnder(box, grid, {lift, most: budget.left});
  if (why === NO_UNDER.far) throw new Error(`${where}: its box stands further than ${FAR} px from the slide — give it a place on the slide`);
  if (why === NO_UNDER.big) throw new Error(`${where}: its box covers more floor than a picture needs (${Number.isFinite(squares) ? Math.round(squares) : 'no end of'} squares) — give it a box the size of its words`);
  // the map's whole budget of stretches, counted as they are made: many boxes at many heights stop at the most, not after
  if (why === NO_UNDER.most) throw new Error(`data-keep-clear: the floor kept clear on this map is more than ${budget.most} stretches, the most a map keeps — keep clear under smaller pieces, or fewer`);
  if (why) throw new Error(`${where}: ${why}`);   // a reason of a newer kit, in its own words until the deck has some
  budget.left -= stretches.length;
  return stretches;
}
