// The deck builds its maps with footprint-story's map steps (isoSpec.js · builtMap → buildIsoMap, the deck's policy),
// not a copy of them: for the example map and for generated maps, every number the deck draws by is the number
// buildIsoMap gives for the same map written as its spec here, by hand — the grid, where each block and footprint
// stands, its outline and paint level, each floor's tiles and label, each wire's way, each name's fit. And no source
// file of the deck imports a step by name.
import {describe, it, expect} from 'vitest';
import {readFileSync, readdirSync} from 'node:fs';
import path from 'node:path';
import {buildIsoMap, isometric, ISO_MAP_POLICIES, MOST_KEEP} from 'footprint-story/isometric';
import {isoDrawn} from './iso.js';
import {keptFloor} from './keepClear.js';
import {layRoutes, specNames} from './isoSpec.js';
import {transformed} from './transforms.js';
import {icons as drawIcons, readIcon} from './transforms.js';

const DECK = ISO_MAP_POLICIES.deck;
const fixed = (v) => +v.toFixed(1);
/** The <b> a block's name is written in, as the deck drew it: the first after the block's own tag. */
const nameTag = (html, name) => { const at = html.indexOf(`data-k="${name}"`); return /<b(?: style="[^"]*")?>[^]*?<\/b>/.exec(html.slice(at))?.[0] ?? null; };
/** A piece's box on the slide, as the deck wrote it: [left, top, width, height]. */
const boxOf = (html, name) => /style="left:([\d.-]+)px;top:([\d.-]+)px;width:([\d.]+)px;height:([\d.]+)px/.exec(html.slice(html.indexOf(`data-k="${name}"`))).slice(1).map(Number);
const POINTS = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1], [3.5, -2, 0.7], [-4, 7, 2]];

/** The deck's map and buildIsoMap's for the same map: the same numbers. `laid`: the links that lie along the floor. */
function same(html, options, spec, laid) {
  const ends = laid.map((link) => link && link.map((name) => ({name, port: null})));
  const drawn = isoDrawn(html, {...options, floorWires: () => ends});
  const m = buildIsoMap(spec, DECK), grid = isometric(m.view);
  expect([drawn.made.placed, drawn.made.fitted, drawn.made.tile]).toEqual([m.placed, m.grid === 'fitted', m.view.tile[0]]);
  for (const p of POINTS) { const q = grid.at(...p); expect(drawn.floor(...p)).toEqual([q.x, q.y]); }
  // every block and footprint: where it stands, its outline, its middle, its paint level
  const ours = [...m.blocks.map((b, i) => ({name: b.name, at: m.at[i], shape: m.shapes[i]})), ...m.obstacles.map((o, j) => ({name: o.name, at: o.at, shape: m.obstacleShapes[j]}))];
  expect(drawn.solids.map((s) => [s.name, s.at, s.outline, s.middle, s.level])).toEqual(ours.map(({name, at, shape: {box, outline}}) => [name, at, outline, [box.x + box.w / 2, box.y + box.h / 2], 2 * (m.order.indexOf(name) + 1)]));
  // every floor's tiles, as its box on the slide, and its label as laid
  m.floors.forEach((f, i) => {
    const {at, size} = m.floorTiles[i], {box} = grid.floor({cols: size[0], rows: size[1], at});
    expect(boxOf(drawn.html, f.name)).toEqual([box.x, box.y, box.w, box.h].map(fixed));
    const label = m.floorLabels[i];
    if (label) expect(drawn.html.slice(drawn.html.indexOf(`data-k="${f.name}"`))).toContain(`font-size:${label.size}px;transform:matrix(`);
  });
  // each name's fit: as written when it fits on one line at its size, else broken and sized
  m.blocks.forEach((b, i) => {
    const f = m.names[i];
    if (!f) return;
    const plain = f.lines.length === 1 && f.size === DECK.name.size;
    expect(nameTag(drawn.html, b.name)).toBe(plain ? `<b>${b.label}</b>` : `<b${f.size === DECK.name.size ? '' : ` style="font-size:${f.size}px"`}>${f.lines.join('<br>')}</b>`);
  });
  // each wire's way along the floor, by the links handed: the steps' own routes, in the deck's names
  const laidRoutes = laid.flatMap((link, i) => (link ? [drawn.routes[i].route] : []));
  expect(laidRoutes).toEqual(m.routes.filter((r, k) => !spec.wires[k].straight));
  return {drawn, m};
}

describe('isoSpec · the deck\'s maps are built by footprint-story\'s map steps', () => {
  it('builds the example map (examples/a-request) as buildIsoMap builds it', () => {
    const dir = path.join(process.cwd(), 'examples', 'a-request');
    const set = Object.fromEntries(readdirSync(path.join(dir, 'icons')).map((f) => [f.replace(/\.svg$/, ''), readIcon(f, readFileSync(path.join(dir, 'icons', f), 'utf8'))]));
    const html = drawIcons(readFileSync(path.join(dir, 'map.html'), 'utf8'), set);
    const links = [['you', 'dns'], ['you', 'server'], ['server', 'db']];
    const block = (name, at, size, label, kind = 'block') => ({name, kind, at, size, label});
    const spec = {
      blocks: [block('you', [0, 5], [2, 2, 0.3], 'You'), block('dns', [4, 1], [2, 2, 1.2], 'DNS'), block('server', [7, 4], [2, 2, 1.6], 'Server'), block('db', [12, 2], [1.8, 1.8, 1.4], 'Database', 'cylinder')],
      floors: [{name: 'floor', at: [-1, -1], size: [16, 9]}],
      wires: links.map(([a, b]) => ({from: {block: a}, to: {block: b}})),
      grid: {tile: 150, origin: [1500, 150]}, usualGrid: {tile: 120, origin: [960, 240]}, area: [0, 220, 1920, 1000],
    };
    const {drawn, m} = same(html, {canvas: [1920, 1080], area: [0, 220, 1920, 1000], links, icons: set}, spec, links);
    expect(m.grid).toBe('written');
    expect(drawn.routes.every((r) => r.route.points)).toBe(true);   // every wire of the example lies along the floor
  });

  it('builds generated maps as buildIsoMap builds them: placed by hand and by the build, groups, cylinders, footprints, kept floor, labelled floors, every grid', () => {
    let seed = 7;
    const rand = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
    const int = (lo, hi) => lo + Math.floor(rand() * (hi - lo + 1)), pick = (list) => list[int(0, list.length - 1)], half = (lo, hi) => int(lo * 2, hi * 2) / 2;
    const LABELS = ['Web', 'Load Balancer Service', 'API gateway', 'Database', Array.from({length: 30}, (_, i) => `w${i}`).join(' ')];
    let built = 0;
    for (let n = 0; n < 160; n += 1) {
      const canvas = pick([[1920, 1080], [1600, 900]]), area = pick([null, [0, 120, 1920, 980], [100, 50, 1500, 850]]), [w] = canvas;
      const byHand = rand() < 0.6, grid = pick(['none', 'fit', 'nums']), grouped = !byHand && rand() < 0.4, still = byHand && grid !== 'fit';
      const blocks = Array.from({length: int(1, 5)}, (_, i) => {
        const kind = pick(['block', 'block', 'cylinder']), wide = half(1, 3), size = [wide, kind === 'cylinder' ? wide : half(1, 3), pick([0.5, 1, 1.6])];
        return {name: `b${i}`, kind, size, at: byHand ? [int(0, 6) * 3, int(0, 6) * 3, pick([0, 0, 1])] : null, label: pick([null, ...LABELS]), group: grouped ? pick(['front', 'back']) : null, rule: pick([null, 'even', 'fill'])};
      });
      const floors = Array.from({length: int(0, 2)}, (_, i) => ({name: `f${i}`, at: rand() < 0.5 ? null : [int(-2, 2), int(-2, 2)], size: rand() < 0.5 ? null : [int(4, 14), int(4, 14)], label: pick([null, 'Production account', 'VPC']), group: grouped ? pick(['front', 'back']) : null}))
        .map((f) => ({...f, at: f.size ? f.at : null, icon: Boolean(f.label) && rand() < 0.5}));
      const feet = still ? Array.from({length: int(0, 2)}, (_, i) => ({name: `fp${i}`, at: [int(0, 6) * 3 + 1, int(0, 6) * 3 + 1, 0], size: [1, 1, pick([0, 0.3])]})) : [];
      const keep = still ? Array.from({length: int(0, 1)}, () => ({x: int(200, 1500), y: int(150, 900), w: int(40, 300), h: int(20, 200)})) : [];
      const standing = [...blocks, ...feet];
      const links = [], laid = [];
      for (let k = 0; k < int(0, 5) && standing.length > 1; k += 1) {
        const a = pick(standing), b = pick(standing.filter((s) => s !== a)), bent = blocks.includes(a) && blocks.includes(b) && rand() < 0.25;
        links.push([a.name, b.name]);
        laid.push(bent ? null : [a.name, b.name]);
      }
      const gridTag = grid === 'none' ? '' : grid === 'fit' ? '<i data-iso-grid="fit"></i>' : '<i data-iso-grid="110 at 900 200"></i>';
      const html = gridTag
        + floors.map((f) => `<div data-k="${f.name}" data-iso="floor"${f.at ? ` data-at="${f.at.join(' ')}"` : ''}${f.size ? ` data-size="${f.size.join(' ')}"` : ''}${f.label ? ` data-label="${f.label}"` : ''}${f.icon ? ' data-icon="acc"' : ''}${f.group ? ` data-iso-group="${f.group}"` : ''}></div>`).join('')
        + blocks.map((b) => `<div data-k="${b.name}" data-iso="${b.kind}"${b.at ? ` data-at="${b.at.join(' ')}"` : ''} data-size="${b.size.join(' ')}"${b.group ? ` data-iso-group="${b.group}"` : ''}${b.label && b.rule ? ` data-break="${b.rule}"` : ''}>${b.label ? `<b>${b.label}</b><small>a note</small>` : ''}</div>`).join('')
        + feet.map((f) => `<img data-k="${f.name}" data-footprint="${f.at.slice(0, 2).join(' ')} ${f.size.join(' ')}" style="left:300px;top:420px;width:180px;height:120px">`).join('')
        + keep.map((k, i) => `<div data-k="k${i}" data-keep-clear style="left:${k.x}px;top:${k.y}px;width:${k.w}px;height:${k.h}px">Words</div>`).join('');
      const options = {canvas, area, links, icons: {acc: {viewBox: '0 0 24 24', body: '<path d="M0 0h24v24H0z"/>'}}};
      const usualGrid = {tile: 120, origin: [w / 2, 240]}, writtenGrid = grid === 'nums' ? {tile: 110, origin: [900, 200]} : grid === 'fit' ? 'fit' : null;
      // the floor kept clear, as the deck works it out: under each box, at each height something stands at, on the grid that does not move
      const fixedGrid = isometric(writtenGrid && writtenGrid !== 'fit' ? writtenGrid : usualGrid), lifts = [...new Set(standing.map((p) => p.at?.[2] ?? 0))], budget = {left: MOST_KEEP, most: MOST_KEEP};
      const pairs = new Set();
      const spec = {
        blocks: blocks.map((b) => ({name: b.name, kind: b.kind, at: b.at, size: b.size, label: b.label, rule: b.label ? b.rule : null, group: b.group})),
        floors: floors.map((f) => ({name: f.name, at: f.size ? f.at ?? [0, 0] : null, size: f.size, label: f.label, icon: f.icon, group: f.group})),
        obstacles: feet.map((f) => ({name: f.name, at: f.at, size: f.size})),
        keep: keep.flatMap((k, i) => lifts.flatMap((lift) => keptFloor(k, fixedGrid, lift, 'k', budget).map(({at, size}) => ({at, size, name: `k${i}`})))),
        // a laid wire, each; a wire drawn straight, only for the build to place by (the first between two blocks)
        wires: links.flatMap(([a, b], i) => {
          const key = [a, b].sort().join(' '), first = !pairs.has(key);
          pairs.add(key);
          return laid[i] ? [{from: {block: a}, to: {block: b}}] : !byHand && first ? [{from: {block: a}, to: {block: b}, straight: true}] : [];
        }),
        grid: writtenGrid, usualGrid, area: area ?? [0, 0, ...canvas],
      };
      let deckRefused = null, stepsRefused = null;
      try { isoDrawn(html, {...options, floorWires: () => laid.map((link) => link && link.map((name) => ({name, port: null})))}); } catch (e) { deckRefused = e; }
      try { buildIsoMap(spec, DECK); } catch (e) { stepsRefused = e; }
      // both build it, or both refuse it (a map of groups a floor names with no block, a fitted grid with nothing to fit)
      expect(Boolean(deckRefused), `${html}\n${deckRefused?.message ?? stepsRefused?.message}`).toBe(Boolean(stepsRefused));
      if (deckRefused) continue;
      same(html, options, spec, laid);
      built += 1;
    }
    expect(built).toBeGreaterThan(100);
  }, 60_000);   // 160 maps, each built twice: seconds under a full suite's load

  it('hands each piece a name of its own: its first name when it is one piece\'s and short enough, else one made for it', () => {
    const long = 'x'.repeat(70);
    expect(specNames(['a', 'b', 'c'])).toEqual(['a', 'b', 'c']);
    const made = specNames(['a', 'a', long, 'a~0']);
    expect(new Set(made).size).toBe(4);
    expect(made[3]).toBe('a~0');                                   // a name the deck wrote keeps it
    expect(made.slice(0, 3).every((name) => [...name].length <= 64)).toBe(true);
    expect(made[0]).not.toBe('a~0');                                // and a made name never takes it
  });
});

describe('isoSpec · what the deck reads back of the built map', () => {
  it('gives a wire the height of the floor it leaves from: the block it starts at, never the one it ends at', () => {
    const raised = {name: 'a', kind: 'block', at: [0, 4, 1], size: [2, 2, 1]}, low = {name: 'b', kind: 'block', at: [5, 1, 0], size: [2, 2, 1]};
    const [up, down] = layRoutes([['a', 'b'], ['b', 'a']], [raised, low]);
    expect([up.lift, down.lift]).toEqual([1, 0]);
    expect(up.route.points).toBe(null);   // two heights: no way along the floor, and the kit says why
    // and on the slide: two blocks raised alike are joined at their height, its floor point where the grid puts it
    const map = '<i data-iso-grid="120 at 960 240"></i><div data-k="a" data-iso="block" data-at="0 4 1.5"></div><div data-k="b" data-iso="block" data-at="5 1 1.5"></div><div data-k="c" data-iso="block" data-at="9 9"></div>';
    const drawn = isoDrawn(map, {canvas: [1920, 1080], links: [['a', 'b'], ['c', 'a']], floorWires: () => [[{name: 'a', port: null}, {name: 'b', port: null}], [{name: 'c', port: null}, {name: 'a', port: null}]]});
    expect(drawn.routes.map((r) => r.lift)).toEqual([1.5, 0]);
  });

  it('names a piece in a refusal of the steps as the deck wrote it, never by a name made for it', () => {
    const long = 'n'.repeat(70), canvas = [1920, 1080];
    const refusal = (html) => { try { transformed(html, {canvas}); } catch (e) { return e.message; } return null; };
    // a name a floor and a block share, and a name past the 64 letters the steps take: each known to the steps by a name made for it
    const shared = refusal('<div data-k="a" data-iso="floor"></div><div data-k="a" data-iso="block" data-size="70 2 1"></div><div data-k="b" data-iso="block"></div>');
    expect(shared).toBe('the build cannot place this map\'s blocks: "a"\'s size is [wide, deep, high] with wide and deep above 0, high 0 or more, none over 64 — not [70,2,1] — or give every block its data-at');
    const longer = refusal(`<div data-k="${long}" data-iso="block" data-size="70 2 1"></div><div data-k="b" data-iso="block"></div>`);
    expect(longer).toBe(`the build cannot place this map's blocks: "${'n'.repeat(60)}…"'s size is [wide, deep, high] with wide and deep above 0, high 0 or more, none over 64 — not [70,2,1] — or give every block its data-at`);
    for (const said of [shared, longer]) expect(said).not.toMatch(/~\d/);
  });

  it('cuts a name in a refusal as 0.32.0 did, at 60 letters, however long the data-k', () => {
    const said = (() => { try { transformed(`<div data-k="${'q'.repeat(5000)}" data-iso="block" data-size="70 2 1"></div><div data-k="b" data-iso="block"></div>`, {canvas: [1920, 1080]}); } catch (e) { return e.message; } return null; })();
    expect(said).toContain(`"${'q'.repeat(60)}…"'s size`);
    expect(said.length).toBeLessThan(300);
  });

  it('draws a piece whose name is 100 emoji (its words past the 200 UTF-16 units the steps take as a who): a block, a floor, and blocks the build places', () => {
    const e = '\u{1F600}'.repeat(100), grid = '<i data-iso-grid="120 at 960 240"></i>', canvas = [1920, 1080];
    expect(transformed(`${grid}<div data-k="${e}" data-iso="block" data-at="0 0"><b>x</b></div>`, {canvas}).html).toContain('data-sd-iso="block"');
    expect(transformed(`${grid}<div data-k="${e}" data-iso="floor" data-size="3 3"></div>`, {canvas}).html).toContain('data-sd-iso="floor"');
    expect(transformed(`<div data-k="${e}" data-iso="block"></div><div data-k="b" data-iso="block"></div><i data-k="w" class="wire" data-arrow="${e} to b"></i>`, {canvas}).made.placed).toBe('build');
  });

  it('refuses more wires than the build places blocks by, in the deck\'s words, with its fix', () => {
    const blocks = Array.from({length: 20}, (_, i) => `<div data-k="a${i}" data-iso="block"></div>`).join('');
    const laid = Array.from({length: 1030}, (_, i) => `<i data-k="w${i}" class="wire" data-arrow="a0 to a1"></i>`).join('');
    const bent = Array.from({length: 19}, (_, i) => `<i data-k="v${i}" class="wire" data-arrow="a${i + 1} to a${(i + 2) % 20} 0"></i>`).join('');
    // 1024 laid along the floor (the most the kit lays), and the first bent wire between each of 19 more pairs of blocks
    expect(() => transformed(blocks + laid + bent, {canvas: [1920, 1080]})).toThrow('the build cannot place this map\'s blocks: it places them by at most 1024 wires — every wire laid along the floor, and the first between each two blocks — and this map has 1043 such wires — split the map in two, or give every block its data-at');
  }, 60_000);
});

describe('isoSpec · no source file of the deck holds a copy of the map steps', () => {
  // the map steps (footprint-story/isometric · ISO_MAP_STEPS) and the parts they are made of: a tool asks buildIsoMap for them
  const STEPS = ['arrange', 'arrangeByGroup', 'routes', 'gridFor', 'wordsToFit', 'floorLabelPlace', 'buildIsoMap', 'ISO_MAP_STEPS', 'readIsoMap', 'roundOutline'];
  const ALLOWED = {'buildIsoMap': ['deck/isoSpec.js']};
  const root = process.cwd(), skip = new Set(['node_modules', 'dist', 'site', '.git', 'examples', 'coverage']);
  const sources = (dir) => readdirSync(path.join(root, dir), {withFileTypes: true}).flatMap((e) => {
    const rel = path.join(dir, e.name);
    if (e.isDirectory()) return skip.has(e.name) ? [] : sources(rel);
    return /\.(m?js|jsx)$/.test(e.name) && !/\.test\.jsx?$/.test(e.name) && !rel.startsWith(`deck${path.sep}test`) ? [rel] : [];
  });

  it('imports or hands on no step by name, never the whole door, and asks no grid for the paint order', () => {
    const files = sources('.');
    expect(files).toContain(path.join('deck', 'iso.js'));
    for (const file of files) {
      const text = readFileSync(path.join(root, file), 'utf8');
      expect(text, file).not.toMatch(/import\s*(?:[\w$]+\s*,\s*)?\*\s*as\s+[\w$]+\s+from\s*['"]footprint-story(?:\/isometric)?['"]/);
      expect(text, file).not.toMatch(/import\s+[\w$]+\s+from\s*['"]footprint-story(?:\/isometric)?['"]/);
      expect(text, file).not.toMatch(/import\(\s*['"]footprint-story(?:\/isometric)?['"]/);
      expect(text, file).not.toMatch(/from\s*['"]footprint-story\/src\//);
      expect(text, file).not.toMatch(/\.backToFront\(/);
      expect(text, file).not.toMatch(/export\s*\*\s*(?:as\s+\w+\s+)?from\s*['"]footprint-story(?:\/isometric)?['"]/);
      // import {…}, import x, {…} and export {…} from the door: each name it brings in, or hands on
      for (const m of text.matchAll(/(?:import\s*(?:[\w$]+\s*,\s*)?|export\s*)\{([^}]*)\}\s*from\s*['"]footprint-story(?:\/isometric)?['"]/g)) {
        const names = m[1].split(',').map((part) => part.trim().split(/\s+as\s+/)[0]).filter(Boolean);
        for (const name of names) if (STEPS.includes(name)) expect(ALLOWED[name] ?? [], `${file} imports ${name}`).toContain(file);
      }
    }
  });
});
