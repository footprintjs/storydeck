import {describe, it, expect} from 'vitest';
import {outline, reviewClick, findClick} from './review.js';
import {compileDeck} from './compile.js';
import {sourceOf, MAP} from './test/helpers.js';

const compiled = compileDeck(sourceOf({clicks: `
<section data-label="Title"><h1>A deck about three boxes and the wires between them all</h1><aside class="notes">Hello there.</aside></section>
<section data-label="Route" data-kicker="1" data-map="map">
  <step data-in="a"><h2>Start at A</h2><aside class="notes">A first.</aside></step>
  <step data-in="w1 b w2 c" data-on="a w1 b w2 c" data-focus="path" data-focus-line="a → c"><h2>Across to C</h2></step>
  <step data-on="b" data-hot="b" data-focus="zoom"><h2>Close in on B</h2></step>
  <step data-on="c" data-focus="left blur" data-focus-label="the end"><h2>One two three four five six seven eight nine ten eleven twelve thirteen</h2></step>
  <step data-on="a b" data-out="c"><h2>Back</h2></step>
  <step data-on="a" data-focus="apart" data-focus-apart="a: 0 -100"><h2>Apart</h2></step>
</section>`, maps: {map: MAP}}));

describe('outline', () => {
  it('is the whole deck, a line per click: label, headline or a plain slide\'s words, what it lights, its strategies', () => {
    const lines = outline(compiled).split('\n');
    expect(lines).toHaveLength(7);
    expect(lines[0]).toBe('1  Title — plain: "A deck about three boxes and the wires between them all"');
    expect(lines[1]).toBe('2  Route · 1 — "Start at A" · lit a · grey');
    expect(lines[2]).toBe('3  Route · 2 — "Across to C" · lit a, w1, b, w2, c · path');
    expect(lines[4]).toContain('left blur');
  });
});

describe('reviewClick', () => {
  it('reads a plain slide: its words and notes', () => {
    expect(reviewClick(compiled, 1)).toBe('click 1 of 7 · "Title" (plain slide)\ntext (11 words): "A deck about three boxes and the wires between them all"\nnotes (1, 2 words): "Hello there."');
    // a part's theme ends the first line, so a reviewer reading text knows which look the click wears
    const themed = compileDeck(sourceOf({clicks: '<section data-label="Cover" data-theme="cover"><h1>Hi</h1></section><section data-label="M" data-map="map" data-theme="ledger"><step data-in="a"><h2>A</h2></step></section>', theme: '[data-theme="cover"],[data-theme="ledger"]{}'}));
    expect(reviewClick(themed, 1).split('\n')[0]).toBe('click 1 of 2 · "Cover" (plain slide) · theme cover');
    expect(reviewClick(themed, 2).split('\n')[0]).toBe('click 2 of 2 · "M · 1" (map "map", step 1 of 1) · theme ledger');
  });

  it('reads a path click: the route in its order, what enters, and that it has no notes', () => {
    const r = reviewClick(compiled, 'Route · 2');
    expect(r).toContain('click 3 of 7 · "Route · 2" (map "map", step 2 of 6)');
    expect(r).toContain('headline: "Across to C" (3 words)');
    expect(r).toContain('focus: path · route: a → w1 → b → w2 → c, 0.35 s apart · line "a → c"');
    expect(r).toContain('lit (5): a, w1, b, w2, c');
    expect(r).toContain('this click: enter w1, b, w2, c');
    expect(r).toContain('notes: —');
  });

  it('reads a zoom: what greys, the ring, and where the view goes', () => {
    const r = reviewClick(compiled, 4);
    expect(r).toContain('greyed (4): a, w1, w2, c');
    expect(r).toContain('this click: grey a, w1, w2, c · ring b');
    expect(r).toMatch(/motion: view at [\d.]+× \(x -?[\d.]+, y -?[\d.]+\), moving/);
  });

  it('flags a long headline, and names a blur\'s frame and a mover', () => {
    const r = reviewClick(compiled, 5);
    expect(r).toContain('(13 words, over 12)');
    expect(r).toContain('blur with frame "the end"');
    expect(r).toContain('move ');
    expect(r).toContain('view back to the whole map');
  });

  it('says what leaves, how the blur melts away, and how an exploded view opens', () => {
    expect(reviewClick(compiled, 6)).toMatch(/leave c[\s\S]*blur melts away/);
    expect(reviewClick(compiled, 7)).toContain('apart: a opens');
  });

  it('finds a click by number or label, and names the range when it cannot', () => {
    expect(findClick(compiled, '3').label).toBe('Route · 2');
    expect(findClick(compiled, 'Title').n).toBe(1);
    expect(() => findClick(compiled, 0)).toThrow(/no click 0 — the deck has clicks 1 to 7/);
    expect(() => findClick(compiled, 'Nope')).toThrow(/no click "Nope"/);
  });

  it('cuts a long list and a long quote short, saying how many more', () => {
    const many = Array.from({length: 20}, (_, i) => `<div data-k="p${i}" style="left:${i * 50}px;top:300px;width:40px;height:40px">${i}</div>`).join('');
    const c = compileDeck(sourceOf({clicks: `<section data-label="M" data-map="map"><step data-in="*"><h2>${'word '.repeat(40)}</h2></step></section>`, maps: {map: many}}));
    const r = reviewClick(c, 1);
    expect(r).toContain('lit (20): p0, p1, p2, p3, p4, p5, p6, p7, p8, p9, p10, p11, p12, p13, … (6 more)');
    expect(r).toMatch(/headline: "(word ){30,}word…" \(40 words, over 12\)/);
    expect(outline(c)).toContain('… (14 more)');
  });

  it('says when a click changes nothing on the map, and when a headline is missing', () => {
    const c = compileDeck(sourceOf({clicks: '<section data-label="M" data-map="map"><step data-in="a"></step><step></step></section>'}));
    expect(reviewClick(c, 2)).toContain('this click: nothing changes on the map');
    expect(reviewClick(c, 2)).toContain('headline: —');
    expect(outline(c)).toContain('(no headline)');
  });
});
