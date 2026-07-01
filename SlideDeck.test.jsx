import { describe, it, expect } from 'vitest';
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

  it('loads deck-stage.js from the provided base path', () => {
    renderDeck();
    const sc = document.querySelector('script[data-deck-stage]');
    expect(sc.getAttribute('src')).toBe('/blog/deck-stage.js');
  });
});
