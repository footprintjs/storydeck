import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { idleTour, tourPlan, tourText } from './tour';

/** A <deck-stage> stand-in: index, goTo, and the slidechange a move dispatches (synchronously, as the real one does). */
function mountDeck(attrs = '') {
  document.body.innerHTML = `<deck-stage ${attrs}><section></section><section></section><section></section><section></section><section></section></deck-stage>`;
  const stage = document.querySelector('deck-stage');
  stage.index = 0;
  stage.goTo = vi.fn((i) => { const previousIndex = stage.index; stage.index = i; stage.dispatchEvent(new CustomEvent('slidechange', { bubbles: true, detail: { index: i, previousIndex, reason: 'api' } })); });
  return stage;
}
const visits = (stage) => stage.goTo.mock.calls.map(([i]) => i + 1);   // as the deck counts them
const fire = (el, type) => el.dispatchEvent(new Event(type, { bubbles: type !== 'pointerenter' && type !== 'pointerleave' }));
/** The tour's IntersectionObserver (vitest.setup.js keeps every one made), told where the deck is now. */
const sight = (...seen) => global.__iobs.at(-1).cb(seen.map((isIntersecting) => ({ isIntersecting })));

let tours = [];
const tour = (stage, options) => { const t = idleTour(stage, options); tours.push(t); return t; };
beforeEach(() => { vi.useFakeTimers(); tours = []; });
afterEach(() => {
  tours.forEach((t) => t.stop());
  vi.useRealTimers();
  delete window.matchMedia;
  document.body.className = '';
  document.body.innerHTML = '';
});

describe('tour · the plan', () => {
  it('reads stops as the deck counts its clicks, each with a hold, and the waits — plain data a person or an LLM can read', () => {
    expect(tourPlan({ stops: '3 4 5 9:6s' })).toEqual({
      stops: [{ to: 3, hold: 3000 }, { to: 4, hold: 3000 }, { to: 5, hold: 3000 }, { to: 9, hold: 6000 }], idleMs: 1400, resumeMs: 3600, loop: true,
    });
    const plan = tourPlan({ stops: [2, 'lid:1500ms', { to: 'core', hold: '2s', say: 'the engine' }], hold: 2500, idleMs: '1s', resumeMs: 5000, loop: false });
    expect(plan).toEqual({ stops: [{ to: 2, hold: 2500 }, { to: 'lid', hold: 1500 }, { to: 'core', hold: 2000, say: 'the engine' }], idleMs: 1000, resumeMs: 5000, loop: false });
    expect(tourPlan(plan)).toEqual(plan);   // a plan reads as itself
  });

  it('says the tour in one line, for the deck\'s notes', () => {
    expect(tourText({ stops: '3 9:6s' })).toBe('Left alone for 1.4 s, it tours itself: slide 3 for 3 s, then slide 9 for 6 s, and round again. '
      + 'A hover, focus, key or press pauses it; it picks up 3.6 s after the last, and waits while out of sight.');
    expect(tourText({ stops: [{ to: 'lid', say: 'the lid lifts' }], loop: false })).toMatch(/^Left alone for 1.4 s, it tours itself: lid for 3 s \(the lid lifts\)\. /);
  });

  it('refuses what it cannot read, naming the fix', () => {
    expect(() => tourPlan({})).toThrow(/idleTour: give stops, the clicks that make the point, in order: '3 4 5 9:6s' \(data-tour\)/);
    expect(() => tourPlan(null)).toThrow(/idleTour: give options, \{stops, hold\?, idleMs\?, resumeMs\?, loop\?, go\?\} — not null/);
    expect(() => tourPlan({ stops: '0 2' })).toThrow(/a stop goes to a click as the deck counts them \(1, 2, …\) or to a name, not 0/);
    expect(() => tourPlan({ stops: [1.5] })).toThrow(/not 1.5/);
    expect(() => tourPlan({ stops: '3:soon' })).toThrow(/the hold of stop 3 is a time — 1400, '1400ms' or '1.4s', up to ten minutes — not "soon"/);
    expect(() => tourPlan({ stops: '3', idleMs: -1 })).toThrow(/idleMs is a time .* not -1/);
    expect(() => tourPlan({ stops: '3', resumeMs: '1h' })).toThrow(/resumeMs is a time .* not "1h"/);
    expect(() => tourPlan({ stops: [{ to: 3, say: 7 }] })).toThrow(/a stop's say is a line of text saying what it shows, not 7/);
    expect(() => tourPlan({ stops: '3', loop: 'yes' })).toThrow(/loop is true \(round again, the default\) or false \(stop at the last\), not "yes"/);
    expect(() => tourPlan({ stops: [{}] })).toThrow(/not undefined/);
  });
});

describe('tour · in the page', () => {
  it('when nobody has touched it for 1.4 s, it goes to each stop as a person would, holds it, and goes round again', () => {
    const stage = mountDeck();
    const t = tour(stage, { stops: '2 3:5s' });
    expect(t.state).toBe('waiting');
    expect(stage.getAttribute('data-tour-state')).toBe('waiting');
    vi.advanceTimersByTime(1399);
    expect(visits(stage)).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(visits(stage)).toEqual([2]);
    expect(t.state).toBe('touring');
    vi.advanceTimersByTime(3000);
    expect(visits(stage)).toEqual([2, 3]);
    vi.advanceTimersByTime(4999);
    expect(visits(stage)).toEqual([2, 3]);
    vi.advanceTimersByTime(1);
    expect(visits(stage)).toEqual([2, 3, 2]);   // round again
  });

  it('pauses on a press, a focus or a key, and picks up 3.6 s after the last of them, at the next stop', () => {
    const stage = mountDeck();
    const t = tour(stage, { stops: '2 3 4' });
    vi.advanceTimersByTime(1400);
    expect(visits(stage)).toEqual([2]);
    vi.advanceTimersByTime(1000);
    fire(stage, 'pointerdown');
    expect(t.state).toBe('paused');
    vi.advanceTimersByTime(2000);
    fire(stage, 'focusin');                     // another touch, 2 s on: the wait starts again
    vi.advanceTimersByTime(3000);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    vi.advanceTimersByTime(3599);
    expect(visits(stage)).toEqual([2]);
    vi.advanceTimersByTime(1);
    expect(visits(stage)).toEqual([2, 3]);
    expect(t.state).toBe('touring');
  });

  it('picks up from where someone left the deck, when that is one of its stops', () => {
    const stage = mountDeck();
    tour(stage, { stops: '2 3 4' });
    vi.advanceTimersByTime(1400);
    expect(visits(stage)).toEqual([2]);
    stage.goTo(3);                              // someone steps on to click 4 (a stop): a move the tour did not make
    vi.advanceTimersByTime(3600);
    expect(visits(stage)).toEqual([2, 4, 2]);   // after 4 comes 2, round again — not 3, which would step back
    stage.goTo(4);                              // click 5 is no stop: the tour goes on from its own place
    vi.advanceTimersByTime(3600);
    expect(visits(stage)).toEqual([2, 4, 2, 5, 3]);
  });

  it('holds still while the pointer is over it, and picks up 3.6 s after it leaves', () => {
    const stage = mountDeck();
    const t = tour(stage, { stops: '2 3' });
    fire(stage, 'pointerenter');
    vi.advanceTimersByTime(60000);
    expect(visits(stage)).toEqual([]);
    expect(t.state).toBe('paused');
    fire(stage, 'pointerleave');
    vi.advanceTimersByTime(3599);
    expect(visits(stage)).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(visits(stage)).toEqual([2]);
  });

  it('a pointer resting on it as it comes back into sight still holds it', () => {
    const stage = mountDeck();
    const t = tour(stage, { stops: '2 3' });
    sight(false);
    fire(stage, 'pointerenter');
    sight(true);
    vi.advanceTimersByTime(60000);
    expect(visits(stage)).toEqual([]);
    expect(t.state).toBe('paused');
  });

  it('its own moves are not someone\'s; a move it did not make is (but not the deck showing its first slide)', () => {
    const stage = mountDeck();
    const t = tour(stage, { stops: '2 3' });
    vi.advanceTimersByTime(1400);
    expect(t.state).toBe('touring');            // its own goTo dispatched a slidechange, and it carried on
    stage.dispatchEvent(new CustomEvent('slidechange', { detail: { index: 0, previousIndex: -1, reason: 'init' } }));
    expect(t.state).toBe('touring');
    stage.dispatchEvent(new CustomEvent('slidechange', { detail: { index: 4, previousIndex: 1, reason: 'api' } }));   // the presenter window moved it
    expect(t.state).toBe('paused');
  });

  it('waits while the deck is out of sight — reading the newest entry — and while the page is hidden', () => {
    const stage = mountDeck();
    const t = tour(stage, { stops: '2 3' });
    sight(true, false);                         // a batch: the last entry is where it is now
    expect(t.state).toBe('hidden');
    vi.advanceTimersByTime(10000);
    expect(visits(stage)).toEqual([]);
    fire(stage, 'pointerdown');                 // a touch while away changes nothing
    expect(t.state).toBe('hidden');
    sight(false, true);
    expect(t.state).toBe('waiting');
    vi.advanceTimersByTime(1400);
    expect(visits(stage)).toEqual([2]);
    const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    document.dispatchEvent(new Event('visibilitychange'));
    expect(t.state).toBe('hidden');
    vi.advanceTimersByTime(10000);
    expect(visits(stage)).toEqual([2]);
    hidden.mockReturnValue(false);
    document.dispatchEvent(new Event('visibilitychange'));
    vi.advanceTimersByTime(1400);
    expect(visits(stage)).toEqual([2, 3]);
  });

  it('under reduced motion there is no tour', () => {
    const listeners = [], reduce = { matches: true, addEventListener: (_, fn) => listeners.push(fn), removeEventListener() {} };
    window.matchMedia = (q) => (/reduce/.test(q) ? reduce : { matches: false });
    const stage = mountDeck();
    const t = tour(stage, { stops: '2 3' });
    expect(t.state).toBe('still');
    vi.advanceTimersByTime(60000);
    expect(visits(stage)).toEqual([]);
    sight(false); sight(true);
    expect(t.state).toBe('still');
    reduce.matches = false;
    listeners.forEach((fn) => fn());            // the reader turned motion back on
    vi.advanceTimersByTime(1400);
    expect(visits(stage)).toEqual([2]);
  });

  it('yields to listen mode, which plays the deck itself', () => {
    const stage = mountDeck();
    const t = tour(stage, { stops: '2 3' });
    document.body.classList.add('train');
    vi.advanceTimersByTime(1400);
    expect(visits(stage)).toEqual([]);
    expect(t.state).toBe('paused');
    document.body.classList.remove('train');
    vi.advanceTimersByTime(3600);
    expect(visits(stage)).toEqual([2]);
  });

  it('a tour that does not loop stops at its last stop', () => {
    const stage = mountDeck();
    const t = tour(stage, { stops: '2 3', loop: false, hold: 1000 });
    vi.advanceTimersByTime(1400 + 1000 + 1000);
    expect(visits(stage)).toEqual([2, 3]);
    expect(t.state).toBe('done');
    fire(stage, 'pointerdown');
    vi.advanceTimersByTime(60000);
    expect(visits(stage)).toEqual([2, 3]);
  });

  it('tours a figure through its own function, by its own names', () => {
    document.body.innerHTML = '<figure></figure>';
    const shown = [];
    tour(document.querySelector('figure'), { stops: ['lid', 'core'], go: (part) => shown.push(part), hold: 2000 });
    vi.advanceTimersByTime(1400 + 2000);
    expect(shown).toEqual(['lid', 'core']);
  });

  it('refuses a stage it cannot drive, naming the fix', () => {
    document.body.innerHTML = '<figure></figure>';
    const figure = document.querySelector('figure');
    expect(() => idleTour(figure, { stops: '2' })).toThrow(/idleTour: <figure> has no goTo\(index\) — tour a <deck-stage>, or give go\(to\)/);
    expect(() => idleTour(mountDeck(), { stops: 'lid' })).toThrow(/a deck's stop is a click as the deck counts them \(1, 2, …\), not "lid" — or give go\(to\)/);
    expect(() => idleTour({}, { stops: '2' })).toThrow(/the stage is the element people use/);
    expect(() => idleTour(figure, { stops: '2', go: 'next' })).toThrow(/go is the function a person's click calls, go\(to\) — not "next"/);
    // a <deck-stage> whose script has not run yet is fine: it is driven once it can be
    document.body.innerHTML = '<deck-stage></deck-stage>';
    expect(tour(document.querySelector('deck-stage'), { stops: '2' }).state).toBe('waiting');
    vi.advanceTimersByTime(1400);
  });

  it('called with nothing, it tours every deck that carries data-tour; stop() lets go of everything', () => {
    const stage = mountDeck('data-tour="2 3:2s" data-tour-hold="1s" data-tour-idle="500ms" data-tour-resume="2s"');
    const inlined = new Function(`return (${idleTour})`)();   // as a built page inlines it: it needs nothing from its module
    const [t] = inlined();
    tours.push(t);
    expect(t.plan).toEqual({ stops: [{ to: 2, hold: 1000 }, { to: 3, hold: 2000 }], idleMs: 500, resumeMs: 2000, loop: true });
    expect(idleTour()).toEqual([]);             // once per deck, however often it is called
    vi.advanceTimersByTime(500);
    expect(visits(stage)).toEqual([2]);
    t.stop();
    expect(t.state).toBe('off');
    expect(stage.hasAttribute('data-tour-state')).toBe(false);
    vi.advanceTimersByTime(60000);
    fire(stage, 'pointerdown');
    expect(visits(stage)).toEqual([2]);
    const again = idleTour();
    tours.push(...again);
    expect(again.length).toBe(1);               // stopped, it can be toured again
  });
});
