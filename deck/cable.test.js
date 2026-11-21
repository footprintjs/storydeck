import {describe, it, expect} from 'vitest';
import {routes, rounded, MOST_ROUTES, NO_ROUTE} from 'footprint-story/isometric';
import {isoDrawn} from './iso.js';
import {cables, cableWay, readWay, wayNote} from './cable.js';
// where a label stands, a way walked and points held are footprint-story's since 0.30.0: these pin what the deck gets from it
import {held, labelPlace, walkWay as cableWalk, CABLE, LABEL_PLACES} from 'footprint-story/isometric';
const cablePoint = (way, t) => way.at(t), LABEL_LOOKS = CABLE.looks, WALK_MOST = CABLE.walkMost;
import {transformed} from './transforms.js';

const canvas = [1920, 1080];
const block = (at, size = [2, 2, 1], kind = 'block') => ({at, size, kind});
/** Pieces as the build draws them on a grid of 120 px tiles: {shapes, floor}, what `cables` reads. */
const drawn = (things) => isoDrawn('<i data-iso-grid="120 at 960 240"></i>' + Object.entries(things).map(([name, t]) => `<div data-k="${name}" data-iso="${t.kind}" data-at="${t.at.join(' ')}" data-size="${t.size.join(' ')}"></div>`).join(''), {canvas});
/** The things the kit is asked about, from the same pieces. */
const asKit = (shapes) => [...shapes].map(([name, {at, size, kind}]) => ({name, at, size, round: kind === 'cylinder'}));
const far = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);

describe('cable · a wire between two isometric pieces, on the slide', () => {
  it('is the kit\'s route, put on the slide: its points, each end 6 px off its foot, and its corners\' rounding', () => {
    const {shapes, floor} = drawn({a: block([0, 4]), b: block([5, 1])});
    const [cable] = cables([['a', 'b']], shapes, floor), [route] = routes(asKit(shapes), [['a', 'b']]);
    expect(cable.route).toEqual(route);   // the kit knows the pieces by numbers of ours: the names are back in what it said
    expect(route.points).toEqual([[2, 5], [6, 5], [6, 3]]);   // out of a's right foot along the cols, one turn, into b's left foot
    const onSlide = route.points.map(([col, row]) => floor(col, row, 0));
    expect(cable.points).toHaveLength(3);
    expect(cable.points[1]).toEqual(onSlide[1]);
    expect(far(cable.points[0], onSlide[0])).toBeCloseTo(6, 9);           // 6 px off the foot it leaves…
    expect(far(cable.points[0], onSlide[1])).toBeCloseTo(far(onSlide[0], onSlide[1]) - 6, 9);   // …along its own run
    expect(far(cable.points[2], onSlide[2])).toBeCloseTo(6, 9);
    expect(far(cable.points[2], onSlide[1])).toBeCloseTo(far(onSlide[2], onSlide[1]) - 6, 9);
    expect(cable.radius).toBeCloseTo(0.4 * far(floor(0, 0, 0), floor(1, 0, 0)), 9);   // two fifths of a tile along the floor: under the half tile two lanes lie apart
  });

  it('asks the kit about every piece of the map, so a wire goes round one that is in no wire', () => {
    const {shapes, floor} = drawn({a: block([0, 4]), mid: block([4, 3], [2, 2, 2]), b: block([8, 4])});
    const [cable] = cables([['a', 'b']], shapes, floor);
    expect(cable.route.behind).toEqual([]);
    expect(cable.route.bends).toBeGreaterThan(0);   // not the straight line through "mid"
    // a round piece is told as round: its wire starts on its round base, nearer its middle than the square's side
    const round = drawn({a: block([0, 4], [2, 2, 1], 'cylinder'), b: block([5, 1])});
    const laid = cables([['a', 'b'], ['a', 'b']], round.shapes, round.floor);
    expect(laid[0].route.points[0]).toEqual([2, 5]);
    expect(laid[1].route.points[0][0]).toBeLessThan(2);
  });

  it('gives null for a wire that was not asked, and the kit\'s reason for one that has no way', () => {
    const {shapes, floor} = drawn({a: block([0, 4]), b: block([5, 1]), up: block([0, 9, 2])});
    const laid = cables([null, ['a', 'elsewhere'], ['nobody', 'b'], ['a', 'a'], ['a', 'up'], ['a', 'b']], shapes, floor);
    expect(laid.slice(0, 3)).toEqual([null, null, null]);   // no wire; an end that is no isometric piece
    expect(laid[3]).toEqual({points: null, radius: 0, tile: expect.any(Number), route: {from: 'a', to: 'a', points: null, why: NO_ROUTE.self}});
    expect(laid[4].points).toBe(null);
    expect(laid[4].route.why).toBe(NO_ROUTE.heights);
    expect(laid[5].points).toHaveLength(3);
    expect(cables([], shapes, floor)).toEqual([]);
    expect(cables([null], shapes, floor)).toEqual([null]);
  });

  it('pieces standing at one height above the floor are joined at that height', () => {
    const {shapes, floor} = drawn({a: block([0, 4, 1.5]), b: block([5, 1, 1.5])});
    const [cable] = cables([['a', 'b']], shapes, floor);
    expect(cable.points[1]).toEqual(floor(6, 5, 1.5));
  });

  it('the kit lays so many wires: one past them is not asked, stays the straight wire it was, and says so', () => {
    const {shapes, floor} = drawn({a: block([0, 4]), b: block([5, 1])});
    const laid = cables(Array.from({length: MOST_ROUTES + 2}, () => ['a', 'b']), shapes, floor);
    expect(laid.slice(0, MOST_ROUTES).every((cable) => cable.points)).toBe(true);
    expect(laid.slice(MOST_ROUTES)).toEqual(Array.from({length: 2}, () => ({points: null, radius: 0, tile: expect.any(Number), route: {from: 'a', to: 'b', points: null, why: NO_ROUTE.work}})));   // and says why
  });

  it('its line: the way with the last run pulled back for the arrow\'s head, corners rounded; a point of it; walked', () => {
    const cable = {points: [[0, 0], [200, 0], [200, 100]], radius: 30};
    const whole = cableWay(cable), line = cableWay(cable, 14.4);
    expect(whole.pieces).toEqual([{to: [170, 0]}, {corner: [200, 0], to: [200, 30]}, {to: [200, 100]}]);
    expect(line.pieces.at(-1)).toEqual({to: [200, 100 - 14.4]});
    expect(line.length).toBeCloseTo(whole.length - 14.4, 9);
    expect(cablePoint(whole, 0)).toEqual([0, 0]);
    expect(cablePoint(whole, 1)).toEqual([200, 100]);
    // a last run shorter than the head: pulled back to a px from its start, never past it
    expect(cableWay({points: [[0, 0], [200, 0], [200, 10]], radius: 30}, 14.4).at(1)).toEqual([200, 1]);
    // a last run under a px (a hand-written grid of tiny tiles): not pulled at all, never pushed on past the tip
    expect(cableWay({points: [[0, 0], [200, 0], [200, 0.5]], radius: 30}, 14.4).at(1)).toEqual([200, 0.5]);
  });
});

describe('cable · what the build writes of a wire\'s way, and what check says of it', () => {
  const route = (more) => ({from: 'app', to: 'db', points: [[0, 0], [1, 0]], feet: ['right', 'left'], bends: 0, tiles: 1, behind: [], crosses: 0, shared: 0, ...more});

  it('nothing for a wire that lies well; else its facts, each a few words', () => {
    expect(wayNote(route())).toBe('');
    expect(wayNote(route({behind: ['logs', 'cache']}))).toBe('behind logs cache');
    expect(wayNote(route({behind: ['x;shared', 'R&amp;D']}))).toBe('behind x%3Bshared R%26amp%3BD');   // no letter of a name can be read as part of the note
    expect(readWay(wayNote(route({behind: ['x;shared', 'R&amp;D']})), 'a', 'b')).toEqual([expect.objectContaining({level: 'warn', message: expect.stringContaining('passes behind x;shared, R&amp;D: ')})]);
    expect(readWay('behind %E0%A4%A', 'a', 'b')[0].message).toContain('passes behind %E0%A4%A:');   // a name nobody can read back is said as it stands
    expect(wayNote(route({behind: ['logs'], crosses: 2, shared: 1.5, bends: 5}))).toBe('behind logs; crosses 2; shared; turns 5');
    expect(wayNote(route({bends: 3}))).toBe('');   // three turns is a way round a block: nothing to say
    for (const [key, why] of Object.entries(NO_ROUTE)) expect(wayNote({from: 'a', to: 'b', points: null, why})).toBe(`straight ${key}`);
    expect(wayNote({from: 'a', to: 'b', points: null, why: 'a reason of a newer kit'})).toBe('straight way');
  });

  it('read back as what check says: a level, and a sentence with its fix', () => {
    expect(readWay('', 'app', 'db')).toEqual([]);
    expect(readWay('behind logs cache', 'app', 'db')).toEqual([{level: 'warn', message: 'passes behind logs, cache: that stretch of it is hidden — move them or the two blocks so there is floor to see between, or draw the wire straight (data-arrow="app to db 0")'}]);
    expect(readWay('behind logs', 'app', 'db')[0].message).toContain('passes behind logs: that stretch of it is hidden — move it or the two blocks');
    expect(readWay('shared', 'a', 'b')).toEqual([{level: 'warn', message: 'lies on another wire for want of room: a foot of a block has a place for three wires — make the block wider (data-size), or take a wire out'}]);
    expect(readWay('straight heights', 'a', 'b')).toEqual([{level: 'info', message: 'is drawn straight, through the air, not along the floor: the two stand at different heights'}]);
    expect(readWay('straight foot', 'a', 'b')[0]).toEqual({level: 'warn', message: 'is drawn straight, through the air, not along the floor: one of the two has no free place at a foot that can be seen — move the blocks round it away, or make it wider (data-size)'});
    expect(readWay('straight way', 'a', 'b')[0].level).toBe('warn');
    expect(readWay('straight work', 'a', 'b')[0].level).toBe('info');
    expect(readWay('straight wide', 'a', 'b')[0].message).toContain('too far apart');
    // crossings are the way of diagrams: said only from three on; turns from the build's own count
    expect(readWay('crosses 2', 'a', 'b')).toEqual([]);
    expect(readWay('crosses 3; turns 5', 'a', 'b')).toEqual([{level: 'info', message: 'crosses 3 other wires'}, {level: 'info', message: 'turns 5 times on its way'}]);
    expect(readWay('behind logs; crosses 4; shared', 'a', 'b').map((s) => s.level)).toEqual(['warn', 'info', 'warn']);
    // words of a newer build, or of nobody: nothing said, nothing thrown
    expect(readWay('sideways 3; straight nowhere; behind; crosses many; ;', 'a', 'b')).toEqual([]);
  });

  it('every reason the kit gives has its sentence', () => {
    for (const key of Object.keys(NO_ROUTE)) expect(readWay(`straight ${key}`, 'a', 'b'), key).toHaveLength(1);
  });
});

describe('cable · where its label stands', () => {
  const square = (left, right) => held([[left, -50], [right, -50], [right, 50], [left, 50]]);
  const run = rounded([[0, 0], [300, 0]]);   // a level line: the point t of the way along is at x = 300·t

  it('on the cable\'s middle when no block is over it', () => {
    expect(LABEL_PLACES).toEqual([0.5, 0.45, 0.55, 0.4, 0.6, 0.35, 0.65, 0.3, 0.7, 0.25, 0.75, 0.2, 0.8]);
    expect(labelPlace(run, [30, 13], [])).toEqual([150, 0]);
    expect(labelPlace(run, [30, 13], [square(400, 500), square(-200, -50)])).toEqual([150, 0]);   // blocks elsewhere
  });

  it('along the cable to the nearest place no block is over, the nearer the start of two as near', () => {
    // a block over x 110 to 190: a label 60 wide is under it at every place from 0.3 to 0.7 of the way; 0.25 is tried before 0.75
    expect(labelPlace(run, [30, 13], [square(110, 190)])).toEqual([75, 0]);
    expect(labelPlace(run, [30, 13], [square(40, 190)])).toEqual([225, 0]);   // the start's side taken too: the other way
    expect(labelPlace(run, [30, 13], [square(160, 190)])).toEqual([expect.closeTo(120, 9), 0]);  // two places off the middle is enough
  });

  it('where a block is over every place, the place least under it — the middle when they are all alike', () => {
    expect(labelPlace(run, [30, 13], [square(-100, 235)])).toEqual([240, 0]);    // four fifths of the way: the least of it covered
    expect(labelPlace(run, [30, 13], [square(-1000, 1000)])).toEqual([150, 0]);
  });

  it('points held: the box round them, asked before the points are', () => {
    expect(held([[3, 9], [-4, 2], [10, 5]])).toEqual({points: [[3, 9], [-4, 2], [10, 5]], left: -4, top: 2, right: 10, bottom: 9});
    // what a box says is far away is never looked at: an outline that would hide the label, held in a box that says it is elsewhere
    const lying = {...square(110, 190), left: 900, right: 990};
    expect(labelPlace(run, [30, 13], [lying])).toEqual([150, 0]);
  });

  it('off its own cable\'s two ends: its plate over the arrow\'s head would hide where the cable goes', () => {
    const short = rounded([[0, 0], [150, 0]]);   // 150 px: the point t of the way along is at x = 150·t
    expect(labelPlace(short, [30, 13], [])).toEqual([75, 0]);   // room at the middle: 45 to 105, off the head (134 on) and the start (to 8)
    // a block over everything left of x 100: every place is partly hidden. At four fifths of the way the least is under
    // the block, but the plate would be over the head; three quarters is no worse, and comes first
    expect(labelPlace(short, [30, 13], [square(-100, 100)])).toEqual([112.5, 0]);
    // on a cable with room to spare past both ends' zones, the ends change nothing
    expect(labelPlace(run, [30, 13], [square(-100, 235)])).toEqual([240, 0]);
  });

  it('a cable walked: from its start to its end, never more than 6 px between two points', () => {
    const level = cableWalk(run);
    expect(level).toHaveLength(51);   // 300 px in steps of 6
    expect([level[0], level.at(-1)]).toEqual([[0, 0], [300, 0]]);
    const bent = cableWalk(rounded([[10, 20], [310, 40], [-150, 420], [300, 200]], 40));
    expect([bent[0], bent.at(-1)]).toEqual([[10, 20], [300, 200]]);
    for (let k = 1; k < bent.length; k++) expect(Math.hypot(bent[k][0] - bent[k - 1][0], bent[k][1] - bent[k - 1][1])).toBeLessThanOrEqual(6 + 1e-9);
    // a cable far longer than a slide is walked more coarsely, never in more points
    expect(WALK_MOST).toBe(512);
    const long = cableWalk(rounded([[0, 0], [9e5, 0]]));
    expect(long).toHaveLength(513);
    expect(long.at(-1)).toEqual([9e5, 0]);
  });

  it('its own run is passed over: a cable is never in the way of its own label', () => {
    const own = {...held(cableWalk(run)), of: run}, other = {...held(cableWalk(run)), of: rounded([[0, 0], [300, 0]])};
    const mine = {left: 1000}, theirs = {left: 1000};
    expect(labelPlace(run, [30, 13], [], [own], mine)).toEqual([150, 0]);
    expect(mine.left).toBe(999);   // found near, known as its own, not asked: the middle is free
    labelPlace(run, [30, 13], [], [other], theirs);   // the same points as another cable's: in the way at every place
    expect(theirs.left).toBeLessThan(1000 - 13 * 10);
    const crossing = {...held(Array.from({length: 41}, (_, k) => [150, -100 + 5 * k])), of: rounded([[150, -100], [150, 100]])};
    expect(labelPlace(run, [30, 13], [], [own, crossing])).toEqual([expect.closeTo(105, 9), 0]);
  });

  it('a map\'s labels share one count of looks: a place that costs more than is left is not asked, nor any after it', () => {
    expect(LABEL_LOOKS).toBe(60_000_000);
    // a label 60 by 26 is 11 by 6 points; a square has 4 sides: a place the square is near costs 11·6·4 looks and 1 to find it near.
    // The square is near at the nine places from 0.3 to 0.7 of the way, and the tenth, a quarter of the way, is free: 9·265 + 1
    const all = {left: 5000};
    expect(labelPlace(run, [30, 13], [square(110, 190)], [], all)).toEqual([75, 0]);
    expect(all.left).toBe(5000 - 9 * 265 - 1);
    const exact = {left: 9 * 265 + 1};
    expect(labelPlace(run, [30, 13], [square(110, 190)], [], exact)).toEqual([75, 0]);
    expect(exact.left).toBe(0);
    // one look short of the tenth place: the best of the nine asked — the least hidden, the earlier of two alike
    const short = {left: 9 * 265};
    expect(labelPlace(run, [30, 13], [square(110, 190)], [], short)).toEqual([expect.closeTo(90, 9), 0]);
    expect(short.left).toBe(0);
    // not enough for the first place: the cable's middle, and nothing spent
    const little = {left: 264};
    expect(labelPlace(run, [30, 13], [square(110, 190)], [], little)).toEqual([150, 0]);
    expect(little.left).toBe(264);
    const none = {left: 0};
    expect(labelPlace(run, [30, 13], [square(110, 190)], [], none)).toEqual([150, 0]);
    expect(labelPlace(run, [30, 13], [], [], none)).toEqual([150, 0]);   // nothing to look at costs nothing
    // another cable's points are looks too: 41 of them near, and 1 to find it
    const down = held(Array.from({length: 41}, (_, k) => [500, -100 + 5 * k])), far = {left: 1000};
    expect(labelPlace(run, [30, 13], [], [down], far)).toEqual([150, 0]);
    expect(far.left).toBe(999);   // not near: only the look that found it far
    const through = held(Array.from({length: 41}, (_, k) => [150, -100 + 5 * k])), spent = {left: 1000};
    labelPlace(run, [30, 13], [], [through], spent);
    expect(spent.left).toBe(1000 - 5 * 42 - 1);   // near at the five places from 0.4 to 0.6 of the way; free at the sixth, where it is not near
  });

  it('off another cable\'s line too: where one runs through the middle, along to the nearest place it does not', () => {
    const down = (x) => held(Array.from({length: 41}, (_, k) => [x, -100 + 5 * k]));   // another cable, walked: straight down the slide at x
    // a label 60 wide keeps 3 px off a line: one at x 150 runs through it wherever it stands from 0.4 to 0.6 of the way
    expect(labelPlace(run, [30, 13], [], [down(150)])).toEqual([expect.closeTo(105, 9), 0]);
    expect(labelPlace(run, [30, 13], [], [down(150), down(100)])).toEqual([expect.closeTo(195, 9), 0]);   // the start's side crossed too: the other way
    expect(labelPlace(run, [30, 13], [], [down(500)])).toEqual([150, 0]);
    expect(labelPlace(run, [30, 13], [], [held(Array.from({length: 41}, (_, k) => [150, 17 + 5 * k]))])).toEqual([150, 0]);   // a line that passes under it, 3 px clear: not through it
  });

  it('a line through its words rather than a block over them: hidden counts first, then crossed, then how near the middle', () => {
    const down = (x) => held(Array.from({length: 41}, (_, k) => [x, -100 + 5 * k]));
    // a block over everything right of x 110, and a line down x 60: the only places not under the block have the line through them
    expect(labelPlace(run, [30, 13], [square(110, 400)], [down(60)])).toEqual([75, 0]);   // a quarter of the way: tried before a fifth, and no more crossed
    // every place as much hidden: the nearest the middle that no line runs through
    expect(labelPlace(run, [30, 13], [square(-1000, 1000)], [down(150), down(140), down(160)])).toEqual([expect.closeTo(105, 9), 0]);
  });
});

describe('cable · a cable that doubles back on itself (a hairpin)', () => {
  // where a way doubles back is the story library's (footprint-story/isometric · hairpins, tested there); here, what the deck says of it
  // out of a port on the right side (+col), down the riser, then back the other way: the port faces away
  const away = [[8, 7, 0.3], [8.25, 7, 0.3], [8.25, 7, 0], [8.5, 7, 0], [8.5, 5.5, 0], [2.5, 5.5, 0], [2.5, 6, 0]];

  it('is written in the way note and read back by check as a warning, naming the end and the fix', () => {
    const route = {from: 'sw', to: 'lap', points: [[0, 0], [1, 0]], path: away, ports: ['p1', null], feet: ['right', 'left'], bends: 2, behind: [], crosses: 0, shared: 0};
    expect(wayNote(route)).toBe('hairpin start');
    expect(readWay('hairpin start', 'sw', 'lap')).toEqual([{level: 'warn', message: 'doubles back on itself where it leaves sw: that port faces away from where the cable goes — put the port on the side of sw that faces the way the cable runs, or turn that block'}]);
    expect(readWay('hairpin end', 'sw', 'lap')[0].message).toContain('where it leaves lap: ');
    expect(readWay('hairpin middle', 'sw', 'lap')[0]).toMatchObject({level: 'warn', message: expect.stringContaining('a tight U-turn')});
    expect(readWay('hairpin start-hook', 'a', 'b')).toEqual([{level: 'info', message: 'makes a short loop near its port on a — moving the port along its side may straighten it'}]);
    for (const word of ['sideways', 'start-', 'start-hook-x']) expect(readWay(`hairpin ${word}`, 'sw', 'lap'), word).toEqual([]);   // a word of a newer build says nothing
  });

  it('is said of a cable the build lays out of a port that faces away', () => {
    const grid = '<i data-iso-grid="120 at 960 150"></i>';
    const html = `${grid}<div data-k="sw" data-iso="block" data-at="6 6" data-size="2 2 0.4" data-ports="p1: 2 1 0.3"></div><div data-k="lap" data-iso="block" data-at="0 6" data-size="2 1.4 0.3" data-ports="rj45: 2 0.7 0.15"></div>`;
    const made = transformed(`${html}<i data-k="w1" class="wire" data-arrow="sw.p1 to lap.rj45"></i>`, {canvas: [1920, 1080]});
    expect(made.ways).toEqual([{name: 'w1', from: 'sw', to: 'lap', way: expect.stringMatching(/^hairpin start(;|$)/)}]);
    // the other way round, the far port is the one that faces away
    expect(transformed(`${html}<i data-k="w1" class="wire" data-arrow="lap.rj45 to sw.p1"></i>`, {canvas: [1920, 1080]}).ways[0].way).toMatch(/^hairpin end(;|$)/);
  });
});
