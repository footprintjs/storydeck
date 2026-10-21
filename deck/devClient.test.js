import {afterEach, beforeEach, describe, it, expect, vi} from 'vitest';
import {devClient} from './devClient.js';

/** The page as the dev server serves it: a deck on its third click, and the build number. */
function page(built = 4) {
  document.head.innerHTML = `<meta name="storydeck-dev" content="${built}">`;
  document.body.innerHTML = '<deck-stage><section data-label="One"></section><section data-label="Two"></section><section data-label="Three"></section></deck-stage>';
  const stage = document.querySelector('deck-stage');
  stage.index = 2;
  stage.goTo = vi.fn((i) => { stage.index = i; });
  stage.next = vi.fn(() => { stage.index += 1; });
  return stage;
}

/** EventSource, faked: the client's channel, and a way to send it an event. */
let channels;
class FakeEventSource {
  constructor(url) { this.url = url; this.on = {}; channels.push(this); }
  addEventListener(type, fn) { this.on[type] = fn; }
  send(type, data) { this.on[type]?.({data: JSON.stringify(data)}); }
}

beforeEach(() => {
  channels = [];
  delete window.__sdDev;
  sessionStorage.clear();
  globalThis.EventSource = FakeEventSource;
  window.requestAnimationFrame = (cb) => { cb(0); return 0; };   // a frame at once (jsdom paints none)
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  delete globalThis.EventSource;
  document.head.innerHTML = '';
});

describe('devClient', () => {
  it('shows where you are, and keeps up as you move', () => {
    const stage = page();
    devClient();
    const bar = document.querySelector('.sd-dev');
    expect(bar.getAttribute('role')).toBe('status');
    expect(bar.textContent).toContain('3 / 3 · Three');
    stage.index = 0;
    stage.dispatchEvent(new Event('slidechange'));
    expect(bar.textContent).toContain('1 / 3 · One');
    expect(channels[0].url).toBe('/__storydeck/events');
  });

  it('runs once per page', () => {
    page();
    devClient();
    devClient();
    expect(document.querySelectorAll('.sd-dev')).toHaveLength(1);
  });

  it('replays the click forward: one click back at once, then a step on', () => {
    const stage = page();
    devClient();
    document.querySelector('.sd-dev button').click();
    expect(stage.goTo).toHaveBeenCalledWith(1);
    expect(stage.next).toHaveBeenCalled();
    expect(stage.index).toBe(2);
    stage.index = 0;
    stage.goTo.mockClear();
    document.querySelector('.sd-dev button').click();   // the first click has nothing before it to come from
    expect(stage.goTo).not.toHaveBeenCalled();
  });

  it('marks a save for replay before it reloads, and replays it after the reload when replay on save is on', () => {
    vi.useFakeTimers();
    const stage = page();
    devClient();
    channels[0].send('reload', {version: 5, ms: 3});
    expect(JSON.parse(sessionStorage.getItem('storydeck-dev'))).toMatchObject({replay: true});
    // …the page loads again
    delete window.__sdDev;
    page();
    const again = document.querySelector('deck-stage');
    devClient();
    vi.advanceTimersByTime(200);
    expect(again.goTo).toHaveBeenCalledWith(1);
    expect(JSON.parse(sessionStorage.getItem('storydeck-dev')).replay).toBe(false);
    expect(stage).not.toBe(again);
  });

  it('does not replay after a reload when replay on save is off, and remembers the choice', () => {
    vi.useFakeTimers();
    page();
    devClient();
    const box = document.querySelector('.sd-dev input');
    expect(box.checked).toBe(true);
    box.checked = false;
    box.dispatchEvent(new Event('change'));
    sessionStorage.setItem('storydeck-dev', JSON.stringify({...JSON.parse(sessionStorage.getItem('storydeck-dev')), replay: true}));
    delete window.__sdDev;
    const stage = page();
    devClient();
    vi.advanceTimersByTime(200);
    expect(stage.goTo).not.toHaveBeenCalled();
    expect(document.querySelector('.sd-dev input').checked).toBe(false);
  });

  it('shows why a build stopped, as text, over the last good page — and clears it once the build is good', () => {
    page();
    devClient();
    channels[0].send('problem', {message: '"A" click 2: no piece "<img src=x onerror=alert(1)>"', version: 4});
    const box = document.querySelector('.sd-dev-problem');
    expect(box.getAttribute('role')).toBe('alert');
    expect(box.textContent).toContain('no piece "<img src=x onerror=alert(1)>"');
    expect(box.querySelector('img')).toBeNull();   // shown as text, never as markup
    expect(box.textContent).toContain('the last good build');
    channels[0].send('problem', {message: 'again', version: 4});
    expect(document.querySelectorAll('.sd-dev-problem')).toHaveLength(1);
    channels[0].send('hello', {version: 4, problem: null});
    expect(document.querySelector('.sd-dev-problem')).toBeNull();
  });

  it('on a page that never built, says to fix the file; the server\'s hello carries the reason', () => {
    document.head.innerHTML = '<meta name="storydeck-dev" content="0">';
    document.body.innerHTML = '';
    devClient();
    expect(document.querySelector('.sd-dev').textContent).toContain('no <deck-stage> on the page');
    channels[0].send('hello', {version: 0, problem: 'deck.json needs a "title"'});
    expect(document.querySelector('.sd-dev-problem').textContent).toMatch(/needs a "title"[\s\S]*the deck appears here/);
  });

  it('keeps a tap on its bar from stepping the deck, and works without storage or EventSource', () => {
    page();
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    delete globalThis.EventSource;
    devClient();
    const bar = document.querySelector('.sd-dev');
    const seen = vi.fn();
    document.body.addEventListener('click', seen);
    bar.click();
    expect(seen).not.toHaveBeenCalled();
    document.querySelector('.sd-dev input').dispatchEvent(new Event('change'));
    expect(channels).toHaveLength(0);
  });

  describe('co-editing', () => {
    /** The page with its token, a map on the active click: pieces a, "b x" and a second a, under a stage zoomed 2×. */
    function editable() {
      const stage = page();
      document.head.insertAdjacentHTML('beforeend', '<meta name="storydeck-dev-token" content="t0k3n">');
      stage.children[2].setAttribute('data-deck-active', '');
      stage.children[2].innerHTML = '<div class="map map-route"><div class="sd-stage" style="--sd-ts: 2;"><div data-k="a"></div><div data-k="b x"></div><div data-k="a"><span>in</span></div></div></div>';
      return stage;
    }
    const answer = (ok, out) => vi.fn(async () => ({ok, status: ok ? 200 : 409, json: async () => out}));
    const settle = () => new Promise((r) => setTimeout(r, 0));
    const pointer = (target, type, init) => target.dispatchEvent(new MouseEvent(type, {bubbles: true, cancelable: true, ...init}));

    it('leaves a note on this click: the page\'s token, JSON, and how many notes are open', async () => {
      editable();
      globalThis.fetch = answer(true, {ok: true, open: 2});
      vi.spyOn(window, 'prompt').mockReturnValue('Make the server wider');
      devClient();
      const note = [...document.querySelectorAll('.sd-dev button')].find((b) => b.textContent === 'note');
      note.click();
      await settle();
      expect(window.prompt).toHaveBeenCalledWith('A note on click 3');
      const [url, init] = fetch.mock.calls[0];
      expect([url, init.method, init.headers]).toEqual(['/__storydeck/feedback', 'POST', {'content-type': 'application/json', 'x-storydeck-token': 't0k3n'}]);
      expect(JSON.parse(init.body)).toEqual({click: 3, text: 'Make the server wider'});
      expect(document.querySelector('.sd-dev').textContent).toContain('noted · 2 open');
      window.prompt.mockReturnValue('  ');
      note.click();
      expect(fetch).toHaveBeenCalledTimes(1);   // no words, no note
      delete globalThis.fetch;
    });

    it('shows the server\'s reason when an edit is refused', async () => {
      editable();
      globalThis.fetch = answer(false, {error: 'the map changed since the page was built'});
      vi.spyOn(window, 'prompt').mockReturnValue('x');
      devClient();
      [...document.querySelectorAll('.sd-dev button')].find((b) => b.textContent === 'note').click();
      await settle();
      expect(document.querySelector('.sd-dev').textContent).toContain('the map changed since the page was built');
      delete globalThis.fetch;
    });

    it('Alt-drags a piece: it follows the pointer, and its move is sent in map px, by name and which of that name', async () => {
      editable();
      globalThis.fetch = answer(true, {ok: true});
      devClient();
      const second = document.querySelectorAll('[data-k="a"]')[1];
      pointer(second.firstChild, 'pointerdown', {altKey: true, clientX: 100, clientY: 100});
      expect(second.style.outline).toContain('dashed');
      pointer(second, 'pointermove', {clientX: 140, clientY: 90});
      expect([second.style.marginLeft, second.style.marginTop]).toEqual(['20px', '-5px']);   // the screen moved 40, -10 at 2×
      pointer(second, 'pointerup', {clientX: 140, clientY: 90});
      await settle();
      expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({map: 'route', name: 'a', nth: 1, dx: 20, dy: -5});
      expect([second.style.outline, second.style.marginLeft]).toEqual(['', '']);
      expect(document.querySelector('.sd-dev').textContent).toContain('moved a · 20, -5');
      delete globalThis.fetch;
    });

    it('ignores a drag without Alt, one that ends where it began, a cancelled one — and every drag on a page without its token', () => {
      const stage = editable();
      globalThis.fetch = answer(true, {ok: true});
      devClient();
      const a = stage.querySelector('[data-k="a"]');
      pointer(a, 'pointerdown', {clientX: 1, clientY: 1});
      pointer(a, 'pointerup', {clientX: 50, clientY: 1});
      pointer(a, 'pointerdown', {altKey: true, clientX: 1, clientY: 1});
      pointer(a, 'pointerup', {clientX: 1, clientY: 1});
      pointer(a, 'pointerdown', {altKey: true, clientX: 1, clientY: 1});
      pointer(a, 'pointercancel', {});
      expect(a.style.outline).toBe('');
      pointer(a, 'pointerup', {clientX: 90, clientY: 1});
      expect(fetch).not.toHaveBeenCalled();
      // a page that carries no token has no note button and no drag
      delete window.__sdDev;
      const plain = page();
      plain.children[2].setAttribute('data-deck-active', '');
      plain.children[2].innerHTML = '<div class="map map-route"><div data-k="a"></div></div>';
      devClient();
      expect([...document.querySelectorAll('.sd-dev button')].map((b) => b.textContent)).toEqual(['replay']);
      const b = plain.querySelector('[data-k="a"]');
      pointer(b, 'pointerdown', {altKey: true, clientX: 1, clientY: 1});
      expect(b.style.outline).toBe('');
      delete globalThis.fetch;
    });
  });
});
