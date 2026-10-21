import {describe, it, expect, vi} from 'vitest';
import {clickRuns, layoutProblems, layoutCheck, findChromium} from './layout.js';
import {deckStageDriver, measureSlide} from '../video.js';
import {tempDir} from './test/helpers.js';

const clicks = Array.from({length: 6}, (_, i) => ({n: i + 1, label: `C${i + 1}`}));

describe('layoutProblems', () => {
  it('writes click numbers as short runs', () => {
    expect(clickRuns([5, 1, 2, 3, 3, 9, 10])).toBe('1–3, 5, 9–10');
    expect(clickRuns([4])).toBe('4');
  });

  it('makes one problem of a finding repeated on several clicks, at its first click', () => {
    const found = [2, 3, 4, 6].map((n) => ({n, kind: 'spills', piece: 'net', text: 'Network', dx: 17.4, dy: 0}));
    found.push({n: 5, kind: 'outside', piece: null, text: 'Far', dx: 0, dy: 30});
    found.push({n: 1, kind: 'spills', piece: '.kicker', text: 'Long kicker', dx: 3, dy: 40});
    expect(layoutProblems(found, clicks)).toEqual([
      {level: 'warn', rule: 'spills', click: 1, label: 'C1', message: 'text spills out of ".kicker" by 3 px wide and 40 px tall ("Long kicker") — shorten it, or give the box more room'},
      {level: 'warn', rule: 'spills', click: 2, label: 'C2', message: 'text spills out of "net" by 17 px wide ("Network") (on clicks 2–4, 6) — shorten it, or give the box more room'},
      {level: 'warn', rule: 'outside', click: 5, label: 'C5', message: 'an element reaches 30 px tall past the slide\'s edge ("Far") — move it in, or zoom less'},
    ]);
  });
});

describe('layoutCheck', () => {
  it('measures every click through the driver, and closes it', async () => {
    const driver = {open: vi.fn(), close: vi.fn(), measure: vi.fn(async (n) => (n === 2 ? [{kind: 'spills', piece: 'a', text: 'x', dx: 9, dy: 0}] : []))};
    const problems = await layoutCheck('file:///deck.html', {clicks: clicks.slice(0, 3), driver});
    expect(driver.open).toHaveBeenCalledWith('file:///deck.html');
    expect(driver.measure.mock.calls.map(([n]) => n)).toEqual([1, 2, 3]);
    expect(driver.close).toHaveBeenCalled();
    expect(problems.map((p) => p.click)).toEqual([2]);
  });

  it('closes the browser when a click cannot be measured', async () => {
    const driver = {open: vi.fn(), close: vi.fn(), measure: vi.fn(async () => { throw new Error('gone'); })};
    await expect(layoutCheck('u', {clicks, driver})).rejects.toThrow('gone');
    expect(driver.close).toHaveBeenCalled();
  });

  it('builds the deck-stage driver from a chromium when no driver is given', async () => {
    const page = {goto: vi.fn(), waitForFunction: vi.fn(), addStyleTag: vi.fn(), evaluate: vi.fn(async (fn) => (fn === measureSlide ? [] : undefined))};
    const chromium = {launch: vi.fn(async () => ({newPage: async () => page, close: vi.fn()}))};
    expect(await layoutCheck('u', {clicks: clicks.slice(0, 2), chromium})).toEqual([]);
    expect(page.evaluate.mock.calls.filter(([fn]) => fn === measureSlide)).toHaveLength(2);
  });

  it('finds no chromium where playwright-core is not installed', async () => {
    expect(await findChromium(tempDir())).toBeNull();
  });
});

describe('measureSlide (in the page)', () => {
  /** A deck on the page: one slide shown, its sizes given (jsdom lays nothing out). */
  function page({scale = 0.5} = {}) {
    document.body.innerHTML = `<deck-stage width="1920" height="1080">
      <section data-label="one"><div data-k="net" class="sd-on" style="display:block"><b style="display:block">Network</b></div>
        <div data-k="gone" style="display:none"><b style="display:block">Hidden</b></div>
        <div class="kicker" style="display:block;font-size:26px">1 · Kicker</div>
        <svg data-k="w"><text>svg text is drawn</text></svg>
        <div data-k="far" class="sd-on" style="display:block"></div>
        <p style="display:block;overflow-x:auto">scrolls</p></section>
      <section data-label="two"></section></deck-stage>`;
    const stage = document.querySelector('deck-stage');
    stage.index = 0;
    const size = (el, {sw = 100, cw = 100, sh = 20, ch = 20} = {}) => {
      const v = (value) => ({value, configurable: true});
      Object.defineProperties(el, {scrollWidth: v(sw), clientWidth: v(cw), scrollHeight: v(sh), clientHeight: v(ch)});
    };
    const slide = stage.querySelector('section');
    slide.getBoundingClientRect = () => ({left: 0, top: 0, right: 1920 * scale, bottom: 1080 * scale, width: 1920 * scale, height: 1080 * scale});
    for (const el of slide.querySelectorAll('*')) size(el);
    size(slide.querySelector('[data-k="net"] b'), {sw: 147, cw: 130});
    size(slide.querySelector('.kicker'), {sh: 28, ch: 26});   // 2 px of glyph over a tight line: not a spill
    const far = slide.querySelector('[data-k="far"]');
    far.getBoundingClientRect = () => ({left: 900, top: 100, right: 1000 * 1, bottom: 200});   // 2000 px in slide px: past 1920
    for (const el of slide.querySelectorAll('[data-k="net"], .kicker')) el.getBoundingClientRect = () => ({left: 10, top: 10, right: 50, bottom: 30});
    return stage;
  }

  it('reports text spilling out of its box and a lit piece past the slide\'s edge, finishing animations first', () => {
    page();
    const finish = vi.fn();
    document.getAnimations = () => [{finish}, {finish: () => { throw new Error('endless'); }}];
    expect(measureSlide()).toEqual([
      {kind: 'spills', piece: 'net', text: 'Network', dx: 17, dy: 0},
      {kind: 'outside', piece: 'far', text: '', dx: 80, dy: 0},
    ]);
    expect(finish).toHaveBeenCalled();
    delete document.getAnimations;
  });

  it('measures nothing when no slide is shown', () => {
    document.body.innerHTML = '';
    expect(measureSlide()).toEqual([]);
    const stage = page();
    stage.index = 5;
    expect(measureSlide()).toEqual([]);
  });

  it('is what the driver runs after a jump to the click', async () => {
    const calls = [];
    const pg = {goto: vi.fn(), waitForFunction: vi.fn(), addStyleTag: vi.fn(), evaluate: vi.fn(async (fn, arg) => { calls.push([fn, arg]); return fn === measureSlide ? ['found'] : undefined; })};
    const driver = deckStageDriver({chromium: {launch: async () => ({newPage: async () => pg, close: vi.fn()})}, hide: []});
    await driver.open('u');
    expect(await driver.measure(4)).toEqual(['found']);
    expect(calls.find(([, arg]) => arg === 3)).toBeTruthy();   // goTo(n - 1)
  });
});
