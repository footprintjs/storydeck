// check — what a deck asks to be fixed, each problem with its click and its fix. Pure (the browser's layout check
// is layout.js). Errors stop a build; warnings and notes are worth a look.
//
//   words          a headline over deck.json "checks.maxWords" (12), a plain slide over "checks.maxSlideWords" (40): the rest belongs in the notes
//   lit-on-entry   a click about some pieces brings others in lit too — they light just by coming in
//   no-change      a click that changes nothing on screen (same headline, nothing enters, moves or lights)
//   never-shown    a map piece no click ever brings in
//   no-notes       clicks without notes in a deck that has them (listen mode says nothing there)
//   theme-unstyled a part asks for a data-theme that theme.css never selects ([data-theme="…"]): a misspelt name changes nothing
//   loop-unset     a loop of the deck's own (a bare data-loop) that nothing gives a --loop: nothing loops
//   differs-unsaid a part names a phrase of its notes that says how it differs from the real thing, and they do not hold it
//   callout-alone  a callout shown on a click that does not show the piece it points at: its tail points at nothing
//   view-far       a click whose view stands further out than half size (a fit over a wide picture): its words are small
//   across-stages  a wire or a callout that joins pieces standing on different stages: when one stage's view moves, it is left behind
//   wire-way       a wire between two blocks that does not lie well on the floor: it passes behind a block, lies on another, doubles back on itself (a hairpin), or is drawn straight — and why
//   name-fit       a block's name that does not fit its top face (or a floor's label its front edge) even on two lines at the least size
//   map-fit        a map of groups whose fitted picture runs past the slide even at the least tile
//   strokes        a map whose hand-drawn strokes (data-style "human:sketchy", "human:hatch") pass the note's size (isoRules.js · STROKES_NOTE)
//   motion         what a critic found in a block's move (data-move): footprint-story's (jerk, arc, spacing, contact, …) and the
//                  deck's own (deck:contact, deck:covers), at the critic's own level — a note is advice, one the move accepts is said as accepted
import {wordCount} from './parse.js';
import {expandNames} from '../focus.js';
import {LOOP_NAMES} from './loops.js';
import {saidInNotes} from './differs.js';
import {showsPiece} from './callouts.js';
import {readWay} from './cable.js';
import {mb, STROKES_NOTE} from './isoRules.js';

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
  const on = expandNames(pieces, c.step.on);   // "gw+": gw, its wires and what they reach
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

/** Loops of the deck's own (a bare data-loop) when neither theme.css nor their own style sets --loop — once, at the first click showing one. */
function unsetLoops(compiled) {
  if (/--loop\s*:/.test(compiled.themeCss ?? '')) return [];
  const bare = compiled.clicks.flatMap((c) => (c.loops ?? []).filter((l) => l.value === '' && !l.styled).map((l) => ({c, piece: l.piece ?? 'an element'})));
  if (!bare.length) return [];
  const list = [...new Set(bare.map((b) => b.piece))], one = list.length === 1;
  return [problem('warn', 'loop-unset', bare[0].c, `${list.join(', ')} ha${one ? 's' : 've'} data-loop but nothing sets ${one ? 'its' : 'their'} --loop, so nothing loops — give ${one ? 'it' : 'them'} one in theme.css (.gear { --loop: spin 4s linear infinite }), or name a loop: data-loop="${LOOP_NAMES[0]}" (${LOOP_NAMES.join(', ')})`)];
}

/** A part that names a phrase of its notes that says how it differs, when they do not hold it — once, at its first click. */
function unsaidDiffers(compiled) {
  const out = [], seen = new Set();
  for (const c of compiled.clicks) {
    if (!c.differs?.said || seen.has(c.part)) continue;
    seen.add(c.part);
    const notes = compiled.clicks.filter((x) => x.part === c.part).flatMap((x) => x.notes).join(' ');   // plain text already (parse.js · takeNotes)
    const missing = c.differs.said.filter((phrase) => !saidInNotes(phrase, notes));
    if (missing.length) out.push(problem('error', 'differs-unsaid', c, `part "${c.part}" says its notes tell how it differs from the real thing (${missing.map((p) => `"${p}"`).join(', ')}), and they do not hold those words — say it in the notes, or fix data-differs-said`));
  }
  return out;
}

/** A callout shown on a click that does not show the piece it points at — once per callout, at its first such click. */
function aloneCallouts(compiled) {
  const out = [], seen = new Set();
  for (const c of compiled.clicks) {
    if (c.kind !== 'map') continue;
    const {pieces, callouts = []} = compiled.maps[c.map];
    const shown = (name) => showsPiece(c.look, pieces, name);
    for (const k of callouts) {
      if (seen.has(`${c.map}/${k.name}`) || !shown(k.name) || shown(k.target)) continue;
      seen.add(`${c.map}/${k.name}`);
      out.push(problem('warn', 'callout-alone', c, `"${k.name}" points at "${k.target}", which this click does not show — bring "${k.target}" in, or take the callout out with data-out`));
    }
  }
  return out;
}

/** Half size: further out than this, words drawn at a slide's usual sizes are hard to read from a seat. A starting choice, not a measurement. */
const FAR_VIEW = 0.5;

/** A map click whose view stands further out than half size: every word on the picture shows that much smaller. */
function farView(c) {
  if (c.kind !== 'map') return [];
  const views = [{what: 'the view', s: c.look.stage?.move?.s}, ...(c.look.stages ?? []).map((st) => ({what: `the view of stage "${st.name}"`, s: st.move?.s}))];
  return views.filter((v) => v.s < FAR_VIEW).map((v) => problem('warn', 'view-far', c, `${v.what} stands at ${v.s}× here, so words drawn 26 px tall show about ${Math.round(26 * v.s)} px tall — show less at once (take pieces out with data-out, or tell it in two parts), or stand the pieces closer together`));
}

/** A piece that joins or is about others (a wire, a callout) and stands on another stage than one of them: each stage has its own view, so it is left behind when one moves. */
function acrossStages(compiled) {
  const out = [];
  for (const [map, {pieces}] of Object.entries(compiled.maps)) {
    if (!pieces.some((p) => p.stage)) continue;
    const click = compiled.clicks.find((c) => c.map === map) ?? null;
    const called = new Map();   // the pieces of each name, found once
    for (const p of pieces) for (const k of p.keys) called.set(k, [...(called.get(k) ?? []), p]);
    for (const p of pieces) {
      if (!p.ends) continue;
      const theirs = [...new Set(p.ends.flatMap((name) => (called.get(name) ?? []).filter((o) => o !== p).map((o) => o.stage ?? 'the main stage')))];
      const own = p.stage ?? 'the main stage';
      if (theirs.length && theirs.some((s) => s !== own)) out.push(problem('warn', 'across-stages', click, `"${p.keys[0]}" stands on ${own === 'the main stage' ? own : `stage "${own}"`} and touches ${p.ends.map((e) => `"${e}"`).join(' and ')} on ${theirs.map((s) => (s === 'the main stage' ? s : `stage "${s}"`)).join(' and ')} — each stage has its own view, so it is left behind when one moves: stand them on one stage (data-stage)`));
    }
  }
  return out;
}

/**
 * A wire between two blocks whose way the build could not lay well: what the build noted of it (compile.js · ways), in words,
 * with the fix. The picture need not be looked at to know that a wire is hidden behind a block.
 */
function wireWaysSaid(compiled) {
  const out = [];
  for (const [map, {ways = [], pieces}] of Object.entries(compiled.maps)) {
    const told = compiled.clicks.filter((c) => c.map === map);
    if (!told.length) continue;   // a map no part is told on is not part of this deck
    // said at the click that first shows the wire (the map's first click for one no click shows)
    const shownAt = (name) => { const i = pieces.findIndex((p) => p.keys.includes(name)); return told.find((c) => i >= 0 && c.look.pieces[i]?.state !== 'gone') ?? told[0]; };
    for (const {name, from, to, way} of ways) { const click = shownAt(name); for (const {level, message} of readWay(way, from, to)) out.push(problem(level, 'wire-way', click, `"${name}" (${from} to ${to}) ${message}`)); }
  }
  return out;
}

/** A block's name that does not fit its top face: broken onto two lines and shrunk to the least size, it still runs past the edges. */
function namesTight(compiled) {
  const out = [];
  for (const [map, {tight = [], pieces}] of Object.entries(compiled.maps)) {
    const told = compiled.clicks.filter((c) => c.map === map);
    if (!told.length) continue;
    const shownAt = (name) => { const i = pieces.findIndex((p) => p.keys.includes(name)); return told.find((c) => i >= 0 && c.look.pieces[i]?.state !== 'gone') ?? told[0]; };
    for (const {name, text, on} of tight) {
      if (on === 'floor-covered') out.push(problem('warn', 'name-fit', shownAt(name), `"${name}": its label "${text}" is covered: something stands on the floor's front edge all along it — move what stands there, or give the floor more room in front (data-size, data-at)`));
      else if (on === 'floor') out.push(problem('warn', 'name-fit', shownAt(name), `"${name}": its label "${text}" does not fit along the floor's front edge, even on two lines at the least size — shorten it, or give the floor more cols (data-size)`));
      else out.push(problem('warn', 'name-fit', shownAt(name), `"${name}": its name "${text}" does not fit its block's top, even on two lines at the least size — shorten it (and say the rest in a <small> line or the notes), or give the block a bigger top (data-size: a top is as wide across its middle as the block's shorter side)`));
    }
  }
  return out;
}

/** A map of groups the build could not fit on the slide even at its least tile: said with how far it runs past, and the fix. */
function mapsFit(compiled) {
  return Object.entries(compiled.maps).flatMap(([map, {made}]) => {
    const first = compiled.clicks.find((c) => c.map === map);
    if (!first || !made?.outside) return [];
    return [problem('warn', 'map-fit', first, `map "${map}": its groups need more room than the slide has — at the least tile the picture runs ${made.outside} px past the slide's area: tell it in two maps, or put fewer groups side by side`)];
  });
}

/**
 * A map whose hand-drawn strokes pass the note's size (isoRules.js · STROKES_NOTE; past STROKES_MOST it is refused at
 * build): said at its first click, with how many and how many bytes the page carries them in (once), and the fix.
 */
function strokesSaid(compiled) {
  return Object.entries(compiled.maps).flatMap(([map, {made}]) => {
    const first = compiled.clicks.find((c) => c.map === map), s = made?.strokes;
    if (!first || !s || (s.strokes <= STROKES_NOTE.strokes && s.bytes <= STROKES_NOTE.bytes)) return [];
    return [problem('info', 'strokes', first, `map "${map}": it draws ${s.strokes} hand-drawn strokes in ${mb(s.bytes)} of the page (drawn once, every click reuses them), past the ${STROKES_NOTE.strokes} strokes or ${mb(STROKES_NOTE.bytes)} a map is noted at (ours) — the page opens and prints slower; a wider hatch spacing ("texture: human:hatch spacing 16") draws fewer`)];
  });
}

/** The levels a move's finding is told at: a critic's warn is a fix, a note advice, and one its move accepts is advice it chose. */
const MOTION_LEVEL = {warn: 'warn', note: 'info', accepted: 'info'};

/**
 * What the critics found in each map's moves (motion.js · motionKept: footprint-story's findings and the deck's own), each
 * at its click, naming the move (data-move[i] and its block), the critic and the fix. WHY at the critic's own level: a
 * warn (a body through the floor, a block through another) is something to fix, so a check never reads clean over it.
 */
function motionFound(compiled) {
  return Object.values(compiled.maps).flatMap(({motion}) => (motion?.findings ?? []).map((f) => {
    const click = compiled.clicks.find((c) => c.n === f.click), move = f.who.slice(f.who.indexOf('data-move'));
    return problem(MOTION_LEVEL[f.level], 'motion', click, `${move} · ${f.critic}${f.level === 'accepted' ? ' (accepted)' : ''}: ${f.what} — ${f.fix}`);
  }));
}

/** Every problem of a compiled deck: [{level: 'error' | 'warn' | 'info', rule, click, label, message}]. */
export function checkDeck(compiled) {
  const out = [];
  compiled.clicks.forEach((c, i) => {
    out.push(...words(c, compiled.config.checks));
    if (c.kind === 'map') out.push(...litOnEntry(c, compiled.maps[c.map].pieces));
    out.push(...noChange(c, compiled.clicks[i - 1]));
    out.push(...farView(c));
  });
  out.push(...neverShown(compiled), ...missingNotes(compiled), ...unstyledThemes(compiled), ...unsetLoops(compiled), ...unsaidDiffers(compiled), ...aloneCallouts(compiled), ...acrossStages(compiled), ...wireWaysSaid(compiled), ...namesTight(compiled), ...mapsFit(compiled), ...strokesSaid(compiled), ...motionFound(compiled));
  return out;
}

/** A compile or read failure as the one problem a check reports. */
export const failure = (error) => [problem('error', 'compile', null, error.message)];

const RANK = {error: 0, warn: 1, info: 2};
/** Problems in the order they are told: worst first, then by click. */
export const worstFirst = (problems) => [...problems].sort((a, b) => RANK[a.level] - RANK[b.level] || (a.click ?? 0) - (b.click ?? 0));
/** One problem as its line. */
export const problemLine = (p) => `${p.level.padEnd(5)} ${p.click ? `click ${p.click} "${p.label}"` : 'deck'} · ${p.rule}: ${p.message}`;

/** Problems as text, one per line, worst first; "no problems" when there are none. */
export function formatProblems(problems) {
  return problems.length ? worstFirst(problems).map(problemLine).join('\n') : 'no problems';
}
