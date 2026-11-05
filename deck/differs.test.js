import {describe, it, expect} from 'vitest';
import {readDiffers, differsHtml, saidInNotes, timeWords, DIFFERS_CSS, DIFFERS_MOST, DIFFERS_SAID_MOST} from './differs.js';
import {checkDeck} from './check.js';
import {compileDeck} from './compile.js';
import {deckPage} from './page.js';
import {pageAssets} from './assets.js';
import {parseClicks, plainText} from './parse.js';
import {layoutProblems} from './layout.js';
import {reviewClick} from './review.js';
import {measureSlide} from '../video.js';
import {readDeck} from './source.js';
import {cleanDecks, sourceOf, tempDeck} from './test/helpers.js';

const TIME = 'Time shown 30 times faster', SCALE = 'The dots are drawn far larger than real';
const read = (attrs) => readDiffers(attrs, '"P"');
const plain = (attrs, notes = 'Here it runs thirty times  faster than life.') => `<section data-label="P" ${attrs}><p>A plug</p><aside class="notes">${notes}</aside></section>`;
const map = (attrs, ...notes) => `<section data-label="M" data-map="map" ${attrs}>${notes.map((n) => `<step data-in="a b c w1 w2"><h2>All</h2><aside class="notes">${n}</aside></step>`).join('').replace(/<step data-in="a b c w1 w2">/g, (m, offset) => (offset === 0 ? m : '<step data-on="b">'))}</section>`;
const compiled = (clicks, deck) => compileDeck(sourceOf({clicks, ...(deck ? {deck: {title: 'T', ...deck}} : {})}));
const rules = (problems) => problems.filter((p) => p.rule === 'differs-unsaid');

describe('an analogy', () => {
  const ANALOGY = 'people stand in for the services';
  it('says what stands in for what, in its own words on the slide', () => {
    expect(read(`data-differs-analogy="${ANALOGY}"`)).toEqual({analogy: ANALOGY, shown: [`An analogy: ${ANALOGY}`]});
    expect(differsHtml(read(`data-differs-analogy="${ANALOGY}"`))).toContain(`An analogy: ${ANALOGY}`);
    expect(read(`data-differs-analogy="${ANALOGY}" data-differs-shown="Eine Analogie"`).shown).toEqual(['Eine Analogie']);
  });
  it('comes after the time and the scale, each with a line of its own', () => {
    expect(read(`data-differs-analogy="${ANALOGY}" data-differs-scale="${SCALE}" data-differs-time="30"`).shown).toEqual([TIME, SCALE, `An analogy: ${ANALOGY}`]);
  });
  it('is a statement like the others: each needs its own line or phrase', () => {
    expect(() => read(`data-differs-time="30" data-differs-analogy="${ANALOGY}" data-differs-shown="${TIME}"`)).toThrow(/it declares both time and an analogy and says only 1 thing .* so neither goes unstated/);
    expect(() => read(`data-differs-time="30" data-differs-scale="${SCALE}" data-differs-analogy="${ANALOGY}" data-differs-shown="A | B"`)).toThrow(/it declares time, scale and an analogy and says only 2 thing .* so none goes unstated/);
    expect(read(`data-differs-analogy="${ANALOGY}" data-differs-shown="false" data-differs-said="stand in for"`)).toEqual({analogy: ANALOGY, shown: [], said: ['stand in for']});
  });
  it('does not take a number in the analogy for a wrong time', () => {
    expect(read('data-differs-time="30" data-differs-analogy="2 dogs stand in for 2 nuclei"').shown).toEqual([TIME, 'An analogy: 2 dogs stand in for 2 nuclei']);
    expect(() => read('data-differs-time="30" data-differs-analogy="a shop" data-differs-shown="Time shown 40 times faster | A shop"')).toThrow(/says 40 where data-differs-time says 30/);
  });
  it('fits the label it goes on, words first', () => {
    const room = DIFFERS_MOST - 'An analogy: '.length;
    expect(read(`data-differs-analogy="${'x'.repeat(room)}"`).shown[0]).toHaveLength(DIFFERS_MOST);
    expect(() => read(`data-differs-analogy="${'x'.repeat(room + 1)}"`)).toThrow(new RegExp(`more than its label can hold in a glance \\(${room}`));
    expect(() => read('data-differs-analogy="  "')).toThrow(/data-differs-analogy is empty/);
  });
  it('has English default words, so a deck in another language gives its own', () => {
    const part = (attrs) => compiled(plain(attrs, 'Hier'), {lang: 'de'});
    expect(() => part(`data-differs-analogy="${ANALOGY}"`)).toThrow(/"An analogy: people stand in for the services" is English and the deck is in "de"/);
    expect(part(`data-differs-analogy="${ANALOGY}" data-differs-shown="Eine Analogie: Menschen stehen für die Dienste"`).clicks[0].differs.shown).toEqual(['Eine Analogie: Menschen stehen für die Dienste']);
  });
  it('is held to the notes when it names a phrase, as any statement is', () => {
    const problems = checkDeck(compiled(plain(`data-differs-analogy="${ANALOGY}" data-differs-said="stand in"`, 'Nothing about it here.')));
    expect(rules(problems)).toHaveLength(1);
  });
});

describe('readDiffers', () => {
  it('reads a declaration, the labels from it unless it gives its own', () => {
    expect(read('')).toBeNull();
    expect(read(`data-label="P" data-differs-time="30" data-differs-scale="${SCALE}"`)).toEqual({time: 30, scale: SCALE, shown: [TIME, SCALE]});
    expect(read('data-differs-time="0.04"').shown).toEqual(['Time shown 25 times slower']);
    expect(timeWords(1.5)).toBe('Time shown 1.5 times faster');
    expect(read('data-differs-time="30" data-differs-shown="Zeit 30-mal schneller | Nicht maßstäblich" data-differs-said="thirty"').shown).toEqual(['Zeit 30-mal schneller', 'Nicht maßstäblich']);
    expect(read('data-differs-scale="Not to scale" data-differs-shown="false" data-differs-said="not to scale"')).toEqual({scale: 'Not to scale', shown: [], said: ['not to scale']});
  });

  it('refuses what is not one, naming the fix', () => {
    expect(() => read('data-differs="30"')).toThrow(/"P": data-differs is not a way to say how a part differs — the attributes are data-differs-time, /);
    expect(() => read('data-differs-speed="30"')).toThrow(/data-differs-speed is not a way/);
    expect(() => read('data-differs-time="1"')).toThrow(/1 is real time, so leave it out/);
    expect(() => read('data-differs-time="fast"')).toThrow(/how many times faster the picture runs/);
    expect(() => read('data-differs-time=""')).toThrow(/how many times faster the picture runs/);
    expect(() => read('data-differs-said="thirty"')).toThrow(/say how the part differs: data-differs-time .* or more than one/);
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

  // The same table as StoryReel's test/differs.test.mjs: a deck and a film find a phrase alike.
  it.each([
    ['thirty times faster', 'Here it runs Thirty  times faster.', true],
    ['thirty times faster', 'Here it runs thirty times, faster.', true],
    ['thirty times faster', 'faster, thirty times', false],
    ['ten times', 'often times it runs', false],
    ['fast', 'breakfast is served', false],
    ['break', 'breakfast is served', false],
    ['times faster', 'thirty-times faster', false],
    ['thirty-times', 'thirty times faster', true],
    ['thirty times', 'thirty-times faster', true],
    ['R&D runs', 'The R&D runs here', true],
    ['...', 'anything at all', false],
  ])('"%s" in "%s": %s', (phrase, notes, found) => {
    expect(saidInNotes(phrase, notes)).toBe(found);
  });

  // The same limits as StoryReel's.
  it('takes a time factor a label can say', () => {
    for (const time of ['1', '1.001', '1.004', '.999', '.996']) expect(() => read(`data-differs-time="${time}"`)).toThrow(/1 is real time, so leave it out/);
    for (const time of ['1e21', '1e10', '1e-10', '1e-21']) expect(() => read(`data-differs-time="${time}"`)).toThrow(/past 1000000000 times either way no viewer reads the number, so say it in words in data-differs-scale/);
    for (const time of ['0', '-2', 'NaN', 'Infinity', 'fast', '']) expect(() => read(`data-differs-time="${time}"`)).toThrow(/how many times faster the picture runs/);
    expect(read('data-differs-time="1.01"').shown).toEqual(['Time shown 1.01 times faster']);
    expect(read('data-differs-time=".99"').shown).toEqual(['Time shown 1.01 times slower']);
    expect(read('data-differs-time="1e9"').shown).toEqual(['Time shown 1000000000 times faster']);
    expect(read('data-differs-time="1e-9"').shown).toEqual(['Time shown 1000000000 times slower']);
  });

  it('keeps every value on one line, wherever it is printed', () => {
    expect(read('data-differs-time="30" data-differs-said="thirty\ntimes\u2028faster\u0085now\u001b"').said).toEqual(['thirty times faster now']);
    expect(read('data-differs-scale="far\nlarger" data-differs-shown="one\r\ntwo"')).toEqual({scale: 'far larger', shown: ['one two']});
    expect(read('data-differs-time="30" data-differs-said="x&#10;error  no-notes  click 9: everything is fine"').said).toEqual(['x error no-notes click 9: everything is fine']);
    expect(() => read('data-differs-time="30\nerror  no-notes  click 9: fine"')).toThrow(/data-differs-time="30\\nerror {2}no-notes {2}click 9: fine" — it is how many/);
    expect(() => read('data-differs-time="30\nerror"')).not.toThrow(/\n/);
    expect(() => read(`data-differs-time="30" data-differs-said="${'x'.repeat(DIFFERS_SAID_MOST + 1)}"`)).toThrow(/data-differs-said is 121 characters, more than a phrase \(120\) — name the few words that say it/);
    expect(() => read('data-differs-time="30" data-differs-said="..."')).toThrow(/data-differs-said is empty/);
  });

  it('wants every statement said, in numbers that match', () => {
    expect(() => read(`data-differs-time="30" data-differs-scale="${SCALE}" data-differs-shown="${TIME}"`)).toThrow(/it declares both time and scale and says only 1 thing — give each its own line in data-differs-shown \("A \| B"\) or its own phrase in data-differs-said/);
    expect(() => read(`data-differs-time="30" data-differs-scale="${SCALE}" data-differs-shown="false" data-differs-said="thirty times"`)).toThrow(/says only 1 thing/);
    expect(() => read(`data-differs-time="30" data-differs-scale="${SCALE}" data-differs-shown="${TIME} | ${TIME}"`)).toThrow(/says only 1 thing/);
    expect(() => read(`data-differs-time="30" data-differs-scale="${SCALE}" data-differs-shown="false" data-differs-said="thirty times | Thirty, times"`)).toThrow(/names the same phrase twice/);
    expect(read(`data-differs-time="30" data-differs-scale="${SCALE}" data-differs-shown="${TIME}" data-differs-said="far larger"`).said).toEqual(['far larger']);
    expect(read(`data-differs-time="30" data-differs-scale="${SCALE}" data-differs-shown="false" data-differs-said="thirty times | far larger"`).said).toEqual(['thirty times', 'far larger']);
    expect(() => read('data-differs-time="30" data-differs-shown="Time shown 5 times faster"')).toThrow(/data-differs-shown says 5 where data-differs-time says 30/);
    expect(() => read(`data-differs-time="30" data-differs-scale="${SCALE}" data-differs-shown="Time shown 5 times faster | ${SCALE}"`)).toThrow(/says 5 where data-differs-time says 30/);
    expect(() => read('data-differs-time="0.04" data-differs-shown="Time shown 30 times slower"')).toThrow(/says 30 where data-differs-time says 0\.04/);
    expect(read('data-differs-time="30" data-differs-scale="Drawn 1000 times larger" data-differs-shown="Zeit 30-mal schneller | Drawn 1000 times larger"').shown).toHaveLength(2);
    expect(read('data-differs-time="1.5" data-differs-shown="Zeit 1,5-mal schneller"').shown).toHaveLength(1);
    expect(read('data-differs-time="0.04" data-differs-shown="25 times slower"').shown).toHaveLength(1);
    expect(read('data-differs-time="30" data-differs-shown="H2O runs fast"').shown).toHaveLength(1);
  });

  it('reads a value as a browser does, once, and draws it so', () => {
    expect(read('data-differs-scale="A &amp; B"').scale).toBe('A & B');
    expect(read('data-differs-scale="It&#39;s larger"').shown).toEqual(["It's larger"]);
    expect(read('data-differs-scale="a &amp;amp; b"').scale).toBe('a &amp; b');
    expect(differsHtml(read('data-differs-scale="A &amp; B"'))).toBe('<div class="differs" data-chrome><span>A &amp; B</span></div>');
    expect(read('data-differs-scale="drawn 10x &gt; real"').scale).toBe('drawn 10x > real');
    expect(read('data-differs-scale="A &#124; B"').shown).toEqual(['A | B']);
    expect(read('data-differs-time="30" data-differs-shown="x &#124; 30 | y"').shown).toEqual(['x | 30', 'y']);
  });

  it('reads shown="false" however it is written', () => {
    for (const shown of ['false', ' false', 'False', 'FALSE ']) expect(read(`data-differs-scale="Not to scale" data-differs-shown="${shown}" data-differs-said="not to scale"`).shown).toEqual([]);
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

  it('a deck that declares nothing is as it was: nothing of this in the whole built page', () => {
    const deck = compiled(plain(''));
    expect(deck.slides[0].html).not.toContain('differs');
    expect('differs' in deck.clicks[0]).toBe(false);
    expect(pageAssets().css.join('\n')).not.toContain('differs');
    expect(deckPage(deck, pageAssets())).not.toMatch(/differs/);
    const voiceOnly = deckPage(compiled(plain('data-differs-time="30" data-differs-shown="false" data-differs-said="thirty times faster"')), pageAssets());
    expect(voiceOnly).toBe(deckPage(deck, pageAssets()));
    const starter = deckPage(compileDeck(readDeck(tempDeck())), pageAssets());
    expect(starter).not.toMatch(/differs/);
    cleanDecks();
  });

  it('a deck that shows a label carries its look, and that and the label are all it adds to the page', () => {
    const page = deckPage(compiled(plain('data-differs-time="30"')), pageAssets()), label = `<div class="differs" data-chrome><span>${TIME}</span></div>`;
    expect(page).toContain(label);
    expect(page).toContain(':where(.differs) { position: absolute; right: 110px; top: 44px;');
    expect(page.replace(label, '').replace(`${DIFFERS_CSS}\n`, '')).toBe(deckPage(compiled(plain('')), pageAssets()));
    // before the deck's own theme, so its rules win
    const themed = deckPage({...compiled(plain('data-differs-time="30"')), themeCss: '.mine {}'}, pageAssets());
    expect(themed.indexOf(DIFFERS_CSS)).toBeLessThan(themed.indexOf('.mine {}'));
  });

  it('a value that a ">" cuts short is refused, not lost, wherever it stands', () => {
    expect(() => parseClicks('<section data-label="P" data-differs-time="30" data-differs-scale="drawn 10x > real"><p>A plug</p></section>')).toThrow(/"P": a ">" inside an attribute's value ends the tag, so its data-differs-\* cannot be read — write &gt; for it/);
    expect(() => parseClicks('<section data-label="P" data-kicker="a > b" data-differs-time="30"><p>A plug</p></section>')).toThrow(/"P": a ">" inside an attribute's value/);
    expect(parseClicks('<section data-label="P" data-differs-scale="drawn 10x &gt; real"><p>A plug</p></section>')[0].differs.scale).toBe('drawn 10x > real');
    // a part that declares nothing is read as it was, even so
    expect(parseClicks('<section data-label="P" data-kicker="a > b"><p>A plug</p></section>')[0].differs).toBeNull();
  });

  it('a <step> cannot declare: refused, naming the <section>', () => {
    const steps = (attrs) => `<section data-label="M" data-map="map"><step data-in="a" ${attrs}><h2>All</h2></step></section>`;
    expect(() => parseClicks(steps('data-differs-time="30"'))).toThrow(/"M" click 1: a <step> cannot say how it differs — put data-differs-\* on its <section>/);
    expect(() => parseClicks(steps('DATA-DIFFERS-SCALE="x"'))).toThrow(/a <step> cannot say how it differs/);
    expect(() => parseClicks(steps('data-differs-scale="a > b"'))).toThrow(/a <step> cannot say how it differs/);
    expect(parseClicks(steps('data-note="data-differs"'))[0].steps).toHaveLength(1);
  });

  it('a deck in another language gives its own words', () => {
    expect(() => compiled(plain('data-differs-time="30"'), {lang: 'de'})).toThrow(/"P": "Time shown 30 times faster" is English and the deck is in "de" — give the words in its language \(data-differs-shown\), or "false" for the notes alone/);
    expect(compiled(plain('data-differs-time="30" data-differs-shown="Zeit 30-mal schneller"'), {lang: 'de'}).clicks[0].differs.shown).toEqual(['Zeit 30-mal schneller']);
    expect(compiled(plain('data-differs-time="30" data-differs-shown="false" data-differs-said="thirty times faster"'), {lang: 'de'}).clicks[0].differs.shown).toEqual([]);
    expect(compiled(plain(`data-differs-scale="${SCALE}"`), {lang: 'de'}).clicks[0].differs.shown).toEqual([SCALE]);
    expect(compiled(plain('data-differs-time="30"'), {lang: 'en-GB'}).clicks[0].differs.shown).toEqual([TIME]);
  });

  it('check: a phrase its notes hold passes, on any click of the part, tags aside; one they do not is an error, once', () => {
    expect(rules(checkDeck(compiled(plain('data-differs-time="30" data-differs-said="thirty times faster"', 'It runs <b>thirty</b> times faster.'))))).toEqual([]);
    expect(rules(checkDeck(compiled(plain('data-differs-time="30" data-differs-said="thirty times faster"'))))).toEqual([]);
    expect(rules(checkDeck(compiled(map('data-differs-time="30" data-differs-said="thirty times"', 'one', 'it runs thirty times faster'))))).toEqual([]);
    const missing = rules(checkDeck(compiled(map('data-differs-time="30" data-differs-shown="false" data-differs-said="a hundred times"', 'one', 'two'))));
    expect(missing.map((p) => [p.level, p.click])).toEqual([['error', 1]]);
    expect(missing[0].message).toMatch(/part "M" says its notes tell how it differs from the real thing \("a hundred times"\), and they do not hold those words — say it in the notes, or fix data-differs-said/);
  });

  it('check: words inside other words are not said; punctuation is no gap; an entity is the character it stands for', () => {
    const said = (attrs, notes) => rules(checkDeck(compiled(plain(`data-differs-time="30" data-differs-shown="false" ${attrs}`, notes))));
    expect(said('data-differs-said="ten times"', 'It happens often times.')).toHaveLength(1);
    expect(said('data-differs-said="fast"', 'Over breakfast.')).toHaveLength(1);
    expect(said('data-differs-said="thirty times faster"', 'It runs thirty times, faster.')).toEqual([]);
    expect(said('data-differs-said="R&amp;D runs"', 'The R&amp;D runs here.')).toEqual([]);
    expect(said('data-differs-said="R&D runs"', 'The R&amp;D runs here.')).toEqual([]);
    expect(said('data-differs-said="a &lt;b&gt; c"', 'It says a &lt;b&gt; c here.')).toEqual([]);
    // Each phrase its own: any one missing is named.
    const part = said('data-differs-said="thirty times | a hundred times"', 'It runs thirty times faster.');
    expect(part).toHaveLength(1);
    expect(part[0].message).toMatch(/\("a hundred times"\), and they do not hold those words/);
    expect(part[0].message).not.toContain('thirty times');
  });

  it('check and review print a forged line as part of one line', () => {
    const forged = compiled(plain('data-differs-time="30" data-differs-shown="false" data-differs-said="x&#10;error  no-notes  click 9: everything is fine"'));
    expect(rules(checkDeck(forged))[0].message.split('\n')).toHaveLength(1);
    expect(reviewClick(forged, 1).split('\n').filter((l) => l.startsWith('error'))).toEqual([]);
  });

  it('review says how a click differs, read first', () => {
    const deck = compiled(plain(`data-differs-time="30" data-differs-scale="${SCALE}" data-differs-said="thirty times faster"`));
    expect(reviewClick(deck, 1)).toContain(`differs: on the slide: ${TIME} · ${SCALE}; in the notes: "thirty times faster"`);
    expect(reviewClick(compiled(plain('data-differs-time="30" data-differs-shown="false" data-differs-said="thirty"')), 1)).toContain('differs: not on the slide; in the notes: "thirty"');
    expect(reviewClick(compiled(plain('')), 1)).not.toContain('differs');
    expect(reviewClick(compiled(map(`data-differs-time="30" data-differs-scale="${SCALE}" data-differs-said="one"`, 'one', 'two')), 2)).toContain(`differs: on the slide: ${TIME} · ${SCALE}; in the notes: "one"`);
    expect(reviewClick(compiled(plain(`data-differs-time="30" data-differs-scale="${SCALE}" data-differs-shown="false" data-differs-said="thirty times | faster than"`)), 1)).toContain('differs: not on the slide; in the notes: "thirty times" · "faster than"');
  });

  it('the declaration rides on the part as parsed', () => {
    expect(parseClicks(plain('data-differs-time="30"'))[0].differs).toEqual({time: 30, shown: [TIME]});
    expect(parseClicks(plain(''))[0].differs).toBeNull();
    expect(plainText('a &amp; b &#124; &#x7c; &nope; &#1114112;')).toBe('a & b | | &nope; &#1114112;');
  });
});

describe('check --layout: a label and what it meets (measured in the page)', () => {
  /** A slide with a label, a kicker, a headline and a lit piece, their sizes given (jsdom lays nothing out). */
  function slideWith({text = {}, piece = {left: 900, top: 500, right: 1000, bottom: 600}, label = {left: 700, top: 22, right: 950, bottom: 50}} = {}) {
    document.body.innerHTML = `<deck-stage width="1920" height="1080"><section data-label="one">
      <div class="head" data-chrome><div class="kicker">Inside</div><h2>A headline</h2></div>
      <div class="differs" data-chrome><span>${TIME}</span></div>
      <div data-k="net" class="sd-on"><b>Net</b></div>
      <div class="foot" data-chrome><span>foot</span></div></section></deck-stage>`;
    const stage = document.querySelector('deck-stage'), slide = stage.querySelector('section'), box = (r) => ({width: r.right - r.left, height: r.bottom - r.top, ...r});
    stage.index = 0;
    slide.getBoundingClientRect = () => box({left: 0, top: 0, right: 960, bottom: 540});
    slide.querySelector('.differs span').getBoundingClientRect = () => box(label);
    slide.querySelector('[data-k="net"]').getBoundingClientRect = () => box(piece);
    const rects = new Map([...slide.querySelectorAll('.kicker, h2, .foot span')].map((el) => [el, text[el.tagName === 'H2' ? 'h2' : el.className || 'foot'] ?? []]));
    document.createRange = () => ({node: null, selectNodeContents(el) { this.node = el; }, getClientRects() { return rects.get(this.node) ?? []; }});
    return stage;
  }
  const overlaps = () => measureSlide().filter((f) => f.kind === 'differs-overlap');

  it('finds the kicker, the headline or a lit piece under the label, by where the text lies', () => {
    slideWith({text: {kicker: [{left: 25, top: 22, right: 200, bottom: 48}], h2: [{left: 25, top: 60, right: 600, bottom: 90}]}});
    expect(overlaps()).toEqual([]);
    slideWith({text: {kicker: [{left: 25, top: 22, right: 800, bottom: 48}]}});
    expect(overlaps()).toEqual([{kind: 'differs-overlap', piece: '.kicker', text: 'Inside', dx: 0, dy: 0}]);
    slideWith({text: {h2: [{left: 25, top: 40, right: 800, bottom: 90}]}});
    expect(overlaps()).toEqual([{kind: 'differs-overlap', piece: 'h2', text: 'A headline', dx: 0, dy: 0}]);
    slideWith({piece: {left: 900, top: 30, right: 1000, bottom: 100}});
    expect(overlaps()).toEqual([{kind: 'differs-overlap', piece: 'net', text: 'Net', dx: 0, dy: 0}]);
    slideWith({text: {foot: [{left: 700, top: 22, right: 950, bottom: 50}]}});
    expect(overlaps()).toEqual([]);
  });

  it('looks only where a label is, and says it as a problem', () => {
    slideWith({piece: {left: 900, top: 30, right: 1000, bottom: 100}});
    document.querySelector('.differs').remove();
    expect(overlaps()).toEqual([]);
    expect(layoutProblems([{n: 1, kind: 'differs-overlap', piece: '.kicker', text: 'Inside', dx: 0, dy: 0}], [{label: 'C1'}])).toEqual([
      {level: 'warn', rule: 'differs-overlap', click: 1, label: 'C1', message: 'the label on how this part differs meets ".kicker" ("Inside"), and one hides the other — shorten the label, or move ".kicker" clear of the top right'},
    ]);
  });
});
