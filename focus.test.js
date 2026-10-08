import { describe, it, expect } from 'vitest';
import { FOCUS, readFocus, focusStep, planFocus } from './focus';

// A small map: a page on the left, a code box on the right, a label with no size, and a note with no place.
const pieces = [
  { keys: ['page'], box: { x: 100, y: 300, w: 600, h: 400 } },
  { keys: ['code', 'box'], box: { x: 1000, y: 300, w: 500, h: 250 } },
  { keys: ['label'], box: { x: 1000, y: 600, w: 0, h: 0 } },
  { keys: ['note'], box: null },
];
const deck = { pieces, area: [0, 200, 1920, 1000] };
const states = (look) => look.pieces.map((p) => p.state);
const changes = (look) => look.pieces.map((p) => p.change);

describe('focus · states and what changed', () => {
  it('brings pieces in, lights what the click is about, greys the rest in place, takes pieces out', () => {
    const { looks } = planFocus([
      { in: ['page', 'code'] },                      // without `on`, everything shown is lit
      { in: ['label'], on: ['code'] },               // what comes in is lit too
      { in: ['note'], on: ['code'], quiet: true },   // …unless the click is quiet
      { out: ['label'], on: ['page'] },
    ], deck);
    expect(states(looks[0])).toEqual(['on', 'on', 'gone', 'gone']);
    expect(changes(looks[0])).toEqual(['enter', 'enter', null, null]);
    expect(states(looks[1])).toEqual(['dim', 'on', 'on', 'gone']);
    expect(changes(looks[1])).toEqual(['fade', null, 'enter', null]);
    expect(states(looks[2])).toEqual(['dim', 'on', 'dim', 'dim']);
    expect(states(looks[3])).toEqual(['on', 'dim', 'gone', 'dim']);
    expect(changes(looks[3])).toEqual(['light', 'fade', 'leave', null]);
  });

  it('on a fresh map, what was already there arrives and only what the click brings in enters', () => {
    const { end } = planFocus([{ in: ['page', 'code'] }], deck);
    const next = focusStep(end, { in: ['label'], fresh: true }, deck);
    expect(changes(next.look)).toEqual(['arrive', 'arrive', 'enter', null]);
    expect(focusStep(end, { in: ['label'] }, deck).look.pieces.map((p) => p.change)).toEqual([null, null, 'enter', null]);
  });

  it('rings the hot piece, and says when the ring is new', () => {
    const { looks } = planFocus([{ in: ['*'], hot: ['code'] }, { hot: ['code'] }, { hot: ['page'] }], deck);
    expect(looks[0].pieces.map((p) => [p.hot, p.hotIn])[1]).toEqual([true, true]);
    expect(looks[1].pieces[1]).toMatchObject({ hot: true, hotIn: false });
    expect(looks[2].pieces[0]).toMatchObject({ hot: true, hotIn: true });
    expect(looks[2].pieces[1].hot).toBe(false);
  });

  it('refuses a name that is no piece, listing the names there are', () => {
    expect(() => focusStep(null, { in: ['pager'] }, deck)).toThrow(/no piece "pager".*page, code, box, label, note/);
  });

  it('carries a map\'s state from one slide to the next', () => {
    const first = planFocus([{ in: ['page'] }], deck);
    const second = planFocus([{ in: ['code'], on: ['code'] }], deck, first.end);
    expect(states(second.looks[0])).toEqual(['dim', 'on', 'gone', 'gone']);
    expect(changes(second.looks[0])).toEqual(['fade', 'enter', null, null]);
  });
});

describe('focus · strategies', () => {
  const lit = { in: ['page', 'code', 'label'], on: ['code', 'label'], quiet: true };   // the page is there, greyed: the context

  it('reads a focus as a name, several, a list, or {strategy, …options}', () => {
    expect(readFocus('left blur', { gap: 10 })).toEqual([{ strategy: 'left', options: { gap: 10 } }, { strategy: 'blur', options: { gap: 10 } }]);
    expect(readFocus(['zoom', { strategy: 'blur', label: 'x' }])).toEqual([{ strategy: 'zoom', options: {} }, { strategy: 'blur', options: { label: 'x' } }]);
    expect(readFocus(undefined)).toEqual([]);
    expect(() => readFocus([42])).toThrow(/strategy name/);
  });

  it('greys the context by default; hide and keep change only how the context looks', () => {
    expect(focusStep(null, lit, deck).look.pieces[0].look).toBe('grey');
    expect(focusStep(null, { ...lit, focus: 'hide' }, deck).look.pieces[0].look).toBe('hide');
    expect(focusStep(null, { ...lit, focus: 'keep' }, deck).look.pieces[0].look).toBe('keep');
    expect(focusStep(null, { ...lit, focus: 'hide' }, deck).look.pieces[1].look).toBe(null);
  });

  it('zoom moves the view so the subject sits in the middle of the area, as large as `share` allows', () => {
    const { stage } = focusStep(null, { ...lit, focus: { strategy: 'zoom', share: 0.5 } }, deck).look;
    // subject = code + label: x 1000–1500, y 300–600 → 500 × 300; area 1920 × 800 → share .5 · min(3.84, 2.67) = 1.33
    expect(stage.move.s).toBeCloseTo(4 / 3, 3);
    const [cx, cy] = [1250, 450];   // the subject's centre lands on the area's centre
    expect(stage.move.s * cx + stage.move.x).toBeCloseTo(960, 1);
    expect(stage.move.s * cy + stage.move.y).toBeCloseTo(600, 1);
    expect(focusStep(null, { ...lit, focus: { strategy: 'zoom', share: 9, most: 2 } }, deck).look.stage.move.s).toBe(2);
  });

  it('left: the context steps aside to the left, smaller; the subject grows into the room on the right', () => {
    const look = focusStep(null, { ...lit, focus: { strategy: 'left', scale: 0.5, gap: 40, grow: 3 } }, deck).look;
    const page = look.pieces[0].move, code = look.pieces[1].move, label = look.pieces[2].move;
    expect(page.s).toBe(0.5);
    // the page's centre (400, 500) goes to x = 40 + 300/2 = 190, y = the area's middle, 600
    expect([400 + page.dx, 500 + page.dy]).toEqual([190, 600]);
    // the room: x 380 → 1920, the whole area's height; the subject (500 × 300) grows to fill .9 of it
    expect(code.s).toBeCloseTo(Math.min(1540 / 500, 800 / 300) * 0.9, 3);
    expect(code.origin).toBe('center');
    expect(label.origin).toBe('top-left');
    // the subject keeps its shape: the label stays where it was against the code box, scaled with it
    const codeAt = [1250 + code.dx, 425 + code.dy], labelAt = [1000 + label.dx, 600 + label.dy];
    expect(labelAt[0] - codeAt[0]).toBeCloseTo(code.s * (1000 - 1250), 1);
    expect(labelAt[1] - codeAt[1]).toBeCloseTo(code.s * (600 - 425), 1);
    expect(label.s).toBe(code.s);
  });

  it('right, up and down put the context on their side', () => {
    const at = (side) => { const m = focusStep(null, { ...lit, focus: side }, deck).look.pieces[0].move; return [400 + m.dx, 500 + m.dy]; };
    expect(at('right')[0]).toBeGreaterThan(1600);
    expect(at('up')[1]).toBeLessThan(400);
    expect(at('down')[1]).toBeGreaterThan(800);
  });

  it('a piece with no place never moves; a mover with nothing to move does nothing', () => {
    const look = focusStep(null, { in: ['*'], on: ['code'], focus: 'left' }, deck).look;
    expect(look.pieces[3].move).toBe(null);
    expect(focusStep(null, { in: ['page'], focus: 'left' }, deck).look.pieces[0].move).toBe(null);   // no context
    expect(focusStep(null, { in: ['note'], focus: 'zoom' }, deck).look.stage).toBe(null);          // no subject box
  });

  it('blur frames the subject where it ends up, or the rects it is given, with a label', () => {
    const plain = focusStep(null, { ...lit, focus: { strategy: 'blur', pad: 10 } }, deck).look.overlay;
    expect(plain).toEqual({ rects: [[990, 290, 520, 320]], label: '', phase: 'in-new', frameNew: true });
    const moved = focusStep(null, { ...lit, focus: 'left blur' }, deck).look;
    expect(moved.overlay.rects[0][0]).toBeGreaterThan(380);   // around the subject on the right, after the move
    const given = focusStep(null, { ...lit, focus: 'blur', options: { rect: '10 20 30 40 50 60 70 80', label: 'the form' } }, deck).look.overlay;
    expect(given.rects).toEqual([[10, 20, 30, 40], [50, 60, 70, 80]]);
    expect(given.label).toBe('the form');
    expect(() => focusStep(null, { ...lit, focus: 'blur', options: { rect: '1 2 3' } }, deck)).toThrow(/x y w h/);
  });

  it('a blur that stays is not new; the first click without it lets it melt away', () => {
    const same = { on: ['code', 'label'] };
    const { looks } = planFocus([{ ...lit, focus: 'blur' }, { ...same, focus: 'blur' }, same, same], deck);
    expect(looks.map((l) => l.overlay?.phase ?? null)).toEqual(['in-new', 'in', 'out', null]);
    expect(looks.map((l) => l.overlay?.frameNew ?? null)).toEqual([true, false, false, null]);
    expect(looks[2].overlay.rects).toEqual(looks[1].overlay.rects);
  });

  it('a blur that moves to another subject stays (no flash), and only its frame is new', () => {
    const { looks } = planFocus([{ ...lit, focus: 'blur' }, { on: ['page'], focus: 'blur' }], deck);
    expect(looks[1].overlay).toMatchObject({ phase: 'in', frameNew: true });
  });

  it('on the way out the blur keeps every hole clear, or only the frame with out: first', () => {
    const rect = '10 20 30 40 50 60 70 80';
    const all = planFocus([{ ...lit, focus: 'blur', options: { rect } }, {}], deck).looks[1].overlay.rects;
    const first = planFocus([{ ...lit, focus: 'blur', options: { rect, out: 'first' } }, {}], deck).looks[1].overlay.rects;
    expect(all).toEqual([[10, 20, 30, 40], [50, 60, 70, 80]]);
    expect(first).toEqual([[10, 20, 30, 40]]);
  });

  it('a click takes one strategy of each kind, from the built-ins or the deck\'s own', () => {
    expect(() => focusStep(null, { ...lit, focus: 'zoom left' }, deck)).toThrow(/one mover at most.*"zoom" and "left"/);
    expect(() => focusStep(null, { ...lit, focus: 'spin' }, deck)).toThrow(/no focus strategy "spin" \(there are grey, hide, keep, zoom, left, right, up, down, place, path, blur\)/);
    const tilt = { kind: 'mover', place: ({ subject }) => ({ subject: { o: [subject.x, subject.y], s: 2, t: [0, 0] } }) };
    const look = focusStep(null, { ...lit, focus: 'tilt' }, { ...deck, strategies: { tilt } }).look;
    expect(look.strategies).toEqual(['tilt']);
    expect(look.pieces[1].move.s).toBe(2);
    expect(() => focusStep(null, { ...lit, focus: 'odd' }, { ...deck, strategies: { odd: { kind: 'paint' } } })).toThrow(/a look, a mover, an overlay or an order/);
    expect(Object.keys(FOCUS)).toEqual(['grey', 'hide', 'keep', 'zoom', 'left', 'right', 'up', 'down', 'place', 'path', 'blur']);
  });
});

describe('focus · twins', () => {
  it('a piece steps aside while its twin is lit, and comes back after', () => {
    const twins = [{ keys: ['solid'], box: null }, { keys: ['dashed'], box: null, twin: ['solid'] }, { keys: ['other'], box: null }];
    const { looks } = planFocus([{ in: ['*'], on: ['other'], quiet: true }, { on: ['solid'] }, { on: ['other'] }], { pieces: twins });
    expect(looks[0].pieces[1]).toMatchObject({ state: 'dim', twinOff: false });
    expect(looks[1].pieces[1]).toMatchObject({ state: 'gone', change: 'leave', twinOff: true });
    expect(looks[2].pieces[1]).toMatchObject({ state: 'dim', change: 'enter', twinOff: false });
  });
});

describe('focus · naming the groups a mover moves', () => {
  it('a lit piece can step aside for the piece it holds, and a piece in neither group stays put', () => {
    const step = { in: ['*'], focus: { strategy: 'up', aside: 'page', subject: 'code' } };   // everything lit
    const look = focusStep(null, step, deck).look;
    expect(look.pieces[0].move.s).toBe(0.6);            // the page steps aside (up), though it is lit
    expect(look.pieces[0].move.dy).toBeLessThan(0);
    expect(look.pieces[1].move).not.toBe(null);          // the code grows
    expect(look.pieces[2].move).toBe(null);              // the label is in neither group
    expect(() => focusStep(null, { in: ['*'], focus: { strategy: 'up', aside: 'pager' } }, deck)).toThrow(/focus aside: no piece "pager"/);
  });
});

describe('focus · a piece that leaves, and a look that changes', () => {
  it('a piece that leaves keeps how it looked and where it stood, so it fades out from there', () => {
    const { looks } = planFocus([{ in: ['page', 'code'] }, { on: ['code'], focus: 'left' }, { out: ['page'], on: ['code'], focus: 'left' }], deck);
    expect(looks[2].pieces[0]).toMatchObject({ state: 'gone', was: 'dim', change: 'leave', look: 'grey', move: looks[1].pieces[0].move });
  });

  it('a piece kept in colour that is lit again does not change; one hidden comes in; a changed look changes from the old one', () => {
    const base = { in: ['page', 'code'], on: ['code'], quiet: true };
    const keepThenLit = planFocus([{ ...base, focus: 'keep' }, { on: ['page'] }], deck).looks[1].pieces[0];
    expect(keepThenLit.change).toBe(null);
    const hideThenLit = planFocus([{ ...base, focus: 'hide' }, { on: ['page'] }], deck).looks[1].pieces[0];
    expect(hideThenLit.change).toBe('enter');
    const hideThenGrey = planFocus([{ ...base, focus: 'hide' }, { on: ['code'] }], deck).looks[1].pieces[0];
    expect(hideThenGrey).toMatchObject({ change: 'relook', look: 'grey', fromLook: 'hide' });
    const litThenKept = planFocus([{ in: ['page', 'code'] }, { on: ['code'], focus: 'keep' }], deck).looks[1].pieces[0];
    expect(litThenKept.change).toBe(null);
  });
});

describe('focus · place: a layout you art-direct', () => {
  const all = { in: ['*'] };
  it('moves named groups by the amounts given, around their own centre or a point you name', () => {
    const look = focusStep(null, { ...all, focus: { strategy: 'place', groups: 'page: -100 50 0.5 | code: 10 0 2 @ 1000 300' } }, deck).look;
    expect(look.pieces[0].move).toEqual({ dx: -100, dy: 50, s: 0.5, origin: 'center' });                  // around its own centre
    // the code box, scaled 2 around its top-left corner (1000, 300), moved 10 right: its centre (1250, 425) goes to (1510, 550)
    expect(look.pieces[1].move).toMatchObject({ dx: 260, dy: 125, s: 2 });
    expect(look.pieces[2].move).toBe(null);                                                                  // in no group: still
  });

  it('reads its amounts in slide px whatever the view, and a later group wins a piece named in two', () => {
    const view = { s: 0.5, x: 0, y: 0 };
    const look = focusStep(null, { ...all, focus: { strategy: 'place', groups: 'page code: 0 0 1 | page: 40 0' } }, { ...deck, view }).look;
    expect(look.pieces[0].move).toMatchObject({ dx: 80, dy: 0, s: 1 });   // 40 slide px = 80 map px
    expect(look.pieces[1].move).toBe(null);
  });

  it('refuses groups it cannot read, or names that are no piece', () => {
    expect(() => focusStep(null, { ...all, focus: 'place' }, deck)).toThrow(/give groups/);
    expect(() => focusStep(null, { ...all, focus: { strategy: 'place', groups: 'page -1 2' } }, deck)).toThrow(/a group is 'names: dx dy scale/);
    expect(() => focusStep(null, { ...all, focus: { strategy: 'place', groups: 'pager: 1 2' } }, deck)).toThrow(/focus group: no piece "pager"/);
  });

  it('an aside can move only the context, leaving the subject where it is', () => {
    const look = focusStep(null, { in: ['page', 'code'], on: ['code'], quiet: true, focus: { strategy: 'left', move: 'aside' } }, deck).look;
    expect(look.pieces[0].move).not.toBe(null);
    expect(look.pieces[1].move).toBe(null);
  });
});

describe('focus · moves between clicks', () => {
  const lit = { in: ['page', 'code'], on: ['code'], quiet: true };
  const code = { on: ['code'] };
  it('a piece that moves says where it came from; one that comes back glides from where it stood', () => {
    const { looks } = planFocus([lit, { ...code, focus: 'left' }, { ...code, focus: 'left' }, code], deck);
    expect(looks[1].pieces[0].from).toEqual({ dx: 0, dy: 0, s: 1 });
    expect(looks[2].pieces[0].from).toBe(null);                         // it stays aside: nothing to replay
    expect(looks[3].pieces[0].move).toBe(null);
    expect(looks[3].pieces[0].from).toEqual(looks[2].pieces[0].move);   // back in place, from where it stood
  });

  it('the view glides back when a zoom ends', () => {
    const { looks } = planFocus([lit, { ...code, focus: 'zoom' }, code], deck);
    expect(looks[1].stage.from).toEqual({ s: 1, x: 0, y: 0 });
    expect(looks[2].stage).toEqual({ move: null, from: looks[1].stage.move });
  });

  it('measures an aside\'s gap in slide px, whatever the view', () => {
    const view = { s: 0.5, x: 0, y: 0 };
    const look = focusStep(null, { ...lit, focus: { strategy: 'left', scale: 0.5, gap: 40 } }, { ...deck, view }).look;
    const page = look.pieces[0].move;
    // the page (600 × 400 on the map) shrinks to 300 × 200; its left edge sits 40 slide px = 80 map px from the area's left (0)
    expect((400 + page.dx - 150) * view.s).toBeCloseTo(40, 1);
  });

  it('plans no clicks to no end', () => {
    expect(planFocus([], deck)).toEqual({ looks: [], end: null });
  });

  it('works on a map drawn scaled: the area is read through the view', () => {
    const view = { s: 0.5, x: 100, y: 50 };
    const { stage } = focusStep(null, { in: ['code'], focus: { strategy: 'zoom', share: 0.5 } }, { ...deck, view }).look;
    // on the slide, the code box's centre (1250, 425) · .5 + (100, 50) must land on the area's centre (960, 600)
    const [mx, my] = [stage.move.s * 1250 + stage.move.x, stage.move.s * 425 + stage.move.y];
    expect(mx * 0.5 + 100).toBeCloseTo(960, 1);
    expect(my * 0.5 + 50).toBeCloseTo(600, 1);
  });
});

describe('focus · path: the subject piece after piece along a route', () => {
  // a request's route: agent → wire → gateway → wire → app, and a note beside it
  const route = [
    { keys: ['agent'], box: { x: 100, y: 300, w: 200, h: 100 } },
    { keys: ['wire', 'link-a'], box: { x: 300, y: 340, w: 200, h: 20 } },
    { keys: ['gw'], box: { x: 500, y: 300, w: 200, h: 100 } },
    { keys: ['wire', 'link-b'], box: { x: 700, y: 340, w: 200, h: 20 } },
    { keys: ['app'], box: { x: 900, y: 300, w: 200, h: 100 } },
    { keys: ['note'], box: { x: 100, y: 600, w: 300, h: 60 } },
  ];
  const d = { pieces: route, area: [0, 200, 1920, 1000] };
  const delays = (look) => look.pieces.map((p) => p.path);

  it('lights the route in the order the click names it, a turn per name, `step` seconds apart', () => {
    const { looks } = planFocus([{ in: ['*'], on: ['agent', 'link-a', 'gw', 'link-b', 'app'], focus: 'path' }], d);
    expect(delays(looks[0])).toEqual([0, 0.35, 0.7, 1.05, 1.4, null]);   // the note is not on the route
    expect(looks[0].path).toEqual({ turns: 5, step: 0.35, done: 1.4, line: '', lineAt: null });
    expect(looks[0].strategies).toEqual(['path']);
  });

  it('takes its own route and step: a name shared by several pieces is one turn, a lit piece off the route lights at once', () => {
    const { looks } = planFocus([{ in: ['*'], on: ['agent', 'wire', 'gw', 'note'], focus: { strategy: 'path', route: 'agent wire gw', step: '0.5' } }], d);
    expect(delays(looks[0])).toEqual([0, 0.5, 1, 0.5, null, null]);
    expect(looks[0].pieces[5].state).toBe('on');
  });

  it('goes with a look, a mover and an overlay, and names its route with a line', () => {
    const { looks } = planFocus([{ in: ['*'], on: ['agent', 'gw'], focus: 'path grey blur', options: { line: 'agent → gateway' } }], d);
    expect(looks[0].strategies.sort()).toEqual(['blur', 'grey', 'path']);
    expect(looks[0].path.line).toBe('agent → gateway');
  });

  it('refuses a route that names no piece, a step it cannot use, and two orders in one click', () => {
    expect(() => planFocus([{ in: ['*'], focus: { strategy: 'path', route: 'agent ghost' } }], d)).toThrow(/focus route: no piece "ghost"/);
    expect(() => planFocus([{ in: ['*'], focus: { strategy: 'path', step: '9' } }], d)).toThrow(/step is the seconds between two pieces of the route \(0–5\)/);
    const strategies = { wave: { kind: 'order', route: () => ({ names: [], step: 0 }) } };
    expect(() => planFocus([{ in: ['*'], focus: 'path wave' }], { ...d, strategies })).toThrow(/a click takes one order at most: "path" and "wave" are both orders/);
  });

  it('a route with nothing shown on it is no path', () => {
    const { looks } = planFocus([{ in: ['agent'], focus: { strategy: 'path', route: 'gw app' } }], d);
    expect(looks[0].path).toBe(null);
    expect(delays(looks[0]).every((x) => x === null)).toBe(true);
  });

  it('gives its turns to LIT pieces only: a name with nothing lit takes none, so nothing greyed waits or glows grey', () => {
    // link-b shares the name "wire" with link-a but is not lit; the note is on the route but greyed
    const { looks } = planFocus([{ in: ['*'], on: ['agent', 'link-a', 'gw'], quiet: true, focus: { strategy: 'path', route: 'agent wire note gw' } }], d);
    expect(states(looks[0])).toEqual(['on', 'on', 'on', 'dim', 'dim', 'dim']);
    expect(delays(looks[0])).toEqual([0, 0.35, 0.7, null, null, null]);
    expect(looks[0].path).toMatchObject({ turns: 3, done: 0.7 });
  });

  it('an empty route falls back to the click\'s on (or in); a path with no order at all is refused, naming the fix', () => {
    const click = { in: ['*'], on: ['agent', 'gw'] };
    for (const route of [[], '', '  ', [''], '*', null]) expect(delays(planFocus([{ ...click, focus: { strategy: 'path', route } }], d).looks[0]), JSON.stringify(route)).toEqual([0, null, 0.35, null, null, null]);
    expect(delays(planFocus([{ in: ['gw', 'agent'], focus: { strategy: 'path', route: [] } }], d).looks[0])).toEqual([0.35, null, 0, null, null, null]);   // no on: in's order
    const fix = /focus "path": the route is empty — write the pieces in the order they light, in `on` or `route`/;
    expect(() => planFocus([{ in: ['*'], on: ['*'], focus: 'path' }], d)).toThrow(fix);
    expect(() => planFocus([{ in: ['*'], focus: { strategy: 'path', route: [] } }], d)).toThrow(fix);
    expect(() => planFocus([{ in: ['*'] }, { focus: 'path' }], d)).toThrow(fix);   // a later click that names nothing
    // focus is the click's own: a click that does not ask for a path is never asked for a route
    expect(planFocus([{ in: ['*'], on: ['*'], focus: 'grey' }, { on: ['*'] }], d).looks.map((l) => l.path)).toEqual([null, null]);
  });

  it('reads a deck\'s own order without writing to what it gave (a frozen route is fine), with no line as \'\' and no lineAt as null', () => {
    const given = Object.freeze({ names: Object.freeze(['gw', 'agent']), step: 0.2 });
    const strategies = { back: { kind: 'order', route: () => given } };
    const { looks } = planFocus([{ in: ['*'], on: ['agent', 'gw'], focus: 'back' }], { ...d, strategies });
    expect(delays(looks[0])).toEqual([0.2, null, 0, null, null, null]);
    expect(looks[0].path).toEqual({ turns: 2, step: 0.2, done: 0.2, line: '', lineAt: null });
    expect(given).toEqual({ names: ['gw', 'agent'], step: 0.2 });
  });

  it('refuses a route a deck\'s own order gives that it cannot use, naming the strategy and the fix', () => {
    const run = (route) => () => planFocus([{ in: ['*'], focus: 'mine' }], { ...d, strategies: { mine: { kind: 'order', route: () => route } } });
    const step = /focus "mine": a route's step is the seconds between two turns, a number from 0 to 5 — not /;
    expect(run({ names: ['agent'] })).toThrow(new RegExp(`${step.source}undefined`));   // no step: never a NaN delay in the page
    expect(run({ names: ['agent'], step: NaN })).toThrow(new RegExp(`${step.source}NaN`));
    expect(run({ names: ['agent'], step: '0.3' })).toThrow(new RegExp(`${step.source}"0.3"`));
    expect(run({ names: ['agent'], step: 6 })).toThrow(new RegExp(`${step.source}6`));
    expect(run({ names: 'agent gw', step: 0.3 })).toThrow(/focus "mine": a route's names are a list of piece names, in the order they light — not "agent gw"/);
    expect(run({ names: ['agent', 7], step: 0.3 })).toThrow(/focus "mine": a route's names are a list of piece names/);
    expect(run({ names: ['agent'], step: 0.3, line: 42 })).toThrow(/focus "mine": a route's line is text that names it, or left out — not 42/);
    expect(run({ names: ['agent'], step: 0.3, lineAt: [1, 2] })).toThrow(/focus "mine": a route's lineAt is 'x y' in slide px, null, or left out — not \[1,2\]/);
    expect(run(null)).toThrow(/focus "mine": route\(\) gives \{names, step, line\?, lineAt\?\}, not null/);
    expect(() => planFocus([{ in: ['*'], on: ['agent'], focus: 'path', options: { line: 7 } }], d)).toThrow(/focus "path": a route's line is text/);
    expect(run({ names: ['agent'], step: 0, line: 'a', lineAt: '10 20' })().looks[0].path).toEqual({ turns: 1, step: 0, done: 0, line: 'a', lineAt: '10 20' });
  });

  it('a piece stepping aside for its lit twin on the route goes at that twin\'s turn (the first to come), so the wire is never missing', () => {
    const twins = [
      { keys: ['agent'], box: null }, { keys: ['solid'], box: null }, { keys: ['alt'], box: null },
      { keys: ['dashed'], box: null, twin: ['solid', 'alt'] }, { keys: ['app'], box: null },
    ];
    const dashed = (second, first = { in: ['agent', 'dashed', 'app'] }) => planFocus([first, second], { pieces: twins }).looks[1].pieces[3];
    expect(dashed({ in: ['solid'], on: ['agent', 'solid', 'app'], focus: 'path' })).toMatchObject({ state: 'gone', change: 'leave', twinOff: true, twinTurn: 0.35, path: null });
    expect(dashed({ in: ['solid', 'alt'], on: ['agent', 'alt', 'solid', 'app'], focus: 'path' }).twinTurn).toBe(0.35);          // alt comes first
    expect(dashed({ in: ['solid', 'alt'], on: ['agent', 'solid', 'alt'], focus: { strategy: 'path', route: 'agent solid' } }).twinTurn).toBe(null);   // alt lights at once
    expect(dashed({ in: ['solid'], on: ['agent', 'solid', 'app'] }).twinTurn).toBe(null);                                         // no path: as before
    expect(dashed({ on: ['agent', 'solid'], focus: 'path' }, { in: ['*'], on: ['solid'] })).toMatchObject({ change: null, twinTurn: null });   // already aside
  });
});
