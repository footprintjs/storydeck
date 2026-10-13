import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { planFocus } from './focus';
import { readPieces, readStep, drawFocus, focusRuntime } from './focusHtml';

// apart in the page: the plan drawn into slides (focusHtml.js · drawFocus) and the springs focusRuntime plays.
// jsdom has no Web Animations, so Element.animate is a recorder: each call keeps its keyframes and timing, and a
// test reads a group's spring value off them at any moment. The clock is performance.now, set by hand.

// Four parts side by side, each a group of its own, all flying up 100 px: a part's spring value is -translateY / 100.
const MAP = ['a', 'b', 'c', 'd'].map((k, i) => `<div data-k="${k}" style="left:${i * 200}px;top:400px;width:100px;height:100px">${k}</div>`).join('');
const UP = 'a: 0 -100 | b: 0 -100 | c: 0 -100 | d: 0 -100';

/** The slides of a deck, one per click, as a built page has them; and a slidechange from one to another. */
function mountDeck(clicks) {
  const { html, pieces } = readPieces(MAP);
  const { looks } = planFocus(clicks, { pieces });
  document.body.innerHTML = `<deck-stage>${looks.map((look) => `<section>${drawFocus(html, look)}</section>`).join('')}</deck-stage>`;
  const stage = document.querySelector('deck-stage'), slides = [...stage.querySelectorAll('section')];
  const go = (index, previousIndex) => stage.dispatchEvent(new CustomEvent('slidechange', { bubbles: true, detail: { index, previousIndex, slide: slides[index] } }));
  return { slides, go, looks };
}

let clock = 0, played = [], added = [];
const addListener = document.addEventListener.bind(document);
beforeEach(() => {
  clock = 0; played = []; added = [];
  vi.spyOn(performance, 'now').mockImplementation(() => clock);
  // focusRuntime listens on the document for good (a page runs it once); each test removes its own listener after.
  vi.spyOn(document, 'addEventListener').mockImplementation((type, fn, opts) => { added.push([type, fn, opts]); addListener(type, fn, opts); });
  Element.prototype.animate = function animate(frames, timing) {
    const anim = { el: this, frames, timing, currentTime: null, cancelled: false, cancel() { anim.cancelled = true; } };
    played.push(anim);
    return anim;
  };
  focusRuntime();
});
afterEach(() => {
  for (const [type, fn, opts] of added) document.removeEventListener(type, fn, opts);
  vi.restoreAllMocks();
  delete Element.prototype.animate;
  delete window.matchMedia;
  delete window.__sdFocusRuntime;
  document.body.innerHTML = '';
});

/** A piece's place at `ms` into its animation, read off the keyframes (linear between them, as the timing says). */
function placeAt(anim, ms) {
  expect(anim.timing).toMatchObject({ easing: 'linear', fill: 'none' });
  const t = Math.min(1, Math.max(0, ms / anim.timing.duration)), f = anim.frames;
  let i = 0;
  while (i + 1 < f.length - 1 && f[i + 1].offset <= t) i++;
  const [a, b] = [f[i], f[Math.min(i + 1, f.length - 1)]], u = b.offset > a.offset ? Math.min(1, (t - a.offset) / (b.offset - a.offset)) : 1;
  const [ax, ay] = a.translate.split(' ').map(parseFloat), [bx, by] = b.translate.split(' ').map(parseFloat);
  return { dx: ax + (bx - ax) * u, dy: ay + (by - ay) * u, s: Number(a.scale) + (Number(b.scale) - Number(a.scale)) * u };
}
/** The spring value of the group a piece is in (0 together, 1 apart), `ms` into its animation. */
const valueAt = (anim, ms) => (0 - placeAt(anim, ms).dy) / 100;
/** When a group sets off: the first keyframe at which its value has left where it began, in ms. */
function setsOff(anim) {
  const v0 = valueAt(anim, 0), at = anim.frames.find((f) => Math.abs(-parseFloat(f.translate.split(' ')[1]) / 100 - v0) > 1e-6);
  return at.offset * anim.timing.duration;
}
const byPiece = (k) => played.find((a) => !a.cancelled && a.el.getAttribute('data-k') === k);
const FRAME = 1000 / 60;

describe('apart · in the page', () => {
  it('draws a piece its group\'s spring moves: marked, no CSS move, its group on it — and a click without apart as before', () => {
    const { slides, looks } = mountDeck([{ in: ['*'] }, { focus: 'apart', options: { apart: UP } }, {}]);
    const a = slides[1].querySelector('[data-k="a"]');
    expect(a.getAttribute('class')).toBe('sd sd-on sd-moved sd-apart');
    expect(a.getAttribute('data-sd-apart')).toBe('0 1 0 35 a');
    expect(a.getAttribute('style')).toBe('left:0px;top:400px;width:100px;height:100px;--sd-dx:0px;--sd-dy:-100px;--sd-s:1;--sd-dx0:0px;--sd-dy0:0px;--sd-s0:1;transform-origin:50% 50%');
    expect(slides[2].querySelector('[data-k="d"]').getAttribute('data-sd-apart')).toBe('3 0 1 35 d');
    expect(slides[0].innerHTML).not.toMatch(/sd-apart/);
    expect(looks[0].apart).toBe(null);
    expect(readStep(' data-focus="apart" data-focus-apart="a: 0 -100" data-focus-stagger="60"')).toMatchObject({ focus: 'apart', options: { apart: 'a: 0 -100', stagger: '60' } });
  });

  it('opens in the order written, `stagger` ms apart, and closes in reverse: the last one out is the first one back', () => {
    const { go } = mountDeck([{ in: ['*'] }, { focus: 'apart', options: { apart: UP } }, {}]);
    go(1, 0);
    expect(played.length).toBe(4);
    const out = ['a', 'b', 'c', 'd'].map((k) => setsOff(byPiece(k)));
    out.forEach((ms, i) => { expect(ms).toBeGreaterThan(i * 35 - 1); expect(ms).toBeLessThanOrEqual(i * 35 + FRAME + 1); });
    for (const k of ['a', 'b', 'c', 'd']) {
      expect(valueAt(byPiece(k), 0)).toBe(0);                                                   // from together…
      expect(byPiece(k).frames.at(-1)).toMatchObject({ offset: 1, translate: '0px -100px', scale: '1' });   // …to apart, at rest
    }
    clock = 5000; go(2, 1);                                                                      // at rest, apart: now back
    expect(played.slice(0, 4).every((a) => a.cancelled)).toBe(true);
    const back = ['a', 'b', 'c', 'd'].map((k) => setsOff(byPiece(k)));
    back.forEach((ms, i) => { const turn = 3 - i; expect(ms).toBeGreaterThan(turn * 35 - 1); expect(ms).toBeLessThanOrEqual(turn * 35 + FRAME + 1); });
    expect(valueAt(byPiece('a'), 0)).toBe(1);
  });

  it('settles a little under critical damping: a hint of weight past the target, then rest', () => {
    const { go } = mountDeck([{ in: ['*'] }, { focus: 'apart', options: { apart: 'a: 0 -100' } }]);
    go(1, 0);
    const a = byPiece('a'), values = a.frames.map((f) => -parseFloat(f.translate.split(' ')[1]) / 100);
    const most = Math.max(...values);
    expect(most).toBeGreaterThan(1);       // it overshoots…
    expect(most).toBeLessThan(1.03);       // …by a hint, not a bounce
    expect(a.timing.duration).toBeGreaterThan(400);
    expect(a.timing.duration).toBeLessThan(1500);
  });

  it('a reversal mid-way reschedules only the groups whose target changes, by their place in that shorter list: the earlier groups always lead', () => {
    const { go } = mountDeck([{ in: ['*'] }, { focus: 'apart', options: { apart: UP, stagger: 100 } }, {}]);
    go(1, 0);
    const opening = Object.fromEntries(['a', 'b', 'c', 'd'].map((k) => [k, byPiece(k)]));
    clock = 150; go(2, 1);   // a and b have set off; c and d were still waiting to
    expect(Object.values(opening).every((anim) => anim.cancelled)).toBe(true);
    // c and d never left: their target does not change, so they stay, and only a and b turn round — b, the later, first
    expect(byPiece('c')).toBe(undefined);
    expect(byPiece('d')).toBe(undefined);
    const a = byPiece('a'), b = byPiece('b');
    expect(valueAt(a, 0)).toBeCloseTo(valueAt(opening.a, 150), 2);   // each turns round from where it was
    expect(valueAt(b, 0)).toBeCloseTo(valueAt(opening.b, 150), 2);
    const peak = (anim) => anim.frames.reduce((m, f, i) => (-parseFloat(f.translate.split(' ')[1]) > -parseFloat(anim.frames[m].translate.split(' ')[1]) ? i : m), 0);
    const turnA = a.frames[peak(a)].offset * a.timing.duration, turnB = b.frames[peak(b)].offset * b.timing.duration;
    expect(turnB).toBeLessThan(turnA);
    expect(turnA).toBeGreaterThan(100 - FRAME);   // a keeps going out for one stagger before it turns
    // a leads b all the way in; where both settle home, each its hint past together (under 1.5 %), they may differ by that
    for (let ms = 0; ms <= Math.max(a.timing.duration, b.timing.duration); ms += 5) expect(valueAt(a, ms)).toBeGreaterThanOrEqual(valueAt(b, ms) - 0.015);
    for (let ms = 0; valueAt(b, ms) > 0.02; ms += 5) expect(valueAt(a, ms)).toBeGreaterThan(valueAt(b, ms));
    expect(a.frames.at(-1).translate).toBe('0px 0px');
  });

  it('a closing turned round mid-way: the groups on their way back go out again, in order; those still out stay', () => {
    const open = { focus: 'apart', options: { apart: UP, stagger: 100 } };
    const { go } = mountDeck([{ in: ['*'] }, open, {}, open]);
    go(1, 0); clock = 5000; go(2, 1);   // back in reverse: d at once, c 100 ms on, b at 200, a at 300
    const closing = { c: byPiece('c'), d: byPiece('d') };
    clock = 5150; go(3, 2);              // d and c are on their way back; b and a never left
    expect(byPiece('a')).toBe(undefined);
    expect(byPiece('b')).toBe(undefined);
    const c = byPiece('c'), d = byPiece('d');
    expect(valueAt(c, 0)).toBeCloseTo(valueAt(closing.c, 150), 2);
    expect(valueAt(d, 0)).toBeCloseTo(valueAt(closing.d, 150), 2);
    const low = (anim) => { const v = anim.frames.map((f) => (0 - parseFloat(f.translate.split(' ')[1])) / 100); return anim.frames[v.indexOf(Math.min(...v))].offset * anim.timing.duration; };
    expect(low(c)).toBeLessThan(low(d));          // c, the earlier, turns out first…
    expect(low(d)).toBeGreaterThan(100 - FRAME);  // …d keeps going home one stagger more
    for (let ms = 0; valueAt(d, ms) < 0.98; ms += 5) expect(valueAt(c, ms)).toBeGreaterThan(valueAt(d, ms));
  });

  it('a click that keeps a group\'s target leaves its spring alone, a pending start too', () => {
    const { go } = mountDeck([{ in: ['*'] }, { focus: 'apart', options: { apart: UP, stagger: 100 } }, { focus: 'apart', options: { apart: UP, stagger: 100 }, hot: ['a'] }]);
    go(1, 0);
    const first = byPiece('a');
    clock = 50; go(2, 1);
    // b, c and d were still waiting (due at 100, 200, 300): they keep their times — 50, 150 and 250 ms after this click
    [['b', 50], ['c', 150], ['d', 250]].forEach(([k, ms]) => { expect(setsOff(byPiece(k))).toBeGreaterThan(ms - 1); expect(setsOff(byPiece(k))).toBeLessThanOrEqual(ms + FRAME + 1); });
    expect(valueAt(byPiece('a'), 0)).toBeGreaterThan(0);   // a, already on its way, carries on from where it was
    expect(valueAt(byPiece('a'), 0)).toBeCloseTo(valueAt(first, 50), 2);
  });

  it('three quick clicks (0, 150, 260 ms, stagger 100): each click sets its groups off in order — a start still pending is rescheduled behind the earlier groups', () => {
    const two = 'c: 0 -100 | d: 0 -100';
    const { go } = mountDeck([{ in: ['*'] }, { focus: 'apart', options: { apart: UP, stagger: 100 } }, { focus: 'apart', options: { apart: two, stagger: 100 } }, { focus: 'apart', options: { apart: UP, stagger: 100 } }]);
    const within = (ms, at) => { expect(ms).toBeGreaterThan(at - 1); expect(ms).toBeLessThanOrEqual(at + FRAME + 1); };
    go(1, 0);
    clock = 150; go(2, 1);
    // a and b turn round in reverse (b at once, a 100 ms on); c and d, still waiting, keep their times (200 and 300 ms)
    const second = Object.fromEntries(['a', 'b', 'c', 'd'].map((k) => [k, byPiece(k)]));
    within(setsOff(second.c), 50);
    within(setsOff(second.d), 150);
    clock = 260; go(3, 2);
    // now a and b turn out again, a at once and b a stagger later; d, still waiting (due at 300), goes behind them
    const a = byPiece('a'), b = byPiece('b'), d = byPiece('d');
    // (the keyframes are the spring sampled 60 times a second: read between two, they agree to within a hundredth)
    expect(Math.abs(valueAt(a, 0) - valueAt(second.a, 110))).toBeLessThan(0.01);
    expect(Math.abs(valueAt(b, 0) - valueAt(second.b, 110))).toBeLessThan(0.01);
    const low = (anim) => { const v = anim.frames.map((f) => (0 - parseFloat(f.translate.split(' ')[1])) / 100); return anim.frames[v.indexOf(Math.min(...v))].offset * anim.timing.duration; };
    expect(low(a)).toBeLessThan(low(b));
    expect(low(b)).toBeGreaterThan(100 - FRAME);
    within(setsOff(d), 200);
    for (let ms = 0; ms <= Math.max(a.timing.duration, b.timing.duration, d.timing.duration); ms += 5) {
      expect(valueAt(a, ms)).toBeGreaterThanOrEqual(valueAt(b, ms) - 0.015);   // settling: each its hint past apart
      expect(valueAt(b, ms)).toBeGreaterThanOrEqual(valueAt(d, ms) - 0.015);
    }
    for (let ms = 0; valueAt(b, ms) < 0.98; ms += 5) expect(valueAt(a, ms)).toBeGreaterThan(valueAt(b, ms));
    for (let ms = 0; valueAt(d, ms) < 0.98; ms += 5) expect(valueAt(b, ms)).toBeGreaterThan(valueAt(d, ms));
    // c was on its way out already: left alone, it carries on from where it was
    expect(Math.abs(valueAt(byPiece('c'), 0) - valueAt(second.c, 110))).toBeLessThan(0.01);
  });

  it('a click right after a close lets the groups settle from wherever they are, instead of snapping home', () => {
    const { go } = mountDeck([{ in: ['*'] }, { focus: 'apart', options: { apart: UP } }, {}, { hot: ['b'] }]);
    go(1, 0); clock = 5000; go(2, 1);
    const closing = byPiece('a');
    clock = 5150; go(3, 2);
    const settling = byPiece('a');
    expect(closing.cancelled).toBe(true);
    expect(valueAt(settling, 0)).toBeCloseTo(valueAt(closing, 150), 2);
    expect(valueAt(settling, 0)).toBeGreaterThan(0.05);   // still on its way home…
    expect(settling.frames.at(-1)).toMatchObject({ offset: 1, translate: '0px 0px', scale: '1' });   // …and home at rest
  });

  it('reads where a group is from its animation\'s own clock when it has one (a paused or stepped timeline)', () => {
    const { go } = mountDeck([{ in: ['*'] }, { focus: 'apart', options: { apart: 'a: 0 -100' } }, {}]);
    go(1, 0);
    const opening = byPiece('a');
    opening.currentTime = 80;   // the page's clock says 0 ms went by; the animation says 80
    clock = 0; go(2, 1);
    expect(Math.abs(valueAt(byPiece('a'), 0) - valueAt(opening, 80))).toBeLessThan(0.01);
    played = [];
    const { go: again } = mountDeck([{ in: ['*'] }, { focus: 'apart', options: { apart: 'a: 0 -100' } }, {}]);
    again(1, 0);
    byPiece('a').currentTime = 1e9;   // finished (a stepper finished it): at rest, apart — whatever the page's clock says
    again(2, 1);
    expect(valueAt(byPiece('a'), 0)).toBe(1);
  });

  it('keeps each deck\'s springs its own: a second deck on the page moving never stops or replays the first', () => {
    const { html, pieces } = readPieces(MAP);
    const { looks } = planFocus([{ in: ['*'] }, { focus: 'apart', options: { apart: UP } }], { pieces });
    const deck = (id) => `<deck-stage id="${id}">${looks.map((l) => `<section>${drawFocus(html, l)}</section>`).join('')}</deck-stage>`;
    document.body.innerHTML = deck('A') + deck('B');
    const go = (id, index, previousIndex) => { const s = document.getElementById(id), slides = [...s.querySelectorAll('section')]; s.dispatchEvent(new CustomEvent('slidechange', { bubbles: true, detail: { index, previousIndex, slide: slides[index] } })); };
    go('A', 1, 0);
    const springsA = played.filter((p) => p.el.closest('#A'));
    expect(springsA.length).toBe(4);
    go('B', 0, 1);                                                  // deck B steps back: it lands…
    expect(document.querySelector('#B section').hasAttribute('data-sd-instant')).toBe(true);
    expect(springsA.every((p) => !p.cancelled)).toBe(true);        // …and deck A's springs play on
    go('A', 0, 1);                                                  // deck A steps back: its own land, B's mark stays
    expect(springsA.every((p) => p.cancelled)).toBe(true);
    expect(document.querySelector('#B section').hasAttribute('data-sd-instant')).toBe(true);
  });

  it('at rest the piece is exactly as drawn — together, the static art — for nothing of the spring is written on it', () => {
    const { slides, go } = mountDeck([{ in: ['*'] }, { focus: 'apart', options: { apart: UP } }, {}, {}]);
    const drawn = slides[2].innerHTML;
    go(1, 0); clock = 5000; go(2, 1);
    for (const k of ['a', 'b', 'c', 'd']) {
      const anim = byPiece(k);
      expect(anim.frames.at(-1)).toMatchObject({ offset: 1, translate: '0px 0px', scale: '1' });   // value 0: no move at all
      expect(anim.timing.fill).toBe('none');   // when it ends, nothing of it stays on the piece
    }
    expect(slides[2].innerHTML).toBe(drawn);   // no style, no transform attribute written
    expect(slides[2].querySelector('[transform]')).toBe(null);
    clock = 10000; go(3, 2);   // the click after: nothing opens or closes, nothing plays
    expect(played.filter((p) => !p.cancelled).length).toBe(0);
  });

  it('a page that already holds this runtime (or a newer one) installs it once; an older one (0.4.0\'s, no springs) does not keep it out', () => {
    expect(window.__sdFocusRuntime).toBe(2);
    focusRuntime();
    expect(added.filter(([type]) => type === 'slidechange').length).toBe(1);
    for (const [type, fn, opts] of added.splice(0)) document.removeEventListener(type, fn, opts);
    window.__sdFocusRuntime = true;
    focusRuntime();
    expect(window.__sdFocusRuntime).toBe(2);
    expect(added.filter(([type]) => type === 'slidechange').length).toBe(1);
  });

  it('runs inlined, as a built page has it: the springs need nothing from their module', () => {
    for (const [type, fn, opts] of added.splice(0)) document.removeEventListener(type, fn, opts);
    delete window.__sdFocusRuntime;
    new Function(`(${focusRuntime})()`)();
    const { go } = mountDeck([{ in: ['*'] }, { focus: 'apart', options: { apart: UP } }]);
    go(1, 0);
    expect(played.length).toBe(4);
    expect(byPiece('d').frames.at(-1)).toMatchObject({ offset: 1, translate: '0px -100px', scale: '1' });
  });

  it('a jump, a step back and reduced motion land at once; so does a browser without Element.animate', () => {
    const { go } = mountDeck([{ in: ['*'] }, { focus: 'apart', options: { apart: UP } }, {}]);
    go(1, 0);
    expect(played.length).toBe(4);
    go(0, 1);                                    // a step back: what was playing stops, nothing new plays
    expect(played.every((a) => a.cancelled)).toBe(true);
    expect(played.length).toBe(4);
    go(2, 0);                                    // a jump forward
    expect(played.length).toBe(4);
    window.matchMedia = (q) => ({ matches: /reduce/.test(q) });
    go(1, 0);
    expect(played.length).toBe(4);
    delete window.matchMedia;
    delete Element.prototype.animate;
    expect(() => go(1, 0)).not.toThrow();
  });
});
