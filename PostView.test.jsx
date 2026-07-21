import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
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
});
