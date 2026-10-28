import {describe, it, expect} from 'vitest';
import {moveAt, readMove} from 'footprint-story/motion';
import {LOOP_NAMES, LOOP_SECONDS, frameCss, loopCss, loopsIn, readLoop} from './loops.js';
import {compileDeck} from './compile.js';
import {deckPage} from './page.js';
import {checkDeck} from './check.js';
import {reviewClick} from './review.js';
import {sourceOf, MAP} from './test/helpers.js';

describe('readLoop', () => {
  it('names the shared table\'s endless moves', () => {
    expect(LOOP_NAMES).toEqual(['marquee', 'pulse', 'float']);
  });

  it('reads a named loop, with its own seconds or the move\'s; a bare data-loop is the deck\'s own', () => {
    expect(readLoop('pulse', 'x')).toEqual({name: 'pulse', seconds: readMove('pulse').seconds});
    expect(readLoop('float 4s', 'x')).toEqual({name: 'float', seconds: 4});
    expect(readLoop('float 0.5s', 'x')).toEqual({name: 'float', seconds: 0.5});
    expect(readLoop('', 'x')).toBeNull();
  });

  it('refuses a name it does not have, a loose form and a length out of range — naming the loops and the fix', () => {
    expect(() => readLoop('spinn', 'map "m"')).toThrow('map "m": data-loop="spinn" is not a loop — name one of marquee, pulse, float, with its seconds if you like ("float 4s"), or write data-loop alone and give the piece its own --loop in theme.css');
    for (const v of [' pulse', 'pulse ', 'pulse  2s', 'pulse 2', 'Pulse', 'pulse 2ms', 'slam']) expect(() => readLoop(v, 'x'), v).toThrow(/is not a loop/);
    expect(() => readLoop('pulse 0.1s', 'x')).toThrow(`a cycle lasts ${LOOP_SECONDS[0]} to ${LOOP_SECONDS[1]} s`);
    expect(() => readLoop('pulse 61s', 'x')).toThrow(/a cycle lasts/);
  });
});

describe('loopsIn', () => {
  it('finds every data-loop as a browser reads it: its piece, its value, and whether its own style sets --loop', () => {
    const html = '<div data-k="db gw" data-loop="pulse" style="left:1px"></div><i data-loop></i>'
      + '<b DATA-LOOP style="--loop: spin 1s infinite" data-k=g></b><p data-loop="float" data-loop="nope"></p>'
      + '<s data-loop-x="pulse"></s><u data-looping></u><em data-loop=\'float 3s\'></em>';
    expect(loopsIn(html, 'map "m"')).toEqual([
      {piece: 'db', value: 'pulse'},
      {piece: null, value: ''},
      {piece: 'g', value: '', styled: true},
      {piece: null, value: 'float'},   // a browser keeps the first of two
      {piece: null, value: 'float 3s'},
    ]);
  });

  it('skips what only looks like one: data-loop inside another attribute\'s value', () => {
    expect(loopsIn('<i title="see data-loop=pulse"></i>', 'x')).toEqual([]);
  });

  it('refuses a tag a browser reads past its ">", and a named loop on an element with its own transform — naming the fix', () => {
    expect(() => loopsIn('<div data-loop="float 4s" title="a>b"></div>', 'map "m"')).toThrow('map "m": <div> with data-loop holds a quote never closed before its ">" — write a ">" inside a value as &gt;');
    expect(() => loopsIn('<div data-k="db" data-loop="pulse" style="left:0;TRANSFORM: rotate(3deg)"></div>', 'map "m"'))
      .toThrow('map "m", piece "db": data-loop="pulse" moves the element by its transform, which would replace the one it has — put data-loop on an element inside it');
    expect(() => loopsIn('<g data-loop="float" transform="translate(9 9)"></g>', 'x')).toThrow(/moves the element by its transform/);
    // the deck's own loop is its own business; a transform-origin is no transform
    expect(loopsIn('<g data-loop transform="translate(9 9)"></g><i data-loop="pulse" style="transform-origin:0 0"></i>', 'x')).toHaveLength(2);
  });

  it('refuses a loop it does not have, naming the piece', () => {
    expect(() => loopsIn('<div data-k="db" data-loop="spin"></div>', 'map "m"')).toThrow(/^map "m", piece "db": data-loop="spin" is not a loop/);
  });

  it('reads 100,000 unfinished tags in one pass', () => {
    const html = '<i data-loop="pulse" '.repeat(100000);
    const t = performance.now();
    expect(loopsIn(html, 'x')).toEqual([]);
    expect(performance.now() - t).toBeLessThan(1000);
  });
});

describe('loopCss', () => {
  it('draws each named loop once, its keyframes from the shared move, and nothing for the deck\'s own', () => {
    const css = loopCss(['pulse', 'float 4s', '', 'pulse']);
    expect(css.match(/@keyframes sd-loop-pulse /g)).toHaveLength(1);
    expect(css.match(/@keyframes sd-loop-float /g)).toHaveLength(1);
    expect(css).toContain(':where([data-loop="pulse"]) { --loop: sd-loop-pulse 1.6s linear infinite; }');
    expect(css).toContain(':where([data-loop="float 4s"]) { --loop: sd-loop-float 4s linear infinite; }');
    expect(css).not.toContain('marquee');
    expect(css).toContain(':where(svg [data-loop]:not([data-loop=""])) { transform-box: fill-box; transform-origin: center; }');
    expect(loopCss([])).toBe('');
    expect(loopCss(['', ''])).toBe('');
  });

  it('animates only what the move moves, so a greyed piece stays grey', () => {
    expect(loopCss(['pulse'])).not.toMatch(/opacity|filter|translate/);
    expect(loopCss(['float'])).not.toMatch(/opacity|filter|scale/);
  });

  it('samples the same curve StoryReel draws: each keyframe is the move at its moment', () => {
    for (const name of LOOP_NAMES) {
      const m = readMove(name), frames = [...loopCss([name]).matchAll(/([\d.]+)% \{ transform: ([^;]+); \}/g)];
      expect(frames).toHaveLength(25);
      frames.forEach(([, pct, transform], i) => {
        expect(Number(pct)).toBeCloseTo((i / 24) * 100, 3);
        const v = moveAt(m, (i / 24) * m.seconds * (1 - 1e-9), {seconds: m.seconds});
        const nums = transform.match(/-?[\d.]+/g).map(Number);
        const want = 'scale' in m.props ? [v.scale] : [v.x, v.y];
        nums.forEach((n, k) => expect(n).toBeCloseTo(want[k], 3));
      });
    }
  });

  it('writes a moment as CSS: x, y, rotate and scale as one transform, opacity, blur — only those the move animates', () => {
    const v = {x: 3, y: -0, rotate: 12.34567, scale: 1.5, opacity: 0.25, blur: 2, clip: 1, progress: 0};
    expect(frameCss(v, {x: [0, 1], rotate: [0, 1], scale: [0, 1], opacity: [0, 1], blur: [0, 1]}))
      .toBe('transform: translate(3px, 0px) rotate(12.3457deg) scale(1.5); opacity: 0.25; filter: blur(2px)');
    expect(frameCss(v, {y: [0, 1]})).toBe('transform: translate(3px, 0px)');
    expect(frameCss(v, {opacity: [0, 1]})).toBe('opacity: 0.25');
    expect(frameCss(v, {})).toBe('');
  });

  it('refuses a value that is not a loop', () => {
    expect(() => loopCss(['spin'])).toThrow(/loopCss: data-loop="spin" is not a loop/);
  });
});

describe('loops in a deck', () => {
  const map = MAP.replace('<div data-k="b" class="box"', '<div data-k="b" data-loop="pulse" class="box"').replace('<div data-k="c" class="box"', '<div data-k="c" data-loop class="box gear"');
  const clicks = `<section data-label="P"><p data-loop="float">hi</p></section>
<section data-label="M" data-map="map"><step data-in="a"><h2>A</h2></step><step data-in="w1 b"><h2>B</h2></step><step data-in="w2 c"><h2>C</h2></step></section>`;
  const compiled = compileDeck(sourceOf({clicks, maps: {map}, theme: '.gear { --loop: spin 4s linear infinite; }'}));

  it('each click knows what loops on it — on a map, only on the pieces it shows', () => {
    expect(compiled.clicks.map((c) => c.loops)).toEqual([
      [{piece: null, value: 'float'}],
      [],
      [{piece: 'b', value: 'pulse'}],
      [{piece: 'b', value: 'pulse'}, {piece: 'c', value: ''}],
    ]);
    expect(compiled.loops).toEqual(['float', 'pulse']);
  });

  it('the page draws the loops it shows, before theme.css (the deck\'s own rules win)', () => {
    const html = deckPage(compiled, {stageJs: '', css: ['.focus{}'], version: '0'});
    expect(html.indexOf('@keyframes sd-loop-float')).toBeGreaterThan(html.indexOf('.focus{}'));
    expect(html.indexOf('@keyframes sd-loop-pulse')).toBeLessThan(html.indexOf('.gear { --loop'));
  });

  it('review names them; a click without loops says nothing of them', () => {
    expect(reviewClick(compiled, 4)).toContain('\nloops (2): b pulse, c (its own --loop)\n');
    expect(reviewClick(compiled, 1)).toContain('\nloops (1): an element float\n');
    expect(reviewClick(compiled, 2)).not.toContain('loops');
  });

  it('refuses a map\'s unknown loop, naming the map and the piece', () => {
    expect(() => compileDeck(sourceOf({clicks, maps: {map: map.replace('data-loop="pulse"', 'data-loop="puls"')}}))).toThrow(/^map "map", piece "b": data-loop="puls" is not a loop/);
  });

  it('loop-unset: the deck\'s own loop with no --loop anywhere — not when theme.css or its own style sets one', () => {
    const p = checkDeck(compileDeck(sourceOf({clicks, maps: {map}})));
    expect(p.filter((x) => x.rule === 'loop-unset')).toEqual([{level: 'warn', rule: 'loop-unset', click: 4, label: 'M · 3',
      message: 'c has data-loop but nothing sets its --loop, so nothing loops — give it one in theme.css (.gear { --loop: spin 4s linear infinite }), or name a loop: data-loop="marquee" (marquee, pulse, float)'}]);
    expect(checkDeck(compiled).some((x) => x.rule === 'loop-unset')).toBe(false);
    const styled = map.replace('data-loop class="box gear"', 'data-loop style="--loop: spin 4s linear infinite" class="box gear"');
    expect(checkDeck(compileDeck(sourceOf({clicks, maps: {map: styled}}))).some((x) => x.rule === 'loop-unset')).toBe(false);
  });
});
