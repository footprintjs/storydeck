// nameInk — whether a map's words read on what they stand on, measured from the page's own CSS (a build has no
// browser): a block's name and its <small> line on its top face, a floor's label on its ground, on the page light and
// dark. What each piece's words stand on is collected as it is drawn (iso.js · wordsOn); the colours are the page's
// rules as written (iso.js · WORDS_CSS, LOOK_CSS; the look's tokens; the tokens theme.css sets on :root and :root.dark;
// the piece's own style and class), worked out here as a browser mixes them.
//
// WHY footprint-story's rule (0.41.0): which ink reads on a face is footprint-story/isometric's `readableInk` (WCAG 2's
// ratio, 4.5 : 1 for words, unrounded) — the rule StoryReel names its blocks by. One rule for both tools: a deck and a
// film call the same name on the same face readable, or not. The deck's colours stay its CSS, decided when the page is
// VIEWED (light or dark), so the build cannot pick the ink for the page; it measures what the page will draw, and a
// name that does not read is a finding (check · name-ink), with its fix — never a silent pass.
//
// What it does not read: a theme.css rule on anything but :root and :root.dark (a class's own --iso-color, a
// [data-theme] part's tokens), and a <small> line's or a name's own inline colour. A page in a part's data-theme is
// measured with the deck's tokens.
import {readableInk} from 'footprint-story/isometric';
import {pageAssets} from './assets.js';
import {LOOK_CSS, WORDS_CSS} from './iso.js';

// ─── the page's CSS, read as a browser reads its colours ──────────────────────────────────────────────────────────
/** A stylesheet without its comments. */
const uncommented = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');

/** The declarations of the first rule whose selector text holds `selector`: {property: value}. */
export const ruleOf = (css, selector) => {
  const at = css.indexOf(selector);
  if (at < 0) throw new Error(`no rule "${selector}"`);
  return Object.fromEntries([...css.slice(at).match(/\{([^}]*)\}/)[1].matchAll(/([\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
};

/** A stylesheet's top-level rules (an at-rule's inside is not one): [{selector, body}]. */
function topRules(css) {
  const text = uncommented(css), out = [];
  let depth = 0, from = 0, selector = null;
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] === '{') { if (depth === 0) { selector = text.slice(from, i).trim(); from = i + 1; } depth += 1; } else if (text[i] === '}' && depth > 0) {
      depth -= 1;
      if (depth === 0) { out.push({selector, body: text.slice(from, i)}); from = i + 1; }
    }
  }
  return out;
}

const ROOT = /^(?::where\(\s*:root\s*\)|:root)$/, ROOT_DARK = /^(?::where\(\s*:root\.dark\s*\)|:root\.dark)$/;
const declared = (body) => Object.fromEntries([...body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);?/g)].map((m) => [m[1], m[2].trim()]));

/** The tokens a stylesheet sets on the root, light and dark: {light, dark} (dark only what :root.dark sets). */
export function rootTokens(css) {
  const light = {}, dark = {};
  for (const {selector, body} of topRules(css ?? '')) {
    if (ROOT.test(selector)) Object.assign(light, declared(body));
    else if (ROOT_DARK.test(selector)) Object.assign(dark, declared(body));
  }
  return {light, dark};
}

/** The top-level arguments of a CSS function: "a, b(c, d), e" → ['a', 'b(c, d)', 'e']. */
function args(text) {
  const out = [];
  let depth = 0, from = 0;
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] === '(') depth += 1; else if (text[i] === ')') depth -= 1; else if (text[i] === ',' && !depth) { out.push(text.slice(from, i).trim()); from = i + 1; }
  }
  return [...out, text.slice(from).trim()];
}

/** A CSS colour the page's rules write — #hex, transparent, var(), color-mix(in srgb, …) — as [r, g, b, a] (0–255, alpha 0–1). */
export function colour(expr, vars, seen = 0) {
  if (seen > 32) throw new Error(`a colour's var() runs round: "${expr}"`);
  expr = expr.trim();
  if (expr === 'transparent') return [0, 0, 0, 0];
  if (/^#[0-9a-f]{3}$/i.test(expr)) return [...expr.slice(1)].map((c) => parseInt(c + c, 16)).concat(1);
  if (/^#[0-9a-f]{6}$/i.test(expr)) return [1, 3, 5].map((i) => parseInt(expr.slice(i, i + 2), 16)).concat(1);
  const fn = /^([\w-]+)\(([^]*)\)$/.exec(expr);
  if (fn?.[1] === 'var') { const [name, fallback] = args(fn[2]); return Object.hasOwn(vars, name) ? colour(vars[name], vars, seen + 1) : colour(fallback, vars, seen + 1); }
  if (fn?.[1] === 'color-mix') {
    const [space, a, b] = args(fn[2]);
    if (space !== 'in srgb') throw new Error(`a mix in "${space}"`);
    const part = (p) => { const m = /^(.*?)\s+(\d+(?:\.\d+)?)%$/.exec(p); return m ? [colour(m[1], vars, seen + 1), Number(m[2]) / 100] : [colour(p, vars, seen + 1), null]; };
    const [[ca, pa], [cb, pb]] = [part(a), part(b)], wa = pa ?? 1 - pb, wb = pb ?? 1 - pa;
    // premultiplied, as CSS mixes: a share of transparent is a share of alpha
    const alpha = ca[3] * wa + cb[3] * wb;
    return [0, 1, 2].map((i) => (alpha ? (ca[i] * ca[3] * wa + cb[i] * cb[3] * wb) / alpha : 0)).concat(alpha);
  }
  throw new Error(`no colour "${expr}"`);
}

/** `fg` laid over `bg` (its alpha blended), as the page shows it. */
export const over = (fg, bg) => [0, 1, 2].map((i) => fg[i] * fg[3] + bg[i] * (1 - fg[3])).concat(1);

/** An opaque colour as the screen holds it: #rrggbb, each channel rounded to a byte — what readableInk reads. */
export const hexOf = (c) => `#${c.slice(0, 3).map((v) => Math.min(255, Math.max(0, Math.round(v))).toString(16).padStart(2, '0')).join('')}`;

// ─── the measure ──────────────────────────────────────────────────────────────────────────────────────────────────
/** What a word is called in a finding. */
const SAID = {name: 'its name', small: 'its <small> line', label: 'its label'};
/** The variable a piece's words take their ink from: a block's name and small line --iso-ink, a floor's label --iso-label. */
const INK_VAR = {name: '--iso-ink', small: '--iso-ink', label: '--iso-label'};
/** The inks a fix may name, tried in this order: the darkest, then the lightest. */
const FIX_INKS = ['#000000', '#ffffff'];

/**
 * The two pages a deck can be viewed as, from its CSS: {light, dark}, each {vars, slide, tones, dark} — the tokens on
 * the root (the look's, then theme.css's, which wins: its :root outranks the look's :where()), the slide's colour
 * (deck.css on html, body), and the classes the look tones a piece by ([class, the --sd-tone it sets], in the look's order).
 */
export function pagesOf({config, themeCss}, {css, looks} = pageAssets()) {
  const look = config.look ? looks[config.look] : '';
  const base = rootTokens(look), own = rootTokens(themeCss);
  const deckCss = css.find((c) => c.includes(':where(html, body)'));
  const tones = [...uncommented(look).matchAll(/:where\(section\[data-label\] \.([\w-]+)\) \{ --sd-tone: ([^;]+); \}/g)].map((m) => [m[1], m[2].trim()]);
  const page = (vars, dark) => ({vars, slide: colour(ruleOf(deckCss, ':where(html, body)').background, vars), tones, dark});
  return {light: page({...base.light, ...own.light}, false), dark: page({...base.light, ...base.dark, ...own.light, ...own.dark}, true)};
}

/** The custom properties a piece's words are drawn with on `page`: the root's, its class's tone, a dark page's paper (LOOK_CSS), its own. */
function varsOf(piece, page) {
  const vars = {...page.vars};
  for (const [cls, tone] of page.tones) if (piece.classes.includes(cls)) vars['--sd-tone'] = tone;
  if (page.dark && piece.paper) Object.assign(vars, ruleOf(LOOK_CSS, '[data-sd-paper])'));
  return Object.assign(vars, piece.vars);
}

/** A word of a piece on `page`: its face and its ink as the screen shows them (#rrggbb), and readableInk's verdict. */
function wordOn(piece, word, page, vars = varsOf(piece, page)) {
  const face = over(colour(piece.face ?? WORDS_CSS[piece.kind === 'floor' ? 'ground' : 'top'], vars), page.slide);
  const ink = over(colour(WORDS_CSS[word], vars), face);
  return {face: hexOf(face), ...readableInk(hexOf(face), [hexOf(ink)])};
}

/** An ink the piece could write beside it that reads for every word it shows, on every page: the first of FIX_INKS, or null. */
function inkFix(piece, pages) {
  return FIX_INKS.find((ink) => piece.words.every((word) => pages.every((page) => wordOn(piece, word, page, {...varsOf(piece, page), [INK_VAR[word]]: ink}).reads))) ?? null;
}

/** The tone class the look colours a piece by (the last of the look's that it carries: its rule is written last), or null. */
const toneOf = (piece, page) => page.tones.filter(([cls]) => piece.classes.includes(cls)).at(-1)?.[0] ?? null;

/** A ratio as a finding says it: to the tenth, rounded down, so a word under the line never reads as on it. */
const down = (r) => Math.floor(r * 10) / 10;

/** A piece measured on both pages: [{word, on, fix}] for each word that does not read, or {unmeasured} when a colour cannot be read. */
function measured(piece, pages) {
  try {
    return piece.words.flatMap((word) => {
      const on = [pages.light, pages.dark].map((p) => ({page: p.dark ? 'dark' : 'light', ...wordOn(piece, word, p)})).filter((w) => !w.reads);
      if (!on.length) return [];
      const ink = inkFix(piece, [pages.light, pages.dark]);
      return [{word, on: on.map(({page, ratio, face}) => ({page, ratio: down(ratio), face})), fix: ink && {variable: INK_VAR[word], ink}}];
    });
  } catch (e) {
    // a colour the reader does not know (rgb(), a named colour, oklch …): said, never passed as if it read
    return {unmeasured: e.message};
  }
}

/**
 * Every word of a compiled deck's maps that does not read on what it stands on, on the page light or dark:
 * [{map, name, kind, word, tone, on: [{page, ratio, face}], fix}] — `fix` the ink the piece could write beside it
 * ({variable, ink}), or null when no ink reads there and only a lighter face does; `tone` the look's class that colours
 * it, or null. Measured by readableInk at 4.5 : 1. A piece whose colours the reader cannot read is one entry
 * {map, name, kind, unmeasured}: the check says so rather than pass it. `assets`: pageAssets(), by default.
 */
export function inksFound(compiled, assets) {
  const pages = pagesOf(compiled, assets), out = [];
  for (const [map, {faces = []}] of Object.entries(compiled.maps)) {
    for (const piece of faces) {
      const said = {map, name: piece.name, kind: piece.kind}, found = measured(piece, pages);
      if (!Array.isArray(found)) out.push({...said, ...found});
      else for (const f of found) out.push({...said, tone: toneOf(piece, pages.light), ...f});
    }
  }
  return out;
}

/** A finding in words, with its fix: what check · name-ink says. */
export function inkMessage({name, kind, word, tone, on, fix, unmeasured}) {
  const face = kind === 'floor' ? 'its floor' : `its ${kind}'s top`;
  if (unmeasured) return `"${name}": the build cannot measure whether its words read on ${face} (${unmeasured}) — write its colours as #rrggbb, var() or color-mix(in srgb, …) to have them measured`;
  const where = on.map((o, i) => (i === 0 ? `${o.ratio} : 1 on ${face} (${o.face}${tone ? `, class "${tone}"` : ''}) on a ${o.page} page` : `${o.ratio} : 1 (${o.face}) on a ${o.page} one`)).join(' and ');
  const lighter = kind === 'floor' ? 'give the floor a lighter ground (--iso-floor)' : `give the ${kind} a lighter colour (--iso-color)${tone ? `, or another class than "${tone}"` : ''}`;
  return `"${name}": ${SAID[word]} stands ${where}, under the 4.5 : 1 words need to read — ${fix ? `write its ink beside it (style="${fix.variable}:${fix.ink}"), or ${lighter}` : lighter}`;
}
