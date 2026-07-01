import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BlogView from './BlogView';

// BlogView takes already-filtered content sections (the consumer/PostView drops bookends).
const sections = [
  {
    key: 'whiteboard', label: 'THE WHITEBOARD', heading: 'Every system begins as a drawing',
    steps: ['<section>build-a</section>', '<section>build-final</section>'], body: '<p>the prose</p>',
  },
];

describe('BlogView', () => {
  it('renders the section heading', () => {
    render(<BlogView sections={sections} />);
    expect(screen.getByRole('heading', { name: 'Every system begins as a drawing' })).toBeInTheDocument();
  });

  it('shows the FINAL step as the figure (grouping collapses to last)', () => {
    const { container } = render(<BlogView sections={sections} />);
    const canvas = container.querySelector('.slide-figure-canvas');
    expect(canvas.innerHTML).toContain('build-final');
    expect(canvas.innerHTML).not.toContain('build-a');
  });

  it('gives each section an anchor id and renders the prose', () => {
    const { container } = render(<BlogView sections={sections} />);
    expect(container.querySelector('#whiteboard')).toBeTruthy();
    expect(screen.getByText('the prose')).toBeInTheDocument();
  });

  it('copies a shareable link, then clears the indicator', () => {
    vi.useFakeTimers();
    render(<BlogView sections={sections} />);
    fireEvent.click(screen.getByLabelText(/Copy link to/));
    expect(navigator.clipboard.writeText).toHaveBeenCalled();
    expect(screen.getByText('link copied ✓')).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1700));
    expect(screen.queryByText('link copied ✓')).not.toBeInTheDocument();
    vi.useRealTimers();
  });

  it('renders a figure-only section with no prose', () => {
    const s = [{ key: 'x', label: 'X', heading: 'H', steps: ['<section>s</section>'], body: '' }];
    const { container } = render(<BlogView sections={s} />);
    expect(container.querySelector('.prose')).toBeNull();
  });
});
