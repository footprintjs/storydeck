import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import SlideFigure from './SlideFigure';

describe('SlideFigure', () => {
  it('mounts the slide html inside a scaled, deck-scoped, aria-hidden figure', () => {
    const { container } = render(<SlideFigure html="<section data-x>hello</section>" />);
    const fig = container.querySelector('.slide-figure.deck-scope');
    expect(fig).toBeTruthy();
    expect(fig).toHaveAttribute('aria-hidden', 'true');
    expect(container.querySelector('.slide-figure-canvas').innerHTML).toContain('hello');
  });
});
