import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
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
});
