import {describe, it, expect} from 'vitest';
import {compileDeck} from './compile.js';
import {sourceOf, MAP} from './test/helpers.js';

const CLICKS = `
<section data-label="Title" data-kicker="Hello"><h1>Hi</h1><aside class="notes">Welcome.</aside></section>
<section data-label="Route" data-kicker="1 · Route" data-map="map">
  <step data-in="a"><h2>Start at A</h2><aside class="notes">A first.</aside></step>
  <step data-in="w1 b" data-on="a w1 b" data-focus="path"><h2>On to B</h2><aside class="notes">Then B.</aside></step>
</section>
<section data-label="More" data-kicker="2 · More" data-map="map">
  <step data-in="w2 c" data-on="c" data-focus="zoom"><h2>And C</h2></step>
</section>
<section data-label="Again" data-kicker="3 · Again" data-map="map">
  <step data-on="a"><h2>Back to A</h2></step>
</section>`;

describe('compileDeck', () => {
  const compiled = compileDeck(sourceOf({deck: {title: 'Deck & co', footer: 'Foot <b>'}, clicks: CLICKS, theme: ':root{--bg:#fff}'}));

  it('makes one slide and one click per click, in order, labelled by part and step', () => {
    expect(compiled.slides.map((s) => s.label)).toEqual(['Title', 'Route · 1', 'Route · 2', 'More · 1', 'Again · 1']);
    expect(compiled.clicks.map((c) => [c.n, c.kind, c.map])).toEqual([[1, 'plain', null], [2, 'map', 'map'], [3, 'map', 'map'], [4, 'map', 'map'], [5, 'map', 'map']]);
    expect(compiled.title).toBe('Deck & co');
    expect(compiled.themeCss).toBe(':root{--bg:#fff}');
    expect(compiled.maps.map.pieces.map((p) => p.keys[0])).toEqual(['a', 'w1', 'b', 'w2', 'c']);
  });

  it('refuses a deck that writes StoryDeck\'s own numbering attributes, in a map or a plain slide', () => {
    const map = `${MAP}<div data-k="f" data-sd-at="0" style="left:1px;top:1px">F</div>`;
    expect(() => compileDeck(sourceOf({clicks: CLICKS, maps: {map}}))).toThrow(/map "map": data-sd-at is StoryDeck's own attribute \(it numbers the pieces\) — remove it from <div>/);
    const plain = CLICKS.replace('<h1>Hi</h1>', '<h1 DATA-SD-I="3">Hi</h1>');
    expect(() => compileDeck(sourceOf({clicks: plain}))).toThrow(/"Title": DATA-SD-I is StoryDeck's own attribute/);
    expect(() => compileDeck(sourceOf({clicks: CLICKS.replace('<h1>Hi</h1>', '<!-- <i data-sd-at="1"> --><h1>Hi</h1>')}))).not.toThrow();
    // however it is joined to the tag: a browser takes <div/data-sd-at> and x="1"data-sd-at as attributes too
    for (const tag of ['<div/data-sd-at="0" data-k="f" style="left:1px;top:1px">', '<div x="1"data-sd-at="0" data-k="f" style="left:1px;top:1px">']) {
      expect(() => compileDeck(sourceOf({clicks: CLICKS, maps: {map: `${MAP}${tag}F</div>`}})), tag).toThrow(/data-sd-at is StoryDeck's own attribute/);
    }
    // only an attribute of that name: a deck may write about StoryDeck in a value or in its text
    const about = `${MAP}<div data-k="f" title="how data-sd-at numbers pieces" style="left:1px;top:1px">data-sd-at="0"</div>`;
    expect(() => compileDeck(sourceOf({clicks: CLICKS, maps: {map: about}}))).not.toThrow();
  });

  it('numbers each piece as the build read it in the dev page only (data-sd-at), and nowhere else', () => {
    expect(compiled.slides.some((sl) => sl.html.includes('data-sd-at'))).toBe(false);
    const dev = compileDeck(sourceOf({deck: {title: 'T'}, clicks: CLICKS}), {dev: true});
    const route1 = dev.slides[1].html;
    expect([...route1.matchAll(/data-k="(\w+)"[^>]*data-sd-at="(\d+)"/g)].map((m) => [m[1], m[2]])).toEqual([['a', '0'], ['w1', '1'], ['b', '2'], ['w2', '3'], ['c', '4']]);
    // the same page otherwise: the dev numbers are the only difference
    expect(route1.replace(/ data-sd-at="\d+"/g, '')).toBe(compileDeck(sourceOf({deck: {title: 'T'}, clicks: CLICKS})).slides[1].html);
  });

  it('draws the chrome on every slide: kicker, headline on a map, footer with the count — escaped', () => {
    const [title, route1] = compiled.slides;
    expect(title.html).toMatch(/^<section data-label="Title" class="slide plain"><div class="head" data-chrome><div class="kicker">Hello<\/div><\/div><h1>Hi<\/h1>/);
    expect(title.html).toContain('<div class="foot" data-chrome><span>Foot &lt;b&gt;</span><span class="count">1 / 5</span></div></section>');
    expect(route1.html).toMatch(/^<section data-label="Route · 1" class="slide on-map "><div class="head" data-chrome><div class="kicker">1 · Route<\/div><h2>Start at A<\/h2><\/div><div class="map map-map">/);
    expect(route1.html).toContain('class="wire pkt');
  });

  it('puts a part\'s theme on each of its slides, plain or on a map, and only on that part\'s', () => {
    const themed = CLICKS.replace('<section data-label="Title" data-kicker="Hello">', '<section data-label="Title" data-kicker="Hello" data-theme="cover">')
      .replace('<section data-label="Route" data-kicker="1 · Route" data-map="map">', '<section data-label="Route" data-kicker="1 · Route" data-map="map" data-theme="ledger-2">');
    const slides = compileDeck(sourceOf({clicks: themed})).slides;
    const themeOf = (html) => / data-theme="([^"]*)"/.exec(html.slice(0, html.indexOf('>')))?.[1] ?? null;
    expect(slides.map((x) => themeOf(x.html))).toEqual(['cover', 'ledger-2', 'ledger-2', null, null]);
    expect(slides[1].html).toMatch(/^<section data-label="Route · 1" data-theme="ledger-2" class="slide on-map ">/);
    // without one, a slide is drawn as before, byte for byte
    const plain = compileDeck(sourceOf({clicks: CLICKS})).slides;
    expect(slides.slice(3).map((x) => x.html)).toEqual(plain.slice(3).map((x) => x.html));
  });

  it('refuses a theme that is not one plain lower-case name, naming the part', () => {
    for (const bad of ['', 'Ledger', 'two words', 'ledger_2', '2col', '-dash', 'ünï', 'a'.repeat(41)]) {
      const clicks = CLICKS.replace('data-label="More" data-kicker="2 · More"', `data-label="More" data-kicker="2 · More" data-theme="${bad}"`);
      expect(() => compileDeck(sourceOf({clicks})), bad).toThrow(/"More": data-theme=.* a theme is one lower-case name/);
    }
  });

  it('carries each map\'s state from click to click and part to part, so the picture builds up', () => {
    const more = compiled.clicks[3];
    const state = (c, k) => c.look.pieces[compiled.maps.map.pieces.findIndex((p) => p.keys[0] === k)].state;
    // w2 comes in with c and lights although the click is about c: a piece lights by coming in (check.js · lit-on-entry)
    expect(['a', 'w1', 'b', 'w2', 'c'].map((k) => state(more, k))).toEqual(['dim', 'dim', 'dim', 'on', 'on']);
    expect(more.look.strategies).toEqual(['zoom']);
    expect(compiled.clicks[2].look.path.turns).toBe(3);
  });

  it('gives each slide its notes: this click\'s, and the earlier ones of its part', () => {
    expect(compiled.slides[2].notes).toEqual({slide: 'Route', step: 1, steps: 1, now: ['Then B.'], earlier: ['A first.']});
    expect(compiled.slides[0].notes).toEqual({slide: 'Title', step: 0, steps: 0, now: ['Welcome.'], earlier: []});
    expect(compiled.clicks[0]).toMatchObject({text: 'Hi', headline: '', notes: ['Welcome.']});
    expect(compiled.clicks[1]).toMatchObject({headline: 'Start at A', stepIndex: 0, steps: 2});
  });

  it('brings a map in fresh when the click before was elsewhere', () => {
    const c = compileDeck(sourceOf({clicks: `<section data-label="M" data-map="map"><step data-in="a"></step></section>
      <section data-label="P"><p>x</p></section>
      <section data-label="N" data-map="map"><step data-on="a"></step></section>`}));
    // after a plain slide the map arrives: its pieces come in where they were left, rather than changing
    expect(c.clicks[2].look.pieces[0].change).toBe('arrive');
  });

  it('names the part and the click when a click cannot be planned', () => {
    expect(() => compileDeck(sourceOf({clicks: '<section data-label="R" data-map="map"><step data-on="zz"></step></section>'})))
      .toThrow(/"R" click 1: no piece "zz" \(the pieces are named a, w1, b, w2, c\)/);
    expect(() => compileDeck(sourceOf({clicks: '<section data-label="R" data-map="map"><step data-in="a" data-focus="spin"></step></section>'})))
      .toThrow(/"R" click 1: no focus strategy "spin"/);
  });

  it('refuses a map it does not have, a map with no pieces, a helper that fails, and two clicks with one label', () => {
    expect(() => compileDeck(sourceOf({clicks: '<section data-label="R" data-map="other"><step></step></section>'}))).toThrow(/told on map "other", which the deck does not have/);
    expect(() => compileDeck(sourceOf({clicks: '<section data-label="R" data-map="map"><step></step></section>', maps: {map: '<p>no pieces</p>'}}))).toThrow(/map "map" has no pieces/);
    expect(() => compileDeck(sourceOf({clicks: '<section data-label="R" data-map="map"><step></step></section>', maps: {map: `${MAP}<i data-icon="x"></i>`}}))).toThrow(/map "map": no icon "x"/);
    expect(() => compileDeck(sourceOf({clicks: '<section data-label="P"><i data-arrow="1"></i></section>'}))).toThrow(/"P": data-arrow="1"/);
    expect(() => compileDeck(sourceOf({clicks: '<section data-label="R · 1"><p>x</p></section><section data-label="R" data-map="map"><step data-in="a"></step></section>'})))
      .toThrow(/two clicks are labelled "R · 1"/);
  });

  it('checks post.json\'s slide labels against the deck', () => {
    const clicks = '<section data-label="P"><p>x</p></section>';
    expect(() => compileDeck(sourceOf({clicks, post: {sections: [{key: 's', slides: ['P']}]}}))).not.toThrow();
    expect(() => compileDeck(sourceOf({clicks, post: {sections: [{key: 's', slides: ['Q']}]}}))).toThrow(/section "s" names slide "Q", which the deck does not have/);
    expect(() => compileDeck(sourceOf({clicks, post: {}}))).toThrow(/post.json has no "sections" list/);
    expect(() => compileDeck(sourceOf({clicks, post: {sections: [{key: 's'}]}}))).not.toThrow();
  });
});

describe('compileDeck · a picture larger than the slide (fit)', () => {
  // three boxes on a floor 5200 px wide: more than two slides and a half
  const wide = `<div data-k="a" class="box" style="left:0px;top:400px;width:400px;height:200px">A</div>
<i data-k="w1" class="wire pkt" data-arrow="a to b"></i>
<div data-k="b" class="box" style="left:1800px;top:400px;width:400px;height:200px">B</div>
<i data-k="w2" class="wire" data-arrow="b to c"></i>
<div data-k="c" class="box" style="left:4800px;top:400px;width:400px;height:200px">C</div>`;
  const clicks = `
<section data-label="Wide" data-kicker="1 · Wide" data-map="map">
  <step data-in="a" data-focus="fit"><h2>One piece</h2></step>
  <step data-in="w1 b" data-focus="fit"><h2>The view slides to take B in</h2></step>
  <step data-in="w2 c" data-focus="fit" data-focus-share="0.9"><h2>And pulls back for C</h2></step>
</section>`;
  const compiled = compileDeck(sourceOf({clicks, maps: {map: wide}}));
  const scale = (k) => Number(/--sd-ts:([\d.]+)/.exec(compiled.slides[k].html)[1]);

  it('each click frames all that is shown: close on one piece, further out than the picture as drawn for all three', () => {
    expect(compiled.clicks.map((c) => c.look.strategies)).toEqual([['fit'], ['fit'], ['fit']]);
    expect(scale(0)).toBe(2.5);                 // one box: held at `most`
    expect(scale(1)).toBeLessThan(1);           // 2200 wide: further out than 1×
    expect(scale(2)).toBeLessThan(scale(1));    // 5200 wide: further still
    expect(scale(2)).toBeGreaterThanOrEqual(0.25);
  });

  it('writes the view\'s move into the slide, from where the last click left it', () => {
    expect(compiled.slides[0].html).toMatch(/<div class="sd-stage" style="--sd-tx:-?[\d.]+px;--sd-ty:-?[\d.]+px;--sd-ts:2\.5">/);
    expect(compiled.slides[1].html).toMatch(/<div class="sd-stage sd-move" style="[^"]*--sd-ts0:2\.5"/);
    expect(compiled.slides[2].html).toContain(`--sd-ts0:${scale(1)}`);
  });
});

describe('compileDeck · an order inside a click (turns on a route)', () => {
  const wide = `<div data-k="a" class="box" style="left:0px;top:400px;width:400px;height:200px">A</div>
<i data-k="w1" class="wire pkt" data-arrow="a to b"></i>
<div data-k="b" class="box" style="left:1800px;top:400px;width:400px;height:200px">B</div>
<i data-k="w2" class="wire pkt" data-arrow="b to c"></i>
<div data-k="c" class="box" style="left:3000px;top:400px;width:400px;height:200px">C</div>`;
  const clicks = `
<section data-label="Order" data-kicker="1 · Order" data-map="map">
  <step data-in="a" data-focus="fit"><h2>One piece</h2></step>
  <step data-in="w1 b w2 c" data-focus="fit path" data-focus-route="camera w1:1.2 b (w2 c)"><h2>The view first, then a slow packet, then the rest</h2></step>
  <step data-on="b" data-focus="fit path" data-focus-route="camera b"><h2>The same picture: the view stays</h2></step>
</section>`;
  const compiled = compileDeck(sourceOf({clicks, maps: {map: wide}}));
  const piece = (k, name) => new RegExp(`<[^>]*data-k="${name}"[^>]*>`).exec(compiled.slides[k].html)[0];

  it('the view takes the first turn, and every piece after it waits until the view has arrived', () => {
    const look = compiled.clicks[1].look;
    expect(look.strategies).toEqual(['fit', 'path']);
    expect(look.stage.turn).toEqual({at: 0, takes: 1});
    expect(look.path).toMatchObject({turns: 4, step: 0.35, done: 2.55});   // view 0 · w1 1 (1.2 s) · b 2.2 · w2 + c 2.55
    expect(compiled.slides[1].html).toMatch(/<div class="sd-stage sd-move sd-stage-turn" style="[^"]*--sd-stage-delay:0s;--sd-stage-time:1s">/);
    expect(piece(1, 'w1')).toContain('--sd-path-delay:1s');
    expect(piece(1, 'w1')).toContain('--sd-turn-time:1.2s');               // its packet rides that long
    expect(piece(1, 'b')).toContain('--sd-path-delay:2.2s');
    expect(piece(1, 'b')).not.toContain('--sd-turn-time');
    expect(piece(1, 'w2')).toContain('--sd-path-delay:2.55s');
    expect(piece(1, 'c')).toContain('--sd-path-delay:2.55s');
  });

  it('on a click where the view stays, its turn takes none, and a deck with no turns writes nothing of them', () => {
    expect(compiled.clicks[2].look.stage.turn).toBe(undefined);
    expect(compiled.slides[2].html).not.toMatch(/sd-stage-turn|--sd-stage-delay|--sd-turn-time/);
    expect(compiled.slides[0].html).not.toMatch(/sd-stage-turn|--sd-stage-delay|--sd-turn-time/);
  });

  it('refuses a route it cannot read while the deck is compiled, naming the click and the fix', () => {
    const bad = clicks.replace('camera w1:1.2 b (w2 c)', 'camera w1:1.2 b (w2 c');
    expect(() => compileDeck(sourceOf({clicks: bad, maps: {map: wide}}))).toThrow(/focus "path": "\(" opens names that come together and "\)" closes them/);
  });
});

describe('compileDeck · stages of their own, and a camera that pans', () => {
  const map = `<div data-k="a" class="box" style="left:0px;top:400px;width:400px;height:200px">A</div>
<i data-k="w1" class="wire pkt" data-arrow="a to b"></i>
<div data-k="b" class="box" style="left:1800px;top:400px;width:400px;height:200px">B</div>
<div data-k="row1" data-stage="panel" class="chip" style="left:1500px;top:60px;width:300px;height:70px">Layer 1</div>
<div data-k="row2" data-stage="panel" class="chip" style="left:1500px;top:230px;width:300px;height:70px">Layer 2</div>
<i data-k="link" class="wire" data-arrow="row1 to row2"></i>`;
  const clicks = `
<section data-label="Map" data-kicker="1 · Map" data-map="map">
  <step data-in="a row1 row2 link" data-on="a" data-quiet data-focus="zoom"><h2>Close on A</h2></step>
  <step data-in="w1 b" data-on="w1 b" data-focus="pan path" data-focus-route="camera w1 b"><h2>Across to B, the same size</h2></step>
  <step data-on="row2" data-focus="zoom" data-focus-stage="panel"><h2>Now the panel</h2></step>
</section>`;
  const compiled = compileDeck(sourceOf({clicks, maps: {map}}));
  const stageOf = (k, name) => new RegExp(`<div class="sd-stage[^"]*"${name ? ` data-sd-stage="${name}"` : ''}[^>]*>`).exec(compiled.slides[k].html)[0];

  it('the panel stays as drawn while the map\'s view moves, and the map\'s view stays while the panel\'s moves', () => {
    const [one, two, three] = compiled.clicks.map((c) => c.look);
    expect(two.stage.move.s).toBe(one.stage.move.s);                       // pan: the size zoom chose
    expect(two.stage.move.x).not.toBe(one.stage.move.x);
    expect(two.stages).toEqual([{name: 'panel', move: null, from: null}]);
    expect(three.stage).toEqual({move: two.stage.move, from: null});       // the map holds
    expect(three.stages[0].from).toEqual({s: 1, x: 0, y: 0});
    expect(compiled.maps.map.pieces.find((p) => p.keys[0] === 'link').stage).toBe('panel');   // a wire between two rows of the panel is the panel's
  });

  it('writes each stage as its own element on every click, the panel\'s pieces inside it', () => {
    for (const k of [0, 1, 2]) {
      expect(stageOf(k, 'panel')).toContain('sd-stage-own');
      const panel = compiled.slides[k].html.split('data-sd-stage="panel"')[1];
      expect([...panel.matchAll(/data-k="(\w+)"/g)].map((m) => m[1])).toEqual(['row1', 'row2', 'link']);
      expect(compiled.slides[k].html.split('data-sd-stage="panel"')[0]).not.toMatch(/data-k="row1"/);
    }
    expect(stageOf(1)).toMatch(/^<div class="sd-stage sd-move sd-stage-turn" style="[^"]*--sd-stage-delay:0s;--sd-stage-time:1s">$/);
    expect(stageOf(2, 'panel')).toMatch(/^<div class="sd-stage sd-move sd-stage-own" data-sd-stage="panel" style="[^"]*--sd-ts0:1">$/);
    expect(stageOf(2)).not.toContain('sd-move');
  });

  it('tells the slide when a view with a turn has arrived, so the deck\'s own animations can wait for it', () => {
    expect(compiled.slides[1].html).toMatch(/^<section data-label="Map · 2" class="slide on-map " style="--sd-view-at:1s">/);
    expect(compiled.slides[0].html).not.toContain('--sd-view-at');
    expect(compiled.slides[2].html).not.toContain('--sd-view-at');           // it moves with no turn: focus.css takes the theme's move time
  });
});
