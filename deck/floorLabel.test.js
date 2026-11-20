import {describe, it, expect} from 'vitest';
import {isometric} from 'footprint-story/isometric';
import {floorLabelPlace, MOST_LABEL} from './floorLabel.js';
import {transformed} from './transforms.js';
import {checkDeck} from './check.js';
import {compileDeck} from './compile.js';
import {sourceOf} from './test/helpers.js';

const canvas = [1920, 1080];
const grid = '<i data-iso-grid="120 at 960 150"></i>', floor = isometric({tile: 120, origin: [960, 150]});
const icons = {acct: {viewBox: '0 0 10 10', body: '<rect width="10" height="10"/>'}};
const labelOf = (html) => /<span class="iso-floor-label" style="([^"]*)">(.*?)<\/span>/.exec(html);

describe('floorLabel · where a floor\'s name lies', () => {
  it('lies flat along the floor\'s near-left edge, a little in from its far end, sized from the tile', () => {
    const place = floorLabelPlace({at: [0, 0], size: [8, 5]}, floor, 'Production account');
    const start = floor.at(0.3, 4.85);
    expect([place.x, place.y]).toEqual([start.x, start.y]);
    // a line runs along the cols, a line's height toward the far rows: both unit steps of the floor
    const col = [60, 30].map((v) => v / Math.hypot(60, 30));
    expect(place.matrix.map((v) => +v.toFixed(6))).toEqual([col[0], col[1], -col[0], col[1]].map((v) => +v.toFixed(6)));
    expect(place).toMatchObject({size: 20, lines: ['Production account'], fits: true, covered: false});
    // a bigger tile, bigger words, up to the most; a smaller one, smaller, down to the least
    expect(floorLabelPlace({at: [0, 0], size: [8, 5]}, isometric({tile: 300, origin: [0, 0]}), 'x').size).toBe(28);
    expect(floorLabelPlace({at: [0, 0], size: [8, 5]}, isometric({tile: 40, origin: [0, 0]}), 'x').size).toBe(14);
  });

  it('breaks and shrinks a label too long for the edge, and says when it still does not fit', () => {
    const place = floorLabelPlace({at: [0, 0], size: [2, 2]}, floor, 'Production account with a long name');
    expect(place).toMatchObject({size: 14, fits: false});
    expect(place.lines).toHaveLength(2);
  });

  it('moves along the edge, half a tile at a time, clear of what stands over it — and says when there is no clear place', () => {
    const at = (c, r, size) => floor.block({at: [c, r], size}).outline.map(({x, y}) => [x, y]);
    const free = floorLabelPlace({at: [0, 0], size: [8, 5]}, floor, 'Home');
    // a tall block standing in front of the edge's far end covers it there: the words move on
    const moved = floorLabelPlace({at: [0, 0], size: [8, 5]}, floor, 'Home', [at(0, 5, [2, 1, 1.2])]);
    expect(moved.covered).toBe(false);
    expect(moved.x).toBeGreaterThan(free.x);
    const {col} = floor.tileAt(moved.x, moved.y);
    expect((col - 0.3) % 0.5).toBeCloseTo(0, 9);
    // a block that stands well behind the edge covers nothing
    expect(floorLabelPlace({at: [0, 0], size: [8, 5]}, floor, 'Home', [at(1, 0, [2, 2, 1])])).toEqual(free);
    // the whole edge taken: the first place, said covered
    const wall = floorLabelPlace({at: [0, 0], size: [8, 5]}, floor, 'Home', [at(0, 4.5, [8, 1, 1])]);
    expect(wall).toMatchObject({covered: true, x: free.x, y: free.y});
  });
});

describe('floorLabel · a labelled floor in a map (data-label, data-icon)', () => {
  const map = (more) => `${grid}<div data-k="prod" data-iso="floor" data-size="8 5"${more}></div><div data-k="a" data-iso="block" data-at="1 1"><b>A</b></div>`;

  it('draws the label inside the floor\'s element — it greys, lights and hides with its floor — with its icon first, escaped', () => {
    const {html} = transformed(map(' data-label="Prod &amp; &lt;b&gt;" data-icon="acct"'), {canvas, icons});
    const floorTag = /<div data-k="prod"[^>]*>/.exec(html)[0];
    expect(floorTag).not.toMatch(/data-label|data-icon/);   // read and drawn by the build, not left for a reader of the page
    const [, style, inner] = labelOf(html);
    expect(style).toMatch(/^left:[\d.]+px;top:[\d.]+px;font-size:20px;transform:matrix\(0\.8944,0\.4472,-0\.8944,0\.4472,0,0\) translateY\(-100%\)$/);
    expect(inner).toBe('<svg class="iso-floor-icon" viewBox="0 0 10 10" aria-hidden="true"><rect width="10" height="10"/></svg>Prod &amp; &lt;b&gt;');
    expect(html.indexOf('iso-floor-label')).toBeLessThan(html.indexOf('data-k="a"'));   // inside the floor, before the next piece
  });

  it('a floor written as an empty <i> keeps its icon for its label (it is no icon of its own)', () => {
    const html = `${grid}<i data-k="prod" data-iso="floor" data-size="8 5" data-label="Prod" data-icon="acct"></i>`;
    expect(labelOf(transformed(html, {canvas, icons}).html)[2]).toContain('iso-floor-icon');
  });

  it('check says a label that does not fit, or that is covered all along its edge', () => {
    const tight = transformed(`${grid}<div data-k="p" data-iso="floor" data-size="2 2" data-label="${'Long name '.repeat(6)}"></div>`, {canvas}).tight;
    expect(tight).toEqual([{name: 'p', text: 'Long name '.repeat(6).trim(), on: 'floor'}]);
    const covered = transformed(`${grid}<div data-k="p" data-iso="floor" data-size="8 5" data-label="Home"></div><div data-k="w" data-iso="block" data-at="0 4.5" data-size="8 1 1"></div>`, {canvas}).tight;
    expect(covered).toEqual([{name: 'p', text: 'Home', on: 'floor-covered'}]);
    // what check says of each, with the fix
    const said = (map2) => checkDeck(compileDeck(sourceOf({clicks: '<section data-label="S" data-map="map"><step data-in="*"><h2>All</h2></step></section>', maps: {map: map2}}))).filter((p) => p.rule === 'name-fit').map((p) => p.message);
    expect(said(`${grid}<div data-k="p" data-iso="floor" data-size="2 2" data-label="${'Long name '.repeat(6)}"></div><div data-k="a" data-iso="block" data-at="5 5"></div>`)).toEqual([expect.stringContaining('"p": its label "Long name Long name Long name Long name Long name Long name" does not fit along the floor\'s front edge, even on two lines at the least size — shorten it, or give the floor more cols (data-size)')]);
    expect(said(`${grid}<div data-k="p" data-iso="floor" data-size="8 5" data-label="Home"></div><div data-k="w" data-iso="block" data-at="0 4.5" data-size="8 1 1"></div>`)).toEqual([expect.stringContaining('"p": its label "Home" is covered: something stands on the floor\'s front edge all along it')]);
  });

  it('refuses, naming the floor and the fix, what it cannot draw', () => {
    const bad = (more, set = icons) => () => transformed(map(more), {canvas, icons: set});
    expect(bad(' data-label="  "')).toThrow(`"prod" (data-iso="floor"): a floor's label is a name of 1 to ${MOST_LABEL} letters — not none`);
    expect(bad(` data-label="${'x'.repeat(MOST_LABEL + 1)}"`)).toThrow(`a floor's label is a name of 1 to ${MOST_LABEL} letters — not ${MOST_LABEL + 1} letters`);
    expect(bad(' data-icon="acct"')).toThrow('"prod" (data-iso="floor"): data-icon on a floor goes beside its label — give the floor a data-label too');
    expect(bad(' data-label="P" data-icon="nope"')).toThrow('"prod" (data-iso="floor"): no icon "nope" (there are acct) — add icons/nope.svg');
    expect(bad(' data-label="P" data-icon="a b"')).toThrow('data-icon names an icon of the deck (icons/<name>.svg) — not "a b"');
    expect(bad(' data-label=P')).toThrow('its data-label is written data-label="…", once, with quotes');
    expect(() => transformed(`${grid}<div data-k="b" data-iso="block" data-at="0 0" data-icon="acct"></div>`, {canvas, icons})).toThrow('"b" (data-iso="block"): data-icon on an isometric piece is the icon of a floor\'s label');
  });

  it('a floor without a label is drawn byte for byte as before; a block may carry a data-label of its own', () => {
    expect(transformed(map(''), {canvas}).html).not.toContain('iso-floor-label');
    expect(transformed(`${grid}<div data-k="b" data-iso="block" data-at="0 0" data-label="x"></div>`, {canvas}).html).toContain('data-label="x"');
  });
});
