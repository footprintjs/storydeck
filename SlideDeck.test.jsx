import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { StoryDeckProvider } from './context';
import SlideDeck from './SlideDeck';

const steps = ['<section>a</section>', '<section>b</section>', '<section>c</section>'];

function renderDeck() {
  return render(
    <StoryDeckProvider basePath="/blog">
      <SlideDeck steps={steps} />
    </StoryDeckProvider>,
  );
}

describe('SlideDeck', () => {
  it('mounts a no-rail <deck-stage> with every step, in order', () => {
    const { container } = renderDeck();
    const stage = container.querySelector('deck-stage');
    expect(stage).toBeTruthy();
    expect(stage.getAttribute('no-rail')).not.toBeNull();
    expect(stage.innerHTML).toContain('a');
    expect(stage.innerHTML).toContain('b');
    expect(stage.innerHTML).toContain('c');
  });

  it('installs the focus runtime, so only a forward click animates and apart\'s springs play', () => {
    delete window.__sdFocusRuntime;
    renderDeck();
    expect(window.__sdFocusRuntime).toBe(true);
  });

  it('loads deck-stage.js from the provided base path', () => {
    renderDeck();
    const sc = document.querySelector('script[data-deck-stage]');
    expect(sc.getAttribute('src')).toBe('/blog/deck-stage.js');
  });

  it('with a tour, the deck tours itself when left alone, through its own goTo, and lets go when it unmounts', () => {
    vi.useFakeTimers();
    try {
      const { container, unmount, rerender } = render(<StoryDeckProvider basePath="/blog"><SlideDeck steps={steps} tour="2 3" /></StoryDeckProvider>);
      const stage = container.querySelector('deck-stage');
      stage.goTo = vi.fn();
      expect(stage.getAttribute('data-tour-state')).toBe('waiting');
      vi.advanceTimersByTime(1400);
      expect(stage.goTo).toHaveBeenCalledWith(1);   // click 2, as the deck counts them
      rerender(<StoryDeckProvider basePath="/blog"><SlideDeck steps={steps} tour="2 3" /></StoryDeckProvider>);
      expect(container.querySelector('deck-stage')).toBe(stage);   // the same spec is the same tour: no remount
      unmount();
      expect(stage.hasAttribute('data-tour-state')).toBe(false);
      vi.advanceTimersByTime(60000);
      expect(stage.goTo).toHaveBeenCalledTimes(1);
    } finally { vi.useRealTimers(); }
  });

  it('without a tour, nothing tours', () => {
    const { container } = renderDeck();
    expect(container.querySelector('deck-stage').hasAttribute('data-tour-state')).toBe(false);
  });
});
