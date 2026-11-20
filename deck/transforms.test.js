import {describe, it, expect} from 'vitest';
import {wires, wiresDrawn, wireTags, transformed, icons, readIcon, applyTransforms} from './transforms.js';
import {isoDrawn} from './iso.js';
import {exitOutline} from './boxes.js';
import {cables, cableWalk, cableWay, held, labelPlace} from './cable.js';
import {stripComments} from './html.js';
import {PACE_CSS} from './pace.js';
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
    expect(t).toMatch(/:where\(svg\.wire\.sd-enter:not\(\.sd-hot, \.sd-hot-in, \[data-sd-lead\]\)\) \{\n\s+-webkit-mask-image/);
    expect(t).toContain(':where(svg.wire.sd-twin-turn) { --sd-twin-lag: .3s; }');
    expect(readFileSync(path.join(process.cwd(), 'focus.css'), 'utf8')).toContain('sdLeave .45s ease calc(var(--sd-turn) + var(--sd-twin-lag, 0s)) both');
    expect(readFileSync(path.join(process.cwd(), 'focus.css'), 'utf8')).toContain('var(--sd-a-path, sdNone 0s), var(--sd-a-more, sdNone 0s), var(--sd-a-loop, sdNone 0s); }');
    expect(wires('<i data-k="w" data-arrow="0 0 9 9"></i>')).not.toContain('pathLength');
  });

  it('keeps deck.css\'s promise: every rule is :where(), so a deck\'s theme wins over any of them', () => {
    const text = css().replace(/\/\*[\s\S]*?\*\//g, '');
    // a selector with each :where(…) taken out: only combinators may be left
    const outside = (sel) => {
      let out = '', i = 0;
      while (i < sel.length) {
        if (!sel.startsWith(':where(', i)) { out += sel[i++]; continue; }
        let depth = 0, j = i + 6;
        for (; j < sel.length; j++) if (sel[j] === '(') depth++; else if (sel[j] === ')' && --depth === 0) break;
        i = j + 1;
      }
      return out.replace(/[\s>+~,]/g, '');
    };
    const strong = [];
    let depth = 0, frames = 0;
    for (const m of text.matchAll(/([^{}]*)\{|\}/g)) {
      if (m[0] === '}') { depth--; if (frames && depth < frames) frames = 0; continue; }
      const sel = m[1].trim();
      depth++;
      if (sel.startsWith('@keyframes')) frames = depth;
      else if (!sel.startsWith('@') && !frames && outside(sel)) strong.push(sel);
    }
    expect(strong).toEqual([]);
  });

  it('shows the lead at a cable\'s far end once the sweep reaches it, by the part\'s pace too — the pace rule leaves it alone', () => {
    const t = css();
    expect(t).toContain(':where(svg.wire[data-sd-lead="end"].sd-enter:not(.sd-hot, .sd-hot-in)) { --sd-a-more: sdLeadWait calc(var(--sd-arrive-time, .6s) * .8) linear calc(var(--sd-delay, 0s) + var(--sd-arrive-delay, 0s)) backwards; }');
    expect(t).toContain(':where(svg.wire.sd-path[data-sd-lead="end"].sd-enter:not(.sd-hot, .sd-hot-in)) { --sd-a-more: sdLeadWait calc(var(--sd-arrive-time, .6s) * .8) linear calc(var(--sd-turn, 0s) + var(--sd-arrive-delay, 0s)) backwards; }');
    // the pace rules come later on the page at the same (zero) weight: they must not take the far-end lead back
    expect(PACE_CSS.match(/svg\.wire[^)]*\.sd-enter:not\(\.sd-hot, \.sd-hot-in, \[data-sd-lead="end"\]\)/g)).toHaveLength(2);
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
  const grid = '<i data-iso-grid="120 at 960 240"></i>';
  const blocks = `${grid}<div data-k="a" data-iso="block" data-at="0 4"></div><div data-k="b" data-iso="block" data-at="5 1"></div>`;
  const tag = (html, name) => new RegExp(`<svg[^>]*data-k="${name}"[^>]*>`).exec(html)[0];
  const svgOf = (html, name) => { const from = html.indexOf(tag(html, name)); return html.slice(from, html.indexOf('</svg>', from)); };
  const cornerOf = (html, name) => /style="left:([\d.-]+)px;top:([\d.-]+)px/.exec(tag(html, name)).slice(1).map(Number);
  /** A cable's line as the build would lay it, and its tip: from the same pieces, by cable.js. */
  const lineOf = (map, link, all = [link]) => {
    const {shapes, floor} = isoDrawn(map, {canvas}), laid = cables(all, shapes, floor), cable = laid[all.indexOf(link)];
    return {way: cableWay(cable, 14.4), tip: cable.points.at(-1), cable, shapes};
  };

  it('is drawn along the way cable.js gives — straight runs and rounded corners — and marked as a cable', () => {
    const map = `${blocks}<i data-k="w" class="wire req" data-arrow="a to b"></i>`, out = applyTransforms(map, {canvas});
    // out of a's right foot along the cols, one rounded turn, up the rows into b's left foot: the line stops where the head begins
    expect(svgOf(out, 'w')).toContain('<path d="M20 20L230.6 125.3Q254.6 137.3 278.6 125.3L356.4 86.4"/>');
    expect(tag(out, 'w')).toMatch(/^<svg data-ends="a b" data-k="w" class="wire req" data-sd-cable style="left:[\d.-]+px;top:[\d.-]+px;width:[\d.]+px;height:[\d.]+px;--sd-angle:[\d.-]+deg;--sd-way:path\('M20 20L230\.6 125\.3Q254\.6 137\.3 278\.6 125\.3L356\.4 86\.4'\);--sd-length:[\d.]+px" viewBox="0 0 [\d.]+ [\d.]+" aria-hidden="true">$/);
    // the same line as cable.js lays it, in the wire's own box
    const {way, tip} = lineOf(blocks, ['a', 'b']), [x, y] = cornerOf(out, 'w');
    expect(way.start[0] - x).toBeCloseTo(20, 1);
    expect(way.pieces.map((piece) => (piece.corner ? 'Q' : 'L')).join('')).toBe('LQL');
    // its head's tip is the cable's end, 6 px off b's foot, pointing up the rows
    const [, hx, hy] = /<path class="head" d="M([\d.-]+) ([\d.-]+)L/.exec(svgOf(out, 'w')).map(Number);
    expect([hx + x, hy + y]).toEqual([expect.closeTo(tip[0], 0), expect.closeTo(tip[1], 0)]);
    expect(hy).toBeLessThan(86.4);
  });

  it('its box holds its line and its label; the label stands on the cable, on a plate, under the head', () => {
    const map = `${blocks}<i data-k="w" class="wire" data-arrow="a to b" data-label="GET"></i>`, out = applyTransforms(map, {canvas}), drawn = svgOf(out, 'w');
    const [, x, y, wide, tall] = /style="left:([\d.-]+)px;top:([\d.-]+)px;width:([\d.]+)px;height:([\d.]+)px/.exec(tag(out, 'w')).map(Number);
    const {way, tip, shapes} = lineOf(blocks, ['a', 'b']);
    for (const p of [way.start, tip, ...way.pieces.flatMap((piece) => (piece.corner ? [piece.corner, piece.to] : [piece.to]))]) expect(p[0] >= x && p[0] <= x + wide && p[1] >= y && p[1] <= y + tall).toBe(true);
    const [, lx, ly] = /<text class="label" x="([\d.-]+)" y="([\d.-]+)"/.exec(drawn).map(Number);
    const want = labelPlace(way, [22, 13], [...shapes.values()].map((shape) => held(shape.outline)), [], undefined, tip);
    expect([lx + x, ly + y]).toEqual([expect.closeTo(want[0], 0), expect.closeTo(want[1], 0)]);
    expect(want).toEqual(way.at(0.5));   // nothing is in its way here: the cable's middle
    // the plate: the label's own box (3 letters × 12 px and 4 px each side, 18 px and 4 px above and below), over the line and
    // under the label — and under the head, so the arrow's tip is seen even where a label is longer than its cable has room for
    const [, px, py, pw, ph] = /<path d="[^"]*"\/><rect class="plate" x="([\d.-]+)" y="([\d.-]+)" width="([\d.]+)" height="([\d.]+)" rx="6"\/><path class="head"[^>]*\/><text class="label"/.exec(drawn).map(Number);
    expect([pw, ph]).toEqual([44, 26]);
    expect(px + pw / 2).toBeCloseTo(lx, 0);
    expect(py + ph / 2).toBeCloseTo(ly, 0);
    expect(readFileSync(path.join(process.cwd(), 'deck.css'), 'utf8')).toContain(':where(svg.wire rect.plate) { fill: var(--wire-plate, var(--bg, #ffffff)); stroke: none; }');   // the slide's ground, or the deck's own token on a tinted floor
    // a letter written as an entity is one letter of the plate's width, not five
    expect(applyTransforms(`${blocks}<i data-k="w" class="wire" data-arrow="a to b" data-label="A &amp; B"></i>`, {canvas})).toMatch(/<rect class="plate" [^>]*width="68" height="26"/);
    // a wire that is no cable has no plate: its label stands beside it, as ever
    expect(applyTransforms(`${blocks}<i data-k="w" class="wire" data-arrow="a to b 0" data-label="GET"></i>`, {canvas})).not.toContain('plate');
  });

  it('its packets ride its own line: carried along --sd-way, under the plate; the stylesheet says how', () => {
    const out = applyTransforms(`${blocks}<i data-k="w" class="wire pkt" data-arrow="a to b" data-label="GET" data-packets="2" data-speed="4"></i>`, {canvas});
    // each is drawn at the corner of the wire's box, and carries no numbers of its own: the line is the wire's
    expect(svgOf(out, 'w')).toMatch(/<path d="[^"]*"\/><rect class="pkt" x="-8" y="-6" width="16" height="12" rx="3"\/><circle class="run" data-loop cx="0" cy="0" r="7" style="[^"]*--loop:sdRun 4s linear 0s infinite"\/><circle class="run" data-loop cx="0" cy="0" r="7" style="[^"]*--loop:sdRun 4s linear -2s infinite"\/><rect class="plate"[^>]*\/><path class="head"[^>]*\/><text class="label"/);
    const css = readFileSync(path.join(process.cwd(), 'deck.css'), 'utf8');
    expect(css).toContain(':where(svg.wire[data-sd-cable] :is(.pkt, .run)) { transform: none; offset-path: var(--sd-way); offset-distance: calc(var(--sd-t) * 100%); offset-rotate: 0deg; }');
    expect(css.indexOf('svg.wire[data-sd-cable] :is(.pkt, .run)')).toBeGreaterThan(css.indexOf(':where(svg.wire :is(.pkt, .run)) {'));   // after the one-handle rule: of two with no weight, the later wins
    // a wire that is no cable still rides by its one handle
    expect(applyTransforms(`${blocks}<i data-k="w" class="wire pkt" data-arrow="a to b 0"></i>`, {canvas})).toMatch(/<rect class="pkt" x="[\d.]+" y="[\d.]+" width="16" height="12" rx="3" style="--cdx:/);
  });

  it('where the packets do not run, one rests clear of the label\'s plate: off the cable\'s middle when the label stands there', () => {
    const packets = (label) => applyTransforms(`${blocks}<i data-k="w" class="wire" data-arrow="a to b"${label} data-packets="2"></i>`, {canvas});
    expect(packets('')).not.toContain('--sd-t');   // no label: the middle, as deck.css says for every wire
    const rests = [...packets(' data-label="GET"').matchAll(/<circle class="run"[^>]*style="--sd-t:([\d.]+);--loop:/g)].map((m) => Number(m[1]));
    expect(rests).toEqual([0.35, 0.35]);   // both of them (one shows): the nearest place the plate is not over
    const {way} = lineOf(blocks, ['a', 'b']), middle = way.at(0.5), rest = way.at(0.35);
    expect(Math.abs(rest[0] - middle[0]) > 22 + 9 || Math.abs(rest[1] - middle[1]) > 13 + 9).toBe(true);   // clear of the plate, the packet's own 7 px and a little more
    expect(applyTransforms(`${blocks}<i data-k="w" class="wire" data-arrow="a to b 0" data-label="GET" data-packets="2"></i>`, {canvas})).not.toContain('--sd-t');
  });

  it('a request and its answer lie in two lanes, each a cable, and their labels do not cover each other', () => {
    const map = `${blocks}<i data-k="req" class="wire" data-arrow="a to b" data-label="GET"></i><i data-k="res" class="wire" data-arrow="b to a" data-label="200"></i>`, out = applyTransforms(map, {canvas});
    expect(tag(out, 'req')).toContain('data-sd-cable');
    expect(tag(out, 'res')).toContain('data-sd-cable');
    const all = [['a', 'b'], ['b', 'a']], one = lineOf(blocks, all[0], all), two = lineOf(blocks, all[1], all);
    expect(one.cable.route.shared + two.cable.route.shared).toBe(0);
    expect(two.cable.route.feet).toEqual(['left', 'right']);   // the same two feet, the other way
    const plate = (name) => {
      const [x, y] = cornerOf(out, name), [, px, py, pw, ph] = /<rect class="plate" x="([\d.-]+)" y="([\d.-]+)" width="([\d.]+)" height="([\d.]+)"/.exec(svgOf(out, name)).map(Number);
      return {left: x + px, top: y + py, right: x + px + pw, bottom: y + py + ph};
    };
    const first = plate('req'), second = plate('res');
    expect(first.right <= second.left || second.right <= first.left || first.bottom <= second.top || second.bottom <= first.top).toBe(true);
    // and neither's line runs through the other's label: there is room here to stand clear of it
    const through = (way, box) => cableWalk(way).some(([px, py]) => px > box.left && px < box.right && py > box.top && py < box.bottom);
    expect(through(two.way, first)).toBe(false);
    expect(through(one.way, second)).toBe(false);
    expect(through(one.way, first)).toBe(true);   // each stands on its own
  });

  it('a block straight in front of another, beside it along a tile line, or against it is reached along the floor too', () => {
    for (const at of ['5 5', '-5 -5', '4 0', '0 4', '2 0', '2.2 0']) {
      const map = `${grid}<div data-k="a" data-iso="block" data-at="0 0"></div><div data-k="b" data-iso="block" data-at="${at}"></div><i data-k="w" class="wire" data-arrow="a to b"></i><i data-k="v" class="wire" data-arrow="b to a"></i>`;
      const out = applyTransforms(map, {canvas});
      expect(tag(out, 'w'), `b at ${at}`).toContain('data-sd-cable');
      expect(tag(out, 'v'), `b at ${at}`).toContain('data-sd-cable');
      expect(transformed(map, {canvas}).ways, `b at ${at}`).toEqual([]);   // and each lies well: nothing to say
    }
  });

  it('a wire goes round a block that stands in its way', () => {
    const through = `${grid}<div data-k="a" data-iso="block" data-at="0 4"></div><div data-k="mid" data-iso="block" data-at="4 3" data-size="2 2 2"></div><div data-k="b" data-iso="block" data-at="8 4"></div><i data-k="w" class="wire" data-arrow="a to b"></i>`;
    const out = applyTransforms(through, {canvas}), {cable} = lineOf(through, ['a', 'b']);
    expect(tag(out, 'w')).toContain('data-sd-cable');
    expect(transformed(through, {canvas}).ways).toEqual([]);
    expect(cable.route.bends).toBeGreaterThan(1);
  });

  it('what the build knows of a wire\'s way is handed on beside the page, for check', () => {
    // walled in front: the only way passes behind the wall
    const walled = `${grid}<div data-k="a" data-iso="block" data-at="0 4"></div><div data-k="b" data-iso="block" data-at="8 4"></div><div data-k="wall" data-iso="block" data-at="4 5.5" data-size="2 40 2"></div><i data-k="w" class="wire" data-arrow="a to b"></i>`;
    const hidden = transformed(walled, {canvas});
    expect(hidden.ways).toEqual([{name: 'w', from: 'a', to: 'b', way: 'behind wall'}]);
    expect(tag(hidden.html, 'w')).toContain('data-sd-cable');
    expect(hidden.html).toBe(applyTransforms(walled, {canvas}));   // the page is the same page: nothing of it is written there
    // two heights: no way along one floor — the straight wire it was, to the byte, and the build says why
    const lifted = `${grid}<div data-k="a" data-iso="block" data-at="0 4"></div><div data-k="up" data-iso="block" data-at="6 0 2"></div><i data-k="w" class="wire" data-arrow="a to up"></i>`;
    const straight = transformed(lifted, {canvas});
    expect(tag(straight.html, 'w')).not.toContain('data-sd-cable');
    expect(straight.ways).toEqual([{name: 'w', from: 'a', to: 'up', way: 'straight heights'}]);
    expect(straight.html).toBe(applyTransforms(lifted.replace('a to up', 'a to up 0'), {canvas}).replace('a to up 0', 'a to up'));   // the very wire a bend of 0 asks for
    // a wire that lies well says nothing; one with no name of its own is called by the two it joins
    expect(transformed(`${blocks}<i data-k="w" class="wire" data-arrow="a to b"></i>`, {canvas}).ways).toEqual([]);
    expect(transformed(lifted.replace(' data-k="w"', ''), {canvas}).ways).toEqual([{name: 'a to up', from: 'a', to: 'up', way: 'straight heights'}]);
    // its name is its own data-k, read as a browser reads the tag: not those words inside another value
    expect(transformed(lifted.replace(' data-k="w"', ' title=\'see data-k="x"\' data-k="real other"'), {canvas}).ways[0].name).toBe('real');
  });

  it('only the build says what the build did: nothing a deck writes is taken for it, and nothing a deck writes is touched', () => {
    const planted = ['<i data-k="w" class="wire" data-sd-way="behind EVIL; shared" data-way="shared" title=\'see data-sd-way="x" here\' data-arrow="a to b"></i>', '<i data-k="w" class="wire" data-arrow="100 300 500 300" data-sd-way="shared"></i>', '<svg data-ends="a b" data-sd-way="behind EVIL" data-k="fake"></svg><i data-k="w" class="wire" data-arrow="a to b"></i>'];
    for (const wire of planted) expect(transformed(`${blocks}${wire}`, {canvas}).ways, wire).toEqual([]);
    expect(applyTransforms(`${blocks}${planted[0]}`, {canvas})).toContain(`title='see data-sd-way="x" here'`);   // the deck's own text, as it wrote it
  });

  it('a block that shares its name with another is still gone round; a name of any length or letters is no trouble', () => {
    // two blocks named "m": no wire can end at "m", and a wire from a to b still must not run under either
    const twins = `${grid}<div data-k="a" data-iso="block" data-at="0 4"></div><div data-k="m" data-iso="block" data-at="4 5" data-size="2 3 2"></div><div data-k="m" data-iso="block" data-at="4 12"></div><div data-k="b" data-iso="block" data-at="8 4"></div>`;
    const {shapes, solids, floor} = isoDrawn(twins, {canvas}), [cable] = cables([['a', 'b']], shapes, floor, solids);
    expect(solids).toHaveLength(4);
    expect(shapes.has('m')).toBe(false);
    const under = (col, row) => col > 4 && col < 6 && row > 5 && row < 8;
    for (const [[c0, r0], [c1, r1]] of cable.route.points.slice(1).map((p, k) => [cable.route.points[k], p])) for (let t = 0.05; t < 1; t += 0.05) expect(under(c0 + (c1 - c0) * t, r0 + (r1 - r0) * t)).toBe(false);
    // drawn so too: the very line the map gets when the second block has a name of its own
    const wire = '<i data-k="w" class="wire" data-arrow="a to b"></i>', lineIn = (map) => /<path d="([^"]+)"/.exec(svgOf(applyTransforms(`${map}${wire}`, {canvas}), 'w'))[1];
    expect(tag(applyTransforms(`${twins}${wire}`, {canvas}), 'w')).toContain('data-sd-cable');
    expect(lineIn(twins)).toBe(lineIn(twins.replace('<div data-k="m" data-iso="block" data-at="4 12">', '<div data-k="m2" data-iso="block" data-at="4 12">')));
    // a name longer than the kit keeps, and one with letters a note is written in
    const long = 'x'.repeat(300);
    const named = `${grid}<div data-k="a" data-iso="block" data-at="0 4"></div><div data-k="b" data-iso="block" data-at="8 4"></div><div data-k="${long}" data-iso="block" data-at="4 5.5" data-size="2 40 2"></div><div data-k="x;shared" data-iso="block" data-at="20 4"></div><i data-k="w" class="wire" data-arrow="a to b"></i><i data-k="v" class="wire" data-arrow="${long} to x;shared"></i>`;
    expect(transformed(named, {canvas}).ways.find((w) => w.name === 'w')).toEqual({name: 'w', from: 'a', to: 'b', way: `behind ${long}`});
    const odd = `${grid}<div data-k="a" data-iso="block" data-at="0 4"></div><div data-k="b" data-iso="block" data-at="8 4"></div><div data-k="x;shared" data-iso="block" data-at="4 5.5" data-size="2 40 2"></div><i data-k="w" class="wire" data-arrow="a to b"></i>`;
    expect(transformed(odd, {canvas}).ways).toEqual([{name: 'w', from: 'a', to: 'b', way: 'behind x%3Bshared'}]);
  });

  it('a wire the floor had no way for, between blocks too close for a straight one, says both', () => {
    // b's two feet are closed in by blocks against them, and a stands against b: no way, and no room for a straight wire
    const boxed = `${grid}<div data-k="a" data-iso="block" data-at="-2 0"></div><div data-k="b" data-iso="block" data-at="0 0"></div><div data-k="e" data-iso="block" data-at="2 0"></div><div data-k="s" data-iso="block" data-at="0 2"></div><i data-k="w" class="wire" data-arrow="a to b"></i>`;
    expect(() => applyTransforms(boxed, {canvas})).toThrow('data-arrow="a to b": no way along the floor was laid for it (no place at a foot that can be seen: closed in, or too narrow), and "a" and "b" are too close for a straight wire between them — move them apart, or give the wire numbers');
    // two blocks that touch, asked for a straight wire: the old words, as ever
    expect(() => applyTransforms(boxed.replace('a to b', 'a to b 0'), {canvas})).toThrow('"a" and "b" are too close for a wire between them (they touch or overlap) — move them apart, or give the wire numbers');
  });

  it('data-head="none": a plain line that runs its whole length, on a cable and on a straight wire', () => {
    const cable = applyTransforms(`${blocks}<i data-k="w" class="wire" data-arrow="a to b" data-head="none"></i>`, {canvas}), {cable: laid} = lineOf(blocks, ['a', 'b']);
    expect(svgOf(cable, 'w')).not.toContain('class="head"');
    const whole = cableWay(laid, 0), [x, y] = cornerOf(cable, 'w'), [, ex, ey] = /L([\d.-]+) ([\d.-]+)"\/>/.exec(svgOf(cable, 'w')).map(Number);
    expect([ex + x, ey + y]).toEqual([expect.closeTo(laid.points.at(-1)[0], 0), expect.closeTo(laid.points.at(-1)[1], 0)]);   // to the cable's own end, 6 px off the foot
    expect(tag(cable, 'w')).toContain(`--sd-length:${+whole.length.toFixed(1)}px`);
    const straight = wires('<i data-k="w" data-arrow="100 300 500 300" data-head="none"></i>');
    expect(straight).toContain('<path d="M20 20 Q220 20 420 20"/>');   // all 400 px of it: no 14 px left for a head
    expect(straight).not.toContain('class="head"');
    expect(wires('<i data-k="w" data-arrow="100 300 500 300"></i>')).toContain('<path d="M20 20 Q220 20 405.6 20"/><path class="head"');
    expect(() => wires('<i data-k="w" data-arrow="100 300 500 300" data-head="round"></i>')).toThrow('wire data-arrow="100 300 500 300": data-head="round" — a wire has its arrow\'s head, or data-head="none" for a plain line that runs its whole length');
  });

  it('carries its line\'s length for a deck\'s own CSS, and the build keeps a record of every cable laid', () => {
    const map = `${blocks}<i data-k="w" class="wire" data-arrow="a to b"></i><i data-k="v" class="wire" data-arrow="b to a 0"></i>`, made = transformed(map, {canvas}), {way, cable} = lineOf(blocks, ['a', 'b']);
    expect(tag(made.html, 'w')).toContain(`;--sd-length:${+way.length.toFixed(1)}px"`);
    expect(tag(made.html, 'v')).not.toContain('--sd-length');   // a straight wire is its own short line
    expect(made.cables).toEqual([{name: 'w', from: 'a', to: 'b', points: cable.points.map(([x, y]) => [+x.toFixed(1), +y.toFixed(1)]), length: +way.length.toFixed(1), unseen: [], behind: [], crosses: 0, shared: 0, bends: 1}]);
    expect(made.made).toEqual({placed: 'hand', tile: 120, fitted: false});
    expect(made.tight).toEqual([]);
    // a stretch a block hides is in the record, in px along the cable
    const walled = `${grid}<div data-k="a" data-iso="block" data-at="0 4"></div><div data-k="b" data-iso="block" data-at="8 4"></div><div data-k="wall" data-iso="block" data-at="4 5.5" data-size="2 40 2"></div><i data-k="w" class="wire" data-arrow="a to b"></i>`;
    const [hidden] = transformed(walled, {canvas}).cables;
    expect(hidden.behind).toEqual(['wall']);
    expect(hidden.unseen.length).toBeGreaterThan(0);
    for (const [from, to] of hidden.unseen) expect(from >= 0 && to > from && to <= hidden.length + 20).toBe(true);
    expect(transformed('<p>no map</p>', {canvas})).toEqual({html: '<p>no map</p>', ways: [], cables: [], tight: [], made: null});
  });

  it('the picture and the floor are fitted to the wires as well as the blocks: a wire that goes round stays on the slide', () => {
    // a ring: the wire back from the last block to the first runs round the front of the others
    const ring = '<div data-k="floor" data-iso="floor"></div>' + ['a', 'b', 'c', 'd'].map((n) => `<div data-k="${n}" data-iso="block"></div>`).join('') + '<i data-k="w1" class="wire" data-arrow="a to b"></i><i data-k="w2" class="wire" data-arrow="b to c"></i><i data-k="w3" class="wire" data-arrow="c to d"></i><i data-k="back" class="wire" data-arrow="d to a"></i>';
    const area = [60, 200, 1860, 1000], made = transformed(ring, {canvas, area});
    expect(made.cables).toHaveLength(4);
    for (const {name, points} of made.cables) for (const [x, y] of points) expect(x >= area[0] && x <= area[2] && y >= area[1] && y <= area[3], `${name} at ${[x, y]}`).toBe(true);
    // and every corner of every wire is on the fitted floor: inside the four-sided ground the floor draws
    const [, fx, fy] = /data-k="floor"[^>]*style="left:([\d.-]+)px;top:([\d.-]+)px/.exec(made.html).map(Number);
    const ground = /<polygon class="iso-ground" points="([^"]+)"/.exec(made.html)[1].trim().split(/\s+/).map((pair) => pair.split(',').map(Number)).map(([x, y]) => [x + fx, y + fy]);
    const onFloor = ([px, py]) => ground.reduce((odd, [xi, yi], i) => { const [xj, yj] = ground.at(i - 1); return (yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi ? !odd : odd; }, false);
    for (const {name, points} of made.cables) for (const p of points) expect(onFloor(p), `${name} at ${p}`).toBe(true);
    expect(onFloor([ground[0][0], ground[0][1] - 50])).toBe(false);   // the check does see a point off the floor
    // three wires round the front of a wall take three lanes: the third runs a tile and a half past every block, and the floor still lies under it
    const lanes = `${grid}<div data-k="floor" data-iso="floor"></div><div data-k="a" data-iso="block" data-at="0 4"></div><div data-k="b" data-iso="block" data-at="8 4"></div><div data-k="wall" data-iso="block" data-at="4 -10" data-size="2 16 1"></div>` + [1, 2, 3].map((n) => `<i data-k="w${n}" class="wire" data-arrow="a to b"></i>`).join('');
    const wide = transformed(lanes, {canvas}), [, lx, ly] = /data-k="floor"[^>]*style="left:([\d.-]+)px;top:([\d.-]+)px/.exec(wide.html).map(Number);
    const under = /<polygon class="iso-ground" points="([^"]+)"/.exec(wide.html)[1].trim().split(/\s+/).map((pair) => pair.split(',').map(Number)).map(([x, y]) => [x + lx, y + ly]);
    const onIt = ([px, py]) => under.reduce((odd, [xi, yi], i) => { const [xj, yj] = under.at(i - 1); return (yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi ? !odd : odd; }, false);
    expect(wide.cables).toHaveLength(3);
    for (const {name, points} of wide.cables) for (const p of points) expect(onIt(p), `${name} at ${p}`).toBe(true);
  });

  it('draws the wires as they were laid: the ways handed to it are the ways it draws, laid once', () => {
    const map = `${blocks}<i data-k="w" class="wire" data-arrow="a to b"></i>`, iso = isoDrawn(map, {canvas});
    expect(wiresDrawn(iso.html, {...iso, routes: [null]}).html).not.toContain('data-sd-cable');          // told the wire was not laid: it draws the straight wire
    expect(wiresDrawn(iso.html, iso).html).toContain('data-sd-cable');                                   // told nothing: it lays the wire itself
    expect(wiresDrawn(iso.html, {...iso, routes: []}).html).toContain('data-sd-cable');                  // a list that is not this map's wires is not used
  });

  it('a block is one piece alone by the pieces that have a box: a wire of its name, or words placed nowhere, leave it a cable\'s end', () => {
    const wire = (k) => `<i data-k="${k}" class="wire" data-arrow="a to b"></i>`;
    for (const map of [`${blocks}${wire('b')}`, `${blocks}<div data-k="b">a label placed nowhere</div>${wire('w')}`, `${blocks}<div data-k="b" style="left:10px;top:10px">no size</div>${wire('w')}`]) {
      const made = transformed(map, {canvas});
      expect(made.cables, map).toHaveLength(1);
      expect(made.html, map).toContain('data-sd-cable');
      // and the drawing agrees with the laying: the ways handed on are the ways it would lay itself
      const iso = isoDrawn(map, {canvas});
      expect(wiresDrawn(iso.html, iso).html, map).toBe(made.html);
    }
    // a callout is placed before the wires are drawn, so one that shares a block's name is a second piece with a box: laying and
    // drawing agree that the name is no block alone (no cable is laid for it, and none is drawn)
    const noted = transformed(`${blocks}<div data-k="c" data-iso="block" data-at="9 4"></div><div data-k="b" data-callout="c right">a note</div>${wire('w')}`, {canvas});
    expect(noted.cables).toEqual([]);
    expect(noted.html).not.toContain('data-sd-cable');
    // a second piece with a box shares the name: the name is a box round both, as ever, and the wire runs straight to it
    const shared = transformed(`${blocks}<div data-k="b" class="chip" style="left:1500px;top:400px;width:50px;height:20px">b</div>${wire('w')}`, {canvas});
    expect(shared.cables).toEqual([]);
    expect(shared.html).not.toContain('data-sd-cable');
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

  it('a cable takes no lane: a straight wire between the same two blocks runs as it would alone', () => {
    const pathOf = (html, name) => /<path d="([^"]+)"/.exec(svgOf(html, name))[1];
    const alone = applyTransforms(`${blocks}<i data-k="s" class="wire" data-arrow="b to a 0"></i>`, {canvas});
    const beside = applyTransforms(`${blocks}<i data-k="c" class="wire" data-arrow="a to b"></i><i data-k="s" class="wire" data-arrow="b to a 0"></i>`, {canvas});
    expect(tag(beside, 's')).toBe(tag(alone, 's'));
    expect(pathOf(beside, 's')).toBe(pathOf(alone, 's'));
    const two = applyTransforms(`${blocks}<i data-k="s" class="wire" data-arrow="b to a 0"></i><i data-k="t" class="wire" data-arrow="a to b 0"></i>`, {canvas});
    expect(tag(two, 's')).not.toBe(tag(alone, 's'));   // two straight ones still share their lanes, as ever
  });

  it('a map\'s cable labels share one count of looks; with none left each stands at its cable\'s middle', () => {
    const map = `${blocks}<i data-k="w" class="wire" data-arrow="a to b" data-label="GET"></i><i data-k="v" class="wire" data-arrow="b to a" data-label="200"></i>`;
    const {html, shapes, floor} = isoDrawn(map, {canvas}), all = [['a', 'b'], ['b', 'a']];
    const label = (out, name) => { const [x, y] = cornerOf(out, name), [, lx, ly] = /<text class="label" x="([\d.-]+)" y="([\d.-]+)"/.exec(svgOf(out, name)).map(Number); return [lx + x, ly + y]; };
    const iso = {shapes, floor}, none = {left: 0}, spent = wires(html, iso, none);
    for (const [name, link] of [['w', all[0]], ['v', all[1]]]) {
      const middle = lineOf(blocks, link, all).way.at(0.5), at = label(spent, name);
      expect(Math.hypot(at[0] - middle[0], at[1] - middle[1])).toBeLessThan(0.2);
    }
    expect(none.left).toBe(0);
    // with looks to spend both labels draw on the one count
    const some = {left: 1_000_000}, one = {left: 1_000_000}, plain = {left: 1_000_000};
    wires(html, iso, some);
    wires(html.replace(' data-label="200"', ''), iso, one);
    expect(some.left).toBeLessThan(one.left);
    expect(one.left).toBeLessThan(1_000_000);
    wires(html.replace(/ data-label="[^"]*"/g, ''), iso, plain);
    expect(plain.left).toBe(1_000_000);   // a map with no labelled cable spends nothing
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
    // and measured by the letters it shows: "&amp;" is one letter wide, so the box is the box of "A & B"
    expect(at(svg(' data-label="A &amp; B"', '100 300 110 300'), /width:([\d.]+)px/)).toEqual(at(svg(' data-label="A + B"', '100 300 110 300'), /width:([\d.]+)px/));
    expect(at(svg(' data-label="&#38;&#x26;&lt;"', '100 300 110 300'), /width:([\d.]+)px/)).toEqual(at(svg(' data-label="abc"', '100 300 110 300'), /width:([\d.]+)px/));
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

describe('a cable that plugs into a port (data-ports, "piece.port")', () => {
  const canvas = [1920, 1080];
  const grid = '<i data-iso-grid="120 at 960 150"></i>';
  const map = `${grid}<div data-k="lap" data-iso="block" data-at="0 6" data-size="2 1.4 0.3" data-ports="rj45: 2 0.7 0.15"></div>`
    + '<div data-k="sw" data-iso="block" data-at="6 6" data-size="4.7 2 0.4" data-ports="p1: 0.4 2 0.3 | up: 4.7 1 0.3"></div>'
    + '<div data-k="router" data-iso="block" data-at="12 2" data-size="2 2 0.8" data-ports="home: 0 1 0.4"></div>';
  const wire = (k, spec, more = '') => `<i data-k="${k}" class="wire" data-arrow="${spec}"${more}></i>`;
  // where a port is on the slide: the drawing's own grid, from what isoDrawn says of the floor
  const portAt = (made, [col, row, height]) => made.floor(col, row, height);

  it('ends on the port itself: its first and last points are the two ports, through the riser of each', () => {
    const made = transformed(`${map}${wire('w1', 'lap.rj45 to sw.p1', ' data-head="none"')}`, {canvas}), iso = isoDrawn(`${map}${wire('w1', 'lap.rj45 to sw.p1', ' data-head="none"')}`, {canvas, links: [['lap', 'sw']], lay: null});
    const [cable] = made.cables;
    expect(cable.ports).toEqual(['rj45', 'p1']);
    const near = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]) < 0.11;   // the record keeps a tenth of a px
    expect(made.html).toContain('data-sd-cable');
    expect(near(cable.points[0], portAt(iso, [2, 6.7, 0.15]))).toBe(true);
    expect(near(cable.points.at(-1), portAt(iso, [6.4, 8, 0.3]))).toBe(true);
    // out of the side at the port's height, then straight down: the second and third points share an x (a riser is upright on the slide)
    expect(Math.abs(cable.points[1][0] - cable.points[2][0])).toBeLessThan(0.11);
    expect(cable.points[2][1]).toBeGreaterThan(cable.points[1][1]);
    // the wire's ends are its pieces, for a click that lights a piece and what it touches
    expect(made.html).toMatch(/<svg[^>]*data-ends="lap sw"[^>]*data-sd-cable/);
  });

  it('draws the lead into a port on a seen side again over its block, one level above it — and none into a port on a back side', () => {
    const html = `${map}${wire('w1', 'lap.rj45 to sw.p1', ' data-head="none"')}${wire('w3', 'sw.up to router.home')}`, made = transformed(html, {canvas});
    const levelOf = (name) => Number(new RegExp(`data-k="${name}"[^>]*data-sd-iso="block"[^>]*z-index:(\\d+)`).exec(made.html)[1]);
    const leads = [...made.html.matchAll(/<svg[^>]*data-k="(w\d)"[^>]*data-sd-lead[^>]*z-index:(\d+)/g)].map(([, k, z]) => [k, Number(z)]);
    expect(leads).toEqual([['w1', levelOf('lap') + 1], ['w1', levelOf('sw') + 1], ['w3', levelOf('sw') + 1]]);   // router's port is on its back-left side
    // the lead is the cable's own piece: its name, its class and its ends
    expect(made.html).toMatch(/<svg data-ends="lap sw" data-k="w1" class="wire"[^>]*data-sd-lead/);
    // a head at a seen port is drawn on the lead too, so the block does not cover it; a back port's is behind its block, as the cable is
    expect(/data-k="w3"[^>]*data-sd-lead[^>]*>.*?<\/svg>/.exec(made.html)[0]).not.toContain('class="head"');
    const headed = transformed(`${map}${wire('w4', 'router.home to sw.p1')}`, {canvas}).html;
    expect(/data-k="w4"[^>]*data-sd-lead[^>]*>.*?<\/svg>/.exec(headed)[0]).toContain('class="head"');   // the head into sw.p1, over sw
    // what check says: the back port as itself, not as a block to move
    expect(made.ways).toContainEqual(expect.objectContaining({name: 'w3', way: expect.stringMatching(/^back router/)}));
  });

  it('refuses a port it cannot plug into, naming the fix; a piece called "a.b" is still that piece', () => {
    const bad = (spec) => () => transformed(`${map}${wire('w', spec)}`, {canvas});
    expect(bad('lap.usb to sw.p1')).toThrow('data-arrow="lap.usb to sw.p1": "lap" has no port "usb" — its ports are rj45');
    expect(bad('router.home to sw.p1 30')).toThrow('a wire to a port runs along the floor, and a bend draws it straight — take the bend out');
    expect(() => transformed(`${map}<div data-k="note" style="left:0;top:0;width:10px;height:10px">x</div>${wire('w', 'note.a to sw.p1')}`, {canvas})).toThrow('"note.a" names a port, and a port is on one block — "note" is no block');
    expect(() => transformed(`${grid}<div data-k="a" data-iso="block" data-at="0 0"></div><div data-k="b" data-iso="block" data-at="6 0"></div>${wire('w', 'a.x to b')}`, {canvas})).toThrow('"a" has no port "x" — it names none (data-ports="p1: x y z | …")');
    // a name with a dot that some piece goes by is that piece, as it always was
    const dotted = transformed(`${grid}<div data-k="v1.2" data-iso="block" data-at="0 0"></div><div data-k="b" data-iso="block" data-at="6 0"></div>${wire('w', 'v1.2 to b')}`, {canvas});
    expect(dotted.cables[0]).toMatchObject({from: 'v1.2', to: 'b'});
    expect(dotted.cables[0].ports).toBeUndefined();
  });

  it('a map the build places from its wires places by the pieces a port belongs to', () => {
    const placed = transformed('<div data-k="a" data-iso="block" data-ports="p: 2 1 0.5"></div><div data-k="b" data-iso="block"></div>' + wire('w', 'a.p to b'), {canvas, area: [60, 200, 1860, 1000]});
    expect(placed.made.placed).toBe('build');
    expect(placed.cables[0].ports).toEqual(['p', null]);
  });
});

describe('a cable\'s lead into a port, after the second read', () => {
  const canvas = [1920, 1080], grid = '<i data-iso-grid="120 at 960 150"></i>';
  const map = `${grid}<div data-k="lap" data-iso="block" data-at="0 6" data-size="2 1.4 0.3" data-ports="rj45: 2 0.7 0.15"></div>`
    + '<div data-k="sw" data-iso="block" data-at="6 6" data-size="4.7 2 0.4" data-ports="p1: 0.4 2 0.3 | hi: 2 2 0.38"></div>'
    + '<div data-k="router" data-iso="block" data-at="12 2" data-size="2 2 0.8" data-ports="home: 0 1 0.4"></div>';
  const wire = (k, spec, more = '') => `<i data-k="${k}" class="wire" data-arrow="${spec}"${more}></i>`;
  const leadsOf = (html, k) => [...html.matchAll(new RegExp(`<svg[^>]*data-k="${k}"[^>]*data-sd-lead="(start|end)"[^>]*width:([\\d.]+)px[^>]*>(.*?)</svg>`, 'g'))].map(([, end, width, body]) => ({end, width: Number(width), body}));
  it('a lead\'s box is its own few px, a head at its end too; it runs through its floor corner; it keeps no id', () => {
    const html = transformed(`${map}${wire('w4', 'router.home to sw.p1', ' id="main"')}`, {canvas}).html;
    const [end] = leadsOf(html, 'w4');
    expect(end.end).toBe('end');
    expect(end.width).toBeLessThan(150);
    expect(end.body).toContain('class="head"');
    expect((/d="([^"]+)"/.exec(end.body)[1].match(/Q/g) ?? []).length).toBe(2);   // out of the port and down, and on to the floor: both corners
    expect(html.match(/id="main"/g)).toHaveLength(1);
  });
  it('one reading of a dotted name for every reader: a wire\'s own name is never an end; a piece of that name is that piece', () => {
    const named = transformed(`${map}${wire('lap.rj45', 'lap.rj45 to sw.p1', ' data-head="none"')}`, {canvas});
    expect(named.html).toMatch(/data-ends="lap sw"/);
    expect(named.cables[0].ports).toEqual(['rj45', 'p1']);
    expect(() => transformed(`${map}<span data-k="sw.b">words</span>${wire('w', 'lap.rj45 to sw.b')}`, {canvas})).toThrow(/no piece "sw\.b" with a box/);
  });
  it('a back port is said as that alone, not as a block to move', () => {
    const made = transformed(`${map}${wire('w3', 'sw.hi to router.home')}`, {canvas});
    expect(made.ways.find((w) => w.name === 'w3').way).toMatch(/^back router(;|$)/);
    expect(made.ways.find((w) => w.name === 'w3').way).not.toMatch(/behind router/);
  });
  it('the dev page still moves pieces on a map with leads: a lead is the build\'s own, in no file', async () => {
    const {editableMaps} = await import('./dev.js'), {compileDeck} = await import('./compile.js'), {sourceOf} = await import('./test/helpers.js');
    const source = sourceOf({clicks: '<section data-label="S" data-map="map"><step data-in="*"><h2>All</h2></step></section>', maps: {map: `${map}${wire('w1', 'lap.rj45 to sw.p1', ' data-head="none"')}`}});
    const compiled = compileDeck(source);
    expect(compiled.maps.map.pieces.filter((p) => p.lead).length).toBe(2);
    expect(editableMaps(source, compiled).map.why).toBeUndefined();
  });
});
