// compile — a deck (source.js · readDeck) turned into its clicks and slides. Pure: data in, data and strings out.
//
// Each map keeps its state from click to click and part to part — one picture, built up. A part on a map the
// previous click was not on arrives fresh (its pieces come in where they were left) and the plan goes on from there.
// Every click becomes one <section> for <deck-stage>: the kicker and headline on top, the map (or the plain slide's
// HTML) in the middle, the footer with the count at the bottom — each carrying data-chrome, so an additive build
// shows only the shared canvas underneath.
import {focusStep} from '../focus.js';
import {readPieces, readStep, drawFocus, wrapStage, slideClass, focusOverlay} from '../focusHtml.js';
import {applyTransforms, icons as drawIcons} from './transforms.js';
import {loopsIn} from './loops.js';
import {exploreTargets} from './explore.js';
import {plainText} from './parse.js';
import {esc, stripComments} from './html.js';
import {readAttributes, tagsWith} from '../pieceRules.js';

/**
 * In the dev page only: each piece keeps the number the build gave it (data-sd-at, beside the data-sd-i drawFocus
 * reads and drops), so a piece moved in the page is named as the build read it — never by a second reading.
 */
function numberForDev(html) {
  let out = '', from = 0;
  for (const {start, tag, before, m} of tagsWith(html, /\sdata-sd-i="(\d+)"/)) {
    const at = start + 1 + tag.length + before.length + m[0].length;
    out += `${html.slice(from, at)} data-sd-at="${m[1]}"`;
    from = at;
  }
  return out + html.slice(from);
}

/**
 * The deck's own HTML never carries StoryDeck's numbering attributes (data-sd-…): the build numbers the pieces with them,
 * and the dev page moves a piece by them — one written by hand would name a piece that is not the one shown.
 */
function refuseOwnNumbers(where, html) {
  for (const t of tagsWith(stripComments(html), /(?:)/)) {
    // its attributes as a browser reads them, however each is joined to the rest (<div/data-sd-at>, x="1"data-sd-at);
    // a tag a browser reads past its ">" is judged by its whole text
    const attrs = readAttributes(t.after);
    const own = attrs ? attrs.find((a) => a.name.startsWith('data-sd-')) : null;
    const name = own ? t.after.slice(own.at, own.at + own.name.length) : attrs ? null : /data-sd-[\w-]*/i.exec(t.after)?.[0];
    if (name) throw new Error(`${where}: ${name} is StoryDeck's own attribute (it numbers the pieces) — remove it from <${t.tag}>`);
  }
}

/** A map ready to plan on: its HTML with the helpers applied and its pieces read (`dev`: numbered for the dev page). */
function prepareMap(name, html, icons, dev) {
  refuseOwnNumbers(`map "${name}"`, html);
  let drawn;
  try {
    drawn = applyTransforms(stripComments(html), {icons});
  } catch (e) {
    throw new Error(`map "${name}": ${e.message}`, {cause: e});
  }
  const {html: out, pieces} = readPieces(drawn);
  if (!pieces.length) throw new Error(`map "${name}" has no pieces — a piece is an element with data-k="name" and an inline left/top (width/height)`);
  // the loops the deck writes: its own text and its icons' (a wire's packets are its wire's, not loops of their own)
  return {name, html: dev ? numberForDev(out) : out, pieces, loops: loopsIn(drawIcons(stripComments(html), icons), `map "${name}"`), state: null};
}

/** A map's loops a click shows: on a piece it does not keep out (gone), or on no piece. */
function shownLoops(map, look) {
  return map.loops.filter((l) => l.piece === null || look.pieces.some((p, i) => p.state !== 'gone' && map.pieces[i].keys.includes(l.piece)));
}

/** Every click of the deck, in order, each with what it needs to be drawn, reviewed and checked. */
function planClicks(parts, maps, {area, canvas, icons}) {
  let lastMap = null;
  const clicks = [];
  for (const part of parts) {
    if (!part.map) {
      refuseOwnNumbers(`"${part.label}"`, part.body);
      let inner;
      try {
        inner = applyTransforms(part.body, {icons});
      } catch (e) {
        throw new Error(`"${part.label}": ${e.message}`, {cause: e});
      }
      clicks.push({label: part.label, part, kind: 'plain', inner, loops: loopsIn(drawIcons(part.body, icons), `"${part.label}"`), notes: part.notes, headline: '', step: 0, steps: 1});
      lastMap = null;
      continue;
    }
    const map = maps[part.map];
    part.steps.forEach((s, k) => {
      let step, r;
      try {
        step = readStep(s.attrs);
        r = focusStep(map.state, {...step, fresh: k === 0 && lastMap !== map}, {pieces: map.pieces, area, canvas: {w: canvas[0], h: canvas[1]}});
      } catch (e) {
        throw new Error(`"${part.label}" click ${k + 1}: ${e.message}`, {cause: e});
      }
      map.state = r.state;
      lastMap = map;
      clicks.push({label: `${part.label} · ${k + 1}`, part, kind: 'map', map, step, look: r.look, loops: shownLoops(map, r.look), headline: s.headline, notes: s.notes, stepIndex: k, steps: part.steps.length});
    });
  }
  const seen = new Set();
  for (const c of clicks) {
    if (seen.has(c.label)) throw new Error(`two clicks are labelled "${c.label}" — rename one part (a map part's clicks are "<label> · 1", "<label> · 2", …)`);
    seen.add(c.label);
  }
  return clicks;
}

/** The top of a slide: its kicker and, on a map, the click's headline. */
const head = (kicker, headline) => `<div class="head" data-chrome><div class="kicker">${esc(kicker)}</div>${headline ? `<h2>${headline}</h2>` : ''}</div>`;
/** The bottom of a slide: the footer text and where the click is in the deck. */
const foot = (footer, n, total) => `<div class="foot" data-chrome><span>${esc(footer)}</span><span class="count">${n} / ${total}</span></div>`;

/** One click as a <deck-stage> slide. */
function drawClick(c, i, total, {footer, area, canvas}) {
  // a part's theme rides on each of its slides, for the deck's theme.css ([data-theme="…"])
  const open = `<section data-label="${esc(c.label)}"${c.part.theme ? ` data-theme="${esc(c.part.theme)}"` : ''}`;
  if (c.kind === 'plain') return `${open} class="slide plain">${head(c.part.kicker, '')}${c.inner}${foot(footer, i + 1, total)}</section>`;
  return `${open} class="slide on-map ${slideClass(c.look)}">${head(c.part.kicker, c.headline)}`
    + `<div class="map map-${c.map.name}">${wrapStage(drawFocus(c.map.html, c.look), c.look)}</div>`
    + `${focusOverlay(c.look, {area, canvas: {w: canvas[0], h: canvas[1]}})}${foot(footer, i + 1, total)}</section>`;
}

/** post.json names slides by label (a section shows its last one in Read): each must be a click of this deck. */
function checkPost(post, labels) {
  if (!post) return;
  if (!Array.isArray(post.sections)) throw new Error('post.json has no "sections" list — each section names the slides (click labels) it shows');
  for (const s of post.sections) {
    for (const l of s.slides ?? []) {
      if (!labels.has(l)) throw new Error(`post.json section "${s.key}" names slide "${l}", which the deck does not have (a map part's clicks are "<label> · 1", "<label> · 2", …)`);
    }
  }
}

/**
 * The deck compiled: {config, slides: [{label, html, notes}], clicks: [{n, label, kind, loops, …}], loops (the named
 * loops its clicks show, for the page's CSS), maps: {name: {pieces}}}.
 * `dev` numbers each map's pieces in the slides (data-sd-at), for the dev page's edits.
 * A slide's notes are what notesData carries ({slide, step, steps, now, earlier}). Throws, naming the part and the
 * click, when a click cannot be planned.
 */
export function compileDeck(source, {dev = false} = {}) {
  const {config, parts, icons = {}} = source;
  const maps = Object.fromEntries(Object.entries(source.maps ?? {}).map(([name, html]) => [name, prepareMap(name, html, icons, dev)]));
  for (const part of parts) if (part.map && !maps[part.map]) throw new Error(`"${part.label}" is told on map "${part.map}", which the deck does not have`);
  const opts = {area: [...config.area], canvas: config.canvas, icons, footer: config.footer};
  const planned = planClicks(parts, maps, opts);
  const total = planned.length;
  const slides = planned.map((c, i) => {
    const partClicks = planned.filter((x) => x.part === c.part);
    const k = partClicks.indexOf(c);
    return {label: c.label, html: drawClick(c, i, total, opts),
      notes: {slide: c.part.label, step: k, steps: partClicks.length - 1, now: c.notes, earlier: partClicks.slice(0, k).flatMap((x) => x.notes)}};
  });
  checkPost(source.post, new Set(slides.map((s) => s.label)));
  const clicks = planned.map((c, i) => ({n: i + 1, label: c.label, part: c.part.label, kicker: c.part.kicker, theme: c.part.theme ?? null, kind: c.kind,
    map: c.kind === 'map' ? c.map.name : null, headline: plainText(c.headline), notes: c.notes, loops: c.loops,
    ...(c.kind === 'map' ? {step: c.step, look: c.look, stepIndex: c.stepIndex, steps: c.steps} : {text: plainText(c.inner)})}));
  // the named loops the page draws: those its clicks show
  const loops = [...new Set(planned.flatMap((c) => c.loops.map((l) => l.value)))].filter(Boolean).sort();
  return {config, title: config.title, themeCss: source.themeCss ?? '', slides, clicks, loops, explore: config.explore ? exploreTargets(planned) : null, maps: Object.fromEntries(Object.values(maps).map((m) => [m.name, {pieces: m.pieces}]))};
}
