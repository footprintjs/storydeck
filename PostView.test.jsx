import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, within, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PostView from './PostView';

const post = {
  title: 'The Flowchart Pattern', description: 'a primer', date: '2026-06-30', author: 'Sanjay',
  sections: [
    { key: 'Title', label: 'Title', heading: 'T', steps: ['<section>t</section>'], body: '' },
    { key: 's1', label: 'S1', heading: 'First point', steps: ['<section>one</section>'], body: '<p>b</p>' },
    { key: 'Close', label: 'Close', heading: 'C', steps: ['<section>c</section>'], body: '' },
  ],
  deckSteps: ['<section>t</section>', '<section>one</section>', '<section>c</section>'],
};

describe('PostView', () => {
  it('renders the article header, defaults to Read, and drops deck bookends', () => {
    render(<PostView post={post} />);
    expect(screen.getByRole('heading', { level: 1, name: 'The Flowchart Pattern' })).toBeInTheDocument();
    expect(screen.getByText('First point')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'T' })).not.toBeInTheDocument(); // Title bookend filtered
    expect(screen.getByRole('button', { name: 'Read it' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('switches to the Scroll lens', async () => {
    const { container } = render(<PostView post={post} />);
    await userEvent.click(screen.getByRole('button', { name: 'Scroll it' }));
    expect(screen.getByRole('button', { name: 'Scroll it' })).toHaveAttribute('aria-pressed', 'true');
    expect(container.querySelector('.scrolly')).toBeTruthy();
  });

  it('switches to the Watch lens (full deck, incl. bookends)', async () => {
    const { container } = render(<PostView post={post} />);
    await userEvent.click(screen.getByRole('button', { name: 'Watch it' }));
    expect(container.querySelector('.deck-shell')).toBeTruthy();
  });

  it('opens a lens directly from ?view=scrolly and can return to Read', async () => {
    window.history.replaceState({}, '', '/blog/x?view=scrolly');
    const { container } = render(<PostView post={post} />);
    expect(container.querySelector('.scrolly')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Read it' }));
    expect(window.location.search).toBe('');
    window.history.replaceState({}, '', '/');
  });

  // Watch mounts <deck-stage>, whose shadow :host is position:fixed;inset:0 — it covers the whole
  // viewport, including the header .view-toggle. Without an escape route inside the deck's own
  // stacking layer, Watch is a trap. These guard the two ways back out.
  describe('Watch mode escape routes (the mode-navigation trap)', () => {
    it('shows a floating lens dock with Read/Scroll while in Watch, and it switches lenses', async () => {
      render(<PostView post={post} />);
      await userEvent.click(screen.getByRole('button', { name: 'Watch it' }));

      const dock = screen.getByRole('group', { name: 'Switch view' });
      expect(dock).toBeTruthy();
      const readInDock = within(dock).getByRole('button', { name: 'Read' });
      await userEvent.click(readInDock);

      expect(screen.getByRole('button', { name: 'Read it' })).toHaveAttribute('aria-pressed', 'true');
      expect(screen.queryByRole('group', { name: 'Switch view' })).not.toBeInTheDocument();
    });

    it('does not render the dock in Read or Scroll modes', () => {
      render(<PostView post={post} />);
      expect(screen.queryByRole('group', { name: 'Switch view' })).not.toBeInTheDocument();
    });

    it('Esc returns to Read from Watch', async () => {
      render(<PostView post={post} />);
      await userEvent.click(screen.getByRole('button', { name: 'Watch it' }));
      expect(screen.getByRole('button', { name: 'Watch it' })).toHaveAttribute('aria-pressed', 'true');

      await userEvent.keyboard('{Escape}');

      expect(screen.getByRole('button', { name: 'Read it' })).toHaveAttribute('aria-pressed', 'true');
      expect(screen.queryByRole('group', { name: 'Switch view' })).not.toBeInTheDocument();
    });

    it('does not react to Esc outside Watch mode', async () => {
      render(<PostView post={post} />);
      await userEvent.click(screen.getByRole('button', { name: 'Scroll it' }));
      await userEvent.keyboard('{Escape}');
      expect(screen.getByRole('button', { name: 'Scroll it' })).toHaveAttribute('aria-pressed', 'true');
    });
  });

  // On narrow viewports, entering Watch takes the deck fullscreen via the Fullscreen API on the
  // .watch-stage wrapper (the dock's ancestor — a fullscreened element is the only thing the
  // browser renders, so the dock must live inside it). Where the API is missing (iPhone Safari)
  // the .is-takeover CSS fallback maximizes instead. Every exit route — Esc, dock, the system
  // gesture (fullscreenchange) — must land ONE state: not-fullscreen AND Read.
  describe('mobile fullscreen Watch (entry/exit state machine)', () => {
    let fsEl = null;
    const fire = () => document.dispatchEvent(new Event('fullscreenchange'));

    function mockViewport(narrow) {
      window.matchMedia = vi.fn(() => ({
        matches: narrow, addEventListener() {}, removeEventListener() {},
      }));
    }
    function mockFullscreenApi({ reject = false } = {}) {
      Element.prototype.requestFullscreen = vi.fn(function () {
        if (reject) return Promise.reject(new TypeError('no gesture'));
        fsEl = this; fire();
        return Promise.resolve();
      });
      document.exitFullscreen = vi.fn(() => { fsEl = null; fire(); return Promise.resolve(); });
      Object.defineProperty(document, 'fullscreenElement', { configurable: true, get: () => fsEl });
    }

    afterEach(() => {
      delete Element.prototype.requestFullscreen;
      delete Element.prototype.webkitRequestFullscreen;
      delete document.exitFullscreen;
      delete document.webkitExitFullscreen;
      delete document.fullscreenElement; // instance shadow → back to jsdom's prototype
      delete document.webkitFullscreenElement;
      delete window.matchMedia;
      fsEl = null;
      window.history.replaceState(null, '', '/');
    });

    it('entering Watch on a narrow viewport fullscreens the stage wrapper — dock and deck inside it', async () => {
      mockViewport(true);
      mockFullscreenApi();
      const { container } = render(<PostView post={post} />);
      await userEvent.click(screen.getByRole('button', { name: 'Watch it' }));

      expect(Element.prototype.requestFullscreen).toHaveBeenCalledTimes(1);
      expect(fsEl).toBe(container.querySelector('.watch-stage'));
      // the fullscreened subtree is all the browser renders — both must be descendants
      expect(fsEl.contains(screen.getByRole('group', { name: 'Switch view' }))).toBe(true);
      expect(fsEl.contains(container.querySelector('.deck-shell'))).toBe(true);
      expect(container.querySelector('.watch-stage.is-takeover')).toBeNull(); // API path, no fallback
    });

    it('does NOT auto-fullscreen on a wide viewport (desktop unchanged by default)', async () => {
      mockViewport(false);
      mockFullscreenApi();
      const { container } = render(<PostView post={post} />);
      await userEvent.click(screen.getByRole('button', { name: 'Watch it' }));
      expect(Element.prototype.requestFullscreen).not.toHaveBeenCalled();
      expect(container.querySelector('.watch-stage.is-takeover')).toBeNull();
    });

    it('Esc leaves fullscreen AND returns to Read in one action', async () => {
      mockViewport(true);
      mockFullscreenApi();
      render(<PostView post={post} />);
      await userEvent.click(screen.getByRole('button', { name: 'Watch it' }));
      expect(fsEl).not.toBeNull();

      await userEvent.keyboard('{Escape}');

      expect(document.exitFullscreen).toHaveBeenCalled();
      expect(fsEl).toBeNull();
      expect(screen.getByRole('button', { name: 'Read it' })).toHaveAttribute('aria-pressed', 'true');
    });

    it('a dock exit also tears fullscreen down with the lens switch (never two stranded states)', async () => {
      mockViewport(true);
      mockFullscreenApi();
      render(<PostView post={post} />);
      await userEvent.click(screen.getByRole('button', { name: 'Watch it' }));

      const dock = screen.getByRole('group', { name: 'Switch view' });
      await userEvent.click(within(dock).getByRole('button', { name: 'Read' }));

      expect(document.exitFullscreen).toHaveBeenCalled();
      expect(fsEl).toBeNull();
      expect(screen.getByRole('button', { name: 'Read it' })).toHaveAttribute('aria-pressed', 'true');
    });

    it('a system-gesture fullscreen exit (fullscreenchange) folds Watch back to Read', async () => {
      mockViewport(true);
      mockFullscreenApi();
      render(<PostView post={post} />);
      await userEvent.click(screen.getByRole('button', { name: 'Watch it' }));
      expect(fsEl).not.toBeNull();

      // the browser exited on its own (swipe/back gesture) — no exitFullscreen() call from us
      await act(async () => { fsEl = null; fire(); });

      expect(screen.getByRole('button', { name: 'Read it' })).toHaveAttribute('aria-pressed', 'true');
      expect(screen.queryByRole('group', { name: 'Switch view' })).not.toBeInTheDocument();
    });

    it('falls back to the .is-takeover maximization when the API is missing (iPhone Safari), and exits cleanly', async () => {
      mockViewport(true); // no mockFullscreenApi — jsdom has no requestFullscreen
      const { container } = render(<PostView post={post} />);
      await userEvent.click(screen.getByRole('button', { name: 'Watch it' }));

      const stage = container.querySelector('.watch-stage.is-takeover');
      expect(stage).toBeTruthy();
      expect(stage.contains(screen.getByRole('group', { name: 'Switch view' }))).toBe(true);

      await userEvent.keyboard('{Escape}');
      expect(container.querySelector('.watch-stage.is-takeover')).toBeNull();
      expect(screen.getByRole('button', { name: 'Read it' })).toHaveAttribute('aria-pressed', 'true');
    });

    it('falls back to takeover when the request rejects (?view=slides deep link has no gesture)', async () => {
      mockViewport(true);
      mockFullscreenApi({ reject: true });
      window.history.replaceState({}, '', '/blog/x?view=slides');
      const { container } = render(<PostView post={post} />);

      await act(async () => {}); // let the rejected promise's catch land
      expect(container.querySelector('.watch-stage.is-takeover')).toBeTruthy();
    });

    it('uses the webkit-prefixed API when that is all the browser has (iPad Safari)', async () => {
      mockViewport(true);
      Element.prototype.webkitRequestFullscreen = vi.fn(function () { fsEl = this; fire(); });
      document.webkitExitFullscreen = vi.fn(() => { fsEl = null; fire(); });
      Object.defineProperty(document, 'webkitFullscreenElement', { configurable: true, get: () => fsEl });
      render(<PostView post={post} />);

      await userEvent.click(screen.getByRole('button', { name: 'Watch it' }));
      expect(Element.prototype.webkitRequestFullscreen).toHaveBeenCalledTimes(1);

      await userEvent.keyboard('{Escape}');
      expect(document.webkitExitFullscreen).toHaveBeenCalled();
      expect(screen.getByRole('button', { name: 'Read it' })).toHaveAttribute('aria-pressed', 'true');
    });

    it('a promise-less webkit request that silently fails still lands the takeover fallback', async () => {
      mockViewport(true);
      Element.prototype.webkitRequestFullscreen = vi.fn(() => undefined); // legacy API, denied: no promise, no fullscreenchange
      const { container } = render(<PostView post={post} />);
      await userEvent.click(screen.getByRole('button', { name: 'Watch it' }));

      expect(container.querySelector('.watch-stage.is-takeover')).toBeNull(); // not yet — the confirm window
      await act(async () => { await new Promise((r) => setTimeout(r, 600)); });
      expect(container.querySelector('.watch-stage.is-takeover')).toBeTruthy();
    });

    it('desktop dock toggle: manual fullscreen exit stays IN Watch (only the auto flow folds to Read)', async () => {
      mockViewport(false);
      mockFullscreenApi();
      render(<PostView post={post} />);
      await userEvent.click(screen.getByRole('button', { name: 'Watch it' }));
      expect(fsEl).toBeNull(); // wide viewport: no auto request

      await userEvent.click(screen.getByRole('button', { name: 'Toggle fullscreen' }));
      expect(fsEl).not.toBeNull();

      // system exit of a MANUAL fullscreen: stay in Watch (desktop semantics unchanged)
      await act(async () => { fsEl = null; fire(); });
      expect(screen.getByRole('button', { name: 'Watch it' })).toHaveAttribute('aria-pressed', 'true');

      // toggle again then exit via the button
      await userEvent.click(screen.getByRole('button', { name: 'Toggle fullscreen' }));
      expect(fsEl).not.toBeNull();
      await userEvent.click(screen.getByRole('button', { name: 'Toggle fullscreen' }));
      expect(document.exitFullscreen).toHaveBeenCalled();
      expect(fsEl).toBeNull();
      expect(screen.getByRole('button', { name: 'Watch it' })).toHaveAttribute('aria-pressed', 'true');
    });

    it('no fullscreen API and no narrow viewport: Watch behaves exactly as before', async () => {
      const { container } = render(<PostView post={post} />);
      await userEvent.click(screen.getByRole('button', { name: 'Watch it' }));
      expect(container.querySelector('.deck-shell')).toBeTruthy();
      expect(container.querySelector('.watch-stage.is-takeover')).toBeNull();
      expect(screen.queryByRole('button', { name: 'Toggle fullscreen' })).not.toBeInTheDocument();
    });
  });
});
