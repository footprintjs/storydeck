// review — a compiled deck read back as text: what each click shows, lights, greys and moves. Pure.
//
// A reviewer — a person, or a model that cannot afford a screenshot per click — reads the deck here first and
// looks at a picture only to confirm. `outline` is the whole deck, a line per click; `reviewClick` is one click.
import {wordCount} from './parse.js';

/** A piece's name: its first data-k name (a wire and its label may share one; they are listed once). */
const nameOf = (pieces, i) => pieces[i].keys[0];
const unique = (names) => [...new Set(names)];
const list = (names, max = 14) => (names.length ? `${names.slice(0, max).join(', ')}${names.length > max ? `, … (${names.length - max} more)` : ''}` : '—');
/** A click's part theme, as the end of its first line (nothing when the part has none). */
const themed = (c) => (c.theme ? ` · theme ${c.theme}` : '');
const quote = (s, max = 160) => (s.length > max ? `"${s.slice(0, max - 1)}…"` : `"${s}"`);

/** The pieces of a map click, grouped by what the click does with them. */
function pieceGroups(click, pieces) {
  const by = (pred) => unique(click.look.pieces.map((p, i) => (pred(p) ? nameOf(pieces, i) : null)).filter(Boolean));
  return {
    lit: by((p) => p.state === 'on'),
    greyed: by((p) => p.state === 'dim'),
    enters: by((p) => p.change === 'enter' || p.change === 'arrive'),
    lights: by((p) => p.change === 'light'),
    fades: by((p) => p.change === 'fade'),
    leaves: by((p) => p.change === 'leave'),
    moves: by((p) => !!p.from && p.change !== 'leave'),
    hot: by((p) => p.hot),
  };
}

/** The route of a path click, in the order it lights, each turn's names together. */
function routeOf(click, pieces) {
  const turns = new Map();
  click.look.pieces.forEach((p, i) => {
    if (p.path === null || p.path === undefined) return;
    if (!turns.has(p.path)) turns.set(p.path, []);
    turns.get(p.path).push(nameOf(pieces, i));
  });
  return [...turns.entries()].sort((a, b) => a[0] - b[0]).map(([, names]) => unique(names).join(' + '));
}

/** What moves the view or the parts on a map click, in words. */
function motionOf(look) {
  const out = [];
  const st = look.stage;
  if (st?.move) out.push(`view at ${st.move.s}× (x ${st.move.x}, y ${st.move.y})${st.from ? ', moving' : ''}`);
  else if (st?.from) out.push('view back to the whole map');
  if (look.apart) out.push(`apart: ${look.apart.groups.map((g) => `${g.names.join(' ')} ${g.to === 1 ? (g.was === 1 ? 'stays out' : 'opens') : 'closes'}`).join(', ')}`);
  if (look.overlay) out.push(`blur ${look.overlay.phase === 'out' ? 'melts away' : look.overlay.label ? `with frame "${look.overlay.label}"` : 'around the subject'}`);
  return out;
}

/** One line per click: number, label, headline (or a plain slide's first words), what it lights, its strategies. */
export function outline(compiled) {
  const width = String(compiled.clicks.length).length;
  return compiled.clicks.map((c) => {
    const n = String(c.n).padStart(width);
    if (c.kind === 'plain') return `${n}  ${c.label} — plain: ${quote(c.text, 70)}`;
    const {lit} = pieceGroups(c, compiled.maps[c.map].pieces);
    const strategies = c.look.strategies.length ? c.look.strategies.join(' ') : 'grey';
    return `${n}  ${c.label} — ${c.headline ? quote(c.headline, 70) : '(no headline)'} · lit ${list(lit, 6)} · ${strategies}`;
  }).join('\n');
}

/** A click number (1-based) or label, checked. */
export function findClick(compiled, which) {
  const total = compiled.clicks.length;
  const n = typeof which === 'number' || /^\d+$/.test(String(which)) ? Number(which) : null;
  const click = n !== null ? compiled.clicks[n - 1] : compiled.clicks.find((c) => c.label === which);
  if (!click) throw new Error(`no click ${JSON.stringify(which)} — the deck has clicks 1 to ${total} (or name one by its label)`);
  return click;
}

/** One click, as a reviewer reads it: where it is, what it says, what it shows and changes, and its notes. */
export function reviewClick(compiled, which, {maxWords = compiled.config?.checks?.maxWords ?? 12} = {}) {
  const c = findClick(compiled, which);
  const lines = [];
  const words = (n) => `${n} word${n === 1 ? '' : 's'}`;
  if (c.kind === 'plain') {
    lines.push(`click ${c.n} of ${compiled.clicks.length} · "${c.label}" (plain slide)${themed(c)}`);
    lines.push(`text (${words(wordCount(c.text))}): ${quote(c.text, 300)}`);
  } else {
    lines.push(`click ${c.n} of ${compiled.clicks.length} · "${c.label}" (map "${c.map}", step ${c.stepIndex + 1} of ${c.steps})${themed(c)}`);
    const hw = wordCount(c.headline);
    lines.push(`headline: ${c.headline ? `${quote(c.headline)} (${words(hw)}${hw > maxWords ? `, over ${maxWords}` : ''})` : '—'}`);
    const pieces = compiled.maps[c.map].pieces;
    const g = pieceGroups(c, pieces);
    const route = routeOf(c, pieces);
    const focus = [`focus: ${c.look.strategies.length ? c.look.strategies.join(', ') : 'grey (default)'}`];
    if (route.length) focus.push(`route: ${route.join(' → ')}${c.look.path ? `, ${c.look.path.step} s apart` : ''}${c.look.path?.line ? ` · line ${quote(c.look.path.line, 80)}` : ''}`);
    lines.push(focus.join(' · '));
    lines.push(`lit (${g.lit.length}): ${list(g.lit)}`);
    lines.push(`greyed (${g.greyed.length}): ${list(g.greyed)}`);
    const changes = [
      g.enters.length && `enter ${list(g.enters, 10)}`,
      g.lights.length && `light up ${list(g.lights, 10)}`,
      g.fades.length && `grey ${list(g.fades, 10)}`,
      g.leaves.length && `leave ${list(g.leaves, 10)}`,
      g.moves.length && `move ${list(g.moves, 10)}`,
      g.hot.length && `ring ${list(g.hot, 10)}`,
    ].filter(Boolean);
    lines.push(`this click: ${changes.length ? changes.join(' · ') : 'nothing changes on the map'}`);
    const motion = motionOf(c.look);
    if (motion.length) lines.push(`motion: ${motion.join(' · ')}`);
  }
  const noteWords = c.notes.reduce((sum, p) => sum + wordCount(p), 0);
  lines.push(c.notes.length ? `notes (${c.notes.length}, ${words(noteWords)}): ${quote(c.notes.join(' '), 240)}` : 'notes: —');
  return lines.join('\n');
}
