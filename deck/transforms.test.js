import {describe, it, expect} from 'vitest';
import {wires, wireTags, icons, readIcon, applyTransforms} from './transforms.js';
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
    expect(svg(' data-packets="2" data-speed="1.5"')).toContain('--loop:sdRun 1.5s linear -0.8s infinite');
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
