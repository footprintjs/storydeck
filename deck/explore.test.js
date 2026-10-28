import {describe, it, expect, afterEach} from 'vitest';
import {exploreTargets, exploreData, exploreRuntime} from './explore.js';
import {compileDeck} from './compile.js';
import {deckPage} from './page.js';
import {readConfig} from './config.js';
import {sourceOf, MAP} from './test/helpers.js';

// a ↔ b ↔ c, wires named by the pieces they join
const map = MAP.replace('data-arrow="300 470 500 470"', 'data-arrow="a to b"').replace('data-arrow="700 470 900 470"', 'data-arrow="b to c"');
const clicks = `<section data-label="Title"><h1>Hi</h1></section>
<section data-label="M" data-map="map">
  <step data-in="*" data-quiet><h2>All</h2></step>
  <step data-on="b+"><h2>B and what it touches</h2></step>
  <step data-on="c"><h2>C</h2></step>
  <step data-on="*"><h2>Everything</h2></step>
</section>`;
const compiled = (explore = true) => compileDeck(sourceOf({deck: {title: 'T', explore}, clicks, maps: {map}}));

describe('exploreTargets', () => {
  it('leads each piece to the first click that names it — gw+\'s gw too — else to the first that takes it in through a name+', () => {
    expect(compiled().explore).toEqual({
      slides: [null, 'map', 'map', 'map', 'map'],
      targets: {map: {b: 2, c: 3, w1: 2, w2: 2, a: 2}},   // c is named on click 4 (index 3), though b+ took it in on click 3
    });
  });

  it('is there only when deck.json asks for it, which must be true or false', () => {
    expect(compiled(false).explore).toBeNull();
    expect(readConfig({title: 'T'}).explore).toBe(false);
    expect(() => readConfig({title: 'T', explore: 'yes'})).toThrow('deck.json "explore" is true or false, not "yes"');
  });

  it('reads the planned clicks alone: a plain slide leads nowhere, and "*" names no piece', () => {
    expect(exploreTargets([{kind: 'plain'}, {kind: 'map', map: {name: 'm', pieces: [{keys: ['x']}]}, step: {on: ['*']}}, {kind: 'map', map: {name: 'm', pieces: []}, step: {on: null}}]))
      .toEqual({slides: [null, 'm', 'm'], targets: {m: {}}});
  });
});

describe('the page', () => {
  const assets = {stageJs: '', css: [], version: '0'};

  it('carries the targets, the explore mark and the runtime only when the deck explores', () => {
    const on = deckPage(compiled(), assets), off = deckPage(compiled(false), assets);
    expect(on).toContain('no-rail data-explore>');
    expect(on).toContain('<script type="application/json" id="deck-explore">{"slides":');
    expect(on).toContain('exploreRuntime');
    expect(off).not.toMatch(/explore/);
  });

  it('keeps the data inside its script tag', () => {
    expect(exploreData({slides: ['</script><b>'], targets: {}})).not.toContain('</script><b>');
  });
});

describe('exploreRuntime (in the page)', () => {
  afterEach(() => { document.body.innerHTML = ''; });

  /** A deck-stage stand-in on click `at`: its slides, goTo, and slidechange as the stage sends it. */
  function page(at) {
    document.body.innerHTML = `<deck-stage data-explore>${[0, 1, 2, 3, 4].map((i) => `<section>${i ? '<div data-k="a">A</div><div data-k="b">B</div><div data-k="c">C</div><i data-k="w1"></i>' : '<h1>Hi</h1>'}</section>`).join('')}</deck-stage>
      ${exploreData(compiled().explore)}`;
    const stage = document.querySelector('deck-stage');
    stage.index = at;
    stage.goTo = (i) => { stage.index = i; stage.dispatchEvent(new CustomEvent('slidechange')); };
    exploreRuntime();
    return stage;
  }
  const piece = (stage, k) => stage.children[stage.index].querySelector(`[data-k="${k}"]`);
  const click = (el, init = {}) => el.dispatchEvent(new MouseEvent('click', {bubbles: true, cancelable: true, button: 0, ...init}));
  const back = () => document.querySelector('.explore-back');

  it('marks the pieces that lead to another click, and goes there on a click', () => {
    const stage = page(4);
    expect([...document.querySelectorAll('.sd-leads')].map((e) => e.getAttribute('data-k'))).toEqual(['a', 'b', 'c', 'w1']);
    expect(back().hidden).toBe(true);
    click(piece(stage, 'c'));
    expect(stage.index).toBe(3);
    expect(back().hidden).toBe(false);
    expect(back().textContent).toBe('← Back to click 5');
    expect(piece(stage, 'c').classList.contains('sd-leads')).toBe(false);   // c's own click: it leads nowhere from here
  });

  it('comes back a step at a time: the Back control, or Backspace', () => {
    const stage = page(4);
    click(piece(stage, 'c'));
    click(piece(stage, 'b'));
    expect(stage.index).toBe(2);
    window.dispatchEvent(new KeyboardEvent('keydown', {key: 'Backspace', cancelable: true}));
    expect(stage.index).toBe(3);
    click(back());
    expect(stage.index).toBe(4);
    expect(back().hidden).toBe(true);
    window.dispatchEvent(new KeyboardEvent('keydown', {key: 'Backspace', cancelable: true}));
    expect(stage.index).toBe(4);   // nothing left to go back to
    click(back());
    expect(stage.index).toBe(4);
  });

  it('leaves alone what is not a way through: an Alt-click (the dev page\'s drag), another button, a slide with no map', () => {
    const stage = page(4);
    click(piece(stage, 'c'), {altKey: true});
    click(piece(stage, 'c'), {button: 1});
    expect(stage.index).toBe(4);
    stage.goTo(0);
    expect(document.querySelectorAll('.sd-leads')).toHaveLength(0);
  });

  it('leaves alone a click off any piece, a piece on a slide not shown, and Backspace typed into a field', () => {
    const stage = page(4);
    click(stage.children[4]);
    click(stage.children[1].querySelector('[data-k="c"]'));
    expect(stage.index).toBe(4);
    click(piece(stage, 'c'));
    const field = document.createElement('input');
    document.body.appendChild(field);
    field.dispatchEvent(new KeyboardEvent('keydown', {key: 'Backspace', bubbles: true, cancelable: true}));
    expect(stage.index).toBe(3);
    const pieceless = stage.children[3].appendChild(document.createElement('div'));
    pieceless.setAttribute('data-k', '');
    click(pieceless);
    expect(stage.index).toBe(3);
  });

  it('a piece on a plain slide leads nowhere, and a click on the page itself is left alone', () => {
    const stage = page(0);
    stage.children[0].innerHTML = '<div data-k="c">C</div>';
    stage.goTo(0);
    expect(document.querySelectorAll('.sd-leads')).toHaveLength(0);
    click(piece(stage, 'c'));
    document.dispatchEvent(new MouseEvent('click', {bubbles: true, cancelable: true, button: 0}));
    expect(stage.index).toBe(0);
  });

  it('does nothing on a page that does not explore', () => {
    document.body.innerHTML = '<deck-stage></deck-stage>';
    exploreRuntime();
    expect(back()).toBeNull();
  });
});
