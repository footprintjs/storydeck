// iso — blocks on a floor seen from a corner. Plain strings in, plain strings out; applied before a map's pieces are
// read, so an isometric piece is a piece like any other: a click brings it in, lights it, greys it and moves the view
// to it, a wire runs to it and a callout stands beside it.
//
//   <i data-iso-grid="120 at 960 240"></i>                                     the floor's tile and far corner (optional)
//   <div data-k="floor" data-iso="floor" data-size="8 5"></div>                 the tile lines
//   <div data-k="server" data-iso="block" data-at="3 1" data-size="2 2 1.4"><b>Server</b><small>an API</small></div>
//   <div data-k="db" data-iso="cylinder" data-at="6 0" data-size="1.6 1.6 1.2"><b>Database</b></div>
//
// data-at is where it stands on the floor, "col row" (col runs down and to the right of the slide, row down and to the
// left), and a third number lifts it; data-size is "wide deep high" in tiles (a floor: "cols rows"). The numbers that
// place it come from footprint-story/isometric, the grid a film can draw with too. Its words stand on its top face.
//
// NO PLACES TO TYPE. A map whose blocks have no data-at says only what is joined to what, with its wires ("you to
// server"), and the build places them (footprint-story's map steps — buildIsoMap · place: arrange, across the frame;
// isoSpec.js hands them the map): a joined block one step to the right of what leads to it on the slide, the blocks
// led to from one place one below the other. A slide is wider than it is tall, so the steps run across it; along the
// floor's own cols a chain is a long slant that leaves two corners of the slide empty. Then nothing else needs a
// number: a block with no data-size is 2 2 1, a floor with none is fitted round the blocks, and with no data-iso-grid
// the tile is chosen so the blocks fill the slide's area (the steps' grid: gridFor). The least a map is:
//
//   <div data-k="floor" data-iso="floor"></div>
//   <div data-k="you" data-iso="block"><b>You</b></div>
//   <div data-k="server" data-iso="block"><b>Server</b></div>
//   <i data-k="w1" class="wire" data-arrow="you to server"></i>
//
// It is all or none: a map that places some of its blocks and not the others is refused, naming them — the build
// does not guess where the unplaced go among the placed. data-iso-grid="fit" asks for the fitted grid on a map that
// places its own blocks.
//
// WHY the build places it (and refuses a left/top/width/height of its own): where a block lands and how big it is on
// the slide follow from the floor, and the order they are painted in (a nearer block over a further one) follows from
// all of them together — written as a z-index, so the map's own order, which a click's numbering uses, never moves.
// A floor is written first: it and the wires share a level, and the later one is drawn over the earlier. A floor is
// ground (data-ground): a camera frames what stands on it, so the view follows the pieces, not the floor.
//
// It looks as ISO_CSS says, which the page carries only when a deck has one. Every rule has no weight, so theme.css has
// the last word: --iso-color (a piece's colour: its top is lighter, its sides darker), --iso-ink, --iso-line,
// --iso-line-width (the faces' outline, 2.5px; a map's data-style that names a width wins over it: isoPaint.js),
// --iso-grid, --iso-floor. Class ok, warn or bad from the base look colours one.
//
// A piece is what it draws, not the box it is placed by. The box of a block seen from a corner has four empty corners,
// and a nearer block's box lies over the block behind it: so on the slide shown only its faces and its words take the
// pointer, and a ring round it (a highlight, explore's hover) follows its faces — isoRing, for whoever rings a piece.
import {isometric, ISO_MAP_LIMITS, MOST_FLOOR_LABEL, MOST_KEEP} from 'footprint-story/isometric';
import {builtMap, usualGrid, DECK} from './isoSpec.js';
import {areaOf, checkFloors, checkPlacing} from './isoRules.js';
import {BREAK_RULES} from 'footprint-story/layout';
import {portsWritten} from './portsWritten.js';
import {groupWritten} from './groups.js';
import {keptFloor, mayKeepClear, readKeepClear} from './keepClear.js';
import {mayHoldFootprint, paintFootprints, readFootprints} from './footprint.js';
import {decodeEntities, esc} from './html.js';
import {attrRule, ownAttribute, pieceTags, tagsWith} from '../pieceRules.js';
import {closeOf} from './callouts.js';
import {isoArt, strokesDrawn} from './isoPaint.js';
import {MAYBE_STYLE, readStyle} from './isoStyle.js';

const KINDS = ['block', 'cylinder', 'floor'];
/** A tag that may carry the attribute: a cheap look, in any case. Whether it does is ownAttribute's to say (a mention inside another value is not it). */
const MAYBE = /data-iso(?![\w-])/i, MAYBE_GRID = /data-iso-grid(?![\w-])/i;
const NUMBER = '(-?(?:\\d+(?:\\.\\d*)?|\\.\\d+))';
/** The grid as written: "tile [tile-height] at x y [rise r]". */
const GRID = new RegExp(`^\\s*${NUMBER}(?:\\s+${NUMBER})?\\s+at\\s+${NUMBER}\\s+${NUMBER}(?:\\s+rise\\s+${NUMBER})?\\s*$`);
const PLACED = ['left', 'top', 'width', 'height'];
/** The most isometric pieces on one map (the grid orders that many). */
export const MOST_ISO_PIECES = 256;
/** A block or a cylinder that gives no data-size: 2 wide, 2 deep, 1 high. */
export const USUAL_SIZE = Object.freeze([2, 2, 1]);
/**
 * A fitted grid's tile, in px: no wider than the first, and no narrower than the second — a block's words are drawn
 * at one size whatever the tile, and under 96 px a block's top has no room for them. A picture too big for the slide
 * at that tile runs past it, and a click's camera frames what the click shows (data-focus="fit"); the layout check
 * names a lit piece that runs past the slide's edge. The deck's numbers, held in the kit's policy for the deck
 * (ISO_MAP_POLICIES.deck · fit, with the px a fitted picture keeps clear of the area's edges and the tiles of floor a
 * fitted floor shows round the blocks, and `grouped`, the least tile a map of groups is fitted at): named here for
 * whoever reads the deck.
 */
export const FITTED_TILE = Object.freeze({most: DECK.fit.most, least: DECK.fit.least});
/** The most tiles a floor has along one side (the grid's own limit: footprint-story/isometric · floor). */
export const MOST_FLOOR = 256;
const FIT = 'fit';

const fixed = (v) => +v.toFixed(1);

/** Numbers written in an attribute, "3 1" or "2 2 1.4": a list, or null when a word is not a number. */
function numbersIn(text) {
  const words = text.trim().split(/\s+/).filter(Boolean), out = words.map(Number);
  return words.length && words.every((w) => new RegExp(`^${NUMBER}$`).test(w)) ? out : null;
}

/**
 * What the map says of its grid, and the map without the element that says it: {html, grid} when it is written in
 * numbers, {html, fit: true} for data-iso-grid="fit", {html} alone when nothing is written (the build then decides:
 * isoPieces). The element is an empty <i> that carries data-iso-grid and nothing else: it is not a piece, so taking it
 * out moves no piece's number (a data-k on it would, and is refused). One pass over the tags.
 */
function readGrid(html) {
  const found = [];
  for (const t of tagsWith(html, MAYBE_GRID)) {
    const run = t.before + t.m[0] + t.after, own = ownAttribute(run, 'data-iso-grid');
    if (own === null) continue;   // the words inside another attribute's value: not a floor
    const written = '<i data-iso-grid="120 at 960 240"></i>';
    if (own === undefined || own.bare || own.twice || t.tag !== 'i' || !html.startsWith('</i>', t.end)) throw new Error(`data-iso-grid: the floor is set on an empty <i>, in lower case and with quotes — ${written}`);
    if ((own.before + own.after).trim()) throw new Error(`data-iso-grid: the floor's <i> carries nothing else (it is not a piece, and is taken out of the map) — write ${written} and put "${(own.before + own.after).trim()}" on a piece`);
    found.push({start: t.start, end: t.end + '</i>'.length, spec: own.value});
  }
  if (found.length > 1) throw new Error(`data-iso-grid: a map has one floor, and this one sets ${found.length} — keep one`);
  if (!found.length) return {html};
  const [{start, end, spec}] = found, map = html.slice(0, start) + html.slice(end);
  if (spec.trim() === FIT) return {html: map, fit: true};
  const m = GRID.exec(spec);
  if (!m) throw new Error(`data-iso-grid="${spec}": the floor is a tile's width in px (and its height, for another angle), "at", and where its far corner stands, x y — "120 at 960 240", with "rise 70" after it to set a unit of height; or "fit", and the build chooses the tile that fills the slide`);
  const [w, h, x, y, rise] = m.slice(1).map((v) => (v === undefined ? undefined : Number(v)));
  try {
    // the numbers as written, for the steps (they make the same grid of them), and the grid they make
    const numbers = {tile: h === undefined ? w : [w, h], origin: [x, y], ...(rise === undefined ? {} : {rise})};
    return {html: map, grid: isometric(numbers), numbers};
  } catch (e) {
    throw new Error(`data-iso-grid="${spec}": ${e.message.replace(/^isometric: /, '')}`, {cause: e});
  }
}

/**
 * Every isometric piece as written, in order, checked: [{start, open, close, end, tag, attrs, where, name, kind, at, size,
 * inner}] — `at` null where no data-at is written, a floor's `size` null where no data-size is. Throws, naming the fix. A tag is one when a browser reads data-iso as its own attribute; the words inside
 * another attribute's value do not make it one.
 */
function readIso(html) {
  const out = [];
  for (const {start, end: open, tag, before, m, after} of tagsWith(html, MAYBE)) {
    const run = before + m[0] + after, own = ownAttribute(run, 'data-iso');
    if (own === null) continue;
    if (own === undefined) throw new Error('data-iso: a quote in its tag is never closed — write a ">" or "<" inside a value as &gt; or &lt;');
    // written any other way a browser reads it as the attribute and a reader of the file would not: refused, never silently a plain element
    if (own.bare || own.twice) throw new Error('data-iso: an isometric piece is written data-iso="block" (or cylinder, floor), once, in lower case and with quotes');
    const kind = own.value.trim(), where = `data-iso="${own.value}"`, attrs = own.before + own.after;
    if (!KINDS.includes(kind)) throw new Error(`${where}: an isometric piece is a ${KINDS.slice(0, -1).join(', a ')} or a ${KINDS.at(-1)}`);
    const name = ownAttribute(attrs, 'data-k')?.value?.trim().split(/\s+/)[0];
    if (!name) throw new Error(`${where}: an isometric piece is a piece, so a click can bring it in — give it a data-k name`);
    const told = `"${name}" (${where})`, styled = ownAttribute(attrs, 'style');
    // a browser keeps the first of two style attributes, and the build writes one: two would leave it where neither says
    if (styled?.bare || styled?.twice) throw new Error(`${told}: its style is written once, with quotes — a browser reads only the first of two, and the build adds its place to it`);
    const style = styled?.value ?? '';
    const placed = PLACED.find((prop) => new RegExp(`(?:^|;)\\s*${prop}\\s*:`, 'i').test(style));
    if (placed) throw new Error(`${told}: its ${placed} comes from the floor — place it with data-at="col row" and size it with data-size, and take ${placed} out of its style`);
    const read = (attr, form) => {
      const a = ownAttribute(attrs, attr);
      if (!a) return null;
      return (a.bare ? null : numbersIn(a.value)) ?? (() => { throw new Error(`${told}: ${attr}="${a.value}" — ${form}`); })();
    };
    // left out, a block's size is the usual one; a floor's size and anything's place are the build's to work out (place, below)
    const size = read('data-size', kind === 'floor' ? 'a floor\'s size is "cols rows", whole numbers' : 'its size is "wide deep high", in tiles') ?? (kind === 'floor' ? null : [...USUAL_SIZE]);
    const at = read('data-at', 'where it stands is "col row" on the floor, with a third number to lift it');
    const ports = portsWritten(ownAttribute(attrs, 'data-ports'), kind, size, told);
    const {at: close, end} = closeOf(html, tag, open, told), inner = html.slice(open, close);
    if (pieceTags(inner).length) throw new Error(`${told}: pieces do not nest, and this one holds a piece — place it beside it`);
    if (kind === 'floor' && inner.trim()) throw new Error(`${told}: a floor holds no words — put them in a piece that stands on it`);
    // a floor's label and its icon, read here and drawn by the build (floorLabelHtml): taken off the element it writes
    let styleCut = styled ? styled.before + styled.after : attrs, label = null, icon = null;
    // how its name breaks onto two lines, when the writer picks (breakWritten): taken off the element like a label
    const broken = breakWritten(styleCut, kind, told);
    if (broken) styleCut = broken.rest;
    // a rule for a name it does not have: refused, as a film refuses a break with no label
    if (broken && !nameOf(inner)) throw new Error(`${told}: data-break says how its name breaks onto two lines, and it has no name the build fits (a first <b> of plain words, inside no other element, with no style of its own) — give it one, or take data-break out`);
    for (const attr of ['data-label', 'data-icon']) {
      const a = ownAttribute(styleCut, attr);
      if (!a) continue;
      if (kind !== 'floor') { if (attr === 'data-label') continue; throw new Error(`${told}: data-icon on an isometric piece is the icon of a floor's label — put it on a floor with a data-label, or an <i data-icon> in the block's words`); }
      if (a.bare || a.twice) throw new Error(`${told}: its ${attr} is written ${attr}="…", once, with quotes`);
      // a label wrapped onto two lines in the file is one line of words: line ends and tabs are spaces
      const value = decodeEntities(a.value).replace(/[\t\n\r]+/g, ' ').trim();
      if (attr === 'data-label') {
        const letters = [...value].length;
        if (!value || letters > MOST_FLOOR_LABEL) throw new Error(`${told}: a floor's label is a name of 1 to ${MOST_FLOOR_LABEL} letters — not ${value ? `${letters} letters` : 'none'}`);
        // a control, a direction mark or another character that draws nothing would read differently in the page and in
        // check's words: refused, not drawn (a joiner inside an emoji stays)
        if (/\p{Cc}|(?!\u200D)\p{Cf}|[\uD800-\uDFFF]/u.test(value)) throw new Error(`${told}: a floor's label is plain words — take out the control or direction character in it`);
        label = value;
      } else {
        if (!/^[\w-]+$/.test(value)) throw new Error(`${told}: data-icon names an icon of the deck (icons/<name>.svg) — not "${value.slice(0, 40)}"`);
        icon = value;
      }
      styleCut = a.before + a.after;
    }
    if (icon && !label) throw new Error(`${told}: data-icon on a floor goes beside its label — give the floor a data-label too`);
    out.push({start, open, close, end, tag, attrs, where: told, name, kind, at, size, ports, inner, style, quote: styled?.quote ?? '"', styleCut, label, icon, rule: broken?.rule ?? null, group: groupWritten(attrs, told)});
  }
  return out;
}

/**
 * The rule a block's name breaks by, when its writer picks one: data-break="fill" (the first line as full as it goes)
 * or "even" (the usual: the two lines as alike as they can be) — footprint-story/isometric · wordsToFit's `break`, the
 * names of footprint-story/layout's BREAK_RULES. Gives {rule, rest} (its attributes without data-break, so the page
 * does not carry it), or null when none is written. WHY a name and not a free value: the common package tests each
 * rule and the run's record names the one used (maps made · breaks). A floor holds no words, so it takes none.
 */
function breakWritten(attrs, kind, told) {
  const a = ownAttribute(attrs, 'data-break');
  if (!a) return null;
  const names = BREAK_RULES.map((r) => `"${r}"`).join(' or ');
  if (a.bare || a.twice) throw new Error(`${told}: data-break is written data-break="fill" or data-break="even", once, in lower case and with quotes`);
  if (kind === 'floor') throw new Error(`${told}: data-break says how a block's name breaks onto two lines, and a floor holds no words — put it on the block`);
  // written exactly, as a film's recipe key is (StoryReel refuses " fill " too): a map moved into a film reads the same
  const rule = a.value;
  if (!BREAK_RULES.includes(rule)) throw new Error(`${told}: data-break="${a.value.slice(0, 40)}" — a name breaks by ${names}: "fill" sets the first line as full as it goes, "even" (the usual) makes the two lines alike`);
  return {rule, rest: a.before + a.after};
}

/** The isometric pieces a map has: [{name, kind}] — nothing for a map without one. */
export const isoIn = (html) => readIso(html).map(({name, kind}) => ({name, kind}));

/** How far points of the slide run past an area [x0, y0, x1, y1], in px: 0 when they are all in it. */
const beyondArea = (points, [x0, y0, x1, y1]) => Math.max(0, ...points.flatMap(({x, y}) => [x0 - x, x - x1, y0 - y, y - y1]));

/**
 * What a piece draws, as the map built it: {box, art, say} — its box on the slide (the steps' `shape`), its faces as SVG
 * inside that box (the steps' paint list, written by isoPaint.js · isoArt) and the middle of its top, where its words
 * stand (null for a floor). WHY the built map's: the steps already made the faces with the style's shape column, so
 * the deck paints that list and builds no face of its own — a deck and a film draw one picture.
 */
function artOf({box, centre}, paints, solid, styled) {
  return {box, art: isoArt(paints, box, {styled}), say: solid ? {x: centre[0], y: centre[1]} : null};
}

/** A block's small line (its first <small>), as plain words: what a name's box under it takes room for (footprint-story/isometric · nameBox). */
const smallOf = (inner) => { const m = /<small\b[^>]*>([\s\S]*?)<\/small\s*>/i.exec(inner); return m ? decodeEntities(m[1].replace(/<[^>]*>/g, '')).replace(/\s+/g, ' ').trim() || null : null; };

/** What a name-fit note shows of a name: enough to find it. */
const SHOWN = 80;
/** Where a name may break — the common package's rule: a space, a tab, a line end. */
const BREAK = /[ \t\n\r\f\v]+/, INSIDE = /[ \t\n\r\f\v]/g;
/** A tag or a comment, a quoted value read whole (a "<b>" inside a title is not a tag). */
const TAG = /<!--[\s\S]*?-->|<(\/?)([a-zA-Z][^\s/>]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/g;
const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
/**
 * A block's name in its words: the first <b> that is inside no other element — {from, to, text} when it holds plain
 * text and has no attribute of its own, else null (a name with a style or markup of its own is the writer's: left as
 * written; so is a <b> inside a <small>, and the words "<b>" inside an attribute's value).
 */
function nameOf(inner) {
  let depth = 0, drawing = 0;   // drawing: inside an <svg> or a <math>, where a tag that ends "/>" is closed (in HTML it is not: <div/> opens a div)
  for (const m of inner.matchAll(TAG)) {
    if (m[2] === undefined) continue;   // a comment
    const tag = m[2].toLowerCase(), foreign = tag === 'svg' || tag === 'math';
    if (m[1]) { depth = Math.max(0, depth - 1); if (foreign) drawing = Math.max(0, drawing - 1); continue; }
    if (depth === 0 && tag === 'b') {
      const after = m.index + m[0].length, close = m[3].trim() ? null : /^([^<]*)<\/b\s*>/i.exec(inner.slice(after));
      return close && close[1].trim() ? {from: m.index, to: after + close[0].length, text: close[1]} : null;
    }
    if (VOID.has(tag) || ((foreign || drawing > 0) && /\/\s*$/.test(m[3]))) continue;
    depth += 1;
    if (foreign) drawing += 1;
  }
  return null;
}

/**
 * A block's name as the steps fit it, and as the deck wrote it: {found, raw, label} — `raw` its words as written (an
 * entity stays an entity), `label` the plain words the steps fit (entities read; null when it has none to show, as a
 * name of a lone no-break space). Broken where the common package breaks: a no-break space, written or as an entity,
 * keeps two words on one line, and a space that comes out of an entity is inside a word, so the fitted break falls
 * between the words as written. Null for a block whose words have no name (nameOf).
 */
function nameWords(inner) {
  const found = nameOf(inner);
  if (!found) return null;
  const raw = found.text.split(BREAK).filter(Boolean), label = raw.map((word) => decodeEntities(word).replace(INSIDE, ' ')).join(' ');
  return {found, raw, label: label.trim() ? label : null};
}

/**
 * The words the steps fit for a block's name: the name, or — past the most letters they fit (ISO_MAP_LIMITS.label,
 * 2000: fitting takes time that grows with a name) — its first so many. A name that long is still drawn whole, broken
 * where its first letters break, and said not to fit (fitOf), as 0.32.0 said it: it never hides a name.
 */
const fittedPart = (label) => (label === null || [...label].length <= ISO_MAP_LIMITS.label ? label : [...label].slice(0, ISO_MAP_LIMITS.label).join(''));
/** What the steps fitted of a name, as the deck says it: a name cut to be fitted does not fit, whatever its start does. */
const fitOf = (fit, label) => (fit && label !== null && label !== fittedPart(label) ? {...fit, fits: false} : fit);

/**
 * A block's words with its name as the steps fitted it to its top face (buildIsoMap · names: `fit`, {lines, size,
 * fits} — wordsToFit, the same rule a film uses: one line, then two, then smaller). It stays as written when it fits on
 * one line; else it is broken where the fitted lines break and given the fitted size. Gives {inner, tight}: `tight` the
 * name, when it does not fit even at the least size on two lines — the build says so (check · name-fit), it never
 * hides a name. WHY counted in letters: a build has no browser. `build --layout` measures the page itself.
 */
function nameFitted(inner, words, fit) {
  if (!words || !fit) return {inner, tight: null};
  const {lines, size, fits} = fit, {found, raw, label} = words;
  if (fits && lines.length === 1 && size === DECK.name.size) return {inner, tight: null};
  const first = lines[0].split(' ').length, written = lines.length === 2 ? `${raw.slice(0, first).join(' ')}<br>${raw.slice(first).join(' ')}` : raw.join(' ');
  const name = `<b${size === DECK.name.size ? '' : ` style="font-size:${size}px"`}>${written}</b>`;
  return {inner: inner.slice(0, found.from) + name + inner.slice(found.to), tight: fits ? null : label.length > SHOWN ? `${label.slice(0, SHOWN)}…` : label};
}

/**
 * One piece, drawn: its element placed and sized by the floor, its faces, its words on its top face, a floor's label.
 * `mark`, on a map whose blocks move (motionDraw.js): {index, mover} — every block's words carry its index
 * (data-sd-say), and a block that moves carries it on its element (data-sd-moving) and has its faces and words in a
 * wrapper the move transforms (data-sd-mover), so a click's focus, which moves the element, is never replaced by it.
 */
function draw(p, html, shape, level, tight, mark = null) {
  const {box, art, say} = shape;
  const placed = [`left:${fixed(box.x)}px`, `top:${fixed(box.y)}px`, `width:${fixed(box.w)}px`, `height:${fixed(box.h)}px`, ...(level === null ? [] : [`z-index:${level}`])];
  const css = [...placed, p.style.trim()].filter(Boolean).join(';');
  let at = p.styleCut;   // its attributes without its style (and without data-iso): the one style written below is its only one
  at = attrRule('class').test(at) ? at.replace(attrRule('class'), (_, q, v) => ` class=${q}${/(^|\s)iso(\s|$)/.test(v) ? v : `iso ${v}`}${q}`) : `${at} class="iso"`;
  const svg = `<svg class="iso-art" viewBox="0 0 ${fixed(box.w)} ${fixed(box.h)}" aria-hidden="true">${art}</svg>`;
  // its name as the steps fitted it to its top face
  const fitted = say && p.inner.trim() ? nameFitted(p.inner, shape.words, shape.fit) : null;
  if (fitted?.tight) tight.push({name: p.name, text: fitted.tight});
  const words = fitted ? `<span class="iso-say"${mark ? ` data-sd-say="${mark.index}"` : ''} style="left:${fixed(say.x - box.x)}px;top:${fixed(say.y - box.y)}px">${fitted.inner}</span>` : '';
  const named = p.label ? floorLabelHtml(p, shape, box, tight) : '';
  // a floor is ground: a camera frames what stands on it, never the floor itself (focus.js) — unless it says otherwise
  // (data-ground="false"), or it is a group's named area (data-iso-group with a data-label): the picture is fitted to hold
  // it, and a view that frames it holds its words. Any other floor, a labelled one too, stays ground (README "Ground").
  const ground = p.kind === 'floor' && !(p.label && p.group !== null) && ownAttribute(at, 'data-ground') === null ? ' data-ground' : '';
  const drawn = mark?.mover ? `<span class="iso-motion" data-sd-mover="${mark.index}">${svg}${words}</span>` : `${svg}${words}`;
  return `<${p.tag}${at}${ground} data-sd-iso="${p.kind}"${mark?.mover ? ` data-sd-moving="${mark.index}"` : ''} style=${p.quote}${css}${p.quote}>${drawn}${named}${html.slice(p.close, p.end)}`;
}

/**
 * A floor's label as drawn — its name flat on the floor along its front edge, the way a diagram heads a group box:
 *
 *   <div data-k="prod" data-iso="floor" data-size="8 5" data-label="Production account" data-icon="account"></div>
 *
 * Where it lies is the steps' (buildIsoMap · floorLabels: footprint-story/isometric · floorLabelPlace, along the
 * floor's cols, just in from the edge nearest the viewer on the left, fitted with wordsToFit, moved half a tile at a
 * time clear of the blocks — by the block each stands in, the deck's policy — footprints and laid cables drawn over
 * it), so a film lays it in the same place. Here it is a span inside the floor's element, so it greys, lights and
 * hides with its floor; its icon first; a label too long for its edge, or covered all along it, is said (tight →
 * check · name-fit) — never cut. WHY flat: a plate standing on the floor reads as one more object; words on the
 * ground read as the name of the ground.
 */
function floorLabelHtml(p, {label: place, iconSvg}, box, tight) {
  const letters = [...p.label], said = letters.length > SHOWN ? `${letters.slice(0, SHOWN).join('')}…` : p.label;
  if (!place.fits) tight.push({name: p.name, text: said, on: 'floor'});
  if (place.covered) tight.push({name: p.name, text: said, on: 'floor-covered'});
  const [a, b, c, d] = place.matrix.map((v) => +v.toFixed(4));
  const style = `left:${fixed(place.x - box.x)}px;top:${fixed(place.y - box.y)}px;font-size:${place.size}px;transform:matrix(${a},${b},${c},${d},0,0) translateY(-100%)`;
  return `<span class="iso-floor-label" style="${style}">${iconSvg ?? ''}${place.lines.map(esc).join('<br>')}</span>`;
}

/**
 * Every isometric piece in some HTML drawn on its floor; HTML without one (and without a floor set) comes back as it
 * was. `canvas`: [w, h], the slide; `area`: [x0, y0, x1, y1], where a fitted picture goes (the deck's area: below the
 * headline, above the footer); `links`: [[from, to]] by piece name, what the map's wires join — what the build places
 * the blocks from, when the map places none itself.
 */
export const isoPieces = (html, options) => isoDrawn(html, options).html;

/**
 * isoPieces, with what a helper that draws between pieces needs of an isometric one: {html, shapes, solids, floor} —
 * `shapes` a Map from a block's or a cylinder's name to {name, outline: [[x, y], …], middle: [x, y]} in slide px (the
 * points round what it draws, and the middle of that) and {kind, at: [col, row, lift], size} in tiles (where it
 * stands); `solids`: every block and cylinder so, those that share a name too (a wire cannot end at one of them, and
 * still must not run under it); `tight`: the names that do not fit their block's face even broken and shrunk,
 * [{name, text}]; `made`: how the map was made — {placed: 'build' | 'hand', tile, fitted, style?} (`style` the built map's {row, options}, only on a map that writes a data-style); `built`: {spec, map} — the
 * spec the steps were handed and the map they built, both frozen, for the run's map flow (run/maps.js);
 * `floor(col, row, lift)`: where a point of the floor is on the slide, [x, y] (absent when the map has no isometric
 * piece); `routes`: one entry a link — the way the steps laid that wire along the floor ({route, lift}, as cable.js ·
 * cablesOn reads it), or null. A block is not the box it is placed by: a wire between two blocks is a cable along the
 * floor, from a foot of one to a foot of the other (cable.js), and a wire from a block to a flat piece ends on the
 * block's outline (transforms.js). A name two pieces share has no shape: it is found by its box, as before.
 *
 * The map is built by footprint-story's steps (isoSpec.js · builtMap: buildIsoMap, the deck's policy): the blocks
 * placed (by the map, or from `links`), the wires that lie along the floor laid round what stands on it
 * (`floorWires(solids)`: one entry a link, [fromEnd, toEnd] or null — transforms.js · floorLinks), the floors fitted,
 * the grid chosen, the names fitted, the floor labels placed and the paint order — the same steps a film builds its
 * map with. Here: the HTML read, the deck's own refusals, and the page written from the built map.
 */
export function isoDrawn(html, {canvas = null, area = null, links = [], floorWires = null, icons = {}, movers = null} = {}) {
  const shapes = new Map(), solids = [], tight = [], levels = new Map();
  if (!MAYBE.test(html) && !MAYBE_GRID.test(html) && !MAYBE_STYLE.test(html) && !mayHoldFootprint(html)) return {html, shapes, solids, tight};
  // the map's style first (isoStyle.js): its <i> taken out before the grid's is read, so one written beside the grid is
  // refused in the style's words, with its fix
  const {html: unstyled, style} = readStyle(html);
  const {html: map, grid: written, numbers: gridWritten, fit = false} = readGrid(unstyled), found = readIso(map), feet = readFootprints(map);
  // a style paints the blocks, cylinders and floors: on a map with none it would say nothing, so it is refused, not dropped
  if (style && !found.length) throw new Error('data-style: a map\'s style paints its isometric pieces (data-iso), and this map has none — take the style out, or add a block');
  if (!found.length && !feet.length) {
    if (fit) throw new Error('data-iso-grid="fit": the grid is fitted to the blocks, and this map has none — add a block, or take the grid out');
    return {html: map, shapes, solids, tight};
  }
  // a footprint's piece stands where its style puts it: a floor fitted to the slide would move under it
  if (feet.length && fit) throw new Error(`${feet[0].where}: a footprint's piece stands where its own style puts it, so the floor is written in numbers beside it — data-iso-grid="120 at 960 240", not "fit"`);
  // floor kept clear under words placed by their own style (keepClear.js): known only on a floor that does not move
  const clear = mayKeepClear(map) ? readKeepClear(map) : [];
  if (clear.length && fit) throw new Error(`${clear[0].where}: the floor kept clear is the floor under the piece where its style puts it, so the floor is written in numbers beside it — data-iso-grid="120 at 960 240", not "fit"`);
  if (found.length + feet.length > MOST_ISO_PIECES) throw new Error(`a map holds at most ${MOST_ISO_PIECES} isometric pieces${feet.length ? ' and footprints together' : ''}, and this one has ${found.length + feet.length}`);
  // a map whose blocks move spreads its paint levels `stride` apart, a level between two still blocks for each that moves
  // (motionDraw.js): they must all stay under the callouts' level (ISO_CSS), so such a map holds fewer pieces
  const stride = movers?.size ? movers.size + 2 : 2, standingCount = found.filter((p) => p.kind !== 'floor').length + feet.length;
  if (stride * standingCount > 2 * MOST_ISO_PIECES) throw new Error(`a map whose blocks move holds at most ${Math.floor((2 * MOST_ISO_PIECES) / stride)} blocks, cylinders and footprints with ${movers.size} of them moving, and this one has ${standingCount} — move fewer blocks on this map, or tell it in two maps`);
  const solid = found.filter((p) => p.kind !== 'floor'), floors = found.filter((p) => p.kind === 'floor'), standing = [...solid, ...feet];
  const byBuild = checkPlacing(solid, feet, clear);
  // the floor kept clear at each height something stands at, where a cable could run under the words: worked out from
  // each box on the grid that does not move (the written one, else the usual one), and handed to the steps in tiles
  // (with floor kept clear, every block has its data-at: checkPlacing)
  const lifts = clear.length ? [...new Set(standing.map((p) => p.at[2] ?? 0))] : [], fixedGrid = clear.length ? written ?? isometric(usualGrid(canvas)) : null;
  const budget = {left: MOST_KEEP, most: MOST_KEEP};
  // (the kit knows each stretch by a number of ours, `name`; `piece` is the deck's name, any text a deck holds)
  const keep = clear.flatMap(({name, box, where}, k) => lifts.flatMap((lift) => keptFloor(box, fixedGrid, lift, where, budget).map(({at, size}) => ({at, size, name: String(k), piece: name}))));
  // the wires that lie along the floor (their ports checked in the deck's words, transforms.js · floorLinks)
  const ends = floorWires ? floorWires(standing.map((p) => ({name: p.name, kind: p.kind, size: [...p.size], ports: p.ports}))) : links.map(() => null);
  checkFloors(floors, solid, feet);
  const fitted = !written && (fit || byBuild);
  // a block's name, as the steps fit it
  const words = solid.map((p) => (p.inner.trim() ? nameWords(p.inner) : null));
  const {map: built, spec, ids, routes} = builtMap({
    blocks: solid.map((p, i) => ({name: p.name, kind: p.kind, at: p.at, size: p.size, label: fittedPart(words[i]?.label ?? null), rule: words[i]?.label ? p.rule : null, group: p.group, ports: p.ports, who: p.where})),
    floors: floors.map((f) => ({name: f.name, at: f.at, size: f.size, label: f.label, icon: Boolean(f.icon), group: f.group, who: f.where})),
    obstacles: feet.map((f) => ({name: f.name, at: f.at, size: f.size, ports: f.ports, who: f.where})),
    keep, links, ends, grid: gridWritten ?? (fit ? 'fit' : null), canvas, area: areaOf(solid, {fitted, canvas, area}), style,
  });
  const grid = isometric({tile: built.view.tile, origin: built.view.origin, rise: built.view.rise});
  // each piece where the map put it, drawn — its name and its floor's label as the steps fitted them
  const drawnOf = new Map([
    ...solid.map((p, i) => [p, {...artOf(built.shapes[i], built.paints[i], true, style !== null), words: words[i], fit: fitOf(built.names[i], words[i]?.label ?? null), drawn: built.shapes[i], id: ids.blocks[i]}]),
    ...floors.map((p, i) => [p, {...artOf(built.floorShapes[i], built.floorPaints[i], false, style !== null), label: built.floorLabels[i]}]),
    ...feet.map((p, i) => [p, {drawn: built.obstacleShapes[i], id: ids.obstacles[i]}]),
  ]);
  // a floor label's icon, from the deck's icons: one it does not have is refused, naming the ones it has
  for (const p of floors) {
    if (!p.icon) continue;
    if (!Object.hasOwn(icons, p.icon)) { const known = Object.keys(icons); throw new Error(`${p.where}: no icon "${p.icon}" (${known.length ? `there are ${known.join(', ')}` : 'the deck has no icons'}) — add icons/${p.icon}.svg`); }
    drawnOf.get(p).iconSvg = `<svg class="ic iso-floor-icon" viewBox="${icons[p.icon].viewBox}" aria-hidden="true">${icons[p.icon].body}</svg>`;
  }
  // the order they are painted in, the furthest first (the steps' `order`): a level each, above the floor and the wires
  // (which share level 0). The levels are even (2, 4, …): the odd one above a block's is where a cable's lead into a port
  // on its seen side stands (transforms.js · leadSvg), over that block and under the next. A footprint's piece takes its
  // place in that order too.
  const levelOf = (p) => stride * (built.order.indexOf(drawnOf.get(p).id) + 1);
  // a block that moves, by its index among the blocks: its name is its own (a move of a name two pieces share is refused)
  const markOf = (p) => (movers?.size && p.kind !== 'floor' ? {index: solid.indexOf(p), mover: movers.has(p.name) && solid.filter((o) => o.name === p.name).length === 1} : null);
  let out = '', from = 0;
  for (const p of [...found, ...feet].sort((a, b) => a.start - b.start)) {
    if (p.kind === 'footprint') out += paintFootprints(map.slice(from, p.end), [{...p, start: p.start - from, end: p.end - from}], () => levelOf(p));
    else out += map.slice(from, p.start) + draw(p, map, drawnOf.get(p), p.kind === 'floor' ? null : levelOf(p), tight, markOf(p));
    from = p.end;
  }
  const twice = new Set(standing.map((p) => p.name).filter((name, i, all) => all.indexOf(name) !== i));
  standing.forEach((p, i) => {
    // a footprint's outline is the floor it takes, raised to its height: what a cable's label keeps clear of
    const {drawn: {outline, box}} = drawnOf.get(p), at = i < solid.length ? built.at[i] : p.at;
    const shape = {name: p.name, outline: outline.map(([x, y]) => [x, y]), middle: [box.x + box.w / 2, box.y + box.h / 2], kind: p.kind, at: [at[0], at[1], at[2] ?? 0], size: [...p.size], ports: p.ports, level: levelOf(p)};
    solids.push(shape);
    if (twice.has(p.name)) return;
    levels.set(p.name, shape.level);
    // a wire to a footprint's piece that is not laid along the floor ends on the piece's own box, as a flat piece's does
    if (p.kind !== 'footprint') shapes.set(p.name, shape);
  });
  // a group's floor names an area, so the fitted picture holds all of it: how far past the slide's area it runs, in px
  const areas = floors.flatMap((f, i) => (f.group === null ? [] : [built.floorTiles[i]])).flatMap(({at: [c, r], size: [w, d]}) => [[c, r], [c + w, r], [c, r + d], [c + w, r + d]]);
  const outside = fitted && areas.length ? beyondArea(areas.map(([c, r]) => grid.at(c, r)), area ?? [0, 0, ...(canvas ?? [1920, 1080])]) : 0;
  // the break rules its writer picked, by block (none written: nothing here, so a map that picks none records as before)
  const breaks = found.filter((p) => p.rule).map((p) => [p.name, p.rule]);
  // the hand-drawn strokes its pieces draw, and that a page does not play their time (isoPaint.js · strokesDrawn): only
  // on a map whose style draws some, so every other map records as before
  const strokes = strokesDrawn([...built.paints, ...built.floorPaints]);
  const made = {placed: built.placed, tile: built.view.tile[0], fitted: built.grid === 'fitted', ...(feet.length ? {footprints: feet.length} : {}), ...(outside > 0.5 ? {outside: Math.round(outside)} : {}), ...(breaks.length ? {breaks} : {}), ...(style ? {style: built.style} : {}), ...(strokes ? {strokes} : {})};
  // what motionPlan.js plans on, for a map whose blocks move: each block where the map built it, with its words' fit and level
  const motion = movers?.size ? {grid, view: {tile: [...built.view.tile], origin: [...built.view.origin], rise: built.view.rise}, blocks: solid.map((p, i) => ({name: p.name, kind: p.kind, at: [built.at[i][0], built.at[i][1], built.at[i][2] ?? 0], size: [...p.size],
    box: built.shapes[i].box, outline: built.shapes[i].outline.map(([x, y]) => [x, y]), say: [...built.shapes[i].centre], fit: drawnOf.get(p).fit, small: smallOf(p.inner), level: levelOf(p),
    ...(twice.has(p.name) ? {twice: true} : {})})), obstacles: feet.map((f) => ({name: f.name, kind: 'footprint', at: [f.at[0], f.at[1], f.at[2] ?? 0], size: [...f.size], level: levelOf(f)}))} : null;
  return {html: out + map.slice(from), shapes, solids, tight, levels, made, built: {spec, map: built}, routes, ...(motion ? {motion} : {}), floor: (col, row, lift = 0) => { const point = grid.at(col, row, lift); return [point.x, point.y]; }};
}

const TONE = 'var(--iso-color, var(--sd-tone, #d9e4f3))';
const INK = 'var(--iso-ink, #14181f)';
const HOT = 'var(--sd-hot, #ef4444)', HOT_WIDTH = '5px';
/** A piece with faces: a block or a cylinder (a floor is lines on the ground). */
const SOLID = '[data-sd-iso="block"], [data-sd-iso="cylinder"]';
/** Four hard shadows, one a side: a ring `width` wide round whatever the element paints. */
const ringFilter = (colour, width) => [`${width} 0`, `-${width} 0`, `0 ${width}`, `0 -${width}`].map((at) => `drop-shadow(${at} 0 ${colour})`).join(' ');

/**
 * The rules that ring the isometric pieces `piece` picks (a selector that ends on the piece), in `colour`: round the
 * faces of a block or a cylinder, along the edge of a floor — never round the box the piece is placed by. The ring is
 * on the faces alone, so the piece's own filter (grey, a glow) stays its state's and its words are not ringed. Each
 * rule has no weight. Whoever rings a piece by its box takes that ring off an isometric one and writes these.
 */
export const isoRing = (piece, colour, width = '4px') => `:where(${piece}:is(${SOLID}) .iso-art) { filter: ${ringFilter(colour, width)}; }
:where(${piece}[data-sd-iso="floor"] .iso-ground) { stroke: ${colour}; stroke-width: ${width}; }`;
/**
 * An isometric piece's look, each rule with no weight and only inside a slide, so a deck's rule wins. One colour a
 * piece (--iso-color): its top a little lighter, its two sides darker by different amounts, as light from the upper
 * left would leave them. Its words are drawn flat on its top face, in --iso-ink (dark by default, as the faces are light).
 */
/** A floor label's look (floorLabelHtml): the page carries it only when a floor has a label, so every other page is as before. (Its own comment, written into the page, still says floorLabel.js — kept, so a page is byte for byte as before.) */
export const FLOOR_LABEL_CSS = `/* a floor's label (floorLabel.js): flat on the floor along its front edge, a part of the floor that greys and lights with it */
:where(section[data-label] .iso-floor-label) {
  position: absolute; transform-origin: 0 0; white-space: nowrap; line-height: 1.15;
  font-family: var(--sans, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif); font-weight: 700; letter-spacing: .02em;
  color: var(--iso-label, color-mix(in srgb, var(--fg, #14181f) 72%, transparent));
}
:where(section[data-label] .iso-floor-icon) { width: 1.15em; height: 1.15em; vertical-align: -0.2em; margin-right: .35em; color: currentColor; }`;

export const ISO_CSS = `/* isometric pieces: blocks on a floor seen from a corner (deck/iso.js) */
:where(section[data-label] [data-sd-iso]) { position: absolute; box-sizing: border-box; --sd-hot-width: 0px; --iso-turn: var(--sd-turn, 0s); }
/* what it draws takes the pointer: its faces and its words, never the empty corners of its box. Only on the slide
   shown (deck-stage's [data-deck-active]): a slide that takes no pointer stays that way — "auto" written on a face
   would bring it back there — and a piece shown anywhere else (a Read lens) is left as it was */
:where(section[data-label][data-deck-active] [data-sd-iso]) { pointer-events: none; }
:where(section[data-label][data-deck-active] [data-sd-iso] :is(.iso-art > *, .iso-say)) { pointer-events: auto; }
:where(section[data-label] .iso-art) {
  position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; pointer-events: none;
  stroke: var(--iso-line, ${INK}); stroke-width: var(--iso-line-width, 2.5px); stroke-linejoin: round;
}
:where(section[data-label] .iso-top) { fill: color-mix(in srgb, ${TONE} 80%, #fff); }
:where(section[data-label] .iso-left) { fill: color-mix(in srgb, ${TONE} 94%, #000); }
:where(section[data-label] :is(.iso-right, .iso-side)) { fill: color-mix(in srgb, ${TONE} 82%, #000); }
:where(section[data-label] .iso-ground) { fill: var(--iso-floor, transparent); stroke: none; }
:where(section[data-label] .iso-lines) { fill: none; stroke: var(--iso-grid, color-mix(in srgb, var(--fg, #14181f) 16%, transparent)); stroke-width: 1.5px; }
:where(section[data-label] .iso-say) {
  position: absolute; translate: -50% -50%; display: grid; justify-items: center; gap: 2px; text-align: center; white-space: nowrap;
  font: 700 26px/1.15 var(--sans, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif); color: ${INK};
}
:where(section[data-label] .iso-say small) { font-size: 18px; font-weight: 500; color: color-mix(in srgb, ${INK} 68%, transparent); }
:where(section[data-label] .iso-say svg.ic) { width: 40px; height: 40px; color: ${INK}; }
/* a callout is words about the picture: over every block, whose levels end at ${2 * MOST_ISO_PIECES} (a lead into a port at one more) */
:where(section[data-label] [data-sd-callout]) { z-index: ${2 * MOST_ISO_PIECES + 2}; }
/* its highlight (data-hot) rings what it draws; the box's own ring is off (--sd-hot-width: 0, read by focus.css) */
${isoRing('section[data-label] .sd-hot', HOT, HOT_WIDTH)}
/* on a forward click the ring comes when a box's does: .3s after the piece's moment (--sd-turn: 0 off a route, its turn
   on one, later under a new blur). That moment is not inherited, so the piece hands it to its faces as --iso-turn */
@keyframes sdIsoRing { from { filter: ${ringFilter('transparent', HOT_WIDTH)}; } }
@media screen and (prefers-reduced-motion: no-preference) {
  :where(section[data-label][data-deck-active]:not([data-sd-instant]):not([data-deck-static]) .sd-hot-in:is(${SOLID}) .iso-art) { animation: sdIsoRing .6s ease calc(.3s + var(--iso-turn, 0s)) both; }
}
`;
