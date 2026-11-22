// motionPlan: each move a block makes, placed from the built map and decided by footprint-story — its end, its pose at
// any moment (footprint-story's own sample, never worked out again), what it refuses and what its critics find.
import {describe, it, expect} from 'vitest';
import {sampleMove} from 'footprint-story/human';
import {isoDrawn} from './iso.js';
import {readMoves} from './motionRead.js';
import {planMotions, checkTimes, INTENT_OF} from './motionPlan.js';
import {MOTION_DOS} from './motionRead.js';
import {footOf, topOf} from './motionPlace.js';

const CANVAS = [1920, 1080];
const GRID = '<i data-iso-grid="120 at 960 300"></i><div data-k="floor" data-iso="floor" data-size="8 6"></div>';
const block = (name, at, size = '1 1 1', kind = 'block', words = `<b>${name}</b>`) => `<div data-k="${name}" data-iso="${kind}" data-at="${at}" data-size="${size}">${words}</div>`;
/** A map's motion data as iso.js builds it, and its clicks' moves planned (`clicks`: one data-move a click, null for none). */
function planOf(blocks, clicks) {
  const movers = new Set(clicks.filter(Boolean).flatMap((v) => v.split(';').map((t) => t.trim().split(/\s+/)[0])));
  const map = isoDrawn(GRID + blocks.join(''), {canvas: CANVAS, movers}).motion;
  const holds = {blocks: map.blocks, others: new Map(), links: [], callouts: []};
  const read = clicks.map((v, i) => ({n: i + 1, moves: v === null ? [] : readMoves(v, `click ${i + 1}: data-move`, holds)}));
  return {map, plan: planMotions(map, read, {canvas: CANVAS})};
}
const near = (a, b) => a.forEach((v, k) => expect(v).toBeCloseTo(b[k], 6));
const px = (map, t) => { const p = map.grid.at(t[0], t[1], t[2]); return [p.x, p.y]; };

describe('motionPlan · each move, placed and decided by footprint-story', () => {
  it('has a row for each word the reader takes', () => {
    expect(Object.keys(INTENT_OF)).toEqual(Object.keys(MOTION_DOS));
  });

  it('a fall drops a block straight down onto the floor, and its pose at every moment is footprint-story\'s sample', () => {
    const {map, plan} = planOf([block('box', '1 1 3')], ['box fall']);
    const [m] = plan.moves, box = map.blocks[0];
    expect(m).toMatchObject({do: 'fall', ci: 0, n: 1, tie: 'foot', end: [1.5, 1.5, 0], leans: []});
    expect(plan.intents[0]).toEqual({do: 'fall', name: 'box', who: 'click 1: data-move[0] ("box")', from: px(map, footOf(box.at, box.size)), floor: px(map, [1.5, 1.5, 0])[1]});
    expect(plan.record[0]).toMatchObject({click: 1, piece: 'box', do: 'fall', model: 'ballistic', by: 'usual', wrappers: []});
    for (const t of [0, m.seconds / 3, m.seconds / 2]) {
      const s = sampleMove(m.move, t), pose = plan.poseAt(box, 0, t), foot = px(map, footOf(box.at, box.size));
      near([pose.dx, pose.dy], [s.x - foot[0], s.y - foot[1]]);
      expect([pose.sx, pose.sy]).toEqual([1, 1]);
    }
    expect(plan.poseAt(box, 0, Infinity).at).toEqual([1, 1, 0]);   // its end exactly: the place it was planned to end on
    expect(plan.poseAt(box, 1, 0)).toBeNull();                     // a click the map does not have
    expect(plan.poseAt(map.blocks[0], -1, 0)).toBeNull();
  });

  it('a fall lands on the highest top under it; a block on what it would fall to is refused, with a lift to give it', () => {
    const {plan} = planOf([block('server', '1 1', '2 2 1.4'), block('box', '1.5 1.5 4')], ['box fall']);
    expect(plan.moves[0].end).toEqual([2, 2, 1.4]);
    expect(plan.moves[0].leans.map((b) => b.name)).toEqual(['server']);
    expect(() => planOf([block('box', '1 1')], ['box fall'])).toThrow(/click 1: data-move\[0\] \("box"\): a fall drops the block from where it stands, and it stands on the floor already — lift it first \(data-at="1 1 3"\), or throw it/);
  });

  it('a throw, a settle and a reach end with the foot on their place; a bounce lands on its target\'s line; a reach reads its target\'s width', () => {
    const {map, plan} = planOf([block('server', '4 1', '2 2 1.4'), block('db', '1 4', '1.6 1.6 1', 'cylinder'), block('a', '1 1'), block('b', '6 4'), block('c', '3 4')],
      ['a throw to server model bounce; b settle to 7 1; c reach to server', 'b reach to db; a reach to 2 2']);
    const [thrown, settled, reached, toDb, toTiles] = plan.moves, server = map.blocks[0];
    expect(thrown.end).toEqual(topOf(server.at, server.size));
    expect(plan.intents[0].floor).toBe(px(map, topOf(server.at, server.size))[1]);
    expect(plan.record[0]).toMatchObject({model: 'bounce', by: 'named'});
    expect(settled.end).toEqual([7, 1, 0]);
    expect(plan.intents[2].target).toBe(map.grid.at(6, 1, 0).x - map.grid.at(4, 3, 0).x);
    expect(plan.intents[3].target).toBe(map.blocks[1].box.w);   // a cylinder's top: its ellipse's width
    expect(plan.intents[4].target).toBeUndefined();
    expect(reached.leans).toEqual([server]);
    expect(toDb.n).toBe(2);
    expect(toTiles.end).toEqual([2, 2, 0]);
  });

  it('a bounce squashes, and its pose carries the squash footprint-story gives', () => {
    const {map, plan} = planOf([block('a', '1 1 4')], ['a fall model bounce squash 0.3']);
    const m = plan.moves[0], squashed = Array.from({length: 2000}, (_, k) => (k / 2000) * m.seconds).map((t) => [t, sampleMove(m.move, t)]).find(([, s]) => s.sx !== undefined && s.sx !== 1);
    expect(squashed).toBeDefined();
    const pose = plan.poseAt(map.blocks[0], 0, squashed[0]);
    expect([pose.sx, pose.sy]).toEqual([squashed[1].sx, squashed[1].sy]);
  });

  it('a hang swings below its pin on a rope, and is the block\'s last move', () => {
    const {map, plan} = planOf([block('lamp', '3 3')], ['lamp hang from 3.5 3.5 4']);
    const [m] = plan.moves, lamp = map.blocks[0], t = m.seconds / 2, s = sampleMove(m.move, t), pose = plan.poseAt(lamp, 0, t);
    expect(m).toMatchObject({tie: 'top', end: null});
    expect(pose.rope).toEqual(s.points);
    near([pose.dx, pose.dy], [s.x - px(map, topOf(lamp.at, lamp.size))[0], s.y - px(map, topOf(lamp.at, lamp.size))[1]]);
    expect(() => planOf([block('lamp', '3 3')], ['lamp hang from 3.5 3.5 4', 'lamp fall'])).toThrow(/click 2: data-move\[0\] \("lamp"\): "lamp" hangs since click 1: data-move\[0\] \("lamp"\) — a hang ends wherever its swing settles, so it is a block's last move/);
    expect(() => planOf([block('lamp', '3 3'), block('a', '1 1')], ['lamp hang from 3.5 3.5 4', 'a throw to lamp'])).toThrow(/to names "lamp", which hangs since click 1.* aim at tiles instead/);
    expect(() => planOf([block('lamp', '3 3')], ['lamp hang from 3.5 3.5 0.5'])).toThrow(/from is its pin, at lift 0.5 — a block hangs below its pin, and its top is at lift 1: lift the pin above it \(from 3.5 3.5 4\)/);
  });

  it('a slide goes along its level to its place, planned side on, and ends exactly there', () => {
    const {map, plan} = planOf([block('crate', '1 4'), block('shelf', '5 0', '3 3 1'), block('cube', '5.5 0.5 1')], ['crate slide to 4 4.5; cube slide to 7 2.5 1']);
    const [crate, cube] = plan.moves;
    expect(crate).toMatchObject({end: [4, 4.5, 0], leans: []});
    expect(crate.side.unit).toBeCloseTo(120 / Math.SQRT2, 9);
    expect(plan.intents[0]).toMatchObject({from: [0, 0]});
    expect(cube.leans.map((b) => b.name)).toEqual(['shelf']);
    expect(plan.poseAt(map.blocks[0], 0, crate.seconds / 2).at[2]).toBe(0);
    expect(plan.poseAt(map.blocks[2], 0, Infinity).at).toEqual([6.5, 2, 1]);
    expect(plan.record[0].model).toBe('coulomb');
  });

  it('refuses a slide it cannot draw truly: from the air, to another level, to where it stands, off its top, from an edge', () => {
    const shelf = block('shelf', '5 0', '3 3 1');
    expect(() => planOf([block('a', '1 1 2')], ['a slide to 3 3'])).toThrow(/a slide goes along what "a" rests on, and it stands in the air at lift 2 \(under it is the floor\) — let it fall first/);
    expect(() => planOf([shelf, block('a', '5.5 0.5 1')], ['a slide to 3 3'])).toThrow(/a slide keeps to the level it starts on, "shelf"'s top \(lift 1\), and to is at lift 0 — give to at its level \("3 3 1"\)/);
    expect(() => planOf([block('a', '1 1')], ['a slide to 3 3 1'])).toThrow(/and to is at lift 1 — give to at its level \("3 3"\)/);
    expect(() => planOf([block('a', '1 1')], ['a slide to 1.5 1.5'])).toThrow(/to is where it stands — a slide goes somewhere along the floor/);
    expect(() => planOf([shelf, block('a', '5.5 0.5 1')], ['a slide to 9 1 1'])).toThrow(/its way runs off "shelf"'s top \(lift 1\) — at to "9 1 1" its middle is past the top's edge/);
    expect(() => planOf([shelf, block('a', '7.6 0.5 1')], ['a slide to 6 1 1'])).toThrow(/"a" rests on the edge of "shelf"'s top \(lift 1\), its middle past it/);
  });

  it('refuses moving a block from under one that rests on it, and a move that relies on a block moving on its click', () => {
    const base = [block('server', '1 1', '2 2 1'), block('box', '1.5 1.5 1')];
    expect(() => planOf(base, ['server slide to 5 5'])).toThrow(/it moves "server" from under "box", which rests on its top, and would leave it on nothing — move "box" off first/);
    expect(() => planOf([block('server', '4 1', '2 2 1'), block('box', '1 1 2')], ['box throw to server', 'server slide to 6 5'])).toThrow(/from under "box", which rests on its top since click 1: data-move\[0\] \("box"\)/);
    // written first, the box lands on the server and the server's move leaves it on nothing; written after, it relies on it
    expect(() => planOf([block('server', '4 1', '2 2 1'), block('box', '1 1')], ['box throw to server; server slide to 6 5'])).toThrow(/data-move\[1\] \("server"\): it moves "server" from under "box", which rests on its top since click 1: data-move\[0\]/);
    expect(() => planOf([block('server', '4 1', '2 2 1'), block('box', '1 1')], ['server slide to 5 4; box throw to server'])).toThrow(/click 1: data-move\[1\] \("box"\): it relies on "server" standing still, and click 1: data-move\[0\] \("server"\) moves it on the same click — move one of them on the next click/);
  });

  it('refuses tiles off the slide and a way that leaves it, naming the moment', () => {
    expect(() => planOf([block('a', '1 1')], ['a throw to 40 1'])).toThrow(/to "40 1 0" is off the slide \(\d+ px to the right and \d+ px below\) — give tiles on the floor the slide shows/);
    expect(() => planOf([block('a', '1 1')], ['a hang from 1.5 1.5 40'])).toThrow(/from "1.5 1.5 40" is off the slide .* give a pin the slide shows/);
    expect(() => planOf([block('a', '0 0 3'), block('b', '7 0')], ['a throw to b'])).toThrow(/its way leaves the slide — at [\d.]+ s the block is \d+ px above .* — a nearer to, or one lower on the slide/);
  });

  it('says what footprint-story refuses in the move\'s name, and refuses accepting a critic its move is not checked by', () => {
    expect(() => planOf([block('a', '1 1 3')], ['a fall model ballistic seconds 2'])).toThrow(/^click 1: data-move\[0\] \("a"\)(?:'s model|: ).*"ballistic" takes gravity — not "seconds"/);
    expect(() => planOf([block('a', '1 1 3')], ['a fall accept arc'])).toThrow(/accept names "arc", which its move \(ballistic\) is not checked by — its critics are spacing, contact, deck:contact, deck:covers/);
  });

  it('keeps footprint-story\'s findings at their level, and one the move accepts as accepted advice', () => {
    const blocks = [block('a', '1 1'), block('b', '1 4')];
    const {plan} = planOf(blocks, ['a reach to 5 1 model min-jerk bend 0; b reach to 5 4 model min-jerk bend 0 accept arc']);
    expect(plan.findings.map((f) => [f.click, f.who, f.critic, f.level])).toEqual([[1, 'click 1: data-move[0] ("a")', 'arc', 'warn'], [1, 'click 1: data-move[1] ("b")', 'arc', 'accepted']]);
    expect(plan.findings[0].what).toMatch(/^its move runs straight/);
    expect(plan.findings[0].fix).toMatch(/\S/);
    expect(plan.record[1].accepted).toEqual(['arc']);
  });

  it('finds a move that passes through a block (deck:contact, swept between samples), at its deepest', () => {
    const {plan} = planOf([block('a', '1 1'), block('wall', '3 0.5', '0.2 2 1')], ['a slide to 6 1.5']);
    expect(plan.findings).toEqual([expect.objectContaining({critic: 'deck:contact', level: 'warn', what: expect.stringMatching(/^at [\d.]+ s it goes [\d.]+ tiles into "wall" — it passes through a block$/), fix: expect.stringMatching(/move it round "wall"/)})]);
    const thrown = planOf([block('a', '1 1'), block('wall', '3 0.5', '0.2 2 6')], ['a throw to 6 1.5']).plan;
    expect(thrown.findings[0].fix).toMatch(/throw it to a place clear of "wall"/);
    const swung = planOf([block('lamp', '3 3'), block('post', '2 3.2', '0.4 0.4 3')], ['lamp hang from 1.5 3.5 4']).plan;
    expect(swung.findings.find((f) => f.critic === 'deck:contact')?.fix).toMatch(/out of its swing/);
  });

  it('hides a name a block comes to rest over, from its rest on, and says so (deck:covers)', () => {
    const {map, plan} = planOf([block('server', '4 1', '2 2 1.4', 'block', '<b>Server</b><small>an API</small>'), block('box', '1 1')], ['box throw to server', null]);
    expect(plan.findings.map((f) => [f.click, f.critic, f.level])).toEqual([[1, 'deck:covers', 'warn']]);
    expect(plan.findings[0].what).toBe('it comes to rest over "server"\'s name ("Server"), which is hidden from then');
    expect(plan.hidden.get(0)).toEqual([{block: map.blocks[0], by: map.blocks[1], from: plan.moves[0].seconds}]);
    expect(plan.hidden.get(1)).toEqual([{block: map.blocks[0], by: map.blocks[1], from: 0}]);   // a later click: hidden all along
    const accepted = planOf([block('server', '4 1', '2 2 1.4'), block('box', '1 1')], ['box throw to server accept deck:covers']).plan;
    expect(accepted.findings[0].level).toBe('accepted');
    // a block landed beside the name leaves it shown
    expect(planOf([block('server', '4 1', '2 2 1.4'), block('box', '1 1')], ['box throw to 1 5']).plan.hidden.size).toBe(0);
  });

  it('plans the same moves the same way every time: footprint-story\'s seeds, exactly', () => {
    const blocks = [block('a', '1 1 3'), block('b', '5 3')], clicks = ['a fall wrap anticipate; b settle to 2 4', 'a reach to 6 1'];
    const one = planOf(blocks, clicks).plan, two = planOf(blocks, clicks).plan;
    expect(two.record).toEqual(one.record);
    for (const [k, m] of one.moves.entries()) for (const t of checkTimes(m)) expect(sampleMove(two.moves[k].move, t)).toEqual(sampleMove(m.move, t));
  });

  it('runs the same intents through footprint-story\'s chart, for the record: the same plan', async () => {
    const {plan} = planOf([block('a', '1 1 3')], ['a fall']);
    const {snapshot, differs} = await plan.run();
    expect(differs).toBeNull();
    expect(Array.isArray(snapshot.commitLog)).toBe(true);
    expect(Object.keys(snapshot.sharedState)).toContain('duration-0');
  });
});
