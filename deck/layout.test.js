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

describe('layoutProblems · loops', () => {
  it('an endless animation that is not a loop, shown on a click: a warning, one for all the clicks it is on', () => {
    const found = [3, 4, 5].map((n) => ({n, kind: 'loose-loop', piece: 'gear', text: '', dx: 0, dy: 0}));
    expect(layoutProblems(found, clicks)).toEqual([{level: 'warn', rule: 'loose-loop', click: 3, label: 'C3',
      message: '"gear" has an endless animation that is not a loop (on clicks 3–5): it starts again at each click and stops on a jump — give the element data-loop and its animation as --loop (or name a loop: data-loop="pulse")'}]);
  });

  it('one running on a hidden slide: an error at the slides it runs on (found from every other click), merged when the same', () => {
    const leak = (n, slide, count = 2, piece = 'a, b') => ({n, kind: 'hidden-loop', piece, text: '', dx: 0, dy: 0, slide, count});
    const found = [leak(1, 2), leak(1, 3), leak(2, 3), leak(3, 2), leak(1, 6, 1, 'c'), leak(2, 6, 1, 'c')];
    expect(layoutProblems(found, clicks)).toEqual([
      {level: 'error', rule: 'hidden-loop', click: 2, label: 'C2', message: '2 endless animations on a, b keep running while the slide is hidden (on clicks 2–3) — make each a loop (data-loop and its animation as --loop): a loop runs only on the slide shown'},
      {level: 'error', rule: 'hidden-loop', click: 6, label: 'C6', message: '1 endless animation on c keeps running while the slide is hidden — make it a loop (data-loop and its animation as --loop): a loop runs only on the slide shown'},
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

  it('closes the browser when the page never comes up', async () => {
    const driver = {open: vi.fn(async () => { throw new Error('Timeout'); }), close: vi.fn(), measure: vi.fn()};
    await expect(layoutCheck('u', {clicks, driver})).rejects.toThrow('Timeout');
    expect(driver.close).toHaveBeenCalled();
    expect(driver.measure).not.toHaveBeenCalled();
  });

  it('runs the page offline when it makes the driver: no names resolve, the context is offline and routed, WebSockets and popups closed', async () => {
    const pageEvents = {};
    const page = {goto: vi.fn(), waitForFunction: vi.fn(), addStyleTag: vi.fn(), evaluate: vi.fn(async (fn) => (fn === measureSlide ? [] : undefined))};
    const context = {route: vi.fn(), routeWebSocket: vi.fn(), newPage: vi.fn(async () => page), on: vi.fn((name, fn) => { pageEvents[name] = fn; })};
    const browser = {newContext: vi.fn(async () => context), newPage: vi.fn(), close: vi.fn()};
    const chromium = {launch: vi.fn(async () => browser)};
    expect(await layoutCheck('file:///tmp/deck/index.html', {clicks: clicks.slice(0, 2), chromium})).toEqual([]);
    expect(chromium.launch.mock.calls[0][0].args).toEqual(expect.arrayContaining(['--host-resolver-rules=MAP * ~NOTFOUND', '--force-webrtc-ip-handling-policy=disable_non_proxied_udp']));
    expect(browser.newContext).toHaveBeenCalledWith(expect.objectContaining({offline: true, serviceWorkers: 'block'}));
    expect(browser.newPage).not.toHaveBeenCalled();
    expect(context.route).toHaveBeenCalledWith('**/*', expect.any(Function));
    expect(context.routeWebSocket).toHaveBeenCalledWith(/.*/, expect.any(Function));
    expect(context.route.mock.invocationCallOrder[0]).toBeLessThan(page.goto.mock.invocationCallOrder[0]);
    const handler = context.route.mock.calls[0][1];
    const request = (url) => ({request: () => ({url: () => url}), continue: vi.fn(), abort: vi.fn()});
    for (const [url, allowed] of [['file:///tmp/deck/index.html', true], ['file:///tmp/deck/index.html#4', true], ['data:image/png;base64,x', true],
      ['file:///etc/passwd', false], ['https://example.com/x', false], ['http://169.254.169.254/', false]]) {
      const r = request(url);
      handler(r);
      expect([url, r.continue.mock.calls.length, r.abort.mock.calls.length]).toEqual([url, allowed ? 1 : 0, allowed ? 0 : 1]);
    }
    const ws = {close: vi.fn()};
    context.routeWebSocket.mock.calls[0][1](ws);
    expect(ws.close).toHaveBeenCalled();
    const popup = {close: vi.fn(async () => {})};
    pageEvents.page(popup);
    pageEvents.page(page);
    expect(popup.close).toHaveBeenCalled();
    expect(page.close).toBeUndefined();
    expect(page.evaluate.mock.calls.filter(([fn]) => fn === measureSlide)).toHaveLength(2);
  });

  it('refuses to go offline with a Playwright that cannot close WebSockets', async () => {
    const context = {route: vi.fn(), newPage: vi.fn(), on: vi.fn()};
    const chromium = {launch: async () => ({newContext: async () => context, close: vi.fn()})};
    await expect(layoutCheck('u', {clicks, chromium})).rejects.toThrow(/offline needs Playwright 1.48 or newer/);
  });

  it('finds no chromium where playwright-core is not installed beside StoryDeck', async () => {
    expect(await findChromium()).toEqual({chromium: null, why: null});
  });

  it('loads nothing when StoryDeck itself runs from inside the deck folder (that node_modules is the deck\'s)', async () => {
    const {realpathSync} = await import('node:fs');
    const {packageRoot} = await import('./assets.js');
    const around = (await import('node:path')).default.dirname(realpathSync(packageRoot()));
    expect(await findChromium({deckRoot: around})).toEqual({chromium: null, why: expect.stringMatching(/StoryDeck is running from inside the deck folder/)});
  });

  it('never loads Playwright from the folder you run in (a deck someone sent you, or the folder around it)', async () => {
    const {mkdirSync, writeFileSync, existsSync, realpathSync} = await import('node:fs');
    const path = (await import('node:path')).default;
    const deck = realpathSync(tempDir());
    const pkg = path.join(deck, 'node_modules', 'playwright-core');
    mkdirSync(pkg, {recursive: true});
    const marker = path.join(deck, 'ran.txt');
    writeFileSync(path.join(pkg, 'package.json'), '{"name":"playwright-core","main":"index.js"}');
    writeFileSync(path.join(pkg, 'index.js'), `require('fs').writeFileSync(${JSON.stringify(marker)}, 'ran'); module.exports = {chromium: {planted: true}};`);
    const before = process.cwd();
    process.chdir(deck);
    try {
      expect((await findChromium()).chromium).toBeNull();
    } finally {
      process.chdir(before);
    }
    expect(existsSync(marker)).toBe(false);
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

  it('reports an endless animation shown that is not a loop, and those running on a slide no one sees, by slide', () => {
    document.body.innerHTML = `<deck-stage width="1920" height="1080">
      <section data-deck-active><div data-k="gear" style="animation-iteration-count: 1, infinite"></div><div data-k="ok" data-loop style="animation-iteration-count: infinite"></div></section>
      <section><div data-k="a"><i></i></div><b data-k="b"></b></section>
      <section data-deck-under><div data-k="u"></div></section>
      <section><div data-k="c"></div></section></deck-stage>`;
    const stage = document.querySelector('deck-stage');
    stage.index = 0;
    const slide = stage.querySelector('section');
    slide.getBoundingClientRect = () => ({left: 0, top: 0, right: 960, bottom: 540, width: 960, height: 540});
    const on = (sel, {iterations = Infinity, playState = 'running'} = {}) => ({playState, finish() {}, effect: {target: stage.querySelector(sel), getTiming: () => ({iterations})}});
    document.getAnimations = () => [on('[data-k="a"] i'), on('[data-k="b"]'), on('[data-k="b"]', {iterations: 1}), on('[data-k="c"]', {playState: 'paused'}), on('[data-k="u"]'), on('[data-k="ok"]')];
    expect(measureSlide()).toEqual([
      {kind: 'loose-loop', piece: 'gear', text: '', dx: 0, dy: 0},
      {kind: 'hidden-loop', piece: 'a, b', text: '', dx: 0, dy: 0, slide: 2, count: 2},
    ]);
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
