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
 * leads to the first that takes it in through a name+.
 */
export function exploreTargets(planned) {
  const targets = {}, through = {};
  planned.forEach((c, i) => {
    if (c.kind !== 'map' || !c.step.on) return;
    const own = (targets[c.map.name] ??= {}), near = (through[c.map.name] ??= {});
    // named outright: each name as written, gw+'s gw too (the first name it stands for)
    for (const name of c.step.on.map((x) => expandNames(c.map.pieces, [x])[0])) if (name !== '*' && !(name in own)) own[name] = i;
    for (const name of expandNames(c.map.pieces, c.step.on)) if (name !== '*' && !(name in near)) near[name] = i;
  });
  for (const [map, near] of Object.entries(through)) for (const [name, i] of Object.entries(near)) if (!(name in targets[map])) targets[map][name] = i;
  return {slides: planned.map((c) => (c.kind === 'map' ? c.map.name : null)), targets};
}

/** The data the page carries, safe inside its <script> tag. */
export const exploreData = (explore) => `<script type="application/json" id="deck-explore">${JSON.stringify(explore).replace(/</g, '\\u003c')}</script>`;

/**
 * Runs in the page: on <deck-stage data-explore>, a click on a piece of the slide shown that leads to another click
 * goes there (an Alt-click is the dev page's drag, left alone), and a "Back" control (or Backspace) returns, a step at
 * a time. Pieces that lead somewhere are marked (sd-leads: deck.css gives them a pointer and a ring on hover).
 */
export function exploreRuntime() {
  const stage = document.querySelector('deck-stage[data-explore]'), data = document.getElementById('deck-explore');
  if (!stage || !data) return;
  const {slides, targets} = JSON.parse(data.textContent), back = [];
  const button = document.createElement('button');
  button.type = 'button'; button.className = 'explore-back'; button.hidden = true;
  document.body.appendChild(button);
  const shown = () => [...stage.children].filter((s) => s.tagName === 'SECTION')[stage.index];
  /** Where a piece leads from the slide shown: a click index, or null. */
  const leads = (piece) => {
    const own = targets[slides[stage.index]] ?? {};   // a plain slide, or a map no click names a piece of: none
    const to = piece.getAttribute('data-k').trim().split(/\s+/).map((k) => own[k]).find((i) => i !== undefined);
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
  // capture: before the stage reads the click as a tap (it leaves a click whose default was prevented)
  document.addEventListener('click', (e) => {
    if (e.altKey || e.button !== 0) return;
    const piece = e.target.closest?.('[data-k]');
    if (!piece || !shown().contains(piece)) return;
    const to = leads(piece);
    if (to === null) return;
    e.preventDefault(); e.stopPropagation();
    back.push(stage.index);
    go(to);
  }, true);
  button.addEventListener('click', (e) => { e.stopPropagation(); goBack(); });
  window.addEventListener('keydown', (e) => {
    if (e.key !== 'Backspace' || !back.length || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName) || e.target?.isContentEditable) return;
    e.preventDefault(); goBack();
  });
  stage.addEventListener('slidechange', mark);
  mark();
}
