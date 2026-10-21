import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  if (typeof document === 'undefined') return;   // a test file in the node environment (deck/ servers and files)
  cleanup();
  document.documentElement.className = '';
  try { localStorage.clear(); } catch (_) {}
  // SlideDeck appends this to <body> directly (outside React), so clear it between tests.
  document.querySelectorAll('script[data-deck-stage]').forEach((s) => s.remove());
  global.__iobs = [];
});

// jsdom lacks these; storydeck's figure + scrolly features use them.
global.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
// Track observers so tests can trigger intersection callbacks (jsdom never fires them itself).
global.__iobs = [];
global.IntersectionObserver = class {
  constructor(cb) { this.cb = cb; this.els = []; global.__iobs.push(this); }
  observe(el) { this.els.push(el); }
  unobserve() {}
  disconnect() {}
};

if (typeof navigator !== 'undefined' && !navigator.clipboard) {
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: vi.fn(() => Promise.resolve()) },
    configurable: true,
  });
}
