import {describe, it, expect} from 'vitest';
import {readPace, paceAttrs, PACE_CSS, PACE_MOST, PACE_LEAST} from './pace.js';
import {parseClicks} from './parse.js';
import {compileDeck} from './compile.js';
import {deckPage} from './page.js';
import {pageAssets} from './assets.js';
import {sourceOf} from './test/helpers.js';

const read = (attrs) => readPace(attrs, '"P"');
const map = (attrs, stepAttrs = '') => `<section data-label="M" data-map="map" ${attrs}><step data-in="a" ${stepAttrs}><h2>One</h2><aside class="notes">One.</aside></step><step data-in="b"><h2>Two</h2><aside class="notes">Two.</aside></step></section>`;
const plain = '<section data-label="Plain"><p>A slide</p><aside class="notes">Words.</aside></section>';

describe('readPace', () => {
  it('reads what a part asks for, and nothing when it asks for none', () => {
    expect(read('data-label="P" data-map="m"')).toBeNull();
    expect(read('data-arrive="fade"')).toEqual({arrive: 'fade'});
    expect(read('data-arrive="FADE" data-arrive-time="0.9" data-arrive-delay="0" data-leave-time="1.5"')).toEqual({arrive: 'fade', arriveTime: .9, arriveDelay: 0, leaveTime: 1.5});
  });
  it('refuses what it cannot play, naming what it can', () => {
    expect(() => read('data-arrive="spin"')).toThrow(/"P": data-arrive="spin" — a piece arrives by grow or fade/);
    for (const bad of ['fast', '', '-1', 'NaN', '1s', String(PACE_MOST + 1), String(PACE_LEAST / 2)]) expect(() => read(`data-arrive-time="${bad}"`), bad).toThrow(/data-arrive-time=.* it is a time in seconds/);
    expect(() => read(`data-leave-time="${PACE_MOST + 1}"`)).toThrow(/data-leave-time=/);
    expect(() => read('data-arrive-delay="-1"')).toThrow(/data-arrive-delay=.* from 0 to/);
    expect(read('data-arrive-delay="0"')).toEqual({arriveDelay: 0});
  });
  it('refuses a misspelt name, so a slip never quietly plays the defaults', () => {
    expect(() => read('data-arrive-tim="0.9"')).toThrow(/"P": data-arrive-tim is not a way to set how pieces arrive or leave — the attributes are data-arrive, data-arrive-time, data-arrive-delay, data-leave-time/);
    expect(() => read('data-leave="1"')).toThrow(/data-leave is not a way/);
    expect(read('data-enter="push" data-arrived-at="x"')).toBeNull();
  });
  it('is a part\'s to set, not a click\'s', () => {
    expect(() => parseClicks(map('', 'data-arrive="fade"'))).toThrow(/"M" click 1: a <step> cannot set how pieces arrive or leave — put data-arrive on its <section>/);
    expect(() => parseClicks(map('', 'data-leave="1"'))).toThrow(/a <step> cannot set how pieces arrive or leave/);
  });
});

describe('on the page', () => {
  const deck = (clicks) => compileDeck(sourceOf({clicks}));
  it('rides on every slide of the part, and on no other', () => {
    expect(paceAttrs(null)).toBe('');
    expect(paceAttrs({arrive: 'grow'})).toBe(' data-sd-pace');
    expect(paceAttrs({arrive: 'fade', arriveTime: .9, arriveDelay: .5, leaveTime: .4})).toBe(' data-sd-pace style="--sd-arrive-with:sdArrive;--sd-arrive-time:0.9s;--sd-arrive-delay:0.5s;--sd-leave-time:0.4s"');
    const {slides} = deck(map('data-arrive="fade" data-arrive-time="0.9"') + plain);
    const html = slides.map((s) => (typeof s === 'string' ? s : s.html ?? '')).join('');
    expect(html.match(/data-sd-pace style="--sd-arrive-with:sdArrive;--sd-arrive-time:0.9s"/g)).toHaveLength(2);
    expect(html).toContain('<section data-label="Plain" class="slide plain">');
  });
  it('adds its CSS only when a part asks, before the deck\'s own, so a deck without it is byte for byte as before', () => {
    const without = deckPage(deck(map('') + plain), pageAssets()), withIt = deckPage(deck(map('data-leave-time="1"') + plain), pageAssets());
    expect(without).not.toContain('data-sd-pace');
    expect(without).not.toContain('deck/pace.js');
    expect(withIt.replaceAll(' data-sd-pace style="--sd-leave-time:1s"', '').replace(`${PACE_CSS}\n`, '')).toBe(without);
    const themed = deckPage({...deck(map('data-leave-time="1"')), themeCss: '.mine {}'}, pageAssets());
    expect(themed.indexOf(PACE_CSS)).toBeLessThan(themed.indexOf('.mine {}'));
  });
  it('fills the same slots as every arrival, keeps the gate\'s rules, and stays weaker than a deck\'s own rule', () => {
    expect(PACE_CSS).toContain('prefers-reduced-motion: no-preference');
    expect(PACE_CSS.includes('animation:')).toBe(false);   // only focus.css starts anything, under its gate: forward steps only
    expect(PACE_CSS.match(/--sd-a-state:/g)).toHaveLength(5 + 1);
    for (const rule of PACE_CSS.split('\n').filter((l) => l.includes('--sd-a-'))) expect(rule.trim().startsWith(':where([data-sd-pace')).toBe(true);
    expect(PACE_CSS.includes('!important')).toBe(false);
  });
});
