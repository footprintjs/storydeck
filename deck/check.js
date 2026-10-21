// check — what a deck asks to be fixed, each problem with its click and its fix. Pure (the browser's layout check
// is layout.js). Errors stop a build; warnings and notes are worth a look.
//
//   words          a headline over deck.json "checks.maxWords" (12), a plain slide over "checks.maxSlideWords" (40): the rest belongs in the notes
//   lit-on-entry   a click about some pieces brings others in lit too — they light just by coming in
//   no-change      a click that changes nothing on screen (same headline, nothing enters, moves or lights)
//   never-shown    a map piece no click ever brings in
//   no-notes       clicks without notes in a deck that has them (listen mode says nothing there)
//   theme-unstyled a part asks for a data-theme that theme.css never selects ([data-theme="…"]): a misspelt name changes nothing
import {wordCount} from './parse.js';

const names = (pieces, idx) => [...new Set(idx.map((i) => pieces[i].keys[0]))];
const problem = (level, rule, click, message) => ({level, rule, click: click?.n ?? null, label: click?.label ?? null, message});

/** A headline, or a plain slide's text, over its word budget. */
function words(c, {maxWords, maxSlideWords}) {
  const plain = c.kind === 'plain', n = wordCount(plain ? c.text : c.headline), most = plain ? maxSlideWords : maxWords;
  if (n <= most) return [];
  const what = plain ? 'this slide shows' : 'the headline is';
  return [problem('warn', 'words', c, `${what} ${n} words (at most ${most}) — keep the canvas short and move the rest into the notes`)];
}

/** Pieces that come in lit although the click names its subject and they are not in it. */
function litOnEntry(c, pieces) {
  if (c.kind !== 'map' || c.step.on === null || c.step.quiet) return [];
  const on = c.step.on;
  if (on.includes('*')) return [];
  const extra = c.look.pieces.map((p, i) => (p.state === 'on' && (p.change === 'enter' || p.change === 'arrive') && !pieces[i].keys.some((k) => on.includes(k)) ? i : null)).filter((i) => i !== null);
  if (!extra.length) return [];
  const list = names(pieces, extra);
  return [problem('warn', 'lit-on-entry', c, `${list.join(', ')} come${list.length === 1 ? 's' : ''} in lit, though the click is about ${on.join(', ')} — add data-quiet to bring ${list.length === 1 ? 'it' : 'them'} in greyed, or name ${list.length === 1 ? 'it' : 'them'} in data-on`)];
}

/** A map click that leaves the screen as the click before it left it. */
function noChange(c, prev) {
  if (c.kind !== 'map' || !prev || prev.kind !== 'map' || prev.map !== c.map || c.stepIndex === 0) return [];
  const l = c.look;
  const moved = l.pieces.some((p) => p.change || p.from || p.hotIn) || l.stage?.from || l.path
    || (l.overlay && (l.overlay.phase !== 'in' || l.overlay.frameNew)) || l.apart?.groups.some((g) => g.to !== g.was);
  if (moved || c.headline !== prev.headline) return [];
  return [problem('warn', 'no-change', c, 'nothing changes on screen from the click before (same headline; nothing enters, leaves, lights, moves or rings) — merge it into that click, or give it something to show')];
}

/** Pieces of a map that no click ever shows. */
function neverShown(compiled) {
  const out = [];
  for (const [map, {pieces}] of Object.entries(compiled.maps)) {
    const told = compiled.clicks.filter((c) => c.map === map);
    if (!told.length) continue;   // a map no part is told on is not part of this deck
    const shown = new Set();
    for (const c of told) c.look.pieces.forEach((p, i) => { if (p.state !== 'gone') shown.add(i); });
    const hidden = pieces.map((_, i) => i).filter((i) => !shown.has(i));
    // A piece that steps aside for its lit twin is "gone" while its twin shows, yet it is part of the picture.
    const real = hidden.filter((i) => !pieces[i].twin?.length);
    if (real.length) out.push(problem('info', 'never-shown', null, `map "${map}": ${names(pieces, real).join(', ')} never shown — bring ${real.length === 1 ? 'it' : 'them'} in with data-in, or remove ${real.length === 1 ? 'it' : 'them'} from the map`));
  }
  return out;
}

/** Clicks without notes, when most of the deck has them. */
function missingNotes(compiled) {
  const without = compiled.clicks.filter((c) => !c.notes.length);
  if (!without.length || without.length * 2 > compiled.clicks.length) return [];
  return [problem('info', 'no-notes', null, `click${without.length === 1 ? '' : 's'} ${without.map((c) => c.n).join(', ')} ha${without.length === 1 ? 's' : 've'} no notes — the presenter view shows nothing there and listen mode skips ${without.length === 1 ? 'it' : 'them'}`)];
}

/** Themes the parts ask for that theme.css never selects — once per theme, at its first click. */
function unstyledThemes(compiled) {
  const out = [], seen = new Set();
  for (const c of compiled.clicks) {
    if (!c.theme || seen.has(c.theme)) continue;
    seen.add(c.theme);
    // a theme is [a-z0-9-] (parse.js · THEME), so it is safe inside the pattern as it is
    const selects = new RegExp(`\\[\\s*data-theme\\s*[~|^$*]?=\\s*(["']?)${c.theme}\\1\\s*(?:[is]\\s*)?\\]`).test(compiled.themeCss ?? '');
    if (!selects) out.push(problem('warn', 'theme-unstyled', c, `part "${c.part}" asks for data-theme="${c.theme}", which theme.css never selects — fix the name, or give it its tokens there ([data-theme="${c.theme}"] { --bg: …; })`));
  }
  return out;
}

/** Every problem of a compiled deck: [{level: 'error' | 'warn' | 'info', rule, click, label, message}]. */
export function checkDeck(compiled) {
  const out = [];
  compiled.clicks.forEach((c, i) => {
    out.push(...words(c, compiled.config.checks));
    if (c.kind === 'map') out.push(...litOnEntry(c, compiled.maps[c.map].pieces));
    out.push(...noChange(c, compiled.clicks[i - 1]));
  });
  out.push(...neverShown(compiled), ...missingNotes(compiled), ...unstyledThemes(compiled));
  return out;
}

/** A compile or read failure as the one problem a check reports. */
export const failure = (error) => [problem('error', 'compile', null, error.message)];

/** Problems as text, one per line, worst first; "no problems" when there are none. */
export function formatProblems(problems) {
  if (!problems.length) return 'no problems';
  const rank = {error: 0, warn: 1, info: 2};
  return [...problems].sort((a, b) => rank[a.level] - rank[b.level] || (a.click ?? 0) - (b.click ?? 0))
    .map((p) => `${p.level.padEnd(5)} ${p.click ? `click ${p.click} "${p.label}"` : 'deck'} · ${p.rule}: ${p.message}`).join('\n');
}
