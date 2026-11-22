// motionRead: a click's moves as plain words, read into footprint-story's intent words — and every refusal, naming the
// move and the fix.
import {describe, it, expect} from 'vitest';
import {readMoves, MOTION_DOS, DECK_CRITICS, MOST_MOVE_LETTERS} from './motionRead.js';

const box = {name: 'box', kind: 'block'}, server = {name: 'server', kind: 'block'}, db = {name: 'db', kind: 'cylinder'}, twin = {name: 'twin', kind: 'block', twice: true};
const MAP = {blocks: [box, server, db, twin], others: new Map([['floor', 'is a floor: the ground the blocks stand on does not move'], ['note', 'is not an isometric block']]),
  links: [['server', 'db']], callouts: [{name: 'tip', target: 'twin'}]};
const read = (value, map = MAP) => readMoves(value, 'data-move', map);

describe('motionRead · the words a move takes', () => {
  it('reads nothing from a step with no data-move', () => {
    expect(read(null)).toEqual([]);
    expect(read(undefined)).toEqual([]);
  });

  it('reads each move: a block, what it does, and its places, wrappers, model and accepted critics', () => {
    const [fall, thrown, hang, slid] = read('box fall; db throw to box wrap anticipate share 0.3 overshoot by 12 model bounce; server hang from 4 2 6', {...MAP, links: []});
    expect(fall).toMatchObject({index: 0, who: 'data-move[0] ("box")', piece: box, do: 'fall', to: null, from: null, wrap: [], model: null, accept: []});
    expect(thrown).toMatchObject({index: 1, piece: db, do: 'throw', to: {block: box}, wrap: [{wrapper: 'anticipate', share: 0.3}, {wrapper: 'overshoot', by: 12}], model: 'bounce'});
    expect(hang).toMatchObject({piece: server, do: 'hang', from: {tiles: [4, 2, 6]}});
    expect(slid).toBeUndefined();
    const [one] = read('box slide to 4 2 accept arc deck:contact model coulomb kinetic 0.4 fast true slow false shape box');
    expect(one).toMatchObject({do: 'slide', to: {tiles: [4, 2, 0]}, accept: ['arc', 'deck:contact'], model: {name: 'coulomb', kinetic: 0.4, fast: true, slow: false, shape: 'box'}});
    expect(read('box reach to server')[0].to).toEqual({block: server});
    expect(read('  box   settle   to  .5  -1.5 ')[0].to).toEqual({tiles: [0.5, -1.5, 0]});
    expect(Object.keys(MOTION_DOS)).toEqual(['fall', 'throw', 'hang', 'settle', 'reach', 'slide']);
    expect(DECK_CRITICS).toEqual(['deck:contact', 'deck:covers']);
  });

  it('refuses a block it cannot move, naming why and what it can move', () => {
    expect(() => read('floor fall')).toThrow(/data-move\[0\]: "floor" is a floor: the ground the blocks stand on does not move — a move moves an isometric block or cylinder: box, server, db, twin/);
    expect(() => read('note fall')).toThrow(/"note" is not an isometric block/);
    expect(() => read('ghost fall')).toThrow(/"ghost" is no piece of this map/);
    expect(() => read('ghost fall', {...MAP, blocks: []})).toThrow(/this map has none \(data-iso="block"\)/);
    expect(() => read('twin fall', {...MAP, callouts: []})).toThrow(/two isometric pieces are called "twin" — give the one that moves a name of its own/);
    expect(() => read('db fall')).toThrow(/a wire joins "db" \(server to db\): it is laid to where "db" stands and would not follow it/);
    expect(() => read('twin fall', {...MAP, blocks: [box, {name: 'twin', kind: 'block'}]})).toThrow(/the callout "tip" points at "twin" where it was built, and would not follow it/);
  });

  it('refuses what a block cannot do: a turn it cannot draw, a pen\'s word, footprint-story\'s other words, none', () => {
    expect(() => read('box')).toThrow(/say what it does after its name — "fall", "throw", "hang", "settle", "reach" or "slide" \("box fall"\)/);
    expect(() => read('box roll to 3 3')).toThrow(/a roll turns a ball on its rim, and StoryDeck has no ball yet/);
    expect(() => read('box tumble to 3 3')).toThrow(/a tumble turns a block end over end, and StoryDeck draws a block only upright/);
    expect(() => read('box draw')).toThrow(/"draw" moves a pen's point along a line, not a block/);
    expect(() => read('box hop')).toThrow(/what it does is .* \(footprint-story's words\) — not "hop"/);
  });

  it('refuses a place that is missing, not wanted, malformed or the block itself', () => {
    expect(() => read('box throw')).toThrow(/a throw needs to, where it ends: a block's name \("box throw to server"\) or tiles/);
    expect(() => read('box hang')).toThrow(/a hang needs from, the pin it hangs from: a block's name, or tiles in the air \("box hang from 4 2 6"\)/);
    expect(() => read('box fall to server')).toThrow(/a fall takes no to — it falls straight down onto what is under it/);
    expect(() => read('box hang from 1 1 9 to server')).toThrow(/a hang takes no to — it swings to rest below its pin/);
    expect(() => read('box settle from server to db')).toThrow(/a settle takes no from — it starts where the block stands/);
    expect(() => read('box throw to')).toThrow(/to is a block's name \("server"\) or tiles on the floor/);
    expect(() => read('box throw to wrap anticipate')).toThrow(/to is a block's name/);
    expect(() => read('box throw to nowhere')).toThrow(/to names "nowhere", which is no block of this map — the blocks are box, server, db, twin; or give tiles/);
    expect(() => read('box throw to box')).toThrow(/to names the block itself/);
    expect(() => read('box throw to 3')).toThrow(/to in tiles is "col row" \(a third number lifts it\) — not "3" alone/);
    expect(() => read('box throw to 3 4 -1')).toThrow(/to's lift is how high above the floor, 0 or more — not -1/);
    expect(() => read('box throw to 3 4000000')).toThrow(/is far off any floor/);
    expect(() => read('box throw to 3 4 1 2')).toThrow(/after "box throw" come .* — not "2"/);
  });

  it('refuses wrappers, models and critics footprint-story does not have, and words said twice', () => {
    expect(() => read('box fall wrap')).toThrow(/wrap names a wrapper after it — "anticipate", "follow-through", "hold" or "overshoot"/);
    expect(() => read('box fall wrap wobble')).toThrow(/wrap names footprint-story's wrappers, .* — not "wobble"/);
    expect(() => read('box fall wrap hold 0.2')).toThrow(/wrap hold takes its options as "name value" pairs \("share 0.3"\) — "0.2" is a number with no name before it/);
    expect(() => read('box fall wrap hold at')).toThrow(/wrap hold's option "at" has no value/);
    expect(() => read('box fall wrap hold at 1 at 2')).toThrow(/wrap hold names its option "at" twice/);
    expect(() => read('box fall wrap hold anticipate overshoot follow-through hold')).toThrow(/wrap takes at most 4 wrappers — not 5/);
    expect(() => read('box fall model')).toThrow(/model names one of footprint-story's models \("bounce"\)/);
    expect(() => read('box fall accept')).toThrow(/accept names the critics whose findings this move keeps/);
    expect(() => read('box fall accept wobble')).toThrow(/accept names "wobble", which is no critic — the critics are jerk, .*deck:contact, deck:covers/);
    expect(() => read('box fall accept arc arc')).toThrow(/accept names "arc" twice/);
    expect(() => read('box fall model bounce model ballistic')).toThrow(/it says "model" twice — say it once/);
  });

  it('refuses an empty move, a block moved twice on one click, and a value too long to read', () => {
    expect(() => read('box fall;')).toThrow(/a click's moves are "<block> <do> …", apart with ";" — one of them is empty/);
    expect(() => read('  ')).toThrow(/— it says none/);
    expect(() => read('box fall; box throw to server')).toThrow(/data-move\[1\] \("box"\): "box" already moves on this click \(data-move\[0\]\) — a block makes one move a click: put this one on the next click/);
    expect(() => read('x'.repeat(MOST_MOVE_LETTERS + 1))).toThrow(new RegExp(`a click's moves are at most ${MOST_MOVE_LETTERS} letters`));
  });
});
