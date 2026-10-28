// explore — a deck a viewer can explore (deck.json "explore": true): click a piece and the deck goes to the click that
// is about it — the first click whose data-on names it, or, when none does, the first that takes it in through a name+
// (gw+: gw and what it touches) — and Back returns to where the viewer was. The authored order never changes: explore
// is a way through the same clicks.
//
// The build writes what each piece leads to (exploreTargets: pure); the page carries it as data (#deck-explore) and
// exploreRuntime follows it. A piece no click is about leads nowhere and is not clickable.
import {expandNames} from '../focus.js';

/**
 * Where each piece leads, from the planned clicks: {slides: [the map each click is on, or null], targets: {map: {name:
 * click index (0-based)}}} — a name leads to the first click on its map whose data-on names it; one no click names
 * leads to the first that takes it in through a name+. Any piece name is a plain key (`constructor` too).
 */
export function exploreTargets(planned) {
  const targets = {}, through = {}, table = () => Object.create(null);
  planned.forEach((c, i) => {
    if (c.kind !== 'map' || !c.step.on) return;
    const own = (targets[c.map.name] ??= table()), near = (through[c.map.name] ??= table());
    // named outright: each name as written, gw+'s gw too (the first name it stands for)
    for (const name of c.step.on.map((x) => expandNames(c.map.pieces, [x])[0])) if (name !== '*' && !Object.hasOwn(own, name)) own[name] = i;
    for (const name of expandNames(c.map.pieces, c.step.on)) if (name !== '*' && !Object.hasOwn(near, name)) near[name] = i;
  });
  for (const [map, near] of Object.entries(through)) for (const [name, i] of Object.entries(near)) if (!Object.hasOwn(targets[map], name)) targets[map][name] = i;
  return {slides: planned.map((c) => (c.kind === 'map' ? c.map.name : null)), targets};
}

/** The data the page carries, safe inside its <script> tag. */
export const exploreData = (explore) => `<script type="application/json" id="deck-explore">${JSON.stringify(explore).replace(/</g, '\\u003c')}</script>`;

/** The look of a piece that leads somewhere and of the way back — in the page only when the deck explores. */
export const EXPLORE_CSS = `:where(deck-stage[data-explore] .sd-leads) { cursor: pointer; }
:where(deck-stage[data-explore] .sd-leads:hover) { outline: 3px solid var(--sd-accent, var(--accent-ink, #0b6e99)); outline-offset: 6px; }
:where(.explore-back) {
  position: fixed; left: 12px; top: 12px; z-index: 10; padding: 8px 14px; border-radius: 20px; cursor: pointer;
  border: 1.5px solid var(--line, #c9d0d9); background: var(--bg-elev, #f6f8fa); color: var(--fg, #14181f);
  font: 600 14px/1 var(--sans, system-ui, sans-serif);
}
@media print { :where(.explore-back) { display: none; } }`;

/**
 * Runs in the page: on <deck-stage data-explore>, a click on a piece of the slide shown that leads to another click
 * goes there, and a "Back" control (or Backspace) returns a step at a time, as a browser's Back does — to where the
 * viewer was before each jump, whatever they stepped through since. Pieces that lead somewhere are marked (sd-leads:
 * a pointer and a ring on hover). Left alone: an Alt-click and a drag (the dev page's), a link or control inside a
 * piece, a piece that cannot be seen, and the presenter window (it follows the room's deck).
 */
export function exploreRuntime() {
  const stage = document.querySelector('deck-stage[data-explore]'), data = document.getElementById('deck-explore');
  if (!stage || !data || window.name === 'deck-presenter' || /[?&]_snthumb=/.test(location.search)) return;
  const {slides, targets} = JSON.parse(data.textContent), back = [];
  const button = document.createElement('button');
  button.type = 'button'; button.className = 'explore-back'; button.hidden = true;
  document.body.appendChild(button);
  const shown = () => [...stage.children].filter((s) => s.tagName === 'SECTION')[stage.index];
  const unseen = '.sd-gone, .sd-hide, .sd-twin-off';
  const controls = 'a[href], button, input, select, textarea, summary, label, video[controls], audio[controls], [role="button"], [onclick], [contenteditable]:not([contenteditable="false" i])';
  /** Where a piece leads from the slide shown: a click index, or null (one that cannot be seen leads nowhere). */
  const leads = (piece) => {
    if (piece.closest(unseen)) return null;
    const own = targets[slides[stage.index]] ?? {};   // a plain slide, or a map no click names a piece of: none
    const to = piece.getAttribute('data-k').trim().split(/\s+/).map((k) => (Object.hasOwn(own, k) ? own[k] : undefined)).find((i) => i !== undefined);
    return to === undefined || to === stage.index ? null : to;
  };
  const mark = () => {
    document.querySelectorAll('.sd-leads').forEach((p) => p.classList.remove('sd-leads'));
    for (const p of shown().querySelectorAll('[data-k]')) if (leads(p) !== null) p.classList.add('sd-leads');
    button.hidden = !back.length;
    if (back.length) button.textContent = `← Back to click ${back.at(-1) + 1}`;
  };
  const go = (i) => { stage.goTo(i); mark(); };
  const goBack = () => { if (back.length) go(back.pop()); };
  // a press that moved is a drag, never a click (the dev page's Alt-drag, whenever Alt is let go)
  let down = null;
  document.addEventListener('pointerdown', (e) => { down = [e.clientX, e.clientY]; }, true);
  // capture: before the stage reads the click as a tap (it leaves a click whose default was prevented)
  document.addEventListener('click', (e) => {
    const dragged = down && Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 4;
    down = null;
    if (e.altKey || e.button !== 0 || dragged || !stage.isConnected) return;
    const piece = e.target.closest?.('[data-k]');
    if (!piece || !shown().contains(piece) || e.target.closest(controls)) return;
    const to = leads(piece);
    if (to === null) return;
    e.preventDefault();
    back.push(stage.index);
    go(to);
  }, true);
  button.addEventListener('click', (e) => { e.stopPropagation(); button.blur(); goBack(); });
  window.addEventListener('keydown', (e) => {
    if (e.key !== 'Backspace' || !back.length || !stage.isConnected || e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName) || e.target?.isContentEditable) return;
    e.preventDefault(); goBack();
  });
  stage.addEventListener('slidechange', mark);
  mark();
}
