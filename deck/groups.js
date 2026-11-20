// groups — blocks that belong together (an account, a team, a tier), each group on a floor of its own:
//
//   <div data-k="web" data-iso="block" data-iso-group="frontend"><b>Web</b></div>
//   <div data-k="api" data-iso="block" data-iso-group="backend"><b>API</b></div>
//   <div data-k="db" data-iso="cylinder" data-iso-group="backend"><b>Database</b></div>
//   <div data-k="g-frontend" data-iso="floor" data-iso-group="frontend" data-label="Frontend team"></div>
//   <div data-k="g-backend" data-iso="floor" data-iso-group="backend" data-label="Backend team"></div>
//
// When the build places the blocks, it places each group's blocks together, then the groups as one thing each, from
// the wires between them, the same way (footprint-story/isometric · arrangeByGroup: arrange inside each group, then
// arrange over the groups): the flow reads left to right across the slide, group by group, and no number is typed.
// A floor with a group and no data-size is fitted round its group's blocks only, so each group stands on a floor of
// its own, a tile clear of the next. Placed by hand, a group still fits its floor.
//
// WHY arrange twice and not a rule of our own: a group is a thing to the arrangement — a box as big as its blocks and
// their floor — so the rule that places blocks from what joins them places groups the same way. WHY the story
// library's: a film places the same groups the same way. This file reads the group a tag writes (iso.js places them
// and fits each group's floor round its blocks, GROUP_MARGIN tiles clear).
import {ownAttribute} from '../pieceRules.js';

const NAME = /^[A-Za-z0-9_-]{1,60}$/;
/** A piece's group as its tag writes it (data-iso-group), or null. Throws, naming the piece and the fix. */
export function groupWritten(attrs, told) {
  const a = ownAttribute(attrs, 'data-iso-group');
  if (!a) return null;
  if (a.bare || a.twice) throw new Error(`${told}: its group is written data-iso-group="name", once, with quotes`);
  const name = a.value.trim();
  if (!NAME.test(name)) throw new Error(`${told}: a group's name is 1 to 60 letters, digits, "-" or "_" — not "${name.slice(0, 40)}${name.length > 40 ? '…' : ''}"`);
  return name;
}

