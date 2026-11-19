import { describe, it, expect, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { readPieces, readStep, drawFocus, wrapStage, focusOverlay, focusRuntime, slideClass, slideStyle } from './focusHtml';
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

  it('a view with a turn on the route waits for it and takes its time: both written on the stage', () => {
    const stage = { move: { s: 0.5, x: 10, y: 20 }, from: { s: 1, x: 0, y: 0 }, turn: { at: 0.7, takes: 1.5 } };
    expect(wrapStage('<x/>', { stage })).toBe('<div class="sd-stage sd-move sd-stage-turn" style="--sd-tx:10px;--sd-ty:20px;--sd-ts:0.5;--sd-tx0:0px;--sd-ty0:0px;--sd-ts0:1;--sd-stage-delay:0.7s;--sd-stage-time:1.5s"><x/></div>');
    // without a turn nothing of it is written: the stage is as it was before turns
    expect(wrapStage('<x/>', { stage: { move: stage.move, from: stage.from } })).not.toMatch(/sd-stage-turn|--sd-stage-/);
    // a view that does not move has no turn to wait for
    expect(wrapStage('<x/>', { stage: { move: stage.move, from: null, turn: stage.turn } })).toBe('<div class="sd-stage" style="--sd-tx:10px;--sd-ty:20px;--sd-ts:0.5"><x/></div>');
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
    expect(css.match(/:where\(\[data-deck-active\]:not\(\[data-sd-instant\]\):not\(\[data-deck-static\]\)\)/g).length).toBe(9);   // + the path's line, + the view's turn on a path, + the two that say when a view has arrived (--sd-arrive-at)
  });

  it('ships a stylesheet for every class it writes', () => {
    const css = readFileSync(path.join(process.cwd(), 'focus.css'), 'utf8');
    for (const c of ['sd-dim', 'sd-gone', 'sd-hide', 'sd-keep', 'sd-hot', 'sd-hot-in', 'sd-enter', 'sd-arrive', 'sd-light', 'sd-fade', 'sd-leave',
      'sd-moved', 'sd-move', 'sd-origin-tl', 'sd-twin-off', 'sd-relook', 'sd-from-grey', 'sd-from-hide', 'sd-from-keep', 'sd-stage', 'sd-veil', 'sd-veil-in-new', 'sd-veil-out', 'sd-frame', 'sd-new', 'sd-focus-new', 'sd-path', 'sd-path-line', 'sd-twin-turn', 'sd-stage-turn', 'sd-stage-own'])
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

describe('focusHtml · a path', () => {
  const html = '<div data-k="a" style="left:0;top:0;width:10px;height:10px"></div><div data-k="b" style="left:20px;top:0;width:10px;height:10px"></div>';
  it('marks each piece on the route with its turn, and writes the route\'s line where it is asked for', () => {
    const { html: numbered, pieces } = readPieces(html);
    const { looks } = planFocus([{ in: ['a', 'b'], focus: 'path', options: { line: 'a → b <done>' } }], { pieces });
    const drawn = drawFocus(numbered, looks[0]);
    expect(drawn).toContain('style="left:0;top:0;width:10px;height:10px;--sd-path-delay:0s" class="sd sd-on sd-enter sd-path"');
    expect(drawn).toContain('--sd-path-delay:0.35s');
    expect(focusOverlay(looks[0], { area: [0, 200, 1920, 1000] })).toBe('<div class="sd-path-line" style="left:24px;top:944px;--sd-path-delay:0.35s">a → b &lt;done&gt;</div>');
    const placed = planFocus([{ in: ['a', 'b'], focus: 'path', options: { line: 'x', lineAt: '100 200' } }], { pieces }).looks[0];
    expect(focusOverlay(placed)).toContain('style="left:100px;top:200px;');
    const bad = planFocus([{ in: ['a', 'b'], focus: 'path', options: { line: 'x', lineAt: 'here' } }], { pieces }).looks[0];
    expect(() => focusOverlay(bad)).toThrow(/lineAt is x y in slide px/);
  });

  it('marks a piece that steps aside for its lit twin on the route with that twin\'s turn, when it goes', () => {
    const twin = readPieces('<i data-k="a"></i><i data-k="s"></i><i data-k="d" data-twin="s"></i>');
    const { looks } = planFocus([{ in: ['a', 'd'] }, { in: ['s'], on: ['a', 's'], focus: 'path' }], { pieces: twin.pieces });
    const drawn = drawFocus(twin.html, looks[1]);
    expect(drawn).toContain('<i data-k="s" class="sd sd-on sd-enter sd-path" style="--sd-path-delay:0.35s">');
    expect(drawn).toContain('<i data-k="d" data-twin="s" class="sd sd-gone sd-leave sd-twin-off sd-twin-turn" style="--sd-path-delay:0.35s">');
  });
});

describe('focusHtml · a deck without a path', () => {
  it('writes the very bytes 0.3.0 wrote, for every change a click can make', () => {
    const { html, pieces } = readPieces(MAP.replace(/<\/div>$/, `  <i data-k="solid" style="left:700px;top:520px;width:300px;height:4px"></i>
  <i data-k="dashed" data-twin="solid" style="left:700px;top:520px;width:300px;height:4px"></i>
</div>`));
    const area = [0, 200, 1920, 1000];
    const first = planFocus([
      { in: ['page', 'wire', 'code', 'label', 'dashed'] },                                              // enter
      { on: ['code', 'label'], hot: ['code'], focus: 'left blur', options: { label: 'the <code>' } },    // fade, move, a new blur, a ring
      { on: ['code', 'label'], hot: ['code'], focus: 'blur' },                                           // glide back, the blur stays
      { on: ['page'], focus: 'zoom' },                                                                   // light, the stage, the blur melts
      { on: ['page'], focus: 'hide' },                                                                   // a look from grey
      { on: ['page'], focus: 'keep' },                                                                   // a look from hidden
      { in: ['solid'], on: ['solid', 'page'], quiet: true },                                             // a twin steps aside
      { out: ['label'], on: ['code'], focus: { strategy: 'place', groups: 'page: -100 50 0.5 | wire: 0 0 1 @ 700 480' } },   // leave, place
    ], { pieces, area });
    const second = planFocus([{ in: ['note'], fresh: true }, { focus: 'up', on: ['note'], hot: ['page'] }], { pieces, area }, first.end);   // arrive
    const out = [...first.looks, ...second.looks].map((look) => `<section class="${slideClass(look)}"><div class="map">${wrapStage(drawFocus(html, look), look)}</div>${focusOverlay(look, { area })}</section>`).join('\n');
    expect(out).not.toMatch(/sd-path|sd-twin-turn|--sd-path-delay/);
    // sha-256 of what 0.3.0 (footprint-storydeck main, 5a424b6) writes for these clicks — 10172 characters
    expect([createHash('sha256').update(out).digest('hex').slice(0, 12), out.length]).toEqual(['120f9c53be9a', 10172]);
  });
});

describe('focusHtml · a path, in focus.css', () => {
  const css = readFileSync(path.join(process.cwd(), 'focus.css'), 'utf8');
  const gate = '@media screen and (prefers-reduced-motion: no-preference) {';
  /** What a block holds: the text inside the braces of the block that starts at `from`. */
  const inside = (from) => {
    const start = css.indexOf('{', from);
    let depth = 0, end = start;
    do { depth += css[end] === '{' ? 1 : css[end] === '}' ? -1 : 0; end += 1; } while (depth);
    return css.slice(start + 1, end - 1);
  };
  const motion = inside(css.indexOf(gate));
  /** The motion block's rules, comments left out: [selector, declarations]. */
  const rules = [...motion.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => [m[1].trim(), m[2].trim()]);
  /** The declarations of the rule with exactly this selector, in the motion block. */
  const rule = (selector) => rules.find(([s]) => s === selector)?.[1] ?? null;
  /** A @keyframes rule's keyframes: [selector, declarations]. */
  const keyframes = (name) => [...inside(css.indexOf(`@keyframes ${name} {`)).matchAll(/(from|to|\d+%)\s*\{([^}]*)\}/g)].map((m) => [m[1], m[2].trim()]);
  /** The functions a filter lists, in order — the outer ones (a var() inside drop-shadow is not one). */
  const functions = (filter) => {
    const names = []; let depth = 0, word = '';
    for (const c of filter) {
      if (c === '(') { if (!depth) names.push(word); depth += 1; word = ''; } else if (c === ')') depth -= 1; else if (!depth) word = /\s/.test(c) ? '' : word + c;
    }
    return names;
  };

  it('lights a piece from grey with ONE animation whose filter lists the same functions at every keyframe, so it glides (no flash)', () => {
    const frames = keyframes('sdLightPulse');
    expect(frames.map(([at]) => at)).toEqual(['from', '40%']);   // no end keyframe: it ends on the plain style
    for (const [, body] of frames) expect(functions(/filter:\s*([^;]+);/.exec(body)[1])).toEqual(['grayscale', 'drop-shadow', 'brightness']);
    expect(frames[0][1]).toContain('opacity: var(--sd-dim-opacity, .32)');   // it carries the light's opacity
    expect(rule('.sd-path.sd-light')).toBe('--sd-a-state: sdLightPulse .9s ease var(--sd-turn) backwards; --sd-a-path: sdNone 0s;');   // grey until its turn; no second filter animation
    // on, entering or arriving, the pulse is the only animation on the filter
    expect(rule('.sd-path')).toBe('--sd-a-path: sdPulse .9s ease var(--sd-turn);');
    for (const name of ['sdEnter', 'sdArrive']) expect(keyframes(name).some(([, body]) => /filter/.test(body)), name).toBe(false);
  });

  it('gives everything on a path one moment, --sd-turn: its delay, .4 s later under a new blur', () => {
    expect(css).toContain('@property --sd-turn { syntax: \'*\'; inherits: false; }');   // never inherited: 0 off the route
    expect(rule(':is(.sd-path, .sd-twin-turn, .sd-path-line)')).toBe('--sd-turn: var(--sd-path-delay, 0s);');
    expect(rule('.sd-focus-new :is(.sd-path, .sd-twin-turn, .sd-path-line)')).toBe('--sd-turn: calc(var(--sd-path-delay, 0s) + .4s);');
    expect(rule('.sd-path.sd-enter')).toBe('--sd-a-state: sdEnter .6s var(--sd-ease, cubic-bezier(.2, .7, .2, 1)) var(--sd-turn) both;');
    expect(rule('.sd-path.sd-arrive')).toBe('--sd-a-state: sdArrive .6s ease var(--sd-turn) both;');
    expect(rule(':where([data-deck-active]:not([data-sd-instant]):not([data-deck-static])) .sd-path-line')).toBe('animation: sdArrive .5s ease var(--sd-turn) both;');
    // a twin goes at its twin's turn — later by --sd-twin-lag when a stylesheet asks (deck.css: a wire, while its twin sweeps in)
    expect(rule('.sd-twin-turn.sd-leave')).toBe('--sd-a-state: sdLeave .45s ease calc(var(--sd-turn) + var(--sd-twin-lag, 0s)) both;');
    expect(rule('.sd-hot-in')).toBe('--sd-a-hot: sdRing .6s var(--sd-ease, cubic-bezier(.2, .7, .2, 1)) calc(.3s + var(--sd-turn, 0s)) both;');   // the ring, .3 s after its turn
  });

  it('leaves what is not on a path as 0.3.0 had it', () => {
    expect(rule('.sd-enter')).toBe('--sd-a-state: sdEnter .6s var(--sd-ease, cubic-bezier(.2, .7, .2, 1)) var(--sd-delay, 0s) both;');
    expect(rule('.sd-arrive')).toBe('--sd-a-state: sdArrive .6s ease both;');
    expect(rule('.sd-light')).toBe('--sd-a-state: sdLight .7s ease both;');
    expect(rule('.sd-focus-new .sd-enter')).toBe('--sd-delay: .4s;');
    // a path never reads or sets --sd-delay, so a new blur's wait cannot lose to it
    for (const [selector, body] of rules) if (selector.includes('sd-path') || selector.includes('sd-twin-turn')) expect(body, selector).not.toContain('--sd-delay');
  });

  it('keeps every animation behind the motion gate: a forward click only, never under reduced motion', () => {
    const outside = css.replace(motion, '').replace(/\/\*[\s\S]*?\*\//g, '');
    expect(outside).not.toMatch(/--sd-a-[\w-]+\s*:|--sd-turn\s*:|(^|[\s;{])animation\s*:/m);
    const animated = rules.filter(([, body]) => /(^|[\s;])animation\s*:/.test(body));
    expect(animated.length).toBe(7);   // the pieces, the path's line, the stage, the stage with a turn, the veil in, the frame, the veil out
    for (const [selector] of animated) expect(selector.startsWith(':where([data-deck-active]:not([data-sd-instant]):not([data-deck-static])) '), selector).toBe(true);
  });
});

describe('focusHtml · ground', () => {
  it('reads data-ground on a piece, and leaves the key out of every other piece', () => {
    const { pieces } = readPieces('<div data-k="floor" data-ground style="left:0px;top:0px;width:9px;height:9px"></div><div data-k="a" data-grounded style="left:0px;top:0px"></div><div data-k="b" data-ground="yes" style="left:1px;top:1px"></div>');
    expect(pieces.map((p) => p.ground)).toEqual([true, undefined, true]);
    expect('ground' in pieces[1]).toBe(false);
  });
});

describe('focusHtml · ground is the tag\'s own attribute', () => {
  it('found in review: the words inside another attribute are not it, and data-ground="false" says it is part of the picture', () => {
    const box = 'style="left:0px;top:0px;width:9px;height:9px"';
    const { pieces } = readPieces(`<div data-k="a" title="x data-ground" ${box}></div><div data-k="b" data-ground="false" ${box}></div><div data-k="c" data-ground="FALSE " ${box}></div><div data-k="d" data-ground="" ${box}></div><div data-k="e" DATA-GROUND ${box}></div>`);
    expect(pieces.map((p) => p.ground)).toEqual([undefined, undefined, undefined, true, true]);
  });
});

describe('focusHtml · stages of their own', () => {
  const box = (x) => `style="left:${x}px;top:0px;width:10px;height:10px"`;
  const map = `<div data-k="a" ${box(0)}>A</div><i data-k="w" class="wire" data-ends="r1 r2" ${box(5)}></i>`
    + `<div data-k="r1" data-stage="panel" ${box(20)}><span>one</span><div>in</div></div><img data-k="pic" data-stage="panel" ${box(30)}>`
    + `<div data-k="b" ${box(40)}>B</div><div data-k="r2" data-stage="panel" ${box(50)}>two</div><div data-k="why" data-ends="a" ${box(60)}>why</div>`;

  it('reads the stage a piece names; a piece that touches others stands on theirs when they share one', () => {
    const { pieces, html } = readPieces(map);
    expect(pieces.map((p) => p.stage)).toEqual([undefined, 'panel', 'panel', 'panel', undefined, 'panel', undefined]);
    expect('stage' in pieces[0]).toBe(false);
    expect(html).toContain('<i data-k="w" data-sd-i="1" class="wire" data-ends="r1 r2" style="left:5px;top:0px;width:10px;height:10px" data-stage="panel">');   // the wire between two rows of the panel is the panel's
    expect(html).toContain('<div data-k="why" data-sd-i="6" data-ends="a" ');                                    // about a piece of the main stage: it stays there
    // touching pieces of two stages, it is left where it was written (check warns: across-stages)
    const mixed = readPieces(`<div data-k="a" ${box(0)}></div><div data-k="r" data-stage="panel" ${box(9)}></div><i data-k="w" data-ends="a r" ${box(5)}></i>`).pieces;
    expect(mixed[2].stage).toBe(undefined);
    // its own word wins, and an end that is no piece decides nothing
    expect(readPieces(`<div data-k="r" data-stage="panel" ${box(9)}></div><i data-k="w" data-stage="top" data-ends="r" ${box(5)}></i><i data-k="v" data-ends="r ghost" ${box(5)}></i>`).pieces.map((p) => p.stage)).toEqual(['panel', 'top', undefined]);
  });

  it('refuses a stage that is not one plain name, and reads the tag\'s own attribute only', () => {
    expect(() => readPieces(`<div data-k="a" data-stage="side panel" ${box(0)}></div>`)).toThrow(/data-stage="side panel": a stage is written data-stage="panel" — one name of letters, digits, - and _, in lower case and with quotes/);
    expect(() => readPieces(`<div data-k="a" data-stage=panel ${box(0)}></div>`)).toThrow(/data-stage: a stage is written data-stage="panel"/);
    expect(() => readPieces(`<div data-k="a" DATA-STAGE="panel" ${box(0)}></div>`)).toThrow(/in lower case and with quotes/);
    expect(() => readPieces(`<div data-k="a" data-stage="" ${box(0)}></div>`)).toThrow(/one name of letters/);
    expect(readPieces(`<div data-k="a" title="see data-stage" ${box(0)}></div>`).pieces[0].stage).toBe(undefined);
  });

  it('draws each stage\'s pieces together in its own element, after the main stage, in the order written', () => {
    const { html, pieces } = readPieces(map);
    const { looks } = planFocus([{ in: ['*'] }, { on: ['r2'], focus: 'zoom', options: { stage: 'panel' } }], { pieces, area: [0, 0, 1920, 1080] });
    const out = wrapStage(drawFocus(html, looks[1]), looks[1]);
    const [, main, panel] = /^<div class="sd-stage">(.*)<\/div><div class="sd-stage sd-move sd-stage-own" data-sd-stage="panel" style="[^"]*">(.*)<\/div>$/s.exec(out);
    const order = (text) => [...text.matchAll(/data-k="(\w+)"/g)].map((m) => m[1]);
    expect(order(main)).toEqual(['a', 'b', 'why']);                      // the main stage keeps its pieces, in order
    expect(order(panel)).toEqual(['w', 'r1', 'pic', 'r2']);              // the panel's, in order — a wire, a piece with elements inside, an image
    expect(panel).toContain('<span>one</span><div>in</div></div><img ');  // each piece whole, the image with no end tag
    expect(out).toContain('--sd-tx0:0px;--sd-ty0:0px;--sd-ts0:1');
    // every piece once, none lost
    expect(order(out).sort()).toEqual(order(html).sort());
    // on the click before, nothing moves: every stage still has its element, so a piece is in the same place on every click
    expect(wrapStage(drawFocus(html, looks[0]), looks[0])).toMatch(/^<div class="sd-stage">.*<\/div><div class="sd-stage sd-stage-own" data-sd-stage="panel">.*<\/div>$/s);
  });

  it('leaves a map with no stage of its own exactly as it was drawn before stages', () => {
    const plain = map.replaceAll(' data-stage="panel"', ''), { html, pieces } = readPieces(plain);
    const { looks } = planFocus([{ in: ['*'] }, { on: ['a'], focus: 'zoom' }], { pieces, area: [0, 0, 1920, 1080] });
    expect(wrapStage('<x/>', looks[0])).toBe('<x/>');
    expect(wrapStage(drawFocus(html, looks[1]), looks[1])).toMatch(/^<div class="sd-stage sd-move" style="[^"]*"><div data-k="a"/);
    expect(html).not.toContain('data-stage');
  });

  it('slideStyle says when a view with a turn has arrived, and nothing otherwise', () => {
    const { pieces } = readPieces(map);
    const turn = planFocus([{ in: ['*'] }, { on: ['a', 'b'], focus: ['zoom', { strategy: 'path', route: 'b camera:0.6 a' }] }], { pieces, area: [0, 0, 1920, 1080] }).looks[1];
    expect(turn.stage.turn).toEqual({ at: 0.35, takes: 0.6 });
    expect(slideStyle(turn)).toBe('--sd-view-at:0.95s');
    const plain = planFocus([{ in: ['*'] }, { on: ['a'], focus: 'zoom' }], { pieces, area: [0, 0, 1920, 1080] }).looks;
    expect(plain.map(slideStyle)).toEqual(['', '']);
    const own = planFocus([{ in: ['*'] }, { on: ['r2', 'a'], focus: ['zoom', { strategy: 'path', route: 'camera r2' }], options: { stage: 'panel' } }], { pieces, area: [0, 0, 1920, 1080] }).looks[1];
    expect(slideStyle(own)).toBe('--sd-view-at:1s');
  });

  it('focus.css gives --sd-arrive-at only behind the motion gate: 0 at rest, the view\'s time when one moves', () => {
    const css = readFileSync(path.join(process.cwd(), 'focus.css'), 'utf8');
    expect(css).toContain("@property --sd-arrive-at { syntax: '<time>'; inherits: true; initial-value: 0s; }");
    expect(css).toContain(':where([data-deck-active]:not([data-sd-instant]):not([data-deck-static])):has(.sd-stage.sd-move) { --sd-arrive-at: var(--sd-view-at, var(--sd-move-time, 1s)); }');
    expect(css.split('@media screen and (prefers-reduced-motion: no-preference)')[0]).not.toMatch(/--sd-arrive-at\s*:/);   // never set outside the gate
  });
});

describe('focusHtml · stages: what the review found', () => {
  const box = (x) => `style="left:${x}px;top:0px;width:10px;height:10px"`;
  const drawn = (map, clicks = [{ in: ['*'] }]) => { const { html, pieces } = readPieces(map); const look = planFocus(clicks, { pieces, area: [0, 0, 1920, 1080] }).looks.at(-1); return wrapStage(drawFocus(html, look), look); };
  const panelOf = (out) => /data-sd-stage="p"[^>]*>(.*)<\/div>$/s.exec(out)[1];

  it('a piece that holds a tag closing itself is cut at its own end, not at whatever closes next', () => {
    // <g/> inside the staged svg once counted as an opening tag: the cut ran on to the next </svg>, taking the main piece with it
    const out = drawn(`<svg data-k="q" data-stage="p" ${box(0)}><svg/><g><g/></g></svg><div data-k="m" ${box(20)}>M</div><svg data-k="tail" ${box(40)}></svg>`);
    expect([...panelOf(out).matchAll(/data-k="(\w+)"/g)].map((m) => m[1])).toEqual(['q']);
    expect(out.split('data-sd-stage="p"')[0]).toContain('data-k="m"');
    expect(out.split('data-sd-stage="p"')[0]).toContain('data-k="tail"');
  });

  it('a piece that closes itself is taken whole: an image, and an svg written <svg … />', () => {
    const out = drawn(`<svg data-k="q" data-stage="p" ${box(0)} /><img data-k="pic" data-stage="p" ${box(9)}><div data-k="m" ${box(20)}>M</div>`);
    expect([...panelOf(out).matchAll(/data-k="(\w+)"/g)].map((m) => m[1])).toEqual(['q', 'pic']);
    expect(out.split('data-sd-stage="p"')[0]).toContain('data-k="m"');
  });

  it('refuses a stage on a part of an svg drawing, and pieces inside each other on a map with stages', () => {
    expect(() => readPieces(`<svg ${box(0)}><g data-k="q" data-stage="p"></g></svg>`)).toThrow(/data-stage="p" on <g>: a part of an <svg> drawing cannot stand on a stage by itself — put data-stage on the <svg> it is in/);
    expect(() => readPieces(`<svg ${box(0)}><rect data-k="q" data-stage="p"/></svg>`)).toThrow(/on <rect>: a part of an <svg> drawing/);
    const inside = /piece "in" is inside piece "out": on a map with stages, pieces stand beside each other, never inside/;
    expect(() => readPieces(`<div data-k="out" ${box(0)}><b data-k="in" data-stage="p">x</b></div>`)).toThrow(inside);                      // a stage's piece inside a main one
    expect(() => readPieces(`<div data-k="out" data-stage="p" ${box(0)}><b data-k="in">x</b></div>`)).toThrow(inside);                      // a main piece inside a stage's
    expect(() => readPieces(`<div data-k="out" data-stage="p" ${box(0)}><i><b data-k="in" data-stage="p">x</b></i></div>`)).toThrow(inside);
    expect(() => readPieces(`<div data-k="a" data-stage="p" ${box(0)}>never closed`)).toThrow(/piece "a": its <div> is never closed/);
    // a map with no stage is read as it always was: nothing new is checked or refused
    expect(readPieces(`<div data-k="out" ${box(0)}><b data-k="in">x</b></div>`).pieces.map((p) => p.keys[0])).toEqual(['out', 'in']);
  });

  it('only a piece goes to a stage, and a stage\'s name reaches the page escaped', () => {
    const out = drawn(`<div data-k="q" data-stage="p" ${box(0)}>Q</div><div class="sd note" data-stage="p">not a piece</div><div data-k="m" ${box(20)}>M</div>`);
    expect(panelOf(out)).not.toContain('not a piece');
    expect(out.split('data-sd-stage="p"')[0]).toContain('not a piece');
    // a program that plans with its own pieces may name a stage anything: it is written safely
    const look = planFocus([{ in: ['*'] }], { pieces: [{ keys: ['a'], box: { x: 0, y: 0, w: 1, h: 1 }, stage: 'x"><b>' }] }).looks[0];
    expect(wrapStage('', look)).toContain('data-sd-stage="x&quot;&gt;&lt;b&gt;"');
  });

  it('a map of thousands of wires on stages costs its length, not its square', () => {
    const n = 4000, map = Array.from({ length: n }, (_, i) => `<div data-k="p${i}" data-stage="p" ${box(i)}></div><i data-k="w${i}" data-ends="p${i} p${(i + 1) % n}" ${box(i)}></i>`).join('');
    const start = performance.now(), { pieces } = readPieces(map);
    expect(performance.now() - start).toBeLessThan(400);                 // it took about 460 ms at this size when every wire looked at every piece
    expect(pieces.filter((p) => p.stage === 'p').length).toBe(2 * n);
  });
});
