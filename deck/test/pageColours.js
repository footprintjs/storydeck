// pageColours — what a built deck page shows, in colours, read from the page's own CSS: the base look's tokens
// (look-base.css, light and dark), deck.css, ISO_CSS, FLOOR_LABEL_CSS and LOOK_CSS as the page carries them, and the
// slide's HTML as written (its inline styles, its classes). A test asks it how a map's words and lines stand against
// what lies under them, in either theme — the contrast a reader sees — without a browser. Its numbers were checked
// against Chromium's computed styles on built pages (0.40.0, the CHANGELOG says how). Since 0.41.0 the colours are
// read by the build's own reader (nameInk.js) and the ratio is footprint-story's (contrastRatio), on each colour as the
// screen holds it, a byte a channel.
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {contrastRatio} from 'footprint-story/isometric';
import {ISO_CSS, FLOOR_LABEL_CSS, LOOK_CSS} from '../iso.js';
import {inlineStrokes} from '../isoPaint.js';
import {colour, hexOf, over, rootTokens, ruleOf} from '../nameInk.js';

// the page's CSS read as a browser reads its colours: the build's own reader (nameInk.js), so a test and the check agree
export {colour, over, ruleOf};

const read = (file) => readFileSync(path.join(process.cwd(), file), 'utf8');

/** The base look's tokens, light and dark, as look-base.css writes them on :root and :root.dark (the build's reader, nameInk.js · rootTokens). */
export function tokens() {
  const {light, dark} = rootTokens(read('look-base.css'));
  return {light, dark: {...light, ...dark}};
}
/** WCAG 2's contrast ratio of two opaque colours, as footprint-story measures it (isometric · contrastRatio: the rule
 * the build's name-ink check reads too, nameInk.js), on the colours as the screen holds them (#rrggbb). */
export const ratio = (a, b) => contrastRatio(hexOf(a), hexOf(b));
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
