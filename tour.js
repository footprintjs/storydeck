// tour — a deck or a figure that shows its point by itself while nobody is using it.
//
// A page people interact with — a deck left on a screen with nobody presenting it, an exploded figure on a post — is
// often looked at by someone who has not touched it yet. Left alone for a moment (1.4 s), it plays a short loop of
// stops, the clicks that make its point, and it drives the SAME targets a person would: the deck's own goTo, so a
// stop one click on animates as that click does (focus, apart's springs and all), or the figure's own function. There
// is no second animation to keep in step.
//
// Accessibility first. The moment someone uses it — a key, a tap, a click, a real move of the pointer over it — it
// hands itself over, and it does not take the deck back soon: only after a long quiet (45 s) or once the deck has
// left sight and come back. Escape, or the "Stop tour" control (or any element marked data-tour-stop), stops every
// tour for the rest of the page view (WCAG 2.2.2). It waits while out of sight, and under reduced motion it never runs.
//
//   idleTour(deck, { stops: '3 4 5 9:6s' })                       // clicks 3, 4, 5, then 9 held 6 s, and round again
//   idleTour(figure, { stops: ['lid', 'core'], go: (part) => show(part) })
//   <deck-stage data-tour="3 4 5 9:6s" data-tour-hold="3s">        // and `(${idleTour})()` once in a built page
//
// The plan is plain data — the stops, how long each is held, the waits — that a person or an LLM can read, and that
// the deck's notes can say in a line (tourText).

/**
 * Tours a deck (any element with goTo(index), as <deck-stage> has) or, given `go`, a figure; returns {plan, state,
 * stop()}. Called with no arguments — `(${idleTour})()` inlined in a built page — it tours every element carrying
 * data-tour (data-tour-hold, data-tour-idle, data-tour-resume) and returns those tours; one it cannot read is left
 * out with a console warning naming the fix, and the others still tour. Self-contained, so it inlines. `stage` null
 * reads the plan only (tourPlan); nothing runs.
 */
export function idleTour(stage, options) {
  // ── the plan: read and checked here, the one reader (tourPlan is this, without a page) ──
  const refuse = (fix) => { throw new Error(`idleTour: ${fix}`); };
  const shown = (v) => (typeof v === 'number' || v === undefined ? String(v) : JSON.stringify(v));
  /** A time in ms: 1400, '1400ms', '1400' or '1.4s' — from `least` up to ten minutes; `d` when left out. */
  const time = (v, d, what, least = 0) => {
    if (v === undefined || v === null || v === '') return d;
    const m = typeof v === 'number' ? null : /^\s*(\d+(?:\.\d+)?)\s*(ms|s)?\s*$/.exec(String(v));
    const ms = typeof v === 'number' ? v : m ? Number(m[1]) * (m[2] === 's' ? 1000 : 1) : NaN;
    return ms >= least && ms <= 600000 ? ms : refuse(`${what} is a time — 1400, '1400ms' or '1.4s', from ${least} ms up to ten minutes — not ${shown(v)}`);
  };
  /** One stop: a click as the deck counts them (3), a figure's own name ('lid'), 'to:hold' ('9:6s'), or {to, hold?, say?}. */
  const stopOf = (x, hold) => {
    const o = x !== null && typeof x === 'object' ? x : typeof x === 'number' ? {to: x} : (() => {
      const m = /^([^\s:]+)(?::(\S+))?$/.exec(String(x ?? '').trim());
      return m ? {to: /^\d+$/.test(m[1]) ? Number(m[1]) : m[1], hold: m[2]} : refuse(`a stop is a click (3), a name ('lid') or either with a hold ('9:6s'), not ${shown(x)}`);
    })();
    if (typeof o.to === 'number' ? !(Number.isInteger(o.to) && o.to >= 1) : typeof o.to !== 'string' || !o.to.trim()) refuse(`a stop goes to a click as the deck counts them (1, 2, …) or to a name, not ${shown(o.to)}`);
    if (o.say !== undefined && typeof o.say !== 'string') refuse(`a stop's say is a line of text saying what it shows, not ${shown(o.say)}`);
    // a stop is held long enough to be seen: under 300 ms the deck would flicker
    return {to: o.to, hold: time(o.hold, hold, `the hold of stop ${shown(o.to)}`, 300), ...(o.say ? {say: o.say} : {})};
  };
  const planOf = (o) => {
    if (!o || typeof o !== 'object') refuse(`give options, {stops, hold?, idleMs?, resumeMs?, loop?, go?} — not ${shown(o)}`);
    const list = typeof o.stops === 'string' ? o.stops.trim().split(/\s+/).filter(Boolean) : Array.isArray(o.stops) ? o.stops : [];
    if (!list.length) refuse(`give stops, the clicks that make the point, in order: '3 4 5 9:6s' (data-tour), or [3, 4, {to: 9, hold: 6000, say: 'the recorders light up'}]`);
    if (o.loop !== undefined && typeof o.loop !== 'boolean') refuse(`loop is true (round again, the default) or false (stop at the last), not ${shown(o.loop)}`);
    const hold = time(o.hold, 3000, 'hold', 300);
    return {stops: list.map((x) => stopOf(x, hold)), idleMs: time(o.idleMs, 1400, 'idleMs'), resumeMs: time(o.resumeMs, 45000, 'resumeMs'), loop: o.loop !== false};
  };
  const fromAttrs = (el) => {
    const at = (name) => el.getAttribute(name) ?? undefined;
    return {stops: at('data-tour'), hold: at('data-tour-hold'), idleMs: at('data-tour-idle'), resumeMs: at('data-tour-resume')};
  };
  if (stage === undefined) {
    // one deck the tour cannot read is left out, said aloud, and the others still tour
    return [...document.querySelectorAll('[data-tour]')].filter((el) => !el.__sdTour).flatMap((el) => {
      try { return [idleTour(el, fromAttrs(el))]; } catch (e) {
        console.warn(`footprint-storydeck · <${el.localName} data-tour="${el.getAttribute('data-tour')}"> does not tour: ${e.message}`);
        return [];
      }
    });
  }
  const plan = planOf(options);
  if (stage === null) return {plan, state: 'off', stop() {}};

  // ── the stage: a deck's own goTo, or the figure's go ──
  if (!stage || typeof stage.addEventListener !== 'function') refuse('the stage is the element people use — a <deck-stage>, or a figure\'s element with go(to)');
  if (options.go !== undefined && typeof options.go !== 'function') refuse(`go is the function a person's click calls, go(to) — not ${shown(options.go)}`);
  const deck = !options.go, tag = String(stage.localName ?? '');
  if (deck) {
    const name = plan.stops.find((s) => typeof s.to !== 'number');
    if (name) refuse(`a deck's stop is a click as the deck counts them (1, 2, …), not ${shown(name.to)} — or give go(to), and the names are the figure's`);
    const later = tag.includes('-') && window.customElements && !customElements.get(tag);   // its script has not run yet
    if (typeof stage.goTo !== 'function' && !later) refuse(`<${tag}> has no goTo(index) — tour a <deck-stage>, or give go(to)`);
  }
  const go = deck ? (to) => { if (typeof stage.goTo === 'function') stage.goTo(to - 1); } : options.go;

  // ── the page: a person's "stop the tour" holds for the whole page view, and one control offers it ──
  const page = window.__sdTourPage ??= {off: false, tours: new Set(), control: null};
  const tour = {plan, get state() { return state; }, stop: () => end()};
  let state = 'off', timer = 0, at = -1, seen = true, moving = false, own = null, ref = null;
  const offs = [], on = (target, type, fn, opts) => { target.addEventListener(type, fn, opts); offs.push(() => target.removeEventListener(type, fn, opts)); };
  const moves = (t) => t.state !== 'off' && t.state !== 'still' && t.state !== 'done';   // a tour that can still move the deck
  const inView = (t) => moves(t) && t.state !== 'hidden';   // …and can be seen to: the control shows only then
  if (page.off) return tour;   // stopped by the person earlier in this page view: it stays stopped
  const showControl = () => {
    const alive = [...page.tours].some(inView);
    if (page.control?.isConnected) { if (page.control.hasAttribute('data-sd-made')) page.control.hidden = !alive; return; }
    if (!alive || document.querySelector('[data-tour-stop]')) return;   // the page's own control is the one
    if (!document.getElementById('sd-tour-style')) {
      const css = document.createElement('style');
      css.id = 'sd-tour-style';
      css.textContent = ':where(.sd-tour-stop){position:fixed;left:16px;bottom:16px;z-index:2147483000;padding:8px 14px;border-radius:999px;'
        + 'border:1px solid currentColor;background:rgba(11,16,32,.72);color:#fff;font:600 14px/1 system-ui,sans-serif;cursor:pointer}';
      document.head.append(css);
    }
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'sd-tour-stop'; b.textContent = 'Stop tour';
    b.setAttribute('data-tour-stop', ''); b.setAttribute('data-sd-made', '');
    // its accessible name is its visible words (WCAG 2.5.3); what it does is said in its title
    b.title = 'Stops every tour on this page: the deck stays where you leave it';
    document.body.append(b);
    page.control = b;
  };

  // ── the runtime ──
  stage.__sdTour?.stop();
  const motion = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  // narrationHtml.js · listenRuntime marks the deck data-listening while it plays it: someone is presenting, so it waits
  const listening = () => stage.hasAttribute('data-listening');
  const set = (s) => { state = s; stage.setAttribute('data-tour-state', s); showControl(); };
  const wait = (ms, then) => { clearTimeout(timer); timer = setTimeout(then, ms); };
  const away = () => !seen || document.hidden;
  const arm = () => { if (motion?.matches) { clearTimeout(timer); set('still'); } else if (away()) { clearTimeout(timer); set('hidden'); } else { set('waiting'); wait(plan.idleMs, next); } };
  /** Someone is using it: hand it over, and take it back only after a long quiet (or once it has left sight and come back). */
  const use = () => {
    if (moving || state === 'off' || state === 'still' || state === 'hidden' || state === 'done') return;
    clearTimeout(timer); set('paused');
    wait(plan.resumeMs, next);
  };
  /** The next stop, as a person would go there, and its hold — unless the deck is being played (listen mode). */
  function next() {
    if (away() || motion?.matches) return arm();
    if (listening()) { set('paused'); return wait(plan.resumeMs, next); }
    // A deck someone left on one of the stops goes on from that stop, so the tour picks up where they were.
    const here = deck && typeof stage.index === 'number' ? stage.index + 1 : null;
    if (here !== null && plan.stops[at]?.to !== here) { const i = plan.stops.findIndex((s) => s.to === here); if (i >= 0) at = i; }
    if (at + 1 >= plan.stops.length && !plan.loop) { clearTimeout(timer); return set('done'); }
    at = (at + 1) % plan.stops.length;
    const stop = plan.stops[at];
    set('touring');
    wait(stop.hold, next);   // first, so a figure's go that throws still leaves the tour going
    // its own move is not someone's: while go runs, and the deck's slidechange for that click whenever it comes
    own = deck ? {index: stop.to - 1, until: Date.now() + 1000} : null;
    moving = true;
    try { go(stop.to); } finally { moving = false; }
  }
  /** Stopped for good: everything let go, and the control gone once no tour is left. */
  function end() {
    clearTimeout(timer); offs.splice(0).forEach((off) => off());
    state = 'off'; stage.removeAttribute('data-tour-state');
    if (stage.__sdTour === tour) delete stage.__sdTour;
    page.tours.delete(tour);
    if (page.control?.hasAttribute('data-sd-made') && ![...page.tours].some(moves)) { page.control.remove(); page.control = null; }
  }
  /** The person stopped it: every tour on the page, for the rest of the page view. */
  const stopAll = () => { page.off = true; [...page.tours].forEach((t) => t.stop()); };
  for (const type of ['pointerdown', 'focusin']) on(stage, type, use);
  // a real move of the pointer over it, looked at every 250 ms: a resting mouse (or the deck moving under it) is no move,
  // and a finger lifted off a touch screen is not someone leaving
  on(stage, 'pointermove', (e) => {
    const now = Date.now();
    if (ref && now - ref.at < 250) return;
    const moved = ref && Math.hypot(e.clientX - ref.x, e.clientY - ref.y) >= 4;
    ref = {x: e.clientX, y: e.clientY, at: now};
    if (moved) use();
  });
  on(window, 'keydown', (e) => (e.key === 'Escape' ? stopAll() : use()), true);
  on(document, 'click', (e) => { if (e.target?.closest?.('[data-tour-stop]')) stopAll(); });
  // a move the tour did not make is someone's (a key, a tap, the presenter window) — but not the deck showing its first slide
  on(stage, 'slidechange', (e) => {
    const mine = own && e.detail?.index === own.index && Date.now() <= own.until;
    if (mine) { own = null; return; }
    if (e.detail?.reason !== 'init' && e.detail?.reason !== 'mutation') use();
  });
  /** Out of sight (the deck scrolled away, or the page hidden), it waits; back in sight, it waits idleMs again. */
  const sight = () => {
    if (away()) { clearTimeout(timer); if (state !== 'still' && state !== 'done') set('hidden'); } else if (state === 'hidden') arm();
  };
  on(document, 'visibilitychange', sight);
  if (motion?.addEventListener) on(motion, 'change', () => { if (state !== 'done') arm(); });
  if (typeof IntersectionObserver === 'function') {
    // read the newest entry: a batch can hold several for the deck, and the last is where it is now
    const io = new IntersectionObserver((entries) => {
      const newest = entries[entries.length - 1];
      if (newest) { seen = newest.isIntersecting; sight(); }
    });
    io.observe(stage);
    offs.push(() => io.disconnect());
  }
  stage.__sdTour = tour;
  page.tours.add(tour);
  arm();
  return tour;
}

/** A tour's plan, read and checked as idleTour reads it — the stops ({to, hold, say?}), idleMs, resumeMs, loop — with no page. */
export function tourPlan(options) {
  return idleTour(null, options).plan;
}

/** A tour in one line, for the deck's notes or a page's caption: what it shows, for how long, and what stops it. */
export function tourText(options) {
  const plan = tourPlan(options), s = (ms) => `${Math.round(ms / 100) / 10} s`;
  const stops = plan.stops.map((x) => `${typeof x.to === 'number' ? `slide ${x.to}` : x.to} for ${s(x.hold)}${x.say ? ` (${x.say})` : ''}`);
  return `Left alone for ${s(plan.idleMs)}, it tours itself: ${stops.join(', then ')}${plan.loop ? ', and round again' : ''}. `
    + `A key, tap, click or move hands it over until ${s(plan.resumeMs)} of quiet; Escape or "Stop tour" stops it.`;
}
