import {describe, it, expect} from 'vitest';
import {wires, wireTags, icons, readIcon, applyTransforms} from './transforms.js';
import {isoDrawn} from './iso.js';
import {exitOutline} from './boxes.js';
import {cables, cablePoint, cableWalk, held, labelPlace} from './cable.js';
import {stripComments} from './html.js';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {generated} from './test/helpers.js';

describe('wires', () => {
  it('draws a straight wire in a box that holds it, with its head, keeping the element\'s attributes', () => {
    expect(wires('<i data-k="w" class="req" data-arrow="100 200 300 200"></i>')).toBe(
      '<svg data-k="w" class="wire req" style="left:80px;top:180px;width:240px;height:40px;--sd-angle:90deg" viewBox="0 0 240 40" aria-hidden="true">'
      + '<path d="M20 20 Q120 20 205.6 20"/><path class="head" d="M220 20L202 30.8L202 9.2Z"/></svg>');
  });

  it('adds a packet for class "pkt", bends the curve, and gives a wire without a class its "wire"', () => {
    const out = wires('<i data-k="w" class="wire pkt" data-arrow="0 0 100 0 40"></i><i data-k="v" data-arrow="0,0,0,50"></i>');
    expect(out).toContain('<rect class="pkt"');
    // the packet rides the curve: its control point and its end, both from where it starts (deck.css · sdPkt)
    const [, cdx, cdy, pdx, pdy] = /--cdx:(-?[\d.]+)px;--cdy:(-?[\d.]+)px;--pdx:(-?[\d.]+)px;--pdy:(-?[\d.]+)px/.exec(out).map(Number);
    expect([cdx, cdy]).toEqual([50, 40]);   // the curve's control point: 50 along, 40 off the straight line
    expect(pdx).toBeGreaterThan(80);
    expect(pdy).toBeGreaterThan(0);
    expect(out).toMatch(/class="wire pkt"/);
    expect(out).toMatch(/<svg data-k="v" class="wire"/);
    expect(out).toContain("Q70 60");   // the bend pulls the curve 40 px off the straight line
  });

  it('keeps a class that already names the wire, and leaves other <i> elements alone', () => {
    expect(wires('<i class="wire x" data-arrow="0 0 10 10"></i>')).toMatch(/class="wire x"/);
    expect(wires('<i class="ic"></i>')).toBe('<i class="ic"></i>');
  });

  it('stays linear on a map of unfinished <i> tags', () => {
    const t0 = performance.now();
    const hostile = '<i data-k="x" '.repeat(100000);
    expect(wires(hostile)).toBe(hostile);
    expect(icons(hostile)).toBe(hostile);
    expect(performance.now() - t0).toBeLessThan(1500);
  });

  it('refuses a wire that is not four or five numbers', () => {
    expect(() => wires('<i data-arrow="1 2 3"></i>')).toThrow('data-arrow="1 2 3": a wire is the pieces it joins, "from to to" ("client to server"), or "x1 y1 x2 y2" in slide px — either with an optional bend');
    expect(() => wires('<i data-arrow="1 2 3 x"></i>')).toThrow(/a wire is/);
  });
});

describe('icons', () => {
  const set = {dot: readIcon('dot', '<?xml version="1.0"?><!-- c --><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8"><circle r="3"/></svg>\n')};

  it('reads an icon file into its viewBox and drawing', () => {
    expect(set.dot).toEqual({viewBox: '0 0 8 8', body: '<circle r="3"/>'});
  });

  it('refuses a file that is not one <svg> with a viewBox', () => {
    expect(() => readIcon('x', '<g/>')).toThrow(/icon "x": an icon file is one <svg/);
    expect(() => readIcon('x', '<svg width="8"></svg>')).toThrow(/has no viewBox/);
  });

  it('draws <i data-icon> as the icon, keeping its other attributes', () => {
    expect(icons('<i class="ic big" data-icon="dot" title="t"></i>', set)).toBe('<svg class="ic big" title="t" viewBox="0 0 8 8" aria-hidden="true"><circle r="3"/></svg>');
  });

  it('names the icons there are when one is missing, or says there are none', () => {
    expect(() => icons('<i data-icon="cat"></i>', set)).toThrow(/no icon "cat" \(there are dot\) — add icons\/cat.svg/);
    expect(() => icons('<i data-icon="cat"></i>')).toThrow(/the deck has no icons/);
  });

  it('runs icons, then wires', () => {
    const out = applyTransforms('<i data-icon="dot"></i><i data-arrow="0 0 10 0"></i>', {icons: set});
    expect(out).toMatch(/^<svg viewBox="0 0 8 8"/);
    expect(out).toContain('class="wire"');
    expect(applyTransforms('<p>plain</p>')).toBe('<p>plain</p>');
  });
});

describe('reading an icon file', () => {
  /** readIcon as it was before: one regex over the file — the oracle the one-pass reading must equal. */
  function readIconBefore(svg) {
    const m = /<svg\b([^>]*)>([\s\S]*)<\/svg>\s*$/.exec(stripComments(svg).replace(/^\s*<\?xml[^>]*>/, '').trim());
    const viewBox = m && /\sviewBox=(["'])([^"']+)\1/.exec(m[1])?.[2];
    return m && viewBox ? {viewBox, body: m[2].trim()} : null;
  }
  const read = (svg) => { try { return readIcon('x', svg); } catch { return null; } };

  it('reads exactly what the one regex read, on 4,000 generated files', () => {
    const tokens = ['<svg', '>', '</svg>', ' viewBox="0 0 1 1"', " viewBox='2'", '<!--', '-->', '<?xml v?>', ' ', '\n', 'x', '<', '/', 'svg', '<svgx'];
    for (const svg of generated(tokens, {count: 4000, length: 20})) expect(read(svg), svg).toEqual(readIconBefore(svg));
  });

  it('stays linear on a file of unfinished tags (the one regex took minutes on 4 MB)', () => {
    const t0 = performance.now();
    expect(() => readIcon('x', '<svg>'.repeat(800_000))).toThrow(/an icon file is one <svg/);
    expect(() => readIcon('x', `${'<svg>'.repeat(800_000)}</svg>`)).toThrow(/has no viewBox/);
    expect(performance.now() - t0).toBeLessThan(1500);
  });
});

describe('wires and icons in one pass', () => {
  /** wires() and icons() as they were before (one regex each): the oracles the one-pass versions must equal. */
  const wiresBefore = (html) => html.replace(/<i\b([^<>]*?)\sdata-arrow="([^"<>]+)"([^<>]*)><\/i>/g, (_, a, spec, b) => `[wire|${a + b}|${spec}]`);
  const iconsBefore = (html) => html.replace(/<i\b([^<>]*?)\sdata-icon="([\w-]+)"([^<>]*)><\/i>/g, (_, a, key, b) => `[icon|${a}${b}|${key}]`);
  const set = {db: {viewBox: '0 0 1 1', body: ''}};

  it('find exactly what their regexes found, on 4,000 generated maps', () => {
    const tokens = ['<i', '<i class="w"', ' data-arrow="1 2 3 4"', ' data-arrow="x"', ' data-arrow="', ' data-icon="db"', ' data-icon="a b"', '>', '</i>', '></i>', '<', '"', ' ', 'x'];
    for (const html of generated(tokens, {count: 4000, length: 24})) {
      const wired = [];
      wiresBefore(html).replace(/\[wire\|([^|]*)\|([^\]]*)\]/g, (_, at, spec) => wired.push([at, spec]));
      expect(wireTags(html).map(({before, m, after}) => [before + after, m[1]]), html).toEqual(wired);
      let refused = false;
      try { icons(html, set); } catch { refused = true; }
      const keys = [...iconsBefore(html).matchAll(/\[icon\|[^|]*\|([\w-]+)\]/g)].map((x) => x[1]);
      expect(refused, html).toBe(keys.some((k) => k !== 'db'));
      if (!refused) expect((icons(html, set).match(/<svg/g) ?? []).length - (html.match(/<svg/g) ?? []).length, html).toBe(keys.length);
    }
  });

  it('stay linear on one tag that repeats an attribute (the regexes took minutes on 4 MB)', () => {
    const t0 = performance.now();
    const arrows = `<i data-k="w"${' data-arrow="1"'.repeat(250_000)}`, names = `<i data-k="w"${' data-icon="db"'.repeat(250_000)}`;
    expect(wires(arrows)).toBe(arrows);
    expect(icons(names, set)).toBe(names);
    expect(performance.now() - t0).toBeLessThan(1500);
  });

  it('refuses an icon called like a property every object has', () => {
    expect(() => icons('<i data-icon="constructor"></i>', set)).toThrow(/no icon "constructor" \(there are db\)/);
  });
});

describe('a packet on the curve, a wire shown in', () => {
  const css = () => readFileSync(path.join(process.cwd(), 'deck.css'), 'utf8');
  const angle = (spec) => Number(/--sd-angle:(-?[\d.]+)deg/.exec(wires(`<i data-k="w" data-arrow="${spec}"></i>`))[1]);

  it('places the packet at B(t) = 2(1-t)t·C + t²·E, the same on both axes, with t one registered number', () => {
    const t = css();
    expect(t).toContain("@property --sd-t { syntax: '<number>'; inherits: false; initial-value: 0; }");
    const axis = (c, p) => `calc(var(--${c}) * 2 * (1 - var(--sd-t)) * var(--sd-t) + var(--${p}) * var(--sd-t) * var(--sd-t))`;
    expect(t).toContain(`transform: translate(${axis('cdx', 'pdx')},\n    ${axis('cdy', 'pdy')});`);
    expect(t).toContain('@keyframes sdPkt { from { --sd-t: 0; } to { --sd-t: 1; } }');
    // B(0) is the start and B(1) the end; a straight wire (C = E/2) gives B(t) = t·E
    const B = (u, c, e) => 2 * (1 - u) * u * c + u * u * e;
    expect([B(0, 50, 100), B(1, 50, 100), B(0.3, 50, 100)]).toEqual([0, 100, 30]);
  });

  it('shows a wire coming in by a sweep square to its run, on the piece itself — never by its dashes', () => {
    expect([angle('0 0 100 0'), angle('0 0 0 100'), angle('0 0 -100 0'), angle('0 0 0 -100'), angle('0 0 100 100')]).toEqual([90, 180, -90, 0, 135]);
    const t = css();
    expect(t).not.toMatch(/stroke-dash|pathLength/);   // a theme's dashes are its own
    expect(t).toMatch(/:where\(svg\.wire\.sd-enter:not\(\.sd-hot, \.sd-hot-in\)\) \{ --sd-a-more: sdReveal [^}]*var\(--sd-delay, 0s\) both; \}/);
    expect(t).toMatch(/:where\(svg\.wire\.sd-path\.sd-enter:not\(\.sd-hot, \.sd-hot-in\)\) \{ --sd-a-more: sdReveal [^}]*var\(--sd-turn, 0s\) both; \}/);
    // a highlighted wire is never masked (its ring is drawn outside its box); a wire stepping aside waits for the sweep
    expect(t).toMatch(/:where\(svg\.wire\.sd-enter:not\(\.sd-hot, \.sd-hot-in\)\) \{\n\s+-webkit-mask-image/);
    expect(t).toContain(':where(svg.wire.sd-twin-turn) { --sd-twin-lag: .3s; }');
    expect(readFileSync(path.join(process.cwd(), 'focus.css'), 'utf8')).toContain('sdLeave .45s ease calc(var(--sd-turn) + var(--sd-twin-lag, 0s)) both');
    expect(readFileSync(path.join(process.cwd(), 'focus.css'), 'utf8')).toContain('var(--sd-a-path, sdNone 0s), var(--sd-a-more, sdNone 0s), var(--sd-a-loop, sdNone 0s); }');
    expect(wires('<i data-k="w" data-arrow="0 0 9 9"></i>')).not.toContain('pathLength');
  });
});

describe('a wire between pieces ("from to to")', () => {
  const box = (k, x, y, w = 300, h = 210) => `<div data-k="${k}" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px"></div>`;
  /** Each wire as drawn: its ends (data-ends) and its run in slide px, from the drawn box and path. */
  const drawn = (html) => [...wires(html).matchAll(/<svg( data-ends="([^"]*)")?[^>]*style="left:([\d.-]+)px;top:([\d.-]+)px[^"]*"[^>]*><path d="M([\d.-]+) ([\d.-]+) Q[\d.-]+ [\d.-]+ ([\d.-]+) ([\d.-]+)"/g)]
    .map((m) => ({ends: m[2] ?? null, from: [+m[5] + +m[3], +m[6] + +m[4]], to: [+m[7] + +m[3], +m[8] + +m[4]]}));
  const two = box('client', 160, 420) + box('server', 720, 420);

  it('runs from the edge of one box to the edge of the other, 6 px clear, and carries its ends', () => {
    const [w] = drawn(`${two}<i data-k="req" data-arrow="client to server"></i>`);
    expect(w.ends).toBe('client server');
    expect(w.from).toEqual([466, 525]);              // the client's right edge (460) + 6, at its middle
    expect(w.to[1]).toBe(525);
    expect(w.to[0]).toBeCloseTo(720 - 6 - 18 * 0.8, 1);   // the path stops where the head begins; the tip is the server's edge − 6
  });

  it('keeps two wires between the same pieces apart, one lane each — whichever way they run', () => {
    const [req, ret] = drawn(`${two}<i data-k="req" data-arrow="client to server"></i><i data-k="ret" data-arrow="server to client"></i>`);
    expect([req.from[1], ret.from[1]]).toEqual([485, 565]);   // 80 px apart, about the middle
    expect(ret.from[0]).toBe(714);                              // the answer leaves the server's left edge, towards the client
    const three = drawn(`${two}<i data-k="a" data-arrow="client to server"></i><i data-k="c" data-arrow="server to client"></i><i data-k="b" data-arrow="client to server"></i>`);
    expect(three.map((w) => w.from[1])).toEqual([445, 605, 525]);   // both requests above the answer, in the order written
  });

  it('keeps to its left whatever the pieces are called: the lanes follow the way a wire runs, never the names', () => {
    const lanes = (l, r) => drawn(`${box(l, 160, 420)}${box(r, 720, 420)}<i data-k="req" data-arrow="${l} to ${r}"></i><i data-k="ret" data-arrow="${r} to ${l}"></i>`).map((w) => w.from[1]);
    expect(lanes('client', 'server')).toEqual([485, 565]);
    expect(lanes('zed', 'alpha')).toEqual([485, 565]);   // "alpha" sorts first: the drawing is the same
    // running down the slide, a wire's left is the slide's right
    const [down, up] = drawn(`${box('a', 0, 0)}${box('b', 0, 600)}<i data-k="d" data-arrow="a to b"></i><i data-k="u" data-arrow="b to a"></i>`);
    expect(down.from[0]).toBeGreaterThan(up.from[0]);
  });

  it('keeps the lanes inside small boxes, and a lone wire on the middle line', () => {
    const small = box('a', 0, 0, 100, 40) + box('b', 400, 0, 100, 40);
    const [x, y] = drawn(`${small}<i data-k="x" data-arrow="a to b"></i><i data-k="y" data-arrow="b to a"></i>`);
    expect([x.from[1], y.from[1]]).toEqual([8, 32]);   // half the box (20) − 8 each way, not 80 apart
    expect(drawn(`${small}<i data-k="x" data-arrow="a to b"></i>`)[0].from[1]).toBe(20);
  });

  it('keeps its lanes across a wide, flat box on a slant: each wire leaves its box\'s edge and its tip reaches the other\'s', () => {
    const A = {x: 0, y: 0, w: 600, h: 60}, B = {x: 600, y: 300, w: 600, h: 60};
    const html = `${box('a', A.x, A.y, A.w, A.h)}${box('b', B.x, B.y, B.w, B.h)}<i data-k="x" data-arrow="a to b"></i><i data-k="y" data-arrow="b to a"></i><i data-k="z" data-arrow="a to b"></i>`;
    // each wire's start (its path's first point) and its tip (its head's first point), in slide px
    const ends = [...wires(html).matchAll(/data-ends="(\w) (\w)"[^>]*style="left:([\d.-]+)px;top:([\d.-]+)px[^>]*><path d="M([\d.-]+) ([\d.-]+)[^"]*"\/><path class="head" d="M([\d.-]+) ([\d.-]+)/g)]
      .map((m) => ({from: m[1], start: [+m[5] + +m[3], +m[6] + +m[4]], tip: [+m[7] + +m[3], +m[8] + +m[4]]}));
    // a point 6 px outside a box's edge (a little more on a slant), never inside it or far from it
    const near = ([x, y], b) => {
      const dx = Math.max(b.x - x, 0, x - b.x - b.w), dy = Math.max(b.y - y, 0, y - b.y - b.h);
      return Math.hypot(dx, dy) > 2 && Math.hypot(dx, dy) < 8;
    };
    expect(ends).toHaveLength(3);
    for (const w of ends) {
      const [from, to] = w.from === 'a' ? [A, B] : [B, A];
      expect(near(w.start, from), JSON.stringify(w)).toBe(true);
      expect(near(w.tip, to), JSON.stringify(w)).toBe(true);
    }
    expect(new Set(ends.map((w) => w.start.join())).size).toBe(3);   // three lanes, none on another
  });

  it('leaves through whichever edge the line crosses, keeps its bend, and finds a name shared by several pieces as one box', () => {
    const [w] = drawn(`${box('top', 400, 0, 200, 100)}${box('low', 400, 600, 200, 100)}<i data-k="w" data-arrow="top to low 30"></i>`);
    expect(w.from).toEqual([500, 106]);   // the bottom edge
    expect(wires(`${box('top', 400, 0, 200, 100)}${box('low', 400, 600, 200, 100)}<i data-k="w" data-arrow="top to low 30"></i>`)).toMatch(/Q\S+ \S+ /);
    const [u] = drawn(`${box('g', 0, 0, 100, 100)}${box('g', 0, 200, 100, 100)}${box('far', 600, 100, 100, 100)}<i data-k="u" data-arrow="g to far"></i>`);
    expect(u.from).toEqual([106, 150]);   // from the box around both "g" pieces
  });

  it('draws numbered wires as before, beside named ones', () => {
    const html = `${two}<i data-k="n" data-arrow="252 352 318 352"></i><i data-k="req" data-arrow="client to server"></i>`;
    expect(drawn(html)[0]).toEqual({ends: null, from: [252, 352], to: [318 - 18 * 0.8, 352]});
  });

  it('refuses a piece it cannot find, a wire to itself, and pieces too close — naming the fix', () => {
    expect(() => wires(`${two}<i data-k="w" data-arrow="client to db"></i>`)).toThrow('data-arrow="client to db": no piece "db" with a box (data-k, and an inline left, top, width and height) — the placed pieces are client, server');
    expect(() => wires('<i data-k="w" data-arrow="a to b"></i>')).toThrow('data-arrow="a to b": no piece "a" with a box (data-k, and an inline left, top, width and height)');
    const many = Array.from({length: 21}, (_, i) => box(`p${i}`, i * 400, 0)).join('');
    expect(() => wires(`${many}<i data-k="w" data-arrow="p0 to q"></i>`)).toThrow(/the placed pieces are p0, p1, (p\d+, ){17}p19, …$/);
    expect(() => wires(`${two}<i data-k="w" data-arrow="client to client"></i>`)).toThrow('data-arrow="client to client": a wire joins two pieces, not "client" to itself');
    expect(() => wires(`${box('a', 0, 0)}${box('b', 290, 0)}<i data-k="w" data-arrow="a to b"></i>`)).toThrow('data-arrow="a to b": "a" and "b" are too close for a wire between them (they touch or overlap) — move them apart, or give the wire numbers');
    expect(() => wires(`${box('a', 0, 0)}${box('b', 0, 0)}<i data-k="w" data-arrow="a to b"></i>`)).toThrow(/share a middle/);
  });
});

describe('a straight wire to an isometric piece ends on what the piece draws, not on the box it is placed by', () => {
  const canvas = [1920, 1080];
  /** Each wire as drawn: where its line starts and where its head's tip is, in slide px. */
  const drawn = (html) => [...html.matchAll(/<svg data-ends="([^"]*)"[^>]*style="left:([\d.-]+)px;top:([\d.-]+)px[^"]*"[^>]*><path d="M([\d.-]+) ([\d.-]+) Q[^"]*"\/><path class="head" d="M([\d.-]+) ([\d.-]+)L/g)]
    .map((m) => ({ends: m[1], from: [+m[4] + +m[2], +m[5] + +m[3]], tip: [+m[6] + +m[2], +m[7] + +m[3]]}));
  /** How far a point is from an outline's nearest side. */
  const off = (points, [px, py]) => Math.min(...points.map(([ax, ay], i) => {
    const [bx, by] = points[(i + 1) % points.length], t = Math.max(0, Math.min(1, ((px - ax) * (bx - ax) + (py - ay) * (by - ay)) / ((bx - ax) ** 2 + (by - ay) ** 2)));
    return Math.hypot(px - ax - t * (bx - ax), py - ay - t * (by - ay));
  }));
  const blocks = '<i data-iso-grid="120 at 960 240"></i><div data-k="a" data-iso="block" data-at="0 0"></div><div data-k="b" data-iso="block" data-at="5 0" data-size="2 2 1.6"></div>';

  it('runs from the outline of one block to the outline of the other, 6 px clear of each, along the line between their middles', () => {
    // a bend of 0 asks for a straight run: with none written, a wire between two blocks is a cable along the floor (below)
    const map = `${blocks}<i data-k="w" class="wire" data-arrow="a to b 0"></i>`, {shapes} = isoDrawn(map, {canvas});
    const [w] = drawn(applyTransforms(map, {canvas})), a = shapes.get('a'), b = shapes.get('b');
    expect(w.ends).toBe('a b');
    const along = [b.middle[0] - a.middle[0], b.middle[1] - a.middle[1]], len = Math.hypot(...along), u = [along[0] / len, along[1] / len];
    const start = exitOutline(a.outline, a.middle, u) + 6, end = len - exitOutline(b.outline, b.middle, [-u[0], -u[1]]) - 6;
    expect(w.from[0]).toBeCloseTo(a.middle[0] + u[0] * start, 0);
    expect(w.from[1]).toBeCloseTo(a.middle[1] + u[1] * start, 0);
    expect(w.tip[0]).toBeCloseTo(a.middle[0] + u[0] * end, 0);
    expect(w.tip[1]).toBeCloseTo(a.middle[1] + u[1] * end, 0);
    expect(off(a.outline, w.from)).toBeLessThan(6.2);     // it starts beside the block itself…
    expect(off(b.outline, w.tip)).toBeLessThan(6.2);      // …and its head touches the other, not the empty corner of a box
    expect(off(a.outline, w.from)).toBeGreaterThan(3);
  });

  it('two blocks that stand clear of each other get their wire though their boxes meet — a box would have called them too close', () => {
    // two tiles apart along the cols and one along the rows: the boxes they are placed by overlap on the slide, what they draw does not
    const near = '<i data-iso-grid="120 at 960 240"></i><div data-k="a" data-iso="block" data-at="0 0"></div><div data-k="b" data-iso="block" data-at="4 1"></div><i data-k="w" class="wire" data-arrow="a to b 0"></i>';
    const boxes = [...isoDrawn(near, {canvas}).html.matchAll(/data-k="([ab])"[^>]*style="left:([\d.-]+)px;top:([\d.-]+)px;width:([\d.-]+)px;height:([\d.-]+)px/g)].map((m) => m.slice(2).map(Number));
    expect(boxes[1][0] < boxes[0][0] + boxes[0][2] && boxes[1][1] < boxes[0][1] + boxes[0][3]).toBe(true);   // the boxes do meet
    const [w] = drawn(applyTransforms(near, {canvas}));
    expect(Math.hypot(w.tip[0] - w.from[0], w.tip[1] - w.from[1])).toBeGreaterThan(12);   // a wire to see: no shorter than the least one drawn
    // drawn by their boxes alone, as before, the same two are refused
    expect(() => wires(isoDrawn(near, {canvas}).html)).toThrow('"a" and "b" are too close for a wire between them');
    // blocks that do cover each other on the slide are still refused, naming the fix
    const touching = near.replace('data-at="4 1"', 'data-at="2.2 0"');
    expect(() => applyTransforms(touching, {canvas})).toThrow('data-arrow="a to b 0": "a" and "b" are too close for a wire between them (they touch or overlap) — move them apart, or give the wire numbers');
  });

  it('a wire between a block and a flat piece ends on the block\'s outline and the piece\'s box; two wires between two blocks keep a lane each', () => {
    const map = `${blocks}<div data-k="note" class="chip" style="left:100px;top:700px;width:200px;height:80px">n</div><i data-k="w" class="wire" data-arrow="note to b"></i><i data-k="go" class="wire" data-arrow="a to b 0"></i><i data-k="back" class="wire" data-arrow="b to a 0"></i>`;
    const {shapes} = isoDrawn(map, {canvas}), all = drawn(applyTransforms(map, {canvas})), b = shapes.get('b'), a = shapes.get('a');
    const [note, go, back] = all;
    expect(off(b.outline, note.tip)).toBeLessThan(6.2);
    expect(off([[100, 700], [300, 700], [300, 780], [100, 780]], note.from)).toBeCloseTo(6, 0);   // the flat piece: its box, as before
    expect(off(b.outline, go.tip)).toBeLessThan(7);
    expect(off(a.outline, back.tip)).toBeLessThan(7);
    expect(Math.hypot(go.from[0] - back.tip[0], go.from[1] - back.tip[1])).toBeGreaterThan(20);   // a lane each: the request does not lie on its answer
  });

  it('a map with no isometric piece draws its wires exactly as 0.16.0 did', () => {
    const flat = '<div data-k="client" style="left:160px;top:420px;width:300px;height:210px"></div><div data-k="server" style="left:720px;top:420px;width:300px;height:210px"></div><i data-k="req" class="wire pkt" data-arrow="client to server" data-label="GET"></i><i data-k="res" data-arrow="server to client 30"></i>';
    const out = applyTransforms(flat, {canvas, area: [0, 220, 1920, 1000]});
    // the opening tags as 0.16.0 wrote them (built from that release's own source and compared whole, byte for byte, when this was written)
    expect(out.match(/<svg data-ends="client server"[^>]*>/)[0]).toBe('<svg data-ends="client server" data-k="req" class="wire pkt" data-label="GET" style="left:446px;top:437px;width:288px;height:68px;--sd-angle:90deg" viewBox="0 0 288 68" aria-hidden="true">');
    expect(out).toHaveLength(882);
    expect(applyTransforms(flat, {canvas})).toBe(out);     // an area changes nothing for a map the build does not fit
    expect(wires(flat, new Map())).toBe(wires(flat));
  });

  it('a name a block shares with another piece is one box round them all, as it always was: the block\'s own outline is not the whole of it', () => {
    const shared = `${blocks}<div data-k="a tag" class="chip" style="left:100px;top:900px;width:120px;height:40px">t</div><i data-k="w" class="wire" data-arrow="a to b"></i>`;
    const alone = `${blocks}<i data-k="w" class="wire" data-arrow="a to b 0"></i>`;
    const [together] = drawn(applyTransforms(shared, {canvas})), [own] = drawn(applyTransforms(alone, {canvas}));
    expect(applyTransforms(shared, {canvas})).not.toContain('data-sd-cable');           // a name that is not one block alone has no foot to lay a cable from
    expect(together.from).not.toEqual(own.from);                                        // it starts from the box round the block and its tag…
    const [boxOnly] = drawn(wires(isoDrawn(shared, {canvas}).html));
    expect(together.from).toEqual(boxOnly.from);                                        // …that end is where a box-only wire starts
    expect(off(isoDrawn(shared, {canvas}).shapes.get('b').outline, together.tip)).toBeLessThan(6.2);   // and its other end, a block alone, is on that block
  });

  it('three wires between two blocks, both ways, keep a lane each: side by side, none crossing, every tip on a block', () => {
    const map = `${blocks}<i data-k="w1" class="wire" data-arrow="a to b 0"></i><i data-k="w2" class="wire" data-arrow="b to a 0"></i><i data-k="w3" class="wire" data-arrow="a to b 0"></i>`;
    const {shapes} = isoDrawn(map, {canvas}), lanes = drawn(applyTransforms(map, {canvas})), a = shapes.get('a'), b = shapes.get('b');
    const u = [b.middle[0] - a.middle[0], b.middle[1] - a.middle[1]], len = Math.hypot(...u), n = [-u[1] / len, u[0] / len];
    const across = lanes.map((w) => (w.from[0] - a.middle[0]) * n[0] + (w.from[1] - a.middle[1]) * n[1]), tips = lanes.map((w) => (w.tip[0] - a.middle[0]) * n[0] + (w.tip[1] - a.middle[1]) * n[1]);
    lanes.forEach((w, i) => expect(across[i]).toBeCloseTo(tips[i], 0));                 // each runs level with the line between the middles: none crosses another
    const order = [...across].sort((x, y) => x - y);
    expect(order[1] - order[0]).toBeGreaterThan(10);
    expect(order[2] - order[1]).toBeCloseTo(order[1] - order[0], 0);                     // evenly apart
    for (const [i, w] of lanes.entries()) expect(off(i === 1 ? a.outline : b.outline, w.tip)).toBeLessThan(7);   // the middle one runs back, to a
  });
});

describe('a wire between two isometric pieces is a cable along the floor', () => {
  const canvas = [1920, 1080];
  const blocks = '<i data-iso-grid="120 at 960 240"></i><div data-k="a" data-iso="block" data-at="0 4"></div><div data-k="b" data-iso="block" data-at="5 1" data-size="2 2 1.6"></div>';
  const tag = (html, name) => new RegExp(`<svg[^>]*data-k="${name}"[^>]*>`).exec(html)[0];
  /** A cable as drawn: its four points in slide px (the last where the line stops, short of the tip), and its head's tip. */
  const laid = (html, name) => {
    const [, x, y] = /style="left:([\d.-]+)px;top:([\d.-]+)px/.exec(tag(html, name)), rest = html.slice(html.indexOf(tag(html, name)));
    const n = /<path d="M([\d.-]+) ([\d.-]+) C([\d.-]+) ([\d.-]+) ([\d.-]+) ([\d.-]+) ([\d.-]+) ([\d.-]+)"\/><path class="head" d="M([\d.-]+) ([\d.-]+)L/.exec(rest).slice(1).map(Number);
    const at = (i) => [n[i] + +x, n[i + 1] + +y];
    return {start: at(0), h1: at(2), h2: at(4), stop: at(6), tip: at(8)};
  };

  it('is drawn as one curve with a handle at each end, from the points cable.js gives, and marked as a cable', () => {
    const map = `${blocks}<i data-k="w" class="wire req" data-arrow="a to b"></i>`, out = applyTransforms(map, {canvas});
    const {shapes, floor} = isoDrawn(map, {canvas}), [[start, h1, h2, end]] = cables([['a', 'b']], shapes, floor), w = laid(out, 'w');
    expect(tag(out, 'w')).toMatch(/^<svg data-ends="a b" data-k="w" class="wire req" data-sd-cable style="left:[\d.-]+px;top:[\d.-]+px;width:[\d.]+px;height:[\d.]+px;--sd-angle:[\d.-]+deg" viewBox="0 0 [\d.]+ [\d.]+" aria-hidden="true">$/);
    for (const [got, want] of [[w.start, start], [w.h1, h1], [w.h2, h2], [w.tip, end]]) { expect(got[0]).toBeCloseTo(want[0], 0); expect(got[1]).toBeCloseTo(want[1], 0); }
    // the line stops where the head begins, on the way in from the second handle; the tip is the cable's end
    const way = [end[0] - h2[0], end[1] - h2[1]], length = Math.hypot(...way);
    expect(w.stop[0]).toBeCloseTo(end[0] - (way[0] / length) * 18 * 0.8, 0);
    expect(w.stop[1]).toBeCloseTo(end[1] - (way[1] / length) * 18 * 0.8, 0);
    expect(w.tip[1]).toBeLessThan(w.h2[1]);   // it comes in from the front, up the rows: its tip points up the slide
  });

  it('its box holds the curve, its handles too; its label stands on the cable, on a plate of the ground\'s colour', () => {
    const map = `${blocks}<i data-k="w" class="wire" data-arrow="a to b" data-label="GET"></i>`, out = applyTransforms(map, {canvas}), w = laid(out, 'w');
    const [, x, y, wide, tall] = /style="left:([\d.-]+)px;top:([\d.-]+)px;width:([\d.]+)px;height:([\d.]+)px/.exec(tag(out, 'w')).map(Number);
    for (const p of [w.start, w.h1, w.h2, w.tip]) expect(p[0] >= x && p[0] <= x + wide && p[1] >= y && p[1] <= y + tall).toBe(true);
    const drawn = out.slice(out.indexOf(tag(out, 'w')));
    const [, lx, ly] = /<text class="label" x="([\d.-]+)" y="([\d.-]+)"/.exec(drawn).map(Number);
    const {shapes, floor} = isoDrawn(map, {canvas}), [cable] = cables([['a', 'b']], shapes, floor);
    const middle = cablePoint(cable, 0.5);
    expect(lx + x).toBeCloseTo(middle[0], 0);   // no block is over the cable's middle here: the label is on it
    expect(ly + y).toBeCloseTo(middle[1], 0);
    // the plate: the label's own box (3 letters × 12 px and 4 px each side, 18 px and 4 px above and below), under the label and over the line
    const [, px, py, pw, ph] = /<path class="head"[^>]*\/><rect class="plate" x="([\d.-]+)" y="([\d.-]+)" width="([\d.]+)" height="([\d.]+)" rx="6"\/><text class="label"/.exec(drawn).map(Number);
    expect([pw, ph]).toEqual([44, 26]);
    expect(px + pw / 2).toBeCloseTo(lx, 0);
    expect(py + ph / 2).toBeCloseTo(ly, 0);
    expect(readFileSync(path.join(process.cwd(), 'deck.css'), 'utf8')).toContain(':where(svg.wire rect.plate) { fill: var(--bg, #ffffff); stroke: none; }');
    // a cable's packets pass under its plate, never across its words
    const riding = applyTransforms(`${blocks}<i data-k="w" class="wire pkt" data-arrow="a to b" data-label="GET" data-packets="1"></i>`, {canvas});
    expect(riding).toMatch(/<rect class="pkt"[^>]*\/><circle class="run"[^>]*\/><rect class="plate"[^>]*\/><text class="label"/);
    // a wire that is no cable has no plate: its label stands beside it, as ever
    expect(applyTransforms(`${blocks}<i data-k="w" class="wire" data-arrow="a to b 0" data-label="GET"></i>`, {canvas})).not.toContain('plate');
  });

  it('its label moves along the cable off a block that stands over the cable\'s middle', () => {
    // a small block standing on the cable from a to b, over its middle
    const crowd = `${blocks}<div data-k="front" data-iso="block" data-at="4.6 4.6" data-size="0.8 0.8 0.5"></div>`;
    const map = `${crowd}<i data-k="w" class="wire" data-arrow="a to b" data-label="GET"></i>`, out = applyTransforms(map, {canvas});
    const {shapes, floor} = isoDrawn(map, {canvas}), [cable] = cables([['a', 'b']], shapes, floor), outlines = [...shapes.values()].map((shape) => shape.outline);
    const [, x, y] = /style="left:([\d.-]+)px;top:([\d.-]+)px/.exec(tag(out, 'w')).map(Number);
    const [, lx, ly] = /<text class="label" x="([\d.-]+)" y="([\d.-]+)"/.exec(out.slice(out.indexOf(tag(out, 'w')))).map(Number);
    const want = labelPlace(cable, [22, 13], outlines.map(held)), middle = cablePoint(cable, 0.5);
    expect([lx + x, ly + y]).toEqual([expect.closeTo(want[0], 0), expect.closeTo(want[1], 0)]);
    expect(Math.hypot(want[0] - middle[0], want[1] - middle[1])).toBeGreaterThan(10);   // not the middle: the block is over it
    expect(labelPlace(cable, [22, 13], [])).toEqual(middle);
    // and where it stands, no block is over any corner of it
    const within = (outline, [px, py]) => outline.reduce((odd, [xi, yi], i) => { const [xj, yj] = outline.at(i - 1); return (yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi ? !odd : odd; }, false);
    for (const corner of [[-22, -13], [22, -13], [22, 13], [-22, 13], [0, 0]]) expect(outlines.some((outline) => within(outline, [want[0] + corner[0], want[1] + corner[1]]))).toBe(false);
  });

  it('the labels of a request and its answer, side by side, never cover each other', () => {
    const out = applyTransforms(`${blocks}<i data-k="req" class="wire" data-arrow="a to b" data-label="request"></i><i data-k="res" class="wire" data-arrow="b to a" data-label="answer"></i>`, {canvas});
    const plate = (name) => {
      const [, x, y] = /style="left:([\d.-]+)px;top:([\d.-]+)px/.exec(tag(out, name)).map(Number);
      const [, px, py, pw, ph] = /<rect class="plate" x="([\d.-]+)" y="([\d.-]+)" width="([\d.]+)" height="([\d.]+)"/.exec(out.slice(out.indexOf(tag(out, name)))).map(Number);
      return {left: x + px, top: y + py, right: x + px + pw, bottom: y + py + ph};
    };
    const one = plate('req'), two = plate('res');
    expect(one.right <= two.left || two.right <= one.left || one.bottom <= two.top || two.bottom <= one.top).toBe(true);
    // and neither's line runs through the other's label: there is room here to stand clear of it
    const {shapes, floor} = isoDrawn(blocks, {canvas}), [request, answer] = cables([['a', 'b'], ['b', 'a']], shapes, floor);
    const through = (cable, box) => cableWalk(cable).some(([px, py]) => px > box.left && px < box.right && py > box.top && py < box.bottom);
    expect(through(answer, one)).toBe(false);
    expect(through(request, two)).toBe(false);
    expect(through(request, one)).toBe(true);   // each stands on its own
    // both are cables between the same two feet: the answer comes back to the foot the request left
    expect(tag(out, 'req')).toContain('data-sd-cable');
    expect(tag(out, 'res')).toContain('data-sd-cable');
  });

  it('its packets ride it by both handles: the one that crosses on a path click, and the ones that keep running', () => {
    const map = `${blocks}<i data-k="w" class="wire pkt" data-arrow="a to b" data-packets="2"></i>`, out = applyTransforms(map, {canvas}), w = laid(out, 'w');
    const rides = [...out.matchAll(/style="(--cdx:[^"]*)"/g)].map((m) => m[1]);
    expect(rides).toHaveLength(3);   // the packet, and two that run
    const vars = Object.fromEntries([...rides[0].matchAll(/--(\w+):(-?[\d.]+)px/g)].map((m) => [m[1], Number(m[2])]));
    expect(Object.keys(vars)).toEqual(['cdx', 'cdy', 'c2x', 'c2y', 'pdx', 'pdy']);
    expect(vars.cdx).toBeCloseTo(w.h1[0] - w.start[0], 0);   // each from where the cable starts
    expect(vars.c2y).toBeCloseTo(w.h2[1] - w.start[1], 0);
    expect(vars.pdx).toBeCloseTo(w.stop[0] - w.start[0], 0);
    expect(rides[1]).toContain('--c2x:');
    // the stylesheet stands a cable's packet at B(t) = 3(1-t)²t·C₁ + 3(1-t)t²·C₂ + t³·E, the same on both axes
    const css = readFileSync(path.join(process.cwd(), 'deck.css'), 'utf8');
    const axis = (c1, c2, p) => `calc(var(--${c1}) * 3 * (1 - var(--sd-t)) * (1 - var(--sd-t)) * var(--sd-t) + var(--${c2}) * 3 * (1 - var(--sd-t)) * var(--sd-t) * var(--sd-t) + var(--${p}) * var(--sd-t) * var(--sd-t) * var(--sd-t))`;
    expect(css).toContain(`:where(svg.wire[data-sd-cable] :is(.pkt, .run)) {\n  transform: translate(${axis('cdx', 'c2x', 'pdx')},\n    ${axis('cdy', 'c2y', 'pdy')});\n}`);
    expect(css.indexOf('svg.wire[data-sd-cable] :is(.pkt, .run)')).toBeGreaterThan(css.indexOf(':where(svg.wire :is(.pkt, .run)) {'));   // after the one-handle rule: of two with no weight, the later wins
    const B = (t, c1, c2, e) => 3 * (1 - t) ** 2 * t * c1 + 3 * (1 - t) * t * t * c2 + t ** 3 * e;
    expect([B(0, 10, 90, 100), B(1, 10, 90, 100)]).toEqual([0, 100]);                           // it starts at the start and ends at the end
    expect(B(0.5, 100 / 3, 200 / 3, 100)).toBeCloseTo(50, 9);                                  // handles a third and two thirds along a straight run: steady along it
  });

  it('a bend, 0 too, keeps the wire a straight run; so does an end that is no block', () => {
    const straight = applyTransforms(`${blocks}<i data-k="w" class="wire" data-arrow="a to b 0"></i><i data-k="v" class="wire" data-arrow="a to b 30"></i>`, {canvas});
    expect(straight).not.toContain('data-sd-cable');
    expect(straight.match(/<path d="M[\d.-]+ [\d.-]+ Q/g)).toHaveLength(2);
    const mixed = applyTransforms(`${blocks}<div data-k="note" class="chip" style="left:100px;top:700px;width:200px;height:80px">n</div><i data-k="w" class="wire" data-arrow="note to b"></i><i data-k="c" class="wire" data-arrow="a to b"></i>`, {canvas});
    expect(mixed.match(/data-sd-cable/g)).toHaveLength(1);
    expect(tag(mixed, 'w')).not.toContain('data-sd-cable');
    expect(tag(mixed, 'c')).toContain('data-sd-cable');
  });

  it('a map\'s cable labels share one count of looks; with none left each stands at its cable\'s middle', () => {
    const map = `${blocks}<div data-k="front" data-iso="block" data-at="4.6 4.6" data-size="0.8 0.8 0.5"></div><i data-k="w" class="wire" data-arrow="a to b" data-label="GET"></i><i data-k="v" class="wire" data-arrow="b to a" data-label="200"></i>`;
    const {html, shapes, floor} = isoDrawn(map, {canvas}), [first, second] = cables([['a', 'b'], ['b', 'a']], shapes, floor);
    const label = (out, name) => {
      const [, x, y] = /style="left:([\d.-]+)px;top:([\d.-]+)px/.exec(tag(out, name)).map(Number);
      const [, lx, ly] = /<text class="label" x="([\d.-]+)" y="([\d.-]+)"/.exec(out.slice(out.indexOf(tag(out, name)))).map(Number);
      return [lx + x, ly + y];
    };
    const none = {left: 0}, spent = wires(html, shapes, floor, none);
    for (const [name, cable] of [['w', first], ['v', second]]) {
      const middle = cablePoint(cable, 0.5), at = label(spent, name);
      expect(Math.hypot(at[0] - middle[0], at[1] - middle[1])).toBeLessThan(0.2);
    }
    expect(none.left).toBe(0);
    // with looks to spend the first label moves off the block over its middle, and both labels draw on the one count
    const some = {left: 1_000_000}, careful = wires(html, shapes, floor, some), middle = cablePoint(first, 0.5), at = label(careful, 'w');
    expect(Math.hypot(at[0] - middle[0], at[1] - middle[1])).toBeGreaterThan(10);
    const one = {left: 1_000_000};
    wires(html.replace(' data-label="200"', ''), shapes, floor, one);
    expect(some.left).toBeLessThan(one.left);   // the second label spent from what the first left
    expect(one.left).toBeLessThan(1_000_000);
    // a map with no labelled cable spends nothing
    const plain = {left: 1_000_000};
    wires(html.replace(/ data-label="[^"]*"/g, ''), shapes, floor, plain);
    expect(plain.left).toBe(1_000_000);
  });

  it('a cable takes no lane: a straight wire between the same two blocks runs as it would alone', () => {
    const path = (html, name) => /<path d="([^"]+)"/.exec(html.slice(html.indexOf(tag(html, name))))[1];
    const alone = applyTransforms(`${blocks}<i data-k="s" class="wire" data-arrow="b to a 0"></i>`, {canvas});
    const beside = applyTransforms(`${blocks}<i data-k="c" class="wire" data-arrow="a to b"></i><i data-k="s" class="wire" data-arrow="b to a 0"></i>`, {canvas});
    expect(tag(beside, 's')).toBe(tag(alone, 's'));
    expect(path(beside, 's')).toBe(path(alone, 's'));
    // two straight ones still share their lanes, as ever
    const two = applyTransforms(`${blocks}<i data-k="s" class="wire" data-arrow="b to a 0"></i><i data-k="t" class="wire" data-arrow="a to b 0"></i>`, {canvas});
    expect(tag(two, 's')).not.toBe(tag(alone, 's'));
  });

  it('two blocks too close for a straight wire still get their cable: it runs from foot to foot, wherever the feet are', () => {
    const close = '<i data-iso-grid="120 at 960 240"></i><div data-k="a" data-iso="block" data-at="0 0"></div><div data-k="b" data-iso="block" data-at="2.2 0"></div>';
    expect(() => applyTransforms(`${close}<i data-k="w" class="wire" data-arrow="a to b 0"></i>`, {canvas})).toThrow(/too close for a wire between them/);
    expect(applyTransforms(`${close}<i data-k="w" class="wire" data-arrow="a to b"></i>`, {canvas})).toContain('data-sd-cable');
  });
});

describe('a wire\'s options: data-label, data-packets, data-speed', () => {
  const svg = (attrs, spec = '100 300 500 300') => wires(`<i data-k="w" data-arrow="${spec}"${attrs}></i>`);
  const at = (html, re) => re.exec(html).slice(1).map(Number);

  it('writes its label beside its middle, to the left of the way it runs: above a level wire, beside a standing one', () => {
    const level = svg(' data-label="SigV4"');
    const [bx, by] = at(level, /style="left:([\d.-]+)px;top:([\d.-]+)px/), [tx, ty] = at(level, /<text class="label" x="([\d.-]+)" y="([\d.-]+)" text-anchor="middle">SigV4<\/text>/);
    expect([bx + tx, by + ty]).toEqual([300, 300 - 13 - 8]);   // the middle, half the label's height and 8 px above
    const back = svg(' data-label="answer"', '500 300 100 300');
    expect(at(back, /top:([\d.-]+)px/)[0] + at(back, /<text class="label" x="[\d.-]+" y="([\d.-]+)"/)[0]).toBe(321);   // running left: below
    const down = svg(' data-label="read"', '300 100 300 500');
    expect(at(down, /left:([\d.-]+)px/)[0] + at(down, /<text class="label" x="([\d.-]+)"/)[0]).toBe(300 + (4 * 12) / 2 + 4 + 8);   // running down, its left is the slide's right (as its lane's): half the label's width and 8 px off
  });

  it('grows the wire\'s box to hold its label, so a wire showing itself in shows its label too', () => {
    const [w, h] = at(svg(' data-label="InvokeAgentRuntime"', '100 300 160 300'), /width:([\d.]+)px;height:([\d.]+)px/);
    expect(w).toBeGreaterThanOrEqual((18 * 12) / 2 * 2);
    expect(h).toBeGreaterThan(40);
    expect(svg(' data-label="A &amp; B"')).toContain('>A &amp; B</text>');   // written as the deck wrote it
  });

  it('runs its packets as loops, evenly spaced on one clock: data-speed the seconds a run takes (3 by default)', () => {
    const runs = [...svg(' data-packets="3" data-speed="6s"').matchAll(/<circle class="run" data-loop [^>]*--loop:sdRun 6s linear (-?[\d.]+)s infinite"\/>/g)].map((m) => Number(m[1]));
    expect(runs).toEqual([0, -2, -4]);
    expect(svg(' data-packets="1"')).toContain('--loop:sdRun 3s linear 0s infinite');
    expect(svg(' data-packets="2" data-speed="1.5"')).toContain('--loop:sdRun 1.5s linear -0.75s infinite');
    // fast and many: still evenly spaced (to the ms), never two on one spot
    const fast = [...svg(' data-packets="6" data-speed="0.5"').matchAll(/linear (-?[\d.]+)s infinite/g)].map((m) => Number(m[1]));
    expect(fast).toEqual([0, -0.083, -0.167, -0.25, -0.333, -0.417]);
  });

  it('reads its options as a browser reads the tag: not from inside another attribute\'s value, in any case, quoted or not', () => {
    expect(svg(' title="see data-label=\'x\' data-packets=\'9\'" data-label="Real"')).toMatch(/>Real<\/text>/);
    expect(svg(' title="see data-label=\'x\' data-packets=\'9\'" data-label="Real"')).not.toContain('class="run"');
    expect(svg(' DATA-LABEL="Up" Data-Packets=2')).toMatch(/>Up<\/text>.*|class="run"/s);
    expect(svg(' DATA-LABEL="Up" Data-Packets=2').match(/class="run"/g)).toHaveLength(2);
    expect(svg(' data-label="first" data-label="second"')).toContain('>first</text>');
    expect(() => wires('<i data-k="w" data-arrow="1 2 3 4" title="a></i>')).toThrow('wire data-arrow="1 2 3 4": a quote in its tag is never closed — write a ">" or "<" inside a value as &gt; or &lt;');
  });

  it('keeps a label clear of a wire bent away from it, under the label\'s whole width', () => {
    const labelled = (bend) => svg(` data-label="ABCDEFGHIJ"`, `100 300 300 300 ${bend}`);
    const yOf = (html) => at(html, /top:([\d.-]+)px/)[0] + at(html, /<text class="label" x="[\d.-]+" y="([\d.-]+)"/)[0];
    // bent 150 px down (away from the label above it): its middle is at y 375, and under the label's ends it rises
    // 2·150·u²/200² back towards the label
    const bottom = yOf(labelled(150)) + 9, rise = (2 * 150 * 64 ** 2) / 200 ** 2;   // 64: half the label's width as drawn (10 letters × 12 / 2 + 4)
    expect(375 - rise - bottom).toBeCloseTo(12, 0);   // clear of the curve under its ends by its plain gap
    expect(yOf(labelled(-150))).toBe(300 - 75 - 21);   // bent towards it: the curve leaves, the label keeps its plain gap
  });

  it('refuses packets it cannot run and a speed for no packets — naming the fix', () => {
    const where = 'wire data-arrow="100 300 500 300": ';
    expect(() => svg(' data-packets="0"')).toThrow(`${where}data-packets="0" — the packets that run along it are a whole number, 1 to 6`);
    expect(() => svg(' data-packets="two"')).toThrow(/a whole number, 1 to 6/);
    expect(() => svg(' data-packets="7"')).toThrow(`${where}data-packets="7" — at most 6 packets run along one wire`);
    expect(() => svg(' data-speed="2"')).toThrow(`${where}data-speed sets how fast its packets run — give it data-packets too`);
    for (const v of ['0.2', '61', 'fast', '-1']) expect(() => svg(` data-packets="1" data-speed="${v}"`), v).toThrow(`${where}data-speed="${v}" — the seconds a packet takes to run the wire, 0.5 to 60`);
  });

  it('a wire without them is drawn as before; deck.css styles the label, the halo and the packets from the theme\'s tokens', () => {
    expect(svg('')).not.toMatch(/label|run/);
    const css = readFileSync(path.join(process.cwd(), 'deck.css'), 'utf8');
    expect(css).toContain(':where(svg.wire.halo path) { filter: drop-shadow(0 0 6px var(--wire-halo, currentColor)); }');
    expect(css).toMatch(/:where\(svg\.wire \.run\) \{\n\s+--sd-t: \.5; fill: var\(--packet, /);
    expect(css).toContain(':where(svg.wire .run + .run) { opacity: 0; }');
    expect(css).toContain('@keyframes sdRun { 0% { --sd-t: 0; opacity: 0; } 12%, 85% { opacity: 1; } 100% { --sd-t: 1; opacity: 0; } }');
  });
});
