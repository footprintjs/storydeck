import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { idleTour, tourPlan, tourText } from './tour';
import { notesData, listenRuntime } from './narrationHtml';

/** A <deck-stage> stand-in: index, goTo, and the slidechange a move dispatches (synchronously, as the real one does). */
function mountDeck(attrs = '', { later = false } = {}) {
  document.body.innerHTML = `<deck-stage ${attrs}><section></section><section></section><section></section><section></section><section></section></deck-stage>`;
  const stage = document.querySelector('deck-stage');
  stage.index = 0;
  const change = (i, previousIndex) => stage.dispatchEvent(new CustomEvent('slidechange', { bubbles: true, detail: { index: i, previousIndex, reason: 'api' } }));
  // `later`: the deck says so a moment after it moves, not during the call
  stage.goTo = vi.fn((i) => { const previousIndex = stage.index; stage.index = i; if (later) setTimeout(() => change(i, previousIndex), 0); else change(i, previousIndex); });
  return stage;
}
const visits = (stage) => stage.goTo.mock.calls.map(([i]) => i + 1);   // as the deck counts them
const fire = (el, type, init = {}) => el.dispatchEvent(Object.assign(new Event(type, { bubbles: true }), init));
const key = (k) => window.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
/** The tour's IntersectionObserver (vitest.setup.js keeps every one made), told where the deck is now. */
const sight = (...seen) => global.__iobs.at(-1).cb(seen.map((isIntersecting) => ({ isIntersecting })));
const QUIET = 45000;

let tours = [];
const tour = (stage, options) => { const t = idleTour(stage, options); tours.push(t); return t; };
beforeEach(() => { vi.useFakeTimers(); tours = []; });
afterEach(() => {
  tours.forEach((t) => t.stop());
  vi.useRealTimers();
  vi.restoreAllMocks();
  delete window.matchMedia;
  delete window.__sdTourPage;
  document.body.className = '';
  document.body.innerHTML = '';
});

describe('tour · the plan', () => {
  it('reads stops as the deck counts its clicks, each with a hold, and the waits — plain data a person or an LLM can read', () => {
    expect(tourPlan({ stops: '3 4 5 9:6s' })).toEqual({
      stops: [{ to: 3, hold: 3000 }, { to: 4, hold: 3000 }, { to: 5, hold: 3000 }, { to: 9, hold: 6000 }], idleMs: 1400, resumeMs: 45000, loop: true,
    });
    const plan = tourPlan({ stops: [2, 'lid:1500ms', { to: 'core', hold: '2s', say: 'the engine' }], hold: 2500, idleMs: '1s', resumeMs: 5000, loop: false });
    expect(plan).toEqual({ stops: [{ to: 2, hold: 2500 }, { to: 'lid', hold: 1500 }, { to: 'core', hold: 2000, say: 'the engine' }], idleMs: 1000, resumeMs: 5000, loop: false });
    expect(tourPlan(plan)).toEqual(plan);   // a plan reads as itself
  });

  it('says the tour in one line, for the deck\'s notes', () => {
    expect(tourText({ stops: '3 9:6s' })).toBe('Left alone for 1.4 s, it tours itself: slide 3 for 3 s, then slide 9 for 6 s, and round again. '
      + 'A key, tap, click or move hands it over until 45 s of quiet; Escape or "Stop tour" stops it.');
    expect(tourText({ stops: [{ to: 'lid', say: 'the lid lifts' }], loop: false })).toMatch(/^Left alone for 1.4 s, it tours itself: lid for 3 s \(the lid lifts\)\. /);
  });

  it('refuses what it cannot read, naming the fix', () => {
    expect(() => tourPlan({})).toThrow(/idleTour: give stops, the clicks that make the point, in order: '3 4 5 9:6s' \(data-tour\)/);
    expect(() => tourPlan(null)).toThrow(/idleTour: give options, \{stops, hold\?, idleMs\?, resumeMs\?, loop\?, go\?\} — not null/);
    expect(() => tourPlan({ stops: '0 2' })).toThrow(/a stop goes to a click as the deck counts them \(1, 2, …\) or to a name, not 0/);
    expect(() => tourPlan({ stops: [1.5] })).toThrow(/not 1.5/);
    expect(() => tourPlan({ stops: '3:soon' })).toThrow(/the hold of stop 3 is a time — 1400, '1400ms' or '1.4s', from 300 ms up to ten minutes — not "soon"/);
    expect(() => tourPlan({ stops: '3:200ms' })).toThrow(/the hold of stop 3 is a time .* from 300 ms .* not "200ms"/);   // a flicker, not a stop
    expect(() => tourPlan({ stops: '3', hold: 100 })).toThrow(/hold is a time .* from 300 ms .* not 100/);
    expect(tourPlan({ stops: '3:300ms' }).stops[0].hold).toBe(300);
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

  it('a key, a tap, a click or a focus hands it over; it takes the deck back only after a long quiet (45 s)', () => {
    const stage = mountDeck();
    const t = tour(stage, { stops: '2 3 4' });
    vi.advanceTimersByTime(1400);
    expect(visits(stage)).toEqual([2]);
    fire(stage, 'pointerdown');
    expect(t.state).toBe('paused');
    vi.advanceTimersByTime(20000);
    fire(stage, 'focusin');                     // more use, 20 s on: the quiet starts again
    vi.advanceTimersByTime(30000);
    key('ArrowRight');
    vi.advanceTimersByTime(QUIET - 1);
    expect(visits(stage)).toEqual([2]);
    vi.advanceTimersByTime(1);
    expect(visits(stage)).toEqual([2, 3]);
    expect(t.state).toBe('touring');
  });

  it('counts a real move of the pointer, looked at every 250 ms — not a resting pointer, and not a finger lifting off', () => {
    const stage = mountDeck();
    const t = tour(stage, { stops: '2 3' });
    const move = (x, y) => fire(stage, 'pointermove', { clientX: x, clientY: y });
    move(100, 100);                              // the first sighting only marks where it is
    vi.advanceTimersByTime(300);
    move(101, 101);                              // a twitch, or the deck moving under a resting pointer: no move
    expect(t.state).toBe('waiting');
    move(300, 300);                              // within 250 ms of the last look: not looked at
    expect(t.state).toBe('waiting');
    vi.advanceTimersByTime(300);
    move(140, 100);                              // a real move
    expect(t.state).toBe('paused');
    fire(stage, 'pointerleave');                 // a finger lifted off a touch screen: nothing
    fire(stage, 'pointerout');
    vi.advanceTimersByTime(QUIET - 1);
    expect(visits(stage)).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(visits(stage)).toEqual([2]);
  });

  it('comes back sooner once the deck has left sight and come back: it waits 1.4 s again', () => {
    const stage = mountDeck();
    const t = tour(stage, { stops: '2 3' });
    fire(stage, 'pointerdown');
    expect(t.state).toBe('paused');
    sight(false);
    expect(t.state).toBe('hidden');
    sight(true);
    expect(t.state).toBe('waiting');
    vi.advanceTimersByTime(1400);
    expect(visits(stage)).toEqual([2]);
  });

  it('picks up from where someone left the deck, when that is one of its stops', () => {
    const stage = mountDeck();
    tour(stage, { stops: '2 3 4' });
    vi.advanceTimersByTime(1400);
    expect(visits(stage)).toEqual([2]);
    stage.goTo(3);                              // someone steps on to click 4 (a stop): a move the tour did not make
    vi.advanceTimersByTime(QUIET);
    expect(visits(stage)).toEqual([2, 4, 2]);   // after 4 comes 2, round again — not 3, which would step back
    stage.goTo(4);                              // click 5 is no stop: after the quiet the tour goes on from its own place
    vi.advanceTimersByTime(QUIET);
    expect(visits(stage)).toEqual([2, 4, 2, 5, 3]);
  });

  it('its own moves are not someone\'s — even when the deck says so later — and a move it did not make is (but not the deck showing its first slide)', () => {
    const stage = mountDeck('', { later: true });
    const t = tour(stage, { stops: '2 3' });
    vi.advanceTimersByTime(1400);
    vi.advanceTimersByTime(0);                  // the deck's slidechange for the tour's own move arrives now
    expect(visits(stage)).toEqual([2]);
    expect(t.state).toBe('touring');
    stage.dispatchEvent(new CustomEvent('slidechange', { detail: { index: 0, previousIndex: -1, reason: 'init' } }));
    expect(t.state).toBe('touring');
    stage.dispatchEvent(new CustomEvent('slidechange', { detail: { index: 4, previousIndex: 1, reason: 'api' } }));   // the presenter window moved it
    expect(t.state).toBe('paused');
  });

  it('a figure\'s go that moves focus inside it is still the tour\'s own move', () => {
    document.body.innerHTML = '<figure><button>lid</button><button>core</button></figure>';
    const figure = document.querySelector('figure'), [lid, core] = figure.querySelectorAll('button');
    const t = tour(figure, { stops: ['lid', 'core'], go: (part) => (part === 'lid' ? lid : core).dispatchEvent(new Event('focusin', { bubbles: true })) });
    vi.advanceTimersByTime(1400);
    expect(t.state).toBe('touring');
  });

  it('Escape stops every tour for the rest of the page view', () => {
    const stage = mountDeck();
    const t = tour(stage, { stops: '2 3' });
    key('Escape');
    expect(t.state).toBe('off');
    expect(stage.hasAttribute('data-tour-state')).toBe(false);
    vi.advanceTimersByTime(QUIET * 2);
    expect(visits(stage)).toEqual([]);
    expect(tour(stage, { stops: '2 3' }).state).toBe('off');   // asked again, on this page view: it stays stopped
    vi.advanceTimersByTime(QUIET);
    expect(visits(stage)).toEqual([]);
  });

  it('offers a visible "Stop tour" control while a tour can move, which stops it for good (WCAG 2.2.2)', () => {
    const stage = mountDeck();
    const t = tour(stage, { stops: '2 3' });
    const control = document.querySelector('button[data-tour-stop]');
    expect(control.textContent).toBe('Stop tour');
    expect(control.hidden).toBe(false);
    expect(document.getElementById('sd-tour-style').textContent).toMatch(/^:where\(\.sd-tour-stop\)\{position:fixed/);   // as weak as can be: a page restyles it
    control.click();
    expect(t.state).toBe('off');
    expect(document.querySelector('[data-tour-stop]')).toBe(null);   // no tour left: the control goes
    vi.advanceTimersByTime(QUIET);
    expect(visits(stage)).toEqual([]);
  });

  it('uses the page\'s own control when it has one (any element marked data-tour-stop), and adds none', () => {
    const stage = mountDeck();
    document.body.insertAdjacentHTML('beforeend', '<a href="#" data-tour-stop>pause the demo</a>');
    const t = tour(stage, { stops: '2 3' });
    expect(document.querySelectorAll('[data-tour-stop]').length).toBe(1);
    document.querySelector('[data-tour-stop]').click();
    expect(t.state).toBe('off');
    expect(document.querySelector('[data-tour-stop]')).not.toBe(null);   // the page's own stays
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

  it('under reduced motion there is no tour, and no control to stop one', () => {
    const listeners = [], reduce = { matches: true, addEventListener: (_, fn) => listeners.push(fn), removeEventListener() {} };
    window.matchMedia = (q) => (/reduce/.test(q) ? reduce : { matches: false });
    const stage = mountDeck();
    const t = tour(stage, { stops: '2 3' });
    expect(t.state).toBe('still');
    expect(document.querySelector('[data-tour-stop]')).toBe(null);
    vi.advanceTimersByTime(60000);
    expect(visits(stage)).toEqual([]);
    sight(false); sight(true);
    expect(t.state).toBe('still');
    reduce.matches = false;
    listeners.forEach((fn) => fn());            // the reader turned motion back on
    vi.advanceTimersByTime(1400);
    expect(visits(stage)).toEqual([2]);
    expect(document.querySelector('[data-tour-stop]').hidden).toBe(false);
  });

  it('waits while listen mode plays the deck (narrationHtml · listenRuntime marks it data-listening)', () => {
    window.speechSynthesis = { speaking: false, cancel() {}, pause() {}, resume() {}, speak() {}, getVoices: () => [], addEventListener() {} };
    window.SpeechSynthesisUtterance = function (t) { this.text = t; };
    const stage = mountDeck();
    document.body.insertAdjacentHTML('beforeend', notesData([{ now: ['One.'] }, { now: ['Two.'] }, { now: ['Three.'] }]));
    const added = [], addListener = window.addEventListener.bind(window);
    vi.spyOn(window, 'addEventListener').mockImplementation((type, fn, opts) => { added.push([type, fn, opts]); addListener(type, fn, opts); });
    try {
      listenRuntime();
      const t = tour(stage, { stops: '2 3', resumeMs: 2000 });
      stage.setAttribute('data-listening', '');   // as listen mode does when it starts (its L key would also be use)
      expect(stage.hasAttribute('data-listening')).toBe(true);
      vi.advanceTimersByTime(60000);
      expect(visits(stage)).toEqual([]);
      expect(t.state).toBe('paused');
      key('l'); key('l');                          // L starts listen mode — and L again stops it: the deck is let go
      expect(stage.hasAttribute('data-listening')).toBe(false);
      vi.advanceTimersByTime(2000);
      expect(visits(stage)).toEqual([2]);
      key('l');                                    // started by its key: marked, and the tour, used, waits
      expect(stage.hasAttribute('data-listening')).toBe(true);
      vi.advanceTimersByTime(60000);
      expect(visits(stage)).toEqual([2]);
      key('l');
    } finally {
      for (const [type, fn, opts] of added) window.removeEventListener(type, fn, opts);
      delete window.speechSynthesis;
      document.querySelectorAll('.train-panel').forEach((p) => p.remove());
    }
  });

  it('a tour that does not loop stops at its last stop', () => {
    const stage = mountDeck();
    const t = tour(stage, { stops: '2 3', loop: false, hold: 1000 });
    vi.advanceTimersByTime(1400 + 1000 + 1000);
    expect(visits(stage)).toEqual([2, 3]);
    expect(t.state).toBe('done');
    fire(stage, 'pointerdown');
    vi.advanceTimersByTime(QUIET * 2);
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

  it('called with nothing, it tours every deck that carries data-tour — one it cannot read is said and left out — and stop() lets go of everything', () => {
    const stage = mountDeck('data-tour="2 3:2s" data-tour-hold="1s" data-tour-idle="500ms" data-tour-resume="2s"');
    document.body.insertAdjacentHTML('beforeend', '<deck-stage id="bad" data-tour="2:50ms"></deck-stage>');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const inlined = new Function(`return (${idleTour})`)();   // as a built page inlines it: it needs nothing from its module
    const toured = idleTour();
    tours.push(...toured);
    expect(toured.length).toBe(1);
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/^footprint-storydeck · <deck-stage data-tour="2:50ms"> does not tour: idleTour: the hold of stop 2 is a time .* not "50ms"/));
    const [t] = toured;
    expect(t.plan).toEqual({ stops: [{ to: 2, hold: 1000 }, { to: 3, hold: 2000 }], idleMs: 500, resumeMs: 2000, loop: true });
    expect(inlined().length).toBe(0);           // once per deck, however often it is called — inlined too (the bad one said again)
    expect(warn).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(500);
    expect(visits(stage)).toEqual([2]);
    t.stop();
    expect(t.state).toBe('off');
    expect(stage.hasAttribute('data-tour-state')).toBe(false);
    vi.advanceTimersByTime(60000);
    fire(stage, 'pointerdown');
    expect(visits(stage)).toEqual([2]);
    const again = inlined();
    tours.push(...again);
    expect(again.length).toBe(1);               // stopped by the page's code (not the person), it can be toured again
  });
});
