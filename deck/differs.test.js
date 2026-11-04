import {describe, it, expect} from 'vitest';
import {readDiffers, differsHtml, saidInNotes, timeWords, DIFFERS_MOST} from './differs.js';
import {checkDeck} from './check.js';
import {compileDeck} from './compile.js';
import {reviewClick} from './review.js';
import {sourceOf} from './test/helpers.js';

const TIME = 'Time shown 30 times faster', SCALE = 'The dots are drawn far larger than real';
const read = (attrs) => readDiffers(attrs, '"P"');
const plain = (attrs, notes = 'Here it runs thirty times  faster than life.') => `<section data-label="P" ${attrs}><p>A plug</p><aside class="notes">${notes}</aside></section>`;
const map = (attrs, ...notes) => `<section data-label="M" data-map="map" ${attrs}>${notes.map((n) => `<step data-in="a b c w1 w2"><h2>All</h2><aside class="notes">${n}</aside></step>`).join('').replace(/<step data-in="a b c w1 w2">/g, (m, offset) => (offset === 0 ? m : '<step data-on="b">'))}</section>`;
const compiled = (clicks) => compileDeck(sourceOf({clicks}));
const rules = (problems) => problems.filter((p) => p.rule === 'differs-unsaid');

describe('readDiffers', () => {
  it('reads a declaration, the labels from it unless it gives its own', () => {
    expect(read('')).toBeNull();
    expect(read(`data-label="P" data-differs-time="30" data-differs-scale="${SCALE}"`)).toEqual({time: 30, scale: SCALE, shown: [TIME, SCALE]});
    expect(read('data-differs-time="0.04"').shown).toEqual(['Time shown 25 times slower']);
    expect(timeWords(1.5)).toBe('Time shown 1.5 times faster');
    expect(read('data-differs-time="30" data-differs-shown="Zeit 30-mal schneller | Nicht maßstäblich" data-differs-said="thirty"').shown).toEqual(['Zeit 30-mal schneller', 'Nicht maßstäblich']);
    expect(read('data-differs-scale="Not to scale" data-differs-shown="false" data-differs-said="not to scale"')).toEqual({scale: 'Not to scale', shown: [], said: 'not to scale'});
  });

  it('refuses what is not one, naming the fix', () => {
    expect(() => read('data-differs="30"')).toThrow(/"P": data-differs is not a way to say how a part differs — the attributes are data-differs-time, /);
    expect(() => read('data-differs-speed="30"')).toThrow(/data-differs-speed is not a way/);
    expect(() => read('data-differs-time="1"')).toThrow(/1 is real time, so leave it out/);
    expect(() => read('data-differs-time="fast"')).toThrow(/how many times faster the picture runs/);
    expect(() => read('data-differs-time=""')).toThrow(/how many times faster the picture runs/);
    expect(() => read('data-differs-said="thirty"')).toThrow(/say how the part differs: data-differs-time .* or both/);
    expect(() => read(`data-differs-scale="${'x'.repeat(DIFFERS_MOST + 1)}"`)).toThrow(/more than a label can hold in a glance \(70\) — shorten it, and say the rest in the notes/);
    expect(() => read('data-differs-time="30" data-differs-shown="false"')).toThrow(/the notes must say it — name their phrase in data-differs-said/);
    expect(() => read('data-differs-time="30" data-differs-said=" "')).toThrow(/data-differs-said is empty/);
    expect(() => compiled(plain('data-differs-time="1"'))).toThrow(/"P": data-differs-time="1"/);
  });

  it('draws its labels as chrome, escaped; none when the notes alone say it', () => {
    expect(differsHtml({shown: [TIME, 'a <b>']})).toBe(`<div class="differs" data-chrome><span>${TIME}</span><span>a &lt;b&gt;</span></div>`);
    expect(differsHtml({shown: []})).toBe('');
    expect(differsHtml(null)).toBe('');
  });

  it('finds the phrase in the notes, case and spacing aside, never loose words', () => {
    expect(saidInNotes('thirty times faster', 'Here it runs Thirty  times faster.')).toBe(true);
    expect(saidInNotes('thirty times faster', 'faster, thirty times')).toBe(false);
  });
});

describe('a deck that declares', () => {
  it('shows the labels on each of the part\'s slides, plain or on a map, and carries it on each click', () => {
    const plainDeck = compiled(plain('data-differs-time="30"'));
    expect(plainDeck.slides[0].html).toContain(`<div class="differs" data-chrome><span>${TIME}</span></div>`);
    expect(plainDeck.clicks[0].differs).toEqual({time: 30, shown: [TIME]});
    expect(plainDeck.clicks[0].text).toBe('A plug');
    const onMap = compiled(map('data-differs-scale="Not to scale"', 'one', 'two'));
    expect(onMap.slides.map((s) => s.html.includes('<span>Not to scale</span>'))).toEqual([true, true]);
  });

  it('a deck that declares nothing is as it was', () => {
    const deck = compiled(plain(''));
    expect(deck.slides[0].html).not.toContain('differs');
    expect('differs' in deck.clicks[0]).toBe(false);
  });

  it('check: a phrase its notes hold passes, on any click of the part, tags aside; one they do not is an error, once', () => {
    expect(rules(checkDeck(compiled(plain('data-differs-time="30" data-differs-said="thirty times faster"', 'It runs <b>thirty</b> times faster.'))))).toEqual([]);
    expect(rules(checkDeck(compiled(plain('data-differs-time="30" data-differs-said="thirty times faster"'))))).toEqual([]);
    expect(rules(checkDeck(compiled(map('data-differs-time="30" data-differs-said="thirty times"', 'one', 'it runs thirty times faster'))))).toEqual([]);
    const missing = rules(checkDeck(compiled(map('data-differs-time="30" data-differs-shown="false" data-differs-said="a hundred times"', 'one', 'two'))));
    expect(missing.map((p) => [p.level, p.click])).toEqual([['error', 1]]);
    expect(missing[0].message).toMatch(/part "M" says its notes tell how it differs from the real thing \("a hundred times"\), and they do not hold those words — say it in the notes, or fix data-differs-said/);
  });

  it('review says how a click differs, read first', () => {
    const deck = compiled(plain(`data-differs-time="30" data-differs-scale="${SCALE}" data-differs-said="thirty times faster"`));
    expect(reviewClick(deck, 1)).toContain(`differs: on the slide: ${TIME} · ${SCALE}; in the notes: "thirty times faster"`);
    expect(reviewClick(compiled(plain('data-differs-time="30" data-differs-shown="false" data-differs-said="thirty"')), 1)).toContain('differs: not on the slide; in the notes: "thirty"');
    expect(reviewClick(compiled(plain('')), 1)).not.toContain('differs');
  });
});
