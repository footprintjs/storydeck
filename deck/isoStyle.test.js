// isoStyle: a map's style, named on an <i data-style> of its own and handed to the map steps. A map with none is drawn
// as before; an outlined one writes its 5 px strokes, a no-outline one writes none; every refusal names the fix in the
// deck's words; the floor's focus ring still rings; and the record says which style drew the map.
import {describe, it, expect} from 'vitest';
import {ISO_STYLE_COLUMNS, ISO_STYLE_CHOICES} from 'footprint-story/isometric';
import {isoPieces, isoDrawn, isoRing, ISO_CSS} from './iso.js';
import {parseStyle, readStyle} from './isoStyle.js';
import {PAGE_STROKES} from './isoPaint.js';
import {compileDeck} from './compile.js';
import {sourceOf} from './test/helpers.js';

const canvas = [1920, 1080];
const GRID = '<i data-iso-grid="120 at 960 240"></i>';
const MAP = `<div data-k="floor" data-iso="floor" data-size="8 5"></div>
<div data-k="you" data-iso="block" data-at="0 3" data-size="2 2 0.3"><b>You</b></div>
<i data-k="w1" class="wire pkt" data-arrow="you to server"></i>
<div data-k="server" data-iso="block" data-at="3 1" data-size="2 2 1.4"><b>Server</b></div>
<div data-k="db" data-iso="cylinder" data-at="6 0" data-size="1.6 1.6 1.2"><b>Database</b></div>`;
/** A map placed by the build, with a group's labelled floor: the other way a map is made. */
const BUILT = `<div data-k="g" data-iso="floor" data-iso-group="back" data-label="Backend"></div>
<div data-k="api" data-iso="block" data-iso-group="back"><b>API</b></div>
<div data-k="db" data-iso="cylinder" data-iso-group="back"><b>DB</b></div>
<i data-k="w" class="wire" data-arrow="api to db"></i>`;
const styled = (style, map = MAP) => `${map}<i data-style="${style}"></i>`;
/** Each face element of a drawn page: its tag, as written. */
const faces = (html) => html.match(/<(?:polygon|ellipse|path) class="iso-(?:left|right|top|side)"[^>]*>/g);
const ground = (html) => html.match(/<polygon class="iso-ground"[^>]*>/g);
const lines = (html) => html.match(/<path class="iso-lines"[^>]*>/g);

describe('isoStyle · a map takes a style (data-style)', () => {
  it('a map with no data-style is drawn byte for byte as before, and one that writes the usual look is too', () => {
    for (const map of [MAP, BUILT]) {
      const plain = isoDrawn(map, {canvas});
      // the usual look named in full: the same page, the same spec bar the style named, the same map
      const usual = isoDrawn(styled('shape: box; shading: tones; line: ink width 2.5; palette: theme; texture: none', map), {canvas});
      expect(usual.html).toBe(plain.html);
      expect(usual.built.map.paints).toEqual(plain.built.map.paints);
      // with none, the spec hands no style and `made` records none: the record of a map with none is as before
      expect(plain.built.spec).not.toHaveProperty('style');
      expect(plain.made).not.toHaveProperty('style');
      expect(plain.html).not.toMatch(/ stroke(-width|-linejoin|-linecap|-opacity)?="/);
    }
    // a map with nothing isometric is the very string it was
    const flat = '<div data-k="a" class="box" style="left:0px;top:0px;width:10px;height:10px" title="data-style">a</div>';
    expect(isoPieces(flat, {canvas})).toBe(flat);
  });

  it('an outlined map writes 5 px strokes on every face, and nothing else changes', () => {
    for (const map of [MAP, BUILT]) {
      const plain = isoPieces(map, {canvas}), out = isoPieces(styled('line: ink width 5', map), {canvas});
      expect(faces(out).length).toBeGreaterThan(0);
      for (const face of faces(out)) expect(face).toMatch(/^<\w+ class="iso-\w+" stroke-width="5" /);
      expect(out.replaceAll(' stroke-width="5"', '')).toBe(plain);
      // the floor keeps the page's: its ground no stroke of its own, its tile lines the CSS's
      for (const g of ground(out)) expect(g).not.toMatch(/stroke/);
      for (const l of lines(out) ?? []) expect(l).not.toMatch(/stroke/);
    }
  });

  it('a no-outline map writes no stroke on its faces (stroke="none" over the CSS\'s ink), and its floor keeps its tile lines', () => {
    const plain = isoPieces(MAP, {canvas}), out = isoPieces(styled('line: none'), {canvas});
    for (const face of faces(out)) expect(face).toMatch(/^<\w+ class="iso-\w+" stroke="none" /);
    expect(out.replaceAll(' stroke="none"', '')).toBe(plain);
    expect(lines(out)).toHaveLength(1);
    expect(lines(out)[0]).not.toMatch(/stroke/);
  });

  it('keeps the floor\'s focus ring working: nothing on .iso-ground for the ring\'s rule to lose to, and the rule still there', () => {
    for (const style of ['line: ink width 5', 'line: none', 'line: ink width 0.5']) {
      for (const g of ground(isoPieces(styled(style), {canvas}))) expect(g).toMatch(/^<polygon class="iso-ground" points="/);
    }
    // the ring sets the floor's stroke by a CSS rule, which wins over any presentation attribute the painter writes
    expect(isoRing('.x', 'red')).toContain(':where(.x[data-sd-iso="floor"] .iso-ground) { stroke: red; stroke-width: 4px; }');
    expect(ISO_CSS).toContain(isoRing('section[data-label] .sd-hot', 'var(--sd-hot, #ef4444)', '5px'));
  });

  it('the page\'s CSS is the usual style\'s look: the strokes the painter leaves unwritten are the ones ISO_CSS draws', () => {
    const face = PAGE_STROKES.top;
    for (const role of ['left', 'right', 'side']) expect(PAGE_STROKES[role]).toEqual(face);
    expect(ISO_CSS).toContain(`stroke: var(--iso-line, var(--iso-ink, #14181f)); stroke-width: var(--iso-line-width, ${face.width}px); stroke-linejoin: ${face.join};`);
    expect(face).toMatchObject({alpha: 1, cap: 'butt'});   // SVG's own cap, and no opacity: neither written in the CSS
    expect(PAGE_STROKES.ground).toBeNull();
    expect(ISO_CSS).toContain('.iso-ground) { fill: var(--iso-floor, transparent); stroke: none; }');
    expect(ISO_CSS).toContain(`.iso-lines) { fill: none; stroke: var(--iso-grid, color-mix(in srgb, var(--fg, #14181f) ${PAGE_STROKES.grid.alpha * 100}%, transparent)); stroke-width: ${PAGE_STROKES.grid.width}px; }`);
  });

  it('is read as plain words: "column: choice", options by name and value, columns apart with ";", effects apart with ","', () => {
    const w = 'data-style';
    expect(parseStyle('line: ink width 5', w)).toEqual({line: {name: 'ink', width: 5}});
    expect(parseStyle('  line:none ; shading: tones;  ', w)).toEqual({line: 'none', shading: 'tones'});
    expect(parseStyle('line: ink width .5', w)).toEqual({line: {name: 'ink', width: 0.5}});
    // written on its own <i>, taken out of the map; an entity read as its letter
    expect(readStyle('<b>x</b><i data-style="line: ink width&#32;6"></i><b>y</b>')).toEqual({html: '<b>x</b><b>y</b>', style: {line: {name: 'ink', width: 6}}});
    expect(readStyle('<b>x</b>')).toEqual({html: '<b>x</b>', style: null});
    // the columns and choices are the kit's (a new one in the kit is a new case here)
    expect(ISO_STYLE_COLUMNS).toEqual(['shape', 'shading', 'line', 'palette', 'texture', 'effects']);
    expect(ISO_STYLE_CHOICES.line).toEqual(['ink', 'none']);
  });

  it('refuses, naming the map and the fix in the deck\'s words: an unknown column, an unknown choice with the ones there are, a bad option', () => {
    const refused = (style, map = MAP) => () => compileDeck(sourceOf({clicks: '<section data-label="S" data-map="m"><step data-in="you"><h2>A</h2></step></section>', maps: {m: styled(style, map)}}));
    expect(refused('lines: none')).toThrow('map "m": data-style="lines: none": a style\'s columns are shape, shading, line, palette, texture, effects — not "lines"');
    expect(refused('line: dotted')).toThrow('map "m": data-style="line: dotted": the line has no choice "dotted" — there are "ink", "none"');
    expect(refused('effects: glow')).toThrow('data-style="effects: glow": the effects has no choice "glow" — there are none yet');
    expect(refused('line: ink width 30')).toThrow('data-style="line: ink width 30": the line "ink" takes a width from 0.5 to 20 px — not 30');
    expect(refused('line: ink width')).toThrow('data-style="line: ink width": an option of the line "ink" is its name and its value, "width 5" — not "width"');
    expect(refused('line: ink colour red')).toThrow('data-style="line: ink colour red": the line "ink" takes width — not "colour"');
    expect(refused('line: none width 5')).toThrow('the line "none" takes no options — not "width"');
    expect(refused('line: ink width 4 width 5')).toThrow('the line "ink" says its width twice — keep one');
    expect(refused('line: ink __proto__ 1')).toThrow('the line "ink" takes width — not "__proto__"');
    expect(refused('line: ink width big')).toThrow('takes a width from 0.5 to 20 px — not "big"');
    expect(refused('line: ink; line: none')).toThrow('data-style="line: ink; line: none": the line is written twice — keep one');
    expect(refused('ink 5')).toThrow('each column is written "column: choice", apart with ";" — not "ink 5"');
    expect(refused('line:')).toThrow('the line names its choice — "line: ink"');
    expect(refused(' ; ')).toThrow('a style names at least one column, "column: choice" — <i data-style="line: ink width 5"></i>, or take it out for today\'s look');
  });

  it('refuses a style anywhere but an empty <i> of its own, two of them, and one on a map with nothing to paint', () => {
    expect(() => isoPieces(MAP.replace('data-at="0 3"', 'data-at="0 3" data-style="line: none"'), {canvas})).toThrow('data-style: a map\'s style is set on an empty <i> of its own, in lower case and with quotes — <i data-style="line: ink width 5"></i> (it styles the whole map, so it is never on a piece\'s <div>)');
    expect(() => isoPieces(`${MAP}<i data-iso-grid="fit" data-style="line: none"></i>`, {canvas})).toThrow('data-style: the style\'s <i> carries nothing else (it is not a piece, and is taken out of the map) — write <i data-style="line: ink width 5"></i> and put "data-iso-grid="fit"" on an <i> of its own');
    expect(() => isoPieces(`${MAP}<i data-k="s" data-style="line: none"></i>`, {canvas})).toThrow('put "data-k="s"" on a piece');
    expect(() => isoPieces(`${MAP}<i data-style="line: none">x</i>`, {canvas})).toThrow('set on an empty <i> of its own');
    expect(() => isoPieces(`${MAP}<i data-style=line></i>`, {canvas})).toThrow('set on an empty <i> of its own');
    expect(() => isoPieces(`${MAP}<span data-style="line: none"></i>`, {canvas})).toThrow('never on a piece\'s <span>');
    expect(() => isoPieces(`${MAP}<i data-style="line: none" data-style="line: ink"></i>`, {canvas})).toThrow('set on an empty <i> of its own');
    expect(() => isoPieces(`${styled('line: none')}<i data-style="line: ink"></i>`, {canvas})).toThrow('data-style: a map has one style, and this one sets 2 — keep one');
    expect(() => isoPieces('<div data-k="a" class="box" style="left:0px;top:0px;width:10px;height:10px">a</div><i data-style="line: none"></i>', {canvas})).toThrow('data-style: a map\'s style paints its isometric pieces (data-iso), and this map has none — take the style out, or add a block');
    // a style beside the grid, each on its own <i>: both read
    expect(isoPieces(`${GRID}${styled('line: ink width 5')}`, {canvas})).toContain('stroke-width="5"');
  });

  it('records the style a map used: the spec the steps were handed and the built map say it, and `made` carries it', () => {
    const {built, made} = isoDrawn(styled('line: ink width 5', BUILT), {canvas});
    expect(built.spec.style).toEqual({line: {name: 'ink', width: 5}});
    expect(Object.isFrozen(built.spec.style.line)).toBe(true);
    const used = {row: {shape: 'box', shading: 'tones', line: 'ink', palette: 'theme', texture: 'none', effects: []}, options: {line: {width: 5}}};
    expect(built.map.style).toEqual(used);
    expect(made.style).toEqual(used);
  });
});
