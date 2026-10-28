import {describe, it, expect, afterEach, vi} from 'vitest';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {CSS_TRANSITIONS, readEnter, transitionKeyframes, transitionTable, transitionData, transitionRuntime, enterText, TRANSITION_CSS} from './transitions.js';
import {compileDeck} from './compile.js';
import {deckPage} from './page.js';
import {pageAssets} from './assets.js';
import {reviewClick} from './review.js';
import {sourceOf} from './test/helpers.js';

const enter = (type, given = {}) => readEnter({type, given}, 'part "P"');

describe('readEnter', () => {
  it('reads a part\'s entrance against the shared table: its settings, their defaults, its length and ease', () => {
    expect(enter('push')).toEqual({type: 'push', seconds: 0.7, ease: 'inOut', p: {from: 'right'}});
    expect(enter('push', {from: 'left', seconds: '1.2', ease: 'outCubic'})).toEqual({type: 'push', seconds: 1.2, ease: 'outCubic', p: {from: 'left'}});
    expect(enter('iris')).toEqual({type: 'iris', seconds: 0.8, ease: 'inOut', p: {at: [960, 540]}});   // "centre": the slide's middle
    expect(enter('iris', {at: '100, 200'}).p.at).toEqual([100, 200]);
    expect(readEnter({type: 'zoom', given: {at: 'centre'}}, 'x', {frame: [1600, 900]}).p.at).toEqual([800, 450]);
    expect(enter('dip').p.color).toBe('#000000');
    expect(readEnter(null, 'x')).toBeNull();
  });

  it('refuses a change a page cannot play, one it does not know, a setting it does not take, and a value out of range', () => {
    expect(() => enter('clock')).toThrow('part "P": data-enter="clock" — a page cannot play it (it needs a canvas, as StoryReel draws it); a part arrives by cut, fade, dip, wipe, split, iris, push, slide, whip, zoom');
    expect(() => enter('slam')).toThrow('part "P": data-enter="slam" — a part arrives by cut, fade');
    expect(() => enter('push', {side: 'left'})).toThrow('part "P": data-enter="push" takes data-enter-seconds, data-enter-ease, data-enter-from — not data-enter-side');
    expect(() => enter('push', {constructor: 'x'})).toThrow(/not data-enter-constructor/);
    expect(() => enter('fade', {seconds: 'slow'})).toThrow('part "P": data-enter="fade": data-enter-seconds is a number of seconds, not "slow"');
    expect(() => enter('iris', {at: '100'})).toThrow('data-enter-at is a point, "x y" in slide px (or "centre"), not "100"');
    expect(() => enter('push', {from: 'up'})).toThrow(/from must be left, right, top, bottom/);
    expect(() => enter('fade', {seconds: '9'})).toThrow(/seconds must be between 0.2 and 4/);
  });

  it('says a part\'s entrance in words, for review', () => {
    expect(enterText(enter('push', {from: 'left'}))).toBe('push from left, 0.7 s');
    expect(enterText(enter('iris', {at: '10 20'}))).toBe('iris at 10 20, 0.8 s');
    expect(enterText(enter('fade'))).toBe('fade, 0.8 s');
  });
});

describe('transitionKeyframes', () => {
  it('samples both slides 30 times a second, from as they were to as they rest, the one drawn over named', () => {
    const k = transitionKeyframes(enter('push'), [1920, 1080]);
    expect(k.leaving).toHaveLength(Math.ceil(0.7 * 30) + 1);
    expect(k.arriving[0].transform).toBe('translate(100%, 0%) scale(1)');
    expect(k.arriving.at(-1)).toEqual({offset: 1, opacity: 1, transform: 'translate(0%, 0%) scale(1)', filter: 'blur(0px)'});
    expect(k.leaving.at(-1).transform).toBe('translate(-100%, 0%) scale(1)');
    expect(k).toMatchObject({type: 'push', on: 'arriving', backdrop: null, options: {duration: 700, easing: 'linear', fill: 'both'}});
    expect(transitionKeyframes(enter('zoom'), [1920, 1080]).on).toBe('leaving');
    expect(transitionKeyframes(enter('dip', {color: '#123456'}), [1920, 1080]).backdrop).toBe('#123456');
    expect(transitionKeyframes(enter('cut'), [1920, 1080])).toMatchObject({seconds: 0, leaving: [], arriving: []});
  });

  it('draws every change a page plays', () => {
    for (const type of CSS_TRANSITIONS) {
      const k = transitionKeyframes(enter(type), [1920, 1080]);
      expect(k.leaving.length, type).toBe(k.arriving.length);
    }
    const wipe = (from) => transitionKeyframes(enter('wipe', {from}), [1920, 1080]).arriving[0].clipPath;
    expect(['left', 'right', 'top', 'bottom'].map(wipe)).toEqual(['inset(0% 100% 0% 0%)', 'inset(0% 0% 0% 100%)', 'inset(0% 0% 100% 0%)', 'inset(100% 0% 0% 0%)']);
    expect(transitionKeyframes(enter('split', {line: 'horizontal'}), [1920, 1080]).arriving[0].clipPath).toBe('inset(50% 0% 50% 0%)');
    expect(transitionKeyframes(enter('whip', {from: 'left'}), [1920, 1080]).leaving[10].filter).toMatch(/^blur\([\d.]+px\)$/);
  });
});

describe('transitionTable', () => {
  it('samples each distinct change once and names it per slide; null when no slide makes one', () => {
    const push = enter('push'), t = transitionTable([null, push, null, enter('push'), enter('fade')], [1920, 1080]);
    expect(Object.keys(t.kinds)).toHaveLength(2);
    expect(t.enter[0]).toBeNull();
    expect(t.enter[1]).toBe(t.enter[3]);
    expect(transitionTable([null, null], [1920, 1080])).toBeNull();
    expect(transitionData({kinds: {'</script>': 1}, enter: []})).not.toContain('</script>"');
  });
});

describe('in a deck', () => {
  const clicks = `<section data-label="Title"><h1>Hi</h1></section>
<section data-label="M" data-map="map" data-enter="wipe" data-enter-from="top"><step data-in="a"><h2>A</h2></step><step data-in="b"><h2>B</h2></step></section>
<section data-label="End" data-enter="fade"><p>Bye</p></section>`;
  const compiled = compileDeck(sourceOf({clicks}));

  it('a part arrives on its first click only', () => {
    expect(compiled.clicks.map((c) => c.enter?.type ?? null)).toEqual([null, 'wipe', null, 'fade']);
    expect(compiled.transitions.enter.map(Boolean)).toEqual([false, true, false, true]);
  });

  it('review says how a part arrives', () => {
    expect(reviewClick(compiled, 2)).toContain('\nenters by wipe from top, 0.8 s (on a forward step)\n');
    expect(reviewClick(compiled, 4)).toContain('\nenters by fade, 0.8 s (on a forward step)\n');
    expect(reviewClick(compiled, 3)).not.toContain('enters by');
  });

  it('names the part when its entrance is refused', () => {
    expect(() => compileDeck(sourceOf({clicks: clicks.replace('data-enter="fade"', 'data-enter="page"')}))).toThrow(/^"End": data-enter="page" — a page cannot play it/);
  });

  it('the page carries the changes, the rule that keeps the leaving slide in view and the runtime — only when a part has one', () => {
    const on = deckPage(compiled, pageAssets()), off = deckPage(compileDeck(sourceOf({clicks: clicks.replace(/ data-enter(-from)?="[^"]*"/g, '')})), pageAssets());
    expect(on).toContain(TRANSITION_CSS);
    expect(on).toContain('<script type="application/json" id="deck-transitions">');
    expect(on).toContain('transitionRuntime');
    expect(off).not.toMatch(/deck-transitions|data-sd-leaving|transitionRuntime/);
  });

  it('deck-stage paints what shows behind the slides with --deck-canvas, white by default', () => {
    expect(readFileSync(path.join(process.cwd(), 'site/public/deck-stage.js'), 'utf8')).toContain('background: var(--deck-canvas, #fff);');
  });
});

describe('transitionRuntime (in the page)', () => {
  afterEach(() => { document.body.innerHTML = ''; delete window.matchMedia; });

  /** Four slides (the third skipped), slides 1 and 3 make an entrance; animate() recorded. */
  function page({reduce = false, motion = null} = {}) {
    window.matchMedia = () => ({matches: reduce});
    const table = transitionTable([null, enter('push'), null, enter('dip', {color: '#123456'}), enter('zoom')], [1920, 1080]);
    document.body.innerHTML = `<deck-stage${motion ? ` data-motion="${motion}"` : ''}><section></section><section></section><section data-deck-skip></section><section></section><section></section></deck-stage>${transitionData(table)}`;
    const stage = document.querySelector('deck-stage'), slides = [...stage.children], played = [];
    for (const s of slides) {
      s.animate = vi.fn((frames, options) => {
        let done;
        let fail;
        const a = {frames, options, finished: new Promise((r, x) => { done = r; fail = x; }), end: () => done()};
        a.cancel = vi.fn(() => fail(new Error('AbortError')));   // as a browser's: a cancelled animation's finished rejects,
        a.finished.catch(() => {});                                // a promise the browser marks as handled
        played.push({slide: slides.indexOf(s), a});
        return a;
      });
    }
    transitionRuntime();
    const go = (index, previousIndex) => stage.dispatchEvent(new CustomEvent('slidechange', {detail: {index, previousIndex, slide: slides[index], previousSlide: slides[previousIndex] ?? null}}));
    return {stage, slides, played, go};
  }

  it('plays a forward step\'s change: the leaving slide kept in view and under the arriving one, both animated', () => {
    const {slides, played, go} = page();
    go(1, 0);
    expect(played.map((p) => p.slide)).toEqual([0, 1]);
    expect(slides[0].hasAttribute('data-sd-leaving')).toBe(true);
    expect([slides[0].style.zIndex, slides[1].style.zIndex]).toEqual(['1', '2']);
    expect(played[1].a.options.duration).toBe(700);
  });

  it('puts everything back when the change ends, or when the next change of slide comes first', async () => {
    const {stage, slides, played, go} = page();
    go(1, 0);
    played[1].a.end();
    await Promise.resolve(); await Promise.resolve();
    expect(slides[0].hasAttribute('data-sd-leaving')).toBe(false);
    expect(played[0].a.cancel).toHaveBeenCalled();
    go(3, 1);   // over the skipped slide: still a step; the dip's colour goes behind both
    expect(stage.style.getPropertyValue('--deck-canvas')).toBe('#123456');
    go(1, 3);   // a step back: the dip is put back, and nothing plays
    expect(stage.style.getPropertyValue('--deck-canvas')).toBe('');
    expect([slides[1].style.zIndex, slides[3].style.zIndex, slides[1].hasAttribute('data-sd-leaving')]).toEqual(['', '', false]);
    expect(played).toHaveLength(4);
  });

  it('draws a zoom\'s leaving slide over the arriving one; a change that ends after a newer one began leaves the newer alone', async () => {
    const {slides, played, go} = page();
    go(1, 0);
    go(4, 3);
    expect([slides[3].style.zIndex, slides[4].style.zIndex]).toEqual(['2', '1']);
    played[1].a.end();   // the push, ended late
    await Promise.resolve(); await Promise.resolve();
    expect(slides[3].hasAttribute('data-sd-leaving')).toBe(true);
  });

  it('plays nothing on a jump, a slide that makes no entrance, an arrival that lands at once, reduced motion or motion off', () => {
    let t = page();
    t.go(3, 0);   // a jump over a slide that is shown
    t.go(2, 1);   // no entrance
    t.slides[1].setAttribute('data-deck-static', '');
    t.go(1, 0);
    expect(t.played).toHaveLength(0);
    t = page({reduce: true});
    t.go(1, 0);
    expect(t.played).toHaveLength(0);
    t = page({motion: 'off'});
    t.go(1, 0);
    expect(t.played).toHaveLength(0);
  });

  it('does nothing on a page without changes', () => {
    document.body.innerHTML = '<deck-stage></deck-stage>';
    expect(() => transitionRuntime()).not.toThrow();
  });
});
