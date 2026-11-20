import {describe, it, expect} from 'vitest';
import {arrange} from 'footprint-story/isometric';
import {arrangeByGroup, groupWritten} from './groups.js';
import {isoDrawn} from './iso.js';
import {transformed, wireLinks} from './transforms.js';
import {checkDeck} from './check.js';
import {compileDeck} from './compile.js';
import {sourceOf} from './test/helpers.js';

const canvas = [1920, 1080];
const block = (k, g, kind = 'block', more = '') => `<div data-k="${k}" data-iso="${kind}"${g ? ` data-iso-group="${g}"` : ''}${more}><b>${k}</b></div>`;
const wire = (k, arrow) => `<i data-k="${k}" class="wire" data-arrow="${arrow}"></i>`;
const floors = '<div data-k="f-front" data-iso="floor" data-iso-group="front" data-label="Frontend team"></div><div data-k="f-back" data-iso="floor" data-iso-group="back" data-label="Backend team"></div>';
const teams = `${floors}${block('web', 'front')}${block('cdn', 'front')}${block('api', 'back')}${block('db', 'back', 'cylinder')}${block('queue', 'back')}${wire('w1', 'cdn to web')}${wire('w2', 'web to api')}${wire('w3', 'api to db')}${wire('w4', 'api to queue')}`;
/** Each piece's place and size in tiles, as the drawing placed it: read back from its own drawing (the floor's data-at is the build's). */
const placed = (html) => {
  const seen = [];
  isoDrawn(html, {canvas, links: wireLinks(html), lay: (solids) => { seen.push(...solids); return []; }});
  return Object.fromEntries(seen.map((s) => [s.name, {at: s.at, size: s.size}]));
};
const overlapping = (a, b) => a.at[0] < b.at[0] + b.size[0] && b.at[0] < a.at[0] + a.size[0] && a.at[1] < b.at[1] + b.size[1] && b.at[1] < a.at[1] + a.size[1];

describe('groups · blocks that belong together, each group on its floor (data-iso-group)', () => {
  it('places each group\'s blocks together and the groups apart, the flow left to right, with no number typed', () => {
    const at = placed(teams);
    const box = (names) => ({c0: Math.min(...names.map((n) => at[n].at[0])), c1: Math.max(...names.map((n) => at[n].at[0] + at[n].size[0])), r0: Math.min(...names.map((n) => at[n].at[1])), r1: Math.max(...names.map((n) => at[n].at[1] + at[n].size[1]))});
    const front = box(['web', 'cdn']), back = box(['api', 'db', 'queue']);
    // the two groups' boxes, each with its floor's tile all round, do not meet: a clear tile at least between the floors
    const apart = front.c1 + 1 < back.c0 - 1 || back.c1 + 1 < front.c0 - 1 || front.r1 + 1 < back.r0 - 1 || back.r1 + 1 < front.r0 - 1;
    expect(apart).toBe(true);
    // left to right on the slide (col − row grows to the right): the frontend leads to the backend
    const x = (b) => (b.c0 + b.c1) / 2 - (b.r0 + b.r1) / 2;
    expect(x(front)).toBeLessThan(x(back));
    for (const [a, b] of [['web', 'cdn'], ['api', 'db'], ['api', 'queue'], ['db', 'queue']]) expect(overlapping(at[a], at[b]), `${a} ${b}`).toBe(false);
  });

  it('fits each group\'s floor round its own blocks, a tile clear — and the picture holds both floors', () => {
    const {html} = transformed(teams, {canvas});
    const floorBox = (k) => { const m = new RegExp(`data-k="${k}"[^>]*style="left:([\\d.-]+)px;top:([\\d.-]+)px;width:([\\d.]+)px;height:([\\d.]+)px`).exec(html); return m.slice(1).map(Number); };
    const [fx, fy, fw, fh] = floorBox('f-front'), [bx, by, bw, bh] = floorBox('f-back');
    for (const [x, y, w, h] of [[fx, fy, fw, fh], [bx, by, bw, bh]]) expect(x >= 0 && y >= 0 && x + w <= 1920 && y + h <= 1080).toBe(true);
    expect(fx).toBeLessThan(bx);   // the frontend's floor starts left of the backend's
    // a labelled floor is not ground: a view that frames it holds its words
    expect(/<div data-k="f-front"[^>]*>/.exec(html)[0]).not.toContain('data-ground');
  });

  it('arranges each group on the wires inside it, then the groups as things on the wires between them', () => {
    const solid = [{name: 'a', size: [2, 2, 1], group: 'x'}, {name: 'b', size: [2, 2, 1], group: 'x'}, {name: 'c', size: [2, 2, 1], group: 'y'}, {name: 'd', size: [2, 2, 1], group: null}];
    const calls = [];
    const spy = (things, links, options) => { calls.push({names: things.map((t) => t.name), links, options}); return arrange(things, links, options); };
    const at = arrangeByGroup(solid, [['a', 'b'], ['b', 'c'], ['c', 'd'], ['a', 'a']], spy);
    expect(at).toHaveLength(4);
    expect(calls.map((c) => c.names)).toEqual([['a', 'b'], ['c'], ['d'], ['g:x', 'g:y', '\u0001']]);
    expect(calls[0].links).toEqual([['a', 'b'], ['a', 'a']]);
    expect(calls[3].links).toEqual([['g:x', 'g:y'], ['g:y', '\u0001']]);
    expect(calls[3].options).toEqual({across: true});   // arrange's own gaps between groups: a tall group does not hide the next
  });

  it('keeps a clear tile between floors even when groups stand on half tiles (floors never meet at a corner)', () => {
    const one = (k, g, size) => `<div data-k="${k}" data-iso="block" data-iso-group="${g}" data-size="${size}"></div>`;
    const html = [0, 1, 2, 3].map((i) => `<div data-k="f${i}" data-iso="floor" data-iso-group="g${i}"></div>`).join('')
      + one('b0', 'g0', '2 3 2.1') + one('b1', 'g1', '3 3 0.2') + one('b2', 'g2', '1 3 2.5') + one('b3', 'g3', '3 3 0') + wire('w1', 'b1 to b2') + wire('w2', 'b0 to b2');
    // the floors' places in tiles, read from what the build fitted them to
    const fitted = {};
    const solids = placed(html);
    for (const [i, name] of ['b0', 'b1', 'b2', 'b3'].entries()) {
      const {at, size} = solids[name];
      fitted[`f${i}`] = {c0: Math.floor(at[0] + 1e-9) - 1, r0: Math.floor(at[1] + 1e-9) - 1, c1: Math.ceil(at[0] + size[0] - 1e-9) + 1, r1: Math.ceil(at[1] + size[1] - 1e-9) + 1};
    }
    const keys = Object.keys(fitted);
    for (const a of keys) for (const b of keys) {
      if (a >= b) continue;
      const A = fitted[a], B = fitted[b];
      const gap = Math.max(B.c0 - A.c1, A.c0 - B.c1, B.r0 - A.r1, A.r0 - B.r1);
      expect(gap, `${a} ${b}`).toBeGreaterThanOrEqual(1);
    }
  });

  it('lets arrange keep its own gap by height between groups, so a tall group does not hide the one behind it', () => {
    const tall = (k, g) => `<div data-k="${k}" data-iso="block" data-iso-group="${g}" data-size="2 2 3"></div>`;
    const html = `<div data-k="s" data-iso="block" data-iso-group="gs"></div>${tall('a', 'ga')}${tall('b', 'gb')}${wire('w1', 's to a')}${wire('w2', 's to b')}`;
    const at = placed(html);
    // a and b stand apart by more than their height's gap would let one hide the other (arrange gives 4.5 for height 3)
    const apart = Math.max(Math.abs(at.a.at[0] - at.b.at[0]) - 2, Math.abs(at.a.at[1] - at.b.at[1]) - 2);
    expect(apart).toBeGreaterThanOrEqual(4.5 - 1e-9);
  });

  it('fits a map of several groups at a smaller tile than blocks alone, and says when the picture still runs past the slide', () => {
    const chain = (n) => Array.from({length: n}, (_, i) => `<div data-k="f${i}" data-iso="floor" data-iso-group="g${i}" data-label="Tier ${i}"></div>${block(`a${i}`, `g${i}`)}${block(`b${i}`, `g${i}`)}${wire(`in${i}`, `a${i} to b${i}`)}${i ? wire(`x${i}`, `b${i - 1} to a${i}`) : ''}`).join('');
    const three = transformed(chain(3), {canvas, area: [80, 200, 1840, 1000]});
    expect(three.made.tile).toBeLessThan(96);
    expect(three.made.outside).toBeUndefined();
    const many = transformed(chain(9), {canvas, area: [80, 200, 1840, 1000]});
    expect(many.made.outside).toBeGreaterThan(0);
    // and check says so, with the fix
    const said = checkDeck(compileDeck(sourceOf({clicks: '<section data-label="S" data-map="map"><step data-in="*"><h2>All</h2></step></section>', maps: {map: chain(9)}}))).filter((p) => p.rule === 'map-fit');
    expect(said).toEqual([expect.objectContaining({level: 'warn', message: expect.stringMatching(/^map "map": its groups need more room than the slide has — at the least tile the picture runs \d+ px past the slide's area: tell it in two maps, or put fewer groups side by side$/)})]);
  });

  it('a map with no group is placed byte for byte as before', () => {
    const plain = `${block('a', null)}${block('b', null)}${wire('w', 'a to b')}`;
    expect(arrange([{name: 'a', size: [2, 2, 1]}, {name: 'b', size: [2, 2, 1]}], [['a', 'b']], {across: true}).things.map((t) => t.at)).toEqual([placed(plain).a.at, placed(plain).b.at]);
  });

  it('fits a group\'s floor on a map placed by hand too', () => {
    const grid = '<i data-iso-grid="120 at 960 150"></i>';
    const html = `${grid}<div data-k="f" data-iso="floor" data-iso-group="g"></div>${block('a', 'g', 'block', ' data-at="0 0"')}${block('b', 'g', 'block', ' data-at="4 0"')}${block('c', null, 'block', ' data-at="12 6"')}`;
    const m = /data-k="f"[^>]*style="([^"]*)"/.exec(isoDrawn(html, {canvas}).html)[1];
    // round a and b only, a tile all round: cols -1 to 7, rows -1 to 3
    const fitted = /data-k="f"[^>]*style="([^"]*)"/.exec(isoDrawn(html.replace('data-iso-group="g"></div>', 'data-at="-1 -1" data-size="8 4"></div>'), {canvas}).html)[1];
    expect(m).toBe(fitted);
  });

  it('refuses, naming the piece and the fix, a group it cannot keep', () => {
    expect(() => transformed(`${block('a', 'x')}<div data-k="f" data-iso="floor" data-iso-group="nobody"></div>`, {canvas})).toThrow('"f" (data-iso="floor"): its group "nobody" has no block — give blocks data-iso-group="nobody", or take the group off the floor');
    expect(() => groupWritten(' data-iso-group="a b"', '"x"')).toThrow('"x": a group\'s name is 1 to 60 letters, digits, "-" or "_" — not "a b"');
    expect(() => groupWritten(' data-iso-group=a', '"x"')).toThrow('"x": its group is written data-iso-group="name", once, with quotes');
    expect(groupWritten(' data-k="x"', '"x"')).toBe(null);
  });
});
