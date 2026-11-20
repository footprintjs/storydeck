// A floor's label in a map (data-label, data-icon): what the build hands footprint-story/isometric · floorLabelPlace to
// keep clear of, how the label is drawn, and what check says. Where the label lies is the story library's, tested there.
import {describe, it, expect} from 'vitest';
import {isometric, MOST_FLOOR_LABEL as MOST_LABEL} from 'footprint-story/isometric';
import {transformed} from './transforms.js';
import {checkDeck} from './check.js';
import {compileDeck} from './compile.js';
import {sourceOf} from './test/helpers.js';

const canvas = [1920, 1080];
const grid = '<i data-iso-grid="120 at 960 150"></i>', floor = isometric({tile: 120, origin: [960, 150]});
const icons = {acct: {viewBox: '0 0 10 10', body: '<rect width="10" height="10"/>'}};
const labelOf = (html) => /<span class="iso-floor-label" style="([^"]*)">(.*?)<\/span>/.exec(html);

describe('floorLabel · a cable over a group\'s floor', () => {
  it('in a map, the label of a group\'s floor moves off the cable that comes into it', () => {
    const b = (k, g) => `<div data-k="${k}" data-iso="block" data-iso-group="${g}"><b>${k}</b></div>`;
    const html = `<div data-k="f1" data-iso="floor" data-iso-group="a" data-label="Front"></div><div data-k="f2" data-iso="floor" data-iso-group="b" data-label="Back team"></div>${b('x', 'a')}${b('y', 'b')}<i data-k="w" class="wire" data-arrow="x to y"></i>`;
    const with_ = transformed(html, {canvas}).html, without = transformed(html.replace('<i data-k="w" class="wire" data-arrow="x to y"></i>', ''), {canvas}).html;
    const left = (h) => Number(/data-k="f2"[\s\S]*?class="iso-floor-label" style="left:([\d.]+)px/.exec(h)[1]);
    expect(left(with_)).not.toBe(left(without));
  });
});

describe('floorLabel · what the map hands it to keep clear of', () => {
  const g = '<i data-iso-grid="120 at 960 150"></i>';
  const fl = '<div data-k="p" data-iso="floor" data-at="0 0" data-size="8 5" data-label="Home"></div>';
  const col = (html) => { const m = /class="iso-floor-label" style="left:([\d.]+)px;top:([\d.]+)px/.exec(html); const f = /data-k="p"[^>]*style="left:([\d.-]+)px;top:([\d.-]+)px/.exec(html); return floor.tileAt(Number(f[1]) + Number(m[1]), Number(f[2]) + Number(m[2])).col; };

  it('a flat footprint over the label\'s first place moves it on', () => {
    const alone = transformed(`${g}${fl}`, {canvas}).html;
    expect(col(alone)).toBeCloseTo(0.3, 6);
    const foot = '<div data-k="mat" data-footprint="0 4 1 1" style="left:1px;top:1px;width:9px;height:9px"></div>';
    expect(col(transformed(`${g}${fl}${foot}`, {canvas}).html)).toBeGreaterThan(0.31);
  });

  it('a cable laid along the floor\'s front edge moves it on: the blocks stay where they are, only the wire is added', () => {
    const blocks = '<div data-k="a" data-iso="block" data-at="-3 4" data-size="1 1 0.3" data-ports="o: 1 0.5 0.1"></div><div data-k="b" data-iso="block" data-at="4 4" data-size="1 1 0.3" data-ports="i: 0 0.5 0.1"></div>';
    const without = transformed(`${g}${fl}${blocks}`, {canvas}).html;
    expect(col(without)).toBeCloseTo(0.3, 6);
    const made = transformed(`${g}${fl}${blocks}<i data-k="w" class="wire" data-arrow="a.o to b.i"></i>`, {canvas});
    expect(made.cables).toHaveLength(1);
    expect(col(made.html)).toBeGreaterThan(5);   // past the cable and the block it plugs into
    expect(made.tight).toEqual([]);
    // laid the whole length of the edge, it leaves no clear place: said covered
    const long = transformed(`${g}${fl}${blocks.replace('data-at="4 4"', 'data-at="9 4"')}<i data-k="w" class="wire" data-arrow="a.o to b.i"></i>`, {canvas});
    expect(long.tight).toEqual([{name: 'p', text: 'Home', on: 'floor-covered'}]);
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
    expect(inner).toBe('<svg class="ic iso-floor-icon" viewBox="0 0 10 10" aria-hidden="true"><rect width="10" height="10"/></svg>Prod &amp; &lt;b&gt;');
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
    // letters, not code units: 61 emoji are 61 letters; a control or a direction override is refused
    expect(() => transformed(map(` data-label="${'\u{1F600}'.repeat(61)}"`), {canvas})).not.toThrow();
    for (const odd of ['&#x202E;evil', 'a&#0;b', '&#xD800;', 'a&#x200F;b', 'a&#xFEFF;b', 'a&#x200B;b']) expect(bad(` data-label="${odd}"`), odd).toThrow('a floor\'s label is plain words — take out the control or direction character in it');
    // a label wrapped onto two lines in the file is one line; a joiner inside an emoji stays
    expect(labelOf(transformed(map(' data-label="Production\n\taccount"'), {canvas}).html)[2]).toBe('Production account');
    expect(() => transformed(map(' data-label="Dev &#x1F468;&#x200D;&#x1F4BB;"'), {canvas})).not.toThrow();
    // what check shows of a long label is cut by letters, never inside one
    const tight = transformed(`${grid}<div data-k="p" data-iso="floor" data-size="2 2" data-label="${'\u{1F600}'.repeat(81)}"></div>`, {canvas}).tight;
    expect(tight[0].text).toBe(`${'\u{1F600}'.repeat(80)}…`);
    expect(() => transformed(`${grid}<div data-k="b" data-iso="block" data-at="0 0" data-icon="acct"></div>`, {canvas, icons})).toThrow('"b" (data-iso="block"): data-icon on an isometric piece is the icon of a floor\'s label');
  });

  it('a labelled floor that names no group stays ground; the page carries the label\'s stylesheet only when a floor has a label', () => {
    expect(/<div data-k="prod"[^>]*>/.exec(transformed(map(' data-label="Prod"'), {canvas}).html)[0]).toContain('data-ground');
    const deck = (m) => compileDeck(sourceOf({clicks: '<section data-label="S" data-map="map"><step data-in="*"><h2>All</h2></step></section>', maps: {map: m}}));
    expect(deck(map(' data-label="Prod"')).floorLabels).toBe(true);
    expect(deck(map('')).floorLabels).toBeUndefined();
  });

  it('a floor without a label is drawn byte for byte as before; a block may carry a data-label of its own', () => {
    expect(transformed(map(''), {canvas}).html).not.toContain('iso-floor-label');
    expect(transformed(`${grid}<div data-k="b" data-iso="block" data-at="0 0" data-label="x"></div>`, {canvas}).html).toContain('data-label="x"');
  });
});
