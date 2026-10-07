import { describe, it, expect, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { readPieces, drawFocus, wrapStage, focusOverlay, focusRuntime } from './focusHtml';
import { planFocus } from './focus';

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
    expect(out).toContain(`class="box sd sd-dim sd-fade sd-moved sd-move" data-k="page" style="left:100px;top:300px;width:600px;height:400px;--sd-dx:${page.dx}px;--sd-dy:${page.dy}px;--sd-s:${page.s};--sd-dx0:0px;--sd-dy0:0px;--sd-s0:1"`);
    expect(out).toMatch(/<b data-k="label" style="left:1000px;top:600px;--sd-dx:[^"]*" class="sd sd-on sd-moved sd-move sd-origin-tl">/);
    const back = drawFocus(html, looks[2]);   // the focus drops: back in place, gliding from where it stood
    expect(back).toContain(`class="box sd sd-dim sd-move" data-k="page" style="left:100px;top:300px;width:600px;height:400px;--sd-dx0:${page.dx}px;--sd-dy0:${page.dy}px;--sd-s0:${page.s}"`);
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
    expect(o).toContain(`clip-path:path(evenodd,'M0 200H1920V1000H0Z M${x} ${y}H${x + w}V${y + h}H${x}Z')`);
    expect(o).toContain('class="sd-veil sd-veil-in-new"');
    expect(o).toContain(`<div class="sd-frame sd-new" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px"><span>the code</span></div>`);
    const out = focusOverlay(looks[2], { area });
    expect(out).toContain('sd-veil-out');
    expect(out).not.toContain('sd-frame');
    expect(focusOverlay(looks[0])).toBe('');
    expect(focusOverlay({ overlay: { rects: [[0, 0, 1, 1]], label: '<b>&', phase: 'in' } })).toContain('<span>&lt;b&gt;&amp;</span>');
  });

  it('ships a stylesheet for every class it writes', () => {
    const css = readFileSync(path.join(process.cwd(), 'focus.css'), 'utf8');
    for (const c of ['sd-dim', 'sd-gone', 'sd-hide', 'sd-keep', 'sd-hot', 'sd-hot-in', 'sd-enter', 'sd-arrive', 'sd-light', 'sd-fade', 'sd-leave',
      'sd-moved', 'sd-move', 'sd-origin-tl', 'sd-stage', 'sd-veil', 'sd-veil-in-new', 'sd-veil-out', 'sd-frame', 'sd-new', 'sd-focus-new'])
      expect(css, c).toMatch(new RegExp(`\\.${c}\\b`));
  });
});

describe('focusHtml · the runtime', () => {
  afterEach(() => { document.body.innerHTML = ''; });
  it('lets a forward click animate, and makes a jump or a step back land at once', () => {
    document.body.innerHTML = '<deck-stage><section></section><section></section><section></section></deck-stage>';
    focusRuntime();
    const stage = document.querySelector('deck-stage'), [a, b, c] = stage.querySelectorAll('section');
    const go = (index, previousIndex, slide) => stage.dispatchEvent(new CustomEvent('slidechange', { detail: { index, previousIndex, slide } }));
    go(1, 0, b); expect(b.hasAttribute('data-sd-instant')).toBe(false);
    go(0, 1, a); expect(a.hasAttribute('data-sd-instant')).toBe(true);
    go(2, 0, c); expect(c.hasAttribute('data-sd-instant')).toBe(true); expect(a.hasAttribute('data-sd-instant')).toBe(false);
  });
  it('does nothing on a page with no deck', () => {
    expect(() => focusRuntime()).not.toThrow();
  });
});
