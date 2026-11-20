import {describe, it, expect} from 'vitest';
import {wires, transformed} from './transforms.js';
import {RIDE_CSS, quoted, seenOf, leadSeen, leadSpan, easing} from './rides.js';
import {rideProfile} from './ride.js';

const canvas = [1920, 1080], grid = '<i data-iso-grid="120 at 960 150"></i>';
const map = `${grid}<div data-k="lap" data-iso="block" data-at="0 6" data-size="2 1.4 0.3" data-ports="rj45: 2 0.7 0.15"></div>`
  + '<div data-k="sw" data-iso="block" data-at="6 6" data-size="4.7 2 0.4" data-ports="p1: 0.4 2 0.3 | up: 4.7 1 0.3"></div>'
  + '<div data-k="router" data-iso="block" data-at="12 2" data-size="2 2 0.8" data-ports="home: 0 1 0.4"></div>';
const wire = (k, spec, more = '') => `<i data-k="${k}" class="wire" data-arrow="${spec}"${more}></i>`;
const svgs = (html, k) => [...html.matchAll(new RegExp(`<svg[^>]*data-k="${k}"[^>]*>.*?</svg>`, 'g'))].map((m) => m[0]);
const straight = (more, spec = '100 300 500 300') => wires(`<i data-k="w" data-arrow="${spec}" data-packets="1"${more}></i>`);
const loops = (svg) => [...svg.matchAll(/--loop:sdRide ([\d.]+)s var\(--sd-ride-ease\) (-?[\d.]+)s infinite, sdShow \1s var\(--sd-show-ease\) \2s infinite/g)].map((m) => [Number(m[1]), Number(m[2])]);
const easeOf = (svg, name) => new RegExp(`--sd-${name}-ease:(linear(?:\\([^)]*\\))?)`).exec(svg)[1];
const wayOf = (svg) => /--sd-way:path\('([^']+)'\)/.exec(svg)[1];
const boxOf = (svg) => /style="left:([\d.-]+)px;top:([\d.-]+)px/.exec(svg).slice(1).map(Number);
const numbers = (d) => d.match(/-?[\d.]+/g).map(Number);
/** Where a linear() easing puts the packet at `time` (0 to 1): straight between its stops, as CSS does. */
const at = (ease, time) => {
  const stops = [...ease.matchAll(/(-?[\d.]+) ([\d.]+)%/g)].map((m) => [Number(m[2]) / 100, Number(m[1])]), k = stops.findIndex(([t]) => t >= time);
  if (k <= 0) return stops[Math.max(0, k)][1];
  const [[t0, p0], [t1, p1]] = [stops[k - 1], stops[k]];
  return t1 === t0 ? p1 : p0 + ((p1 - p0) * (time - t0)) / (t1 - t0);
};

describe('how a wire\'s packets ride: data-ride, data-rest, data-keep-size, data-trail, data-behind, data-speed in px (rides.js)', () => {
  it('a wire that asks for none is drawn as before: no mark, no new loop, and the page carries no ride stylesheet', () => {
    const plain = transformed(`${map}${wire('w1', 'lap.rj45 to sw.p1', ' data-packets="2" data-speed="4"')}`, {canvas});
    expect(plain.html).not.toMatch(/data-sd-ride|sdRide|trail|--sd-seen/);
    expect(plain.html).toContain('--loop:sdRun 4s linear -2s infinite');
    expect(plain.rides).toBeUndefined();
    expect(straight('')).not.toMatch(/data-sd-ride|--sd-way/);
    expect(straight('')).toContain('--cdx:');   // by its one handle, as ever
  });

  it('a wire through the air that asks rides its own curve by length, as a cable does: its curve as --sd-way, each packet at the box\'s corner', () => {
    const svg = straight(' data-speed="300px" data-trail="3px blue"', '200 600 1200 600 350'), [, d] = /<path d="([^"]+)"\/>/.exec(svg);
    expect(wayOf(svg)).toBe(d);
    expect(svg).toMatch(/<circle class="run" data-loop cx="0" cy="0" r="7" style="--loop:sdRide/);
    expect(svg).not.toContain('--cdx');
    expect(RIDE_CSS).toContain(':where(svg.wire[data-sd-ride] .run) { transform: none; offset-path: var(--sd-way); offset-distance: calc(var(--sd-t) * 100%); offset-rotate: 0deg; opacity: var(--sd-seen, 1); }');
  });

  it('data-speed="300px": the run takes the line\'s own length over that speed — the build measures, the deck never does', () => {
    // a wire through the air: its curve to where the head begins, 385.6 px
    expect(loops(straight(' data-speed="385.6px"'))).toEqual([[1, 0]]);
    expect(loops(straight(' data-speed="192.8px/s"'))).toEqual([[2, 0]]);
    // a cable: the record's length, the line its packets ride
    const made = transformed(`${map}${wire('w1', 'lap.rj45 to sw.p1', ' data-head="none" data-packets="2" data-speed="226px"')}`, {canvas}), [cable] = made.cables;
    const [svg] = svgs(made.html, 'w1');
    expect(svg).toContain(`--sd-length:${cable.length}px`);
    expect(loops(svg)).toEqual([[+(cable.length / 226).toFixed(3), 0], [+(cable.length / 226).toFixed(3), -(+(cable.length / 226 / 2).toFixed(3))]]);
    expect(made.rides).toBe(true);
    expect(loops(straight(' data-speed="2" data-keep-size'))).toEqual([[2, 0]]);   // unitless keeps its meaning: seconds
  });

  it('data-ride="ease-ends 0.15 0.2": the ride\'s easing is ride.js\'s profile for the line; with a px speed, that speed is the steady one', () => {
    const svg = straight(' data-speed="300px" data-ride="ease-ends 0.15 0.2"'), ease = easeOf(svg, 'ride');
    expect(ease).toMatch(/^linear\(0 0%, .*, 1 100%\)$/);
    const stops = [...ease.matchAll(/([\d.]+) ([\d.]+)%/g)].map((m) => [Number(m[2]) / 100, Number(m[1])]);
    const from = stops.find(([, p]) => p === 0.15), to = stops.find(([, p]) => p === 0.8), [[seconds]] = loops(svg);
    expect((((to[1] - from[1]) * 385.6) / ((to[0] - from[0]) * seconds))).toBeCloseTo(300, 0);   // the steady stretch, 300 px a second
    expect(seconds).toBeCloseTo((385.6 * 1.35) / 300, 2);
    expect(easeOf(straight(' data-ride="ease-ends 0.2"'), 'ride')).toContain('0.8 ');   // one number: both ends
    expect(easeOf(straight(' data-ride="ease-ends 0 0"'), 'ride')).toBe('linear');
    expect(easeOf(svg, 'show')).toBe('linear(0 0%, 1 12%, 1 85%, 0 100%)');   // shown as today: in over 12%, out over the last 15%
  });

  it('the EMITTED easing stays within half a px of the true ease, on any line up to 4096 px', () => {
    for (const [length, ease] of [[500, [0.15, 0.2]], [1000, [0.2, 0.3]], [2400, [0.5, 0.5]], [4096, [0.5, 0.5]], [4096, [0.3, 0.1]]]) {
      const css = easing(rideProfile(ease, length)), whole = 1 + ease[0] + ease[1], ta = (2 * ease[0]) / whole, tb = (2 * ease[1]) / whole;
      const truth = (t) => (t <= ta ? ease[0] * (t / ta) ** 2 : t >= 1 - tb ? 1 - ease[1] * ((1 - t) / tb) ** 2 : ease[0] + ((t - ta) / (1 - ta - tb)) * (1 - ease[0] - ease[1]));
      let worst = 0;
      for (let k = 0; k <= 4000; k++) worst = Math.max(worst, Math.abs(at(css, k / 4000) - truth(k / 4000)) * length);
      expect(worst, `${length} px, ${ease}`).toBeLessThanOrEqual(0.5);
    }
    // and on a wire: an air wire 3985.6 px long, eased at both ends by half
    const svg = straight(' data-ride="ease-ends 0.5" data-speed="2000px"', '0 300 4000 300'), css = easeOf(svg, 'ride');
    for (let k = 0; k <= 2000; k++) { const t = k / 2000, want = t < 0.5 ? 0.5 * (t / 0.5) ** 2 : 1 - 0.5 * ((1 - t) / 0.5) ** 2; expect(Math.abs(at(css, t) - want) * 3985.6).toBeLessThanOrEqual(0.5); }
  });

  it('data-rest="end": the packet stays at the end — 1 s, or as long as said — and rests there where packets do not run', () => {
    const svg = straight(' data-speed="2" data-rest="end"');
    expect(loops(svg)).toEqual([[3, 0]]);   // 2 s the ride, 1 s at the end
    expect(easeOf(svg, 'ride')).toBe('linear(0 0%, 1 66.667%, 1 100%)');
    expect(easeOf(svg, 'show')).toBe('linear(0 0%, 1 8%, 1 100%)');   // never fades out: it is at the end when the next run starts
    expect(svg).toMatch(/<circle class="run" data-loop [^>]*style="--sd-t:1;--loop:/);
    expect(loops(straight(' data-speed="2" data-rest="end 0.5s"'))).toEqual([[2.5, 0]]);
    expect(loops(wires('<i data-k="w" data-arrow="100 300 500 300" data-packets="2" data-speed="2" data-rest="end 0s"></i>'))).toEqual([[2, 0], [2, -1]]);
  });

  it('data-keep-size scales its packets by one over the view\'s zoom, and, while the view moves, by the move\'s own zoom', () => {
    expect(straight(' data-keep-size')).toMatch(/^<svg data-k="w" data-packets="1" data-keep-size class="wire" data-sd-ride data-sd-keep style=/);
    expect(RIDE_CSS).toContain(':where(svg.wire[data-sd-ride][data-sd-keep] .run) { --sd-keep: var(--sd-ts, 1); transform: scale(calc(1 / var(--sd-keep))); }');
    expect(RIDE_CSS.indexOf('[data-sd-keep] .run) { --sd-keep')).toBeGreaterThan(RIDE_CSS.indexOf(':where(svg.wire[data-sd-ride] .run) { transform: none'));   // of two with no weight, the later wins
    // through the view's move: --sd-keep runs from where the view came, in the view's own time, delay and easing — with the loops where they run, alone where not
    expect(RIDE_CSS).toContain('@keyframes sdKeep { from { --sd-keep: var(--sd-ts0, var(--sd-ts, 1)); } }');
    expect(RIDE_CSS).toContain(':where(.sd-stage.sd-move svg.wire[data-sd-keep] .run) { --sd-keep-time: var(--sd-move-time, 1s); --sd-keep-at: 0s; }');
    expect(RIDE_CSS).toContain(':where(.sd-stage.sd-stage-turn.sd-move svg.wire[data-sd-keep] .run) { --sd-keep-time: var(--sd-stage-time, 1s); --sd-keep-at: var(--sd-stage-delay, 0s); }');
    expect(RIDE_CSS).toContain(':where(.sd-focus-new .sd-stage.sd-stage-turn.sd-move svg.wire[data-sd-keep] .run) { --sd-keep-at: calc(var(--sd-stage-delay, 0s) + .4s); }');
    const moving = RIDE_CSS.slice(RIDE_CSS.indexOf('@media screen and (prefers-reduced-motion: no-preference)'));
    expect(moving).toContain(':where([data-deck-active][data-deck-loop]:not([data-sd-instant]):not([data-deck-static])) .sd-stage.sd-move svg.wire[data-sd-keep] .run {\n    animation: var(--loop, sdNone 0s), sdKeep var(--sd-keep-time) var(--sd-ease, cubic-bezier(.2, .7, .2, 1)) var(--sd-keep-at) both; }');
    expect(moving).toContain(':where([data-deck-active]:not([data-deck-loop]):not([data-sd-instant]):not([data-deck-static])) .sd-stage.sd-move svg.wire[data-sd-keep] .run {\n    animation: sdKeep var(--sd-keep-time) var(--sd-ease, cubic-bezier(.2, .7, .2, 1)) var(--sd-keep-at) both; }');
  });

  it('data-trail draws a line behind each packet, its width and colour, as long as the share it has ridden', () => {
    const svg = straight(' data-trail="3px var(--l1)"'), [, d] = /<path d="([^"]+)"\/>/.exec(svg);
    expect(svg).toContain(`<path class="trail" data-loop d="${d}" pathLength="1" style="stroke:var(--l1);stroke-width:3px;--loop:sdRide`);
    const two = wires('<i data-k="w" data-arrow="100 300 500 300" data-packets="2" data-trail="2.5px color-mix(in srgb, #e11d48 60%, white)"></i>');
    expect(two.match(/class="trail"/g)).toHaveLength(2);
    expect(two.indexOf('class="trail"')).toBeLessThan(two.indexOf('class="run"'));   // under the packets
    expect(RIDE_CSS).toContain('stroke-dasharray: calc(max(0, min(var(--sd-t), var(--sd-to, 1)) - var(--sd-from, 0))) 3; stroke-dashoffset: calc(-1 * var(--sd-from, 0));');
  });

  it('data-behind="fade": out before a stretch a block hides and back after it — its radius more, so never cut by the block', () => {
    const made = transformed(`${map}${wire('w3', 'sw.up to router.home', ' data-packets="1" data-speed="200px" data-behind="fade"')}`, {canvas}), [cable] = made.cables;
    const [lo] = cable.unseen[0], [svg] = svgs(made.html, 'w3'), seen = /--sd-seen:([^;]+);--loop/.exec(svg)[1];
    const [, outTo, rate] = /\(([\d.]+) - var\(--sd-t\)\) \* ([\d.]+)/.exec(seen).map(Number);
    expect(outTo * cable.length).toBeCloseTo(lo - 7, 0);   // gone when its front reaches the block
    expect(rate).toBeCloseTo(cable.length / 10, 0);   // over three frames: 10 px at 200 px/s
    expect(straight(' data-behind="fade"')).not.toContain('--sd-seen');   // nothing hides a wire through the air
    expect(RIDE_CSS).toContain(':where([data-deck-loop]) :where(svg.wire[data-sd-ride] .run) { opacity: calc(var(--sd-show) * var(--sd-seen, 1)); }');
  });

  it('end to end: a cable that runs behind a tall block in its middle fades out before it and back after it; keeping its size, by its radius over the zoom', () => {
    const middle = '<i data-iso-grid="100 at 960 100"></i><div data-k="a" data-iso="block" data-at="0 0" data-size="1 1 0.3"></div><div data-k="c" data-iso="block" data-at="9 0" data-size="1 1 0.3"></div>'
      + '<div data-k="b" data-iso="block" data-at="7 5" data-size="2 2 5"></div>';
    const made = transformed(`${middle}${wire('w', 'a to c', ' data-packets="1" data-speed="300px" data-behind="fade"')}`, {canvas}), [cable] = made.cables;
    expect(cable.unseen).toEqual([[90.8, 300.5]]);
    expect(cable.behind).toEqual(['b']);
    const seen = /--sd-seen:([^;]+);/.exec(made.html)[1], [, outTo] = /\(([\d.]+) - var\(--sd-t\)\)/.exec(seen).map(Number), [, backFrom] = /\(var\(--sd-t\) - ([\d.]+)\)/.exec(seen).map(Number);
    expect(outTo * cable.length).toBeCloseTo(90.8 - 7, 0);
    expect(backFrom * cable.length).toBeCloseTo(300.5 + 7, 0);
    const kept = transformed(`${middle}${wire('w', 'a to c', ' data-packets="1" data-speed="300px" data-behind="fade" data-keep-size')}`, {canvas}).html;
    // its radius on the line is 7 px over the zoom: the browser divides it
    const [, keptOut, pad, , keptBack, pad2] = /^clamp\(0, max\(\(([\d.]+) - var\(--sd-t\) - ([\d.]+) \/ var\(--sd-keep\)\) \* ([\d.]+), \(var\(--sd-t\) - ([\d.]+) - ([\d.]+) \/ var\(--sd-keep\)\) \* [\d.]+\), 1\)$/.exec(/--sd-seen:([^;]+);/.exec(kept)[1]).map(Number);
    expect(keptOut * cable.length).toBeCloseTo(90.8, 0);
    expect(keptBack * cable.length).toBeCloseTo(300.5, 0);
    expect(pad * cable.length).toBeCloseTo(7, 1);
    expect(pad2).toBe(pad);
  });

  it('seenOf: each stretch a ramp out and a ramp back, the least of them where there are more, and none on a lead\'s stretch', () => {
    expect(seenOf([])).toBe('');
    expect(seenOf([[0.2, 0.25, 0.5, 0.6]])).toBe('clamp(0, max((0.25 - var(--sd-t)) * 20, (var(--sd-t) - 0.5) * 10), 1)');
    expect(seenOf([[0, 0, 0.1, 0.2]])).toBe('clamp(0, (var(--sd-t) - 0.1) * 10, 1)');   // hidden from the start: no ramp out
    expect(seenOf([[0.8, 0.9, 1, 1]])).toBe('clamp(0, (0.9 - var(--sd-t)) * 10, 1)');   // hidden to the end: no ramp back
    expect(seenOf([[0, 0, 1, 1]])).toBe('0');   // hidden all along
    expect(seenOf([[0.1, 0.2, 0.3, 0.4], [0.7, 0.8, 1, 1]])).toBe('min(clamp(0, max((0.2 - var(--sd-t)) * 10, (var(--sd-t) - 0.3) * 10), 1), clamp(0, (0.8 - var(--sd-t)) * 10, 1))');
    // the cable's own packet is 1 minus a lead's copy at the lead's edge: one or the other, never both
    expect(seenOf([], '', [0.1, 0.9])).toBe('min(clamp(0, (var(--sd-t) - 0.1) * 10000, 1), clamp(0, (0.9 - var(--sd-t)) * 10000, 1))');
    for (const [k, share] of [[0, 0.1], [1, 0.9]]) {
      for (const t of [share - 0.001, share - 0.00005, share, share + 0.00005, share + 0.001]) {
        const clamp = (v) => Math.min(1, Math.max(0, v)), copy = clamp(k ? (t - share) * 10000 + 1 : (share - t) * 10000 + 1), own = clamp(k ? (share - t) * 10000 : (t - share) * 10000);
        expect(copy + own).toBeCloseTo(1, 9);
      }
    }
    expect(leadSeen(1, 0.9)).toBe('clamp(0, (var(--sd-t) - 0.9) * 10000 + 1, 1)');
    expect(leadSpan(1, 0.9, 400).map((v) => +v.toFixed(9))).toEqual([0.895, 1]);   // under the lead's round cap: 2 px more
    expect(leadSpan(0, 0.1, 400).map((v) => +v.toFixed(9))).toEqual([0, 0.105]);
  });

  it('a lead into a port on a seen side carries a copy of the packets on the cable\'s own line, on its own stretch, under its head', () => {
    const made = transformed(`${map}${wire('w1', 'lap.rj45 to sw.p1', ' data-packets="2" data-rest="end" data-trail="3px red" data-keep-size')}`, {canvas});
    const [cable, start, end] = svgs(made.html, 'w1'), [cable1] = made.cables;
    expect(cable).toContain('data-sd-cable data-sd-ride data-sd-keep');
    expect(start).toMatch(/data-sd-lead="start" data-sd-ride data-sd-keep style="[^"]*--sd-way:path\('M/);
    // the copy rides the cable's line, in the lead's own px: the same points, moved by the two boxes' corners
    for (const lead of [start, end]) {
      const [cx, cy] = boxOf(cable), [lx, ly] = boxOf(lead), mine = numbers(wayOf(lead)), its = numbers(wayOf(cable));
      expect(mine.length).toBe(its.length);
      mine.forEach((v, i) => expect(v).toBeCloseTo(its[i] + (i % 2 ? cy - ly : cx - lx), 0));
      expect(loops(lead)).toEqual(loops(cable));   // on the cable's own clock and period
    }
    // shown up to the share the start's lead holds, and from the share the end's lead starts at; the cable's own hidden there
    const startAt = Number(/--sd-seen:clamp\(0, \(([\d.]+) - var\(--sd-t\)\) \* 10000 \+ 1, 1\)/.exec(start)[1]), endAt = Number(/--sd-seen:clamp\(0, \(var\(--sd-t\) - ([\d.]+)\) \* 10000 \+ 1, 1\)/.exec(end)[1]);
    expect(0 < startAt && startAt < endAt && endAt < 1).toBe(true);
    expect(cable).toContain(`--sd-seen:min(clamp(0, (var(--sd-t) - ${startAt}) * 10000, 1), clamp(0, (${endAt} - var(--sd-t)) * 10000, 1));`);
    const startTo = Number(/--sd-from:0;--sd-to:([\d.]+);/.exec(start)[1]), endFrom = Number(/--sd-from:([\d.]+);--sd-to:1;/.exec(end)[1]);
    expect((startTo - startAt) * cable1.length).toBeCloseTo(2, 1);   // its trail: its stretch, and 2 px under the lead's round cap
    expect((endAt - endFrom) * cable1.length).toBeCloseTo(2, 1);
    // at rest it stands at the end: the end's copy shows it there; the packets are drawn before the lead's head, which stays on top
    expect(end).toMatch(/<circle class="run" data-loop cx="0" cy="0" r="7" style="--sd-t:1;--sd-seen:/);
    const headed = svgs(transformed(`${map}${wire('w4', 'router.home to sw.p1', ' data-packets="1" data-rest="end"')}`, {canvas}).html, 'w4').find((s) => s.includes('data-sd-lead="end"'));
    expect(headed.lastIndexOf('class="run"')).toBeLessThan(headed.indexOf('class="head"'));
    // the copy shows by --sd-seen when packets do not run too: off its stretch it is hidden
    expect(RIDE_CSS).toMatch(/:where\(svg\.wire\[data-sd-ride\] \.run\) \{[^}]*opacity: var\(--sd-seen, 1\); \}/);
    // without a ride option the leads are as before: no copy
    expect(svgs(transformed(`${map}${wire('w1', 'lap.rj45 to sw.p1', ' data-head="none" data-packets="1"')}`, {canvas}).html, 'w1')[2]).not.toContain('class="run"');
  });

  it('refuses each it cannot draw, naming the wire and the fix, quoting at most 60 letters of a value', () => {
    const where = 'wire data-arrow="100 300 500 300": ', bad = (more) => () => wires(`<i data-k="w" data-arrow="100 300 500 300"${more}></i>`);
    for (const name of ['data-ride="ease-ends 0.1"', 'data-rest="end"', 'data-keep-size', 'data-trail="2px red"', 'data-behind="fade"']) {
      expect(bad(` ${name}`), name).toThrow(`${where}${name.split('=')[0]} says how its packets ride — give it data-packets too`);
    }
    for (const v of ['ease', 'ease-ends', 'ease-ends 0.6 0.1', 'ease-ends a b', 'ease-ends 0.1 0.2 0.3']) expect(bad(` data-packets="1" data-ride="${v}"`), v).toThrow(`${where}data-ride="${v}" — a ride eases out of its start and into its end over shares of its length, each 0 to 0.5: data-ride="ease-ends 0.15 0.2" (one number for both ends)`);
    for (const v of ['start', 'end 2', 'end 61s', 'middle']) expect(bad(` data-packets="1" data-rest="${v}"`), v).toThrow(`${where}data-rest="${v}" — a packet rests at the end of the wire when it arrives: data-rest="end", or "end 2s" for how long it stays there (0 to 60 s; 1 s when not said)`);
    expect(bad(' data-packets="1" data-keep-size="yes"')).toThrow(`${where}data-keep-size="yes" — it takes no value: write data-keep-size alone`);
    for (const v of ['red', '3 red', '3px', '3px red;opacity:0', '3px url(#x)', '3px var(--a', '3px a)(b', '3px "red"', '3px &amp;', `3px ${'a'.repeat(101)}`, '3px f(g(h(i(red))))']) {
      expect(bad(` data-packets="1" data-trail='${v}'`), v).toThrow(`${where}data-trail=${quoted(v)} — a trail is its width in px and its colour`);
    }
    expect(bad(' data-packets="1" data-trail="3px color-mix(in srgb, var(--a), rgb(1 2 3))"')).not.toThrow();
    expect(bad(' data-packets="1" data-trail="30px red"')).toThrow(`${where}data-trail="30px red" — a trail is 0.5 to 24 px wide`);
    expect(bad(' data-packets="1" data-behind="hide"')).toThrow(`${where}data-behind="hide" — where its cable runs behind a block its packets fade out and come back after it: data-behind="fade"`);
    expect(bad(' data-packets="1" data-speed="0px"')).toThrow(`${where}data-speed="0px" — a speed in px a second is more than 0 ("300px")`);
    expect(bad(' data-packets="1" data-speed="fast"')).toThrow(`${where}data-speed="fast" — the seconds a packet takes to run the wire, 0.5 to 60, or its speed in px a second ("300px")`);
    expect(bad(' data-packets="1" data-speed="5000px"')).toThrow(`${where}data-speed="5000px" — this wire is 386 px long, so a run would take 0.08 s, and a run takes 0.5 to 60 s — give it 6.5px to 771.2px, or its seconds (data-speed="3")`);
    expect(bad(' data-packets="1" data-speed="2px"')).toThrow(/so a run would take 192\.8 s/);
    // a wire with no length takes no px speed
    expect(() => wires('<i data-k="w" data-arrow="100 300 100 300" data-packets="1" data-speed="300px" data-head="none"></i>')).toThrow('wire data-arrow="100 300 100 300": data-speed="300px" — this wire is too short for a speed in px a second (0 px): give it its seconds (data-speed="3")');
    // a value thousands of letters long gives a short error
    const long = `ease-ends ${'9'.repeat(5000)}`;
    let said = '';
    try { bad(` data-packets="1" data-ride="${long}"`)(); } catch (e) { said = e.message; }
    expect(said.length).toBeLessThan(400);
    expect(said).toContain(`data-ride="${long.slice(0, 59)}…"`);
    expect(quoted('short')).toBe('"short"');
  });

  it('the page carries the ride stylesheet only when a wire asks: a map or a plain slide', async () => {
    const {compileDeck} = await import('./compile.js'), {deckStyles} = await import('./page.js'), {sourceOf} = await import('./test/helpers.js');
    const assets = {css: ['/*base*/'], looks: {}};
    const deck = (body) => compileDeck(sourceOf({clicks: '<section data-label="S" data-map="map"><step data-in="*"><h2>All</h2></step></section>', maps: {map: `${map}${body}`}}));
    expect(deck(wire('w1', 'lap.rj45 to sw.p1', ' data-packets="1"')).rides).toBeUndefined();
    expect(deckStyles(deck(wire('w1', 'lap.rj45 to sw.p1', ' data-packets="1"')), assets)).not.toContain('sdRide');
    const asked = deck(wire('w1', 'lap.rj45 to sw.p1', ' data-packets="1" data-keep-size'));
    expect(asked.rides).toBe(true);
    expect(deckStyles(asked, assets)).toContain(RIDE_CSS);
    const plain = compileDeck(sourceOf({clicks: '<section data-label="P"><h2>Hi</h2><i data-k="w" data-arrow="100 300 500 300" data-packets="1" data-rest="end"></i></section>', maps: {}}));
    expect(plain.rides).toBe(true);
  });
});
