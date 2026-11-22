// pageColours — what a built deck page shows, in colours, read from the page's own CSS: the base look's tokens
// (look-base.css, light and dark), deck.css, ISO_CSS, FLOOR_LABEL_CSS and LOOK_CSS as the page carries them, and the
// slide's HTML as written (its inline styles, its classes). A test asks it how a map's words and lines stand against
// what lies under them, in either theme — the contrast a reader sees — without a browser. Its numbers were checked
// against Chromium's computed styles on built pages (0.40.0, the CHANGELOG says how).
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {ISO_CSS, FLOOR_LABEL_CSS, LOOK_CSS} from '../iso.js';
import {inlineStrokes} from '../isoPaint.js';

const read = (file) => readFileSync(path.join(process.cwd(), file), 'utf8');

/** The base look's tokens, light and dark, as look-base.css writes them on :root and :root.dark. */
export function tokens() {
  const css = read('look-base.css');
  const block = (sel) => Object.fromEntries([...new RegExp(`:where\\(${sel.replace('.', '\\.')}\\) \\{([^}]*)\\}`).exec(css)[1].matchAll(/(--[\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
  const light = block(':root');
  return {light, dark: {...light, ...block(':root.dark')}};
}
/** The declarations of the rule `selector` opens in a stylesheet: {property: value}. */
export const ruleOf = (css, selector) => {
  const at = css.indexOf(selector);
  if (at < 0) throw new Error(`no rule "${selector}"`);
  return Object.fromEntries([...css.slice(at).match(/\{([^}]*)\}/)[1].matchAll(/([\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
};
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
export function colour(expr, vars) {
  expr = expr.trim();
  if (expr === 'transparent') return [0, 0, 0, 0];
  if (/^#[0-9a-f]{3}$/i.test(expr)) return [...expr.slice(1)].map((c) => parseInt(c + c, 16)).concat(1);
  if (/^#[0-9a-f]{6}$/i.test(expr)) return [1, 3, 5].map((i) => parseInt(expr.slice(i, i + 2), 16)).concat(1);
  const fn = /^([\w-]+)\(([^]*)\)$/.exec(expr);
  if (fn?.[1] === 'var') { const [name, fallback] = args(fn[2]); return Object.hasOwn(vars, name) ? colour(vars[name], vars) : colour(fallback, vars); }
  if (fn?.[1] === 'color-mix') {
    const [space, a, b] = args(fn[2]);
    if (space !== 'in srgb') throw new Error(`a mix in "${space}"`);
    const part = (p) => { const m = /^(.*?)\s+(\d+(?:\.\d+)?)%$/.exec(p); return m ? [colour(m[1], vars), Number(m[2]) / 100] : [colour(p, vars), null]; };
    const [[ca, pa], [cb, pb]] = [part(a), part(b)], wa = pa ?? 1 - pb, wb = pb ?? 1 - pa;
    // premultiplied, as CSS mixes: a share of transparent is a share of alpha
    const alpha = ca[3] * wa + cb[3] * wb;
    return [0, 1, 2].map((i) => (alpha ? (ca[i] * ca[3] * wa + cb[i] * cb[3] * wb) / alpha : 0)).concat(alpha);
  }
  throw new Error(`no colour "${expr}"`);
}
/** `fg` laid over `bg` (its alpha blended), as the page shows it. */
export const over = (fg, bg) => [0, 1, 2].map((i) => fg[i] * fg[3] + bg[i] * (1 - fg[3])).concat(1);
const lum = (c) => { const [r, g, b] = c.slice(0, 3).map((v) => { const s = v / 255; return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
/** WCAG 2's contrast ratio of two opaque colours. */
export const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)]; return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const round = (v) => Math.round(v * 10) / 10;
/** A property of a tag's style attribute ("stroke" is not "stroke-width"), or undefined. */
const inline = (tag, prop) => new RegExp(`style="(?:[^"]*;)?${prop}:([^;"]+)`).exec(tag ?? '')?.[1];
const first = (html, re) => re.exec(html)?.[0] ?? null;

/**
 * A built deck's first slide, as a page in `mode` ('light' | 'dark') shows it, against what lies under each:
 *   name    a block's name on its top face          label   the floor's label on its ground
 *   line    the block's edge (its faces' outline, or a hand-drawn stroke) on its top face
 *   edge?   a contour (its outside band) on the slide            cable?  a wire's label on its plate
 *   ring    the highlight ring (--sd-hot) on the slide, round a block   floorRing  on the floor's ground
 * `withLook` false: as if the page did not carry LOOK_CSS (what a dark page drew before 0.40.0).
 */
export function measure(deck, mode, {withLook = true} = {}) {
  const page = tokens()[mode], html = inlineStrokes(deck.slides[0].html, deck.strokeDefs ?? {});
  const look = withLook && mode === 'dark' && deck.looks;
  const varsOf = (kind) => {
    const vars = {...page}, tag = first(html, new RegExp(`<div [^>]*data-sd-iso="${kind}"[^>]*>`));
    // the look's rules set custom properties on the pieces, on a dark page: every piece, then a paper map's
    if (look) Object.assign(vars, ruleOf(LOOK_CSS, '[data-sd-iso])'), tag.includes(' data-sd-paper') ? ruleOf(LOOK_CSS, '[data-sd-paper])') : {});
    return vars;
  };
  const block = varsOf('block'), floor = varsOf('floor');
  const slide = colour(ruleOf(read('deck.css'), ':where(html, body)').background, page);
  const art = ruleOf(ISO_CSS, '.iso-art) {');
  const topTag = first(html, /<polygon class="iso-top"[^>]*>/), groundTag = first(html, /<polygon class="iso-ground"[^>]*>/);
  const top = over(colour(inline(topTag, 'fill') ?? ruleOf(ISO_CSS, '.iso-top)').fill, block), slide);
  const ground = over(colour(inline(groundTag, 'fill') ?? ruleOf(ISO_CSS, '.iso-ground)').fill, floor), slide);
  const name = over(colour(ruleOf(ISO_CSS, '.iso-say) {').color, block), top);
  const label = over(colour(ruleOf(FLOOR_LABEL_CSS, '.iso-floor-label)').color, floor), ground);
  // the edge a block is drawn with: a hand-drawn stroke's fill, else its top face's own stroke, else the page's
  const sketch = first(html, /<path class="iso-ink"[^>]*>/);
  const lineExpr = sketch ? inline(sketch, 'fill') : inline(topTag, 'stroke') ?? art.stroke;
  const line = over(colour(lineExpr, block), top);
  const contourTag = first(html, /<polygon class="iso-contour"[^>]*>/);
  const edge = contourTag && over(colour(inline(contourTag, 'stroke') ?? (look ? ruleOf(LOOK_CSS, '.iso-contour)').stroke : art.stroke), block), slide);
  // a wire's label: its text in the wire's colour (a request's, the base look's --fg), on its plate
  const wireTag = first(html, /<svg [^>]*class="wire[ "][^>]*>/);
  const cable = wireTag && html.includes('<text class="label"') ? ratio(over(colour(/\breq\b/.test(wireTag) ? ruleOf(read('look-base.css'), 'svg.wire.req)').color : ruleOf(read('deck.css'), ':where(svg.wire)').color, page), slide),
    over(colour(ruleOf(read('deck.css'), 'svg.wire rect.plate)').fill, page), slide)) : null;
  // the highlight's colour, as ISO_CSS rings a lit piece with it (iso.js · isoRing)
  const hot = colour(/var\(--sd-hot, #[0-9a-f]{6}\)/.exec(ISO_CSS)[0], page);
  return {name: round(ratio(name, top)), label: round(ratio(label, ground)), line: round(ratio(line, top)), ...(edge ? {edge: round(ratio(edge, slide))} : {}),
    ...(cable ? {cable: round(cable)} : {}), ring: round(ratio(hot, slide)), floorRing: round(ratio(hot, ground))};
}
