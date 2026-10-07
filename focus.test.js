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
    expect(plain).toEqual({ rects: [[990, 290, 520, 320]], label: '', phase: 'in-new' });
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
    expect(looks[2].overlay.rects).toEqual(looks[1].overlay.rects.slice(0, 1));
  });

  it('a click takes one strategy of each kind, from the built-ins or the deck\'s own', () => {
    expect(() => focusStep(null, { ...lit, focus: 'zoom left' }, deck)).toThrow(/one mover at most.*"zoom" and "left"/);
    expect(() => focusStep(null, { ...lit, focus: 'spin' }, deck)).toThrow(/no focus strategy "spin" \(there are grey, hide, keep, zoom, left, right, up, down, blur\)/);
    const tilt = { kind: 'mover', place: ({ subject }) => ({ subject: { o: [subject.x, subject.y], s: 2, t: [0, 0] } }) };
    const look = focusStep(null, { ...lit, focus: 'tilt' }, { ...deck, strategies: { tilt } }).look;
    expect(look.strategies).toEqual(['tilt']);
    expect(look.pieces[1].move.s).toBe(2);
    expect(() => focusStep(null, { ...lit, focus: 'odd' }, { ...deck, strategies: { odd: { kind: 'paint' } } })).toThrow(/a look, a mover or an overlay/);
    expect(Object.keys(FOCUS)).toEqual(['grey', 'hide', 'keep', 'zoom', 'left', 'right', 'up', 'down', 'blur']);
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

  it('works on a map drawn scaled: the area is read through the view', () => {
    const view = { s: 0.5, x: 100, y: 50 };
    const { stage } = focusStep(null, { in: ['code'], focus: { strategy: 'zoom', share: 0.5 } }, { ...deck, view }).look;
    // on the slide, the code box's centre (1250, 425) · .5 + (100, 50) must land on the area's centre (960, 600)
    const [mx, my] = [stage.move.s * 1250 + stage.move.x, stage.move.s * 425 + stage.move.y];
    expect(mx * 0.5 + 100).toBeCloseTo(960, 1);
    expect(my * 0.5 + 50).toBeCloseTo(600, 1);
  });
});
