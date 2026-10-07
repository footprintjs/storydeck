import { describe, it, expect, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { readPieces, readStep, drawFocus, wrapStage, focusOverlay, focusRuntime, slideClass } from './focusHtml';
import { planFocus } from './focus';

/** The veil's rectangles, from its clip path, as [x0, y0, x1, y1]; and how much of the slide they blur. */
const runs = (html) => [...html.matchAll(/M(-?[\d.]+) (-?[\d.]+)H(-?[\d.]+)V(-?[\d.]+)H-?[\d.]+Z/g)].map((m) => m.slice(1, 5).map(Number));
const blurred = (html) => runs(html).reduce((n, [x0, y0, x1, y1]) => n + (x1 - x0) * (y1 - y0), 0);

const MAP = `<div class="map">
  <div class="box" data-k="page" style="left:100px;top:300px;width:600px;height:400px">page</div>
  <svg class="wire" data-k="wire" style="left:700px;top:480px" width="300" height="40"></svg>
  <span data-k="code box" class="m" style="left:1000px;top:300px;width:500px;height:250px;color:red;">code</span>
  <b data-k="label" style="left:1000px;top:600px">label</b>
  <i data-k="note">note</i>
</div>`;

describe('focusHtml · reading pieces', () => {
  it('numbers every named element and reads its box from the inline style (an svg\'s size from its attributes)', () => {
    const { html, pieces } = readPieces(MAP);
    expect(pieces.map((p) => p.keys)).toEqual([['page'], ['wire'], ['code', 'box'], ['label'], ['note']]);
    expect(pieces.map((p) => p.box)).toEqual([
      { x: 100, y: 300, w: 600, h: 400 }, { x: 700, y: 480, w: 300, h: 40 }, { x: 1000, y: 300, w: 500, h: 250 }, { x: 1000, y: 600, w: 0, h: 0 }, null,
    ]);
    expect(html.match(/data-sd-i="\d+"/g)).toEqual(['data-sd-i="0"', 'data-sd-i="1"', 'data-sd-i="2"', 'data-sd-i="3"', 'data-sd-i="4"']);
    expect(readPieces('<p data-name="x" style="left:1px;top:2px"></p>', { attr: 'data-name' }).pieces[0].box).toEqual({ x: 1, y: 2, w: 0, h: 0 });
    expect(readPieces('<i data-k="d" data-twin="s t"></i>').pieces[0].twin).toEqual(['s', 't']);
    expect(readPieces('<p data-k="z" style="left:0;top:0;width:10px;height:0"></p>').pieces[0].box).toEqual({ x: 0, y: 0, w: 10, h: 0 });   // a bare 0 is a length
    expect(readPieces('<p data-k="e" style="left:2em;top:0"></p>').pieces[0].box).toBe(null);                                     // other units are not px
  });

  it('reads and dresses single-quoted attributes, keeping their quotes', () => {
    const { html, pieces } = readPieces(`<div class='box' data-k='x' style='left:0;top:0'>x</div>`);
    expect(pieces[0]).toEqual({ keys: ['x'], box: { x: 0, y: 0, w: 0, h: 0 } });
    const { looks } = planFocus([{ in: ['x'] }], { pieces });
    expect(drawFocus(html, looks[0])).toBe(`<div class='box sd sd-on sd-enter' data-k='x' style='left:0;top:0'>x</div>`);
  });
});

describe('focusHtml · reading a click', () => {
  it('reads a step\'s attributes, its focus and its options (camelCased)', () => {
    expect(readStep(` data-in="a b" data-on='c' data-quiet data-focus="left blur" data-focus-aside-by="1 2" data-focus-label='the form'`)).toEqual({
      in: ['a', 'b'], out: [], on: ['c'], hot: [], quiet: true, focus: 'left blur', options: { asideBy: '1 2', label: 'the form' },
    });
    expect(readStep(' data-out="x"')).toEqual({ in: [], out: ['x'], on: null, hot: [], quiet: false, focus: '', options: {} });
    expect(readStep(' data-quiet-ish="1"').quiet).toBe(false);
    expect(() => readStep(' data-focus="10 20 30 40"')).toThrow(/put "10 20 30 40" in data-focus-rect/);
  });
});

describe('focusHtml · drawing a click', () => {
  const { html, pieces } = readPieces(MAP);
  const area = [0, 200, 1920, 1000];
  const { looks } = planFocus([
    { in: ['*'] },
    { on: ['code', 'label'], focus: 'left blur', options: { label: 'the code' } },
    { on: ['code', 'label'] },
    { focus: 'zoom' },
  ], { pieces, area });

  it('dresses each piece for its state, and keeps its own classes and style', () => {
    const out = drawFocus(html, looks[0]);
    expect(out).toContain('<div class="box sd sd-on sd-enter" data-k="page" style="left:100px;top:300px;width:600px;height:400px">');
    expect(out).toContain('<span data-k="code box" class="m sd sd-on sd-enter" style="left:1000px;top:300px;width:500px;height:250px;color:red;">');
    expect(out).toContain('<i data-k="note" class="sd sd-on sd-enter">');
    expect(out).not.toContain('data-sd-i');
  });

  it('writes where a piece moved to and where it came from, so the move can be animated', () => {
    const out = drawFocus(html, looks[1]);
    const page = looks[1].pieces[0].move;
    expect(out).toContain(`class="box sd sd-dim sd-fade sd-moved sd-move" data-k="page" style="left:100px;top:300px;width:600px;height:400px;--sd-dx:${page.dx}px;--sd-dy:${page.dy}px;--sd-s:${page.s};--sd-dx0:0px;--sd-dy0:0px;--sd-s0:1;transform-origin:50% 50%"`);
    expect(out).toMatch(/<b data-k="label" style="left:1000px;top:600px;--sd-dx:[^"]*;transform-origin:0 0" class="sd sd-on sd-moved sd-move sd-origin-tl">/);
    // the origin is inline, so a stylesheet's transform-origin on the piece cannot move it off its planned place
    expect(out).toMatch(/data-k="code box" class="m sd sd-on sd-moved sd-move" style="[^"]*;transform-origin:50% 50%"/);
    const back = drawFocus(html, looks[2]);   // the focus drops: back in place, gliding from where it stood
    expect(back).toContain(`class="box sd sd-dim sd-move" data-k="page" style="left:100px;top:300px;width:600px;height:400px;--sd-dx0:${page.dx}px;--sd-dy0:${page.dy}px;--sd-s0:${page.s};transform-origin:50% 50%"`);
  });

  it('marks a piece that stepped aside for its twin', () => {
    const twin = readPieces('<i data-k="s"></i><i data-k="d" data-twin="s"></i>');
    const { looks } = planFocus([{ in: ['*'], on: ['s'] }], { pieces: twin.pieces });
    expect(drawFocus(twin.html, looks[0])).toContain('<i data-k="d" data-twin="s" class="sd sd-gone sd-twin-off">');
  });

  it('refuses a look planned from other HTML', () => {
    expect(() => drawFocus('<p data-sd-i="9"></p>', looks[0])).toThrow(/piece 9 is not in this look/);
  });

  it('wraps the pieces in a stage only while the view moves', () => {
    expect(wrapStage('<x/>', looks[0])).toBe('<x/>');
    const z = looks[3].stage.move;
    expect(wrapStage('<x/>', looks[3])).toBe(`<div class="sd-stage sd-move" style="--sd-tx:${z.x}px;--sd-ty:${z.y}px;--sd-ts:${z.s};--sd-tx0:0px;--sd-ty0:0px;--sd-ts0:1"><x/></div>`);
  });

  it('draws the blur over the area with a hole and a labelled frame; on the way out, only the blur', () => {
    const o = focusOverlay(looks[1], { area });
    const [x, y, w, h] = looks[1].overlay.rects[0];
    expect(blurred(o)).toBe(1920 * 800 - w * h);
    expect(o).toContain('class="sd-veil sd-veil-in-new"');
    expect(slideClass(looks[1])).toBe('sd-focus-new');
    expect(slideClass(looks[0])).toBe('');
    expect(o).toContain(`<div class="sd-frame sd-new" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px"><span>the code</span></div>`);
    const out = focusOverlay(looks[2], { area });
    expect(out).toContain('sd-veil-out');
    expect(out).not.toContain('sd-frame');
    expect(focusOverlay(looks[0])).toBe('');
    expect(focusOverlay({ overlay: { rects: [[0, 0, 1, 1]], label: '<b>&', phase: 'in' } })).toContain('<span>&lt;b&gt;&amp;</span>');
  });

  it('keeps overlapping holes clear and never blurs outside the area', () => {
    const o = focusOverlay({ overlay: { rects: [[100, 100, 200, 200], [200, 200, 200, 200], [-50, 150, 100, 100]], label: '', phase: 'in', frameNew: false } }, { area: [0, 150, 1000, 1000] });
    // area 1000 × 850; holes inside it: [100,150 → 300,300] (clamped), [200,200 → 400,400], [0,150 → 50,250] (clamped)
    const union = 200 * 150 + 200 * 200 - 100 * 100 + 50 * 100;
    expect(blurred(o)).toBe(1000 * 850 - union);
    for (const [x0, y0, x1, y1] of runs(o)) expect(x0 >= 0 && y0 >= 150 && x1 <= 1000 && y1 <= 1000).toBe(true);
  });

  it('frames a moved blur anew without fading the blur in again, and leaves a leaving piece as it looked', () => {
    const moved = { overlay: { rects: [[10, 10, 50, 50]], label: '', phase: 'in', frameNew: true } };
    expect(focusOverlay(moved)).toContain('class="sd-veil sd-veil-in"');
    expect(focusOverlay(moved)).toContain('class="sd-frame sd-new"');
    const plan = planFocus([{ in: ['*'] }, { on: ['code'], focus: 'left' }, { out: ['page'], on: ['code'], focus: 'left' }], { pieces, area }).looks;
    const leaving = plan[2].pieces[0].move;
    expect(drawFocus(html, plan[2])).toContain(`class="box sd sd-gone sd-dim sd-leave sd-moved" data-k="page" style="left:100px;top:300px;width:600px;height:400px;--sd-dx:${leaving.dx}px;--sd-dy:${leaving.dy}px;--sd-s:${leaving.s};transform-origin:50% 50%"`);
    const relook = planFocus([{ in: ['*'], on: ['code'], quiet: true, focus: 'hide' }, { on: ['code'] }], { pieces }).looks[1];
    expect(drawFocus(html, relook)).toContain('class="box sd sd-dim sd-relook sd-from-hide"');
  });

  it("keeps its motion rules weak, so a deck's own rule for a piece wins", () => {
    const css = readFileSync(path.join(process.cwd(), 'focus.css'), 'utf8');
    expect(css).not.toMatch(/^\s*\[data-deck-active\]/m);
    expect(css.match(/:where\(\[data-deck-active\]:not\(\[data-sd-instant\]\):not\(\[data-deck-static\]\)\)/g).length).toBe(5);
  });

  it('ships a stylesheet for every class it writes', () => {
    const css = readFileSync(path.join(process.cwd(), 'focus.css'), 'utf8');
    for (const c of ['sd-dim', 'sd-gone', 'sd-hide', 'sd-keep', 'sd-hot', 'sd-hot-in', 'sd-enter', 'sd-arrive', 'sd-light', 'sd-fade', 'sd-leave',
      'sd-moved', 'sd-move', 'sd-origin-tl', 'sd-twin-off', 'sd-relook', 'sd-from-grey', 'sd-from-hide', 'sd-from-keep', 'sd-stage', 'sd-veil', 'sd-veil-in-new', 'sd-veil-out', 'sd-frame', 'sd-new', 'sd-focus-new'])
      expect(css, c).toMatch(new RegExp(`\\.${c}\\b`));
  });
});

describe('focusHtml · the runtime', () => {
  afterEach(() => { document.body.innerHTML = ''; delete window.__sdFocusRuntime; });
  it('lets a forward click animate, and makes a jump or a step back land at once', () => {
    document.body.innerHTML = '<deck-stage><section></section><section></section><section></section></deck-stage>';
    focusRuntime();
    const stage = document.querySelector('deck-stage'), [a, b, c] = stage.querySelectorAll('section');
    const go = (index, previousIndex, slide) => stage.dispatchEvent(new CustomEvent('slidechange', { bubbles: true, detail: { index, previousIndex, slide } }));
    go(1, 0, b); expect(b.hasAttribute('data-sd-instant')).toBe(false);
    go(0, 1, a); expect(a.hasAttribute('data-sd-instant')).toBe(true);
    go(2, 0, c); expect(c.hasAttribute('data-sd-instant')).toBe(true); expect(a.hasAttribute('data-sd-instant')).toBe(false);
  });
  it('listens on the document, so it may run before the deck exists, once however often it is called; a step over skipped slides is a step', () => {
    focusRuntime(); focusRuntime();
    document.body.innerHTML = '<deck-stage><section></section><section data-deck-skip></section><section></section></deck-stage>';
    const stage = document.querySelector('deck-stage'), [a, , c] = stage.querySelectorAll('section');
    let calls = 0; document.addEventListener('slidechange', () => calls++);
    stage.dispatchEvent(new CustomEvent('slidechange', { bubbles: true, detail: { index: 2, previousIndex: 0, slide: c } }));
    expect(c.hasAttribute('data-sd-instant')).toBe(false);
    expect(calls).toBe(1);
    void a;
  });
  it('called after the deck showed a slide, it lets that slide land as it is', () => {
    document.body.innerHTML = '<deck-stage><section data-deck-active></section></deck-stage>';
    focusRuntime();
    expect(document.querySelector('section').hasAttribute('data-sd-instant')).toBe(true);
  });
  it('does nothing on a page with no deck', () => {
    expect(() => focusRuntime()).not.toThrow();
  });
});
