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
