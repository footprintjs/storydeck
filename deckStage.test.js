import { describe, it, expect, beforeAll, afterEach } from 'vitest';

// deck-stage.js is the standalone web component the Watch lens loads at runtime
// (site/public/deck-stage.js, mirrored byte-identically into the blog's public/).
// These tests drive the ADDITIVE-BUILD state machine (data-build="add" chains):
// chain resolution, forward/backward navigation, deep links, jumps, skips, print,
// and — most importantly — that a deck WITHOUT the attribute behaves exactly as
// before (no data-deck-under / data-deck-static ever appears).

const tick = () => new Promise((r) => setTimeout(r, 0));

function key(k) {
  window.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
}

async function mount(sectionsHtml, { hash = '' } = {}) {
  window.history.replaceState(null, '', hash ? `/${hash}` : '/');
  const el = document.createElement('deck-stage');
  el.setAttribute('no-rail', '');
  el.innerHTML = sectionsHtml;
  document.body.appendChild(el);
  await tick(); // slotchange (slide collection) is delivered async
  return el;
}

const slides = (el) => Array.from(el.querySelectorAll('section'));
const activeIndex = (el) => slides(el).findIndex((s) => s.hasAttribute('data-deck-active'));
const underIndices = (el) =>
  slides(el).map((s, i) => (s.hasAttribute('data-deck-under') ? i : -1)).filter((i) => i >= 0);
const isStatic = (el, i) => slides(el)[i].hasAttribute('data-deck-static');

// S0 ─ S1(add) ─ S2(add) │ S3 ─ S4(add)   → two chains: [0,1,2] and [3,4]
const CHAIN_DECK = `
  <section data-label="S0"><h2 data-chrome>zero</h2><div class="mark">m0</div></section>
  <section data-label="S1" data-build="add"><h2 data-chrome>one</h2><div class="mark">m1</div></section>
  <section data-label="S2" data-build="add"><h2 data-chrome>two</h2><div class="mark">m2</div></section>
  <section data-label="S3"><h2 data-chrome>three</h2></section>
  <section data-label="S4" data-build="add"><h2 data-chrome>four</h2></section>
`;

const PLAIN_DECK = `
  <section data-label="P0">a</section>
  <section data-label="P1">b</section>
  <section data-label="P2">c</section>
`;

beforeAll(async () => {
  if (typeof window.matchMedia !== 'function') {
    window.matchMedia = () => ({
      matches: false,
      addEventListener() {},
      removeEventListener() {},
      addListener() {},
      removeListener() {},
    });
  }
  await import('./site/public/deck-stage.js');
});

afterEach(() => {
  // Remove instances so their window-level key handlers can't cross tests.
  document.querySelectorAll('deck-stage').forEach((el) => el.remove());
  window.history.replaceState(null, '', '/');
});

describe('backward compatibility — a deck with no data-build attributes', () => {
  it('navigates exactly as before and never stamps build attributes', async () => {
    const el = await mount(PLAIN_DECK);
    expect(activeIndex(el)).toBe(0);
    key('ArrowRight');
    expect(activeIndex(el)).toBe(1);
    key('End');
    expect(activeIndex(el)).toBe(2);
    key('ArrowLeft');
    key('Home');
    expect(activeIndex(el)).toBe(0);
    for (const s of slides(el)) {
      expect(s.hasAttribute('data-deck-under')).toBe(false);
      expect(s.hasAttribute('data-deck-static')).toBe(false);
    }
  });

  it('still emits slidechange with the usual detail', async () => {
    const el = await mount(PLAIN_DECK);
    let seen = null;
    el.addEventListener('slidechange', (e) => { seen = e.detail; });
    key('ArrowRight');
    expect(seen.index).toBe(1);
    expect(seen.previousIndex).toBe(0);
    expect(seen.reason).toBe('keyboard');
  });
});

describe('chain resolution + forward builds', () => {
  it('forward step into an additive slide layers the chain and ANIMATES (no data-deck-static)', async () => {
    const el = await mount(CHAIN_DECK);
    key('ArrowRight'); // S0 → S1
    expect(activeIndex(el)).toBe(1);
    expect(underIndices(el)).toEqual([0]);
    expect(isStatic(el, 1)).toBe(false);
    key('ArrowRight'); // S1 → S2
    expect(activeIndex(el)).toBe(2);
    expect(underIndices(el)).toEqual([0, 1]);
    expect(isStatic(el, 2)).toBe(false);
  });

  it('a normal slide resets the canvas: no under layers on the chain base or after leaving a chain', async () => {
    const el = await mount(CHAIN_DECK);
    expect(underIndices(el)).toEqual([]); // base slide alone
    key('ArrowRight'); key('ArrowRight'); key('ArrowRight'); // → S3
    expect(activeIndex(el)).toBe(3);
    expect(underIndices(el)).toEqual([]); // fresh canvas
    key('ArrowRight'); // → S4, second chain
    expect(underIndices(el)).toEqual([3]);
    expect(isStatic(el, 4)).toBe(false);
  });

  it('programmatic next() from the predecessor is also an animated build step', async () => {
    const el = await mount(CHAIN_DECK);
    el.next();
    expect(activeIndex(el)).toBe(1);
    expect(isStatic(el, 1)).toBe(false);
  });
});

describe('backward navigation — the newest addition leaves, nothing replays', () => {
  it('back within a chain arrives INSTANTLY (data-deck-static) with the shallower composite', async () => {
    const el = await mount(CHAIN_DECK);
    key('ArrowRight'); key('ArrowRight'); // → S2
    key('ArrowLeft'); // → S1
    expect(activeIndex(el)).toBe(1);
    expect(underIndices(el)).toEqual([0]);
    expect(isStatic(el, 1)).toBe(true);
    const s2 = slides(el)[2];
    expect(s2.hasAttribute('data-deck-active')).toBe(false);
    expect(s2.hasAttribute('data-deck-under')).toBe(false);
  });

  it('back onto the chain base from its own chain is instant too', async () => {
    const el = await mount(CHAIN_DECK);
    key('ArrowRight'); // → S1
    key('ArrowLeft'); // → S0
    expect(activeIndex(el)).toBe(0);
    expect(isStatic(el, 0)).toBe(true);
    expect(underIndices(el)).toEqual([]);
  });

  it('re-advancing after a back-step animates again', async () => {
    const el = await mount(CHAIN_DECK);
    key('ArrowRight'); key('ArrowRight'); key('ArrowLeft'); // …→ S1
    key('ArrowRight'); // → S2 again, forward from predecessor
    expect(isStatic(el, 2)).toBe(false);
  });

  it('arriving backward at a plain slide from a DIFFERENT chain replays as before (no static)', async () => {
    const el = await mount(CHAIN_DECK);
    key('End'); // → S4
    key('Home'); // → S0 (not from S0’s own chain)
    expect(activeIndex(el)).toBe(0);
    expect(isStatic(el, 0)).toBe(false);
  });
});

describe('jumps and deep links — a link is a destination', () => {
  it('deep-linking into the middle of a chain shows the full composite instantly', async () => {
    const el = await mount(CHAIN_DECK, { hash: '#3' }); // 1-indexed → S2
    expect(activeIndex(el)).toBe(2);
    expect(underIndices(el)).toEqual([0, 1]);
    expect(isStatic(el, 2)).toBe(true);
  });

  it('End jumps to the last slide with its chain stacked, instantly', async () => {
    const el = await mount(CHAIN_DECK);
    key('End');
    expect(activeIndex(el)).toBe(4);
    expect(underIndices(el)).toEqual([3]);
    expect(isStatic(el, 4)).toBe(true);
  });

  it('number-key jump from outside the chain is instant', async () => {
    const el = await mount(CHAIN_DECK);
    key('End'); // → S4
    key('2'); // → S1 (additive, arrived from another chain)
    expect(activeIndex(el)).toBe(1);
    expect(underIndices(el)).toEqual([0]);
    expect(isStatic(el, 1)).toBe(true);
  });
});

describe('skips, print, and the injected stylesheet', () => {
  it('a skipped chain member is excluded from the under-stack and from prev/next', async () => {
    const el = await mount(CHAIN_DECK);
    slides(el)[1].setAttribute('data-deck-skip', '');
    key('ArrowRight'); // S0 → S2 (S1 skipped)
    expect(activeIndex(el)).toBe(2);
    expect(underIndices(el)).toEqual([0]);
    expect(isStatic(el, 2)).toBe(false); // still the forward build step
  });

  it('print clears the layering; afterprint restores it', async () => {
    const el = await mount(CHAIN_DECK, { hash: '#3' });
    window.dispatchEvent(new Event('beforeprint'));
    for (const s of slides(el)) {
      expect(s.hasAttribute('data-deck-active')).toBe(true);
      expect(s.hasAttribute('data-deck-under')).toBe(false);
      expect(s.hasAttribute('data-deck-static')).toBe(false);
    }
    window.dispatchEvent(new Event('afterprint'));
    expect(activeIndex(el)).toBe(2);
    expect(underIndices(el)).toEqual([0, 1]);
  });

  it('installs the document-level build stylesheet, scoped under deck-stage', async () => {
    await mount(CHAIN_DECK);
    const tag = document.getElementById('deck-stage-build-css');
    expect(tag).toBeTruthy();
    expect(tag.textContent).toContain('deck-stage [data-deck-under]');
    expect(tag.textContent).toContain('deck-stage [data-deck-under] [data-chrome]');
    expect(tag.textContent).toContain('data-build="add"');
    // every rule stays scoped so Read/Scrolly figures are untouched
    expect(tag.textContent).not.toMatch(/^\s*\[data-deck-under\]/m);
  });
});
