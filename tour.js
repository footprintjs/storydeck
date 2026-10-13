// tour — a deck or a figure that shows its point by itself while nobody is using it.
//
// A page people interact with — a deck left on a screen with nobody presenting it, an exploded figure on a post — is
// often looked at by someone who has not touched it yet. Left alone for a moment (1.4 s), it plays a short loop of
// stops, the clicks that make its point, and it drives the SAME targets a person would: the deck's own goTo, so a
// stop one click on animates as that click does (focus, apart's springs and all), or the figure's own function. There
// is no second animation to keep in step. A hover, focus, key or press pauses it, and it picks up 3.6 s after the
// last; it waits while the deck or the page is out of sight, and under reduced motion there is no tour.
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
 * data-tour (data-tour-hold, data-tour-idle, data-tour-resume) and returns those tours. Self-contained, so it inlines.
 * `stage` null reads the plan only (tourPlan); nothing runs.
 */
export function idleTour(stage, options) {
  // ── the plan: read and checked here, the one reader (tourPlan is this, without a page) ──
  const refuse = (fix) => { throw new Error(`idleTour: ${fix}`); };
  const shown = (v) => (typeof v === 'number' || v === undefined ? String(v) : JSON.stringify(v));
  /** A time in ms: 1400, '1400ms', '1400' or '1.4s' (up to ten minutes); `d` when left out. */
  const time = (v, d, what) => {
    if (v === undefined || v === null || v === '') return d;
    const m = typeof v === 'number' ? null : /^\s*(\d+(?:\.\d+)?)\s*(ms|s)?\s*$/.exec(String(v));
    const ms = typeof v === 'number' ? v : m ? Number(m[1]) * (m[2] === 's' ? 1000 : 1) : NaN;
    return ms >= 0 && ms <= 600000 ? ms : refuse(`${what} is a time — 1400, '1400ms' or '1.4s', up to ten minutes — not ${shown(v)}`);
  };
  /** One stop: a click as the deck counts them (3), a figure's own name ('lid'), 'to:hold' ('9:6s'), or {to, hold?, say?}. */
  const stopOf = (x, hold) => {
    const o = x !== null && typeof x === 'object' ? x : typeof x === 'number' ? {to: x} : (() => {
      const m = /^([^\s:]+)(?::(\S+))?$/.exec(String(x ?? '').trim());
      return m ? {to: /^\d+$/.test(m[1]) ? Number(m[1]) : m[1], hold: m[2]} : refuse(`a stop is a click (3), a name ('lid') or either with a hold ('9:6s'), not ${shown(x)}`);
    })();
    if (typeof o.to === 'number' ? !(Number.isInteger(o.to) && o.to >= 1) : typeof o.to !== 'string' || !o.to.trim()) refuse(`a stop goes to a click as the deck counts them (1, 2, …) or to a name, not ${shown(o.to)}`);
    if (o.say !== undefined && typeof o.say !== 'string') refuse(`a stop's say is a line of text saying what it shows, not ${shown(o.say)}`);
    return {to: o.to, hold: time(o.hold, hold, `the hold of stop ${shown(o.to)}`), ...(o.say ? {say: o.say} : {})};
  };
  const planOf = (o) => {
    if (!o || typeof o !== 'object') refuse(`give options, {stops, hold?, idleMs?, resumeMs?, loop?, go?} — not ${shown(o)}`);
    const list = typeof o.stops === 'string' ? o.stops.trim().split(/\s+/).filter(Boolean) : Array.isArray(o.stops) ? o.stops : [];
    if (!list.length) refuse(`give stops, the clicks that make the point, in order: '3 4 5 9:6s' (data-tour), or [3, 4, {to: 9, hold: 6000, say: 'the recorders light up'}]`);
    if (o.loop !== undefined && typeof o.loop !== 'boolean') refuse(`loop is true (round again, the default) or false (stop at the last), not ${shown(o.loop)}`);
    const hold = time(o.hold, 3000, 'hold');
    return {stops: list.map((x) => stopOf(x, hold)), idleMs: time(o.idleMs, 1400, 'idleMs'), resumeMs: time(o.resumeMs, 3600, 'resumeMs'), loop: o.loop !== false};
  };
  const fromAttrs = (el) => {
    const at = (name) => el.getAttribute(name) ?? undefined;
    return {stops: at('data-tour'), hold: at('data-tour-hold'), idleMs: at('data-tour-idle'), resumeMs: at('data-tour-resume')};
  };
  if (stage === undefined) return [...document.querySelectorAll('[data-tour]')].filter((el) => !el.__sdTour).map((el) => idleTour(el, fromAttrs(el)));
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

  // ── the runtime ──
  stage.__sdTour?.stop();
  const offs = [], on = (target, type, fn, opts) => { target.addEventListener(type, fn, opts); offs.push(() => target.removeEventListener(type, fn, opts)); };
  const motion = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  // narrationHtml.js · listenRuntime marks the body `train` while it plays the deck: someone is presenting, so no tour
  const listening = () => !!document.body?.classList.contains('train');
  let state = 'off', timer = 0, at = -1, hovering = false, seen = true, moving = false;
  const set = (s) => { state = s; stage.setAttribute('data-tour-state', s); };
  const wait = (ms, then) => { clearTimeout(timer); timer = setTimeout(then, ms); };
  const away = () => !seen || document.hidden;
  const arm = () => { if (motion?.matches) { clearTimeout(timer); set('still'); } else if (away()) { clearTimeout(timer); set('hidden'); } else { set('waiting'); wait(plan.idleMs, next); } };
  /** Someone is using it: hold still, and pick up resumeMs after the last thing they did (not while they hover it). */
  const touch = () => {
    if (state === 'off' || state === 'still' || state === 'hidden' || state === 'done') return;
    clearTimeout(timer); set('paused');
    if (!hovering) wait(plan.resumeMs, next);
  };
  /** The next stop, as a person would go there, and its hold — unless someone is there (hovering, or listen mode playing). */
  function next() {
    if (away() || motion?.matches) return arm();
    if (hovering || listening()) return touch();
    // A deck someone left on one of the stops goes on from that stop, so the tour picks up where they were.
    const here = deck && typeof stage.index === 'number' ? stage.index + 1 : null;
    if (here !== null && plan.stops[at]?.to !== here) { const i = plan.stops.findIndex((s) => s.to === here); if (i >= 0) at = i; }
    if (at + 1 >= plan.stops.length && !plan.loop) { clearTimeout(timer); return set('done'); }
    at = (at + 1) % plan.stops.length;
    const stop = plan.stops[at];
    set('touring');
    wait(stop.hold, next);   // first, so a figure's go that throws still leaves the tour going
    moving = true;
    try { go(stop.to); } finally { moving = false; }
  }
  on(stage, 'pointerenter', () => { hovering = true; touch(); });
  on(stage, 'pointerleave', () => { hovering = false; touch(); });
  for (const type of ['pointerdown', 'focusin']) on(stage, type, touch);
  on(window, 'keydown', touch, true);
  // a move the tour did not make is someone's (a key, a tap, the presenter window) — but not the deck showing its first slide
  on(stage, 'slidechange', (e) => { if (!moving && e.detail?.reason !== 'init' && e.detail?.reason !== 'mutation') touch(); });
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
  const stop = () => { clearTimeout(timer); offs.splice(0).forEach((off) => off()); state = 'off'; stage.removeAttribute('data-tour-state'); if (stage.__sdTour === tour) delete stage.__sdTour; };
  const tour = {plan, get state() { return state; }, stop};
  stage.__sdTour = tour;
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
    + `A hover, focus, key or press pauses it; it picks up ${s(plan.resumeMs)} after the last, and waits while out of sight.`;
}
