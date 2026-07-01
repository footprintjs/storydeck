import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ThemeToggle from './ThemeToggle';

describe('ThemeToggle', () => {
  it('offers the opposite theme in its label and toggles on click', async () => {
    render(<ThemeToggle />);
    const btn = screen.getByRole('button');
    expect(btn).toHaveAttribute('aria-label', 'Switch to light theme'); // dark default
    await userEvent.click(btn);
    expect(document.documentElement.classList.contains('light')).toBe(true);
    expect(btn).toHaveAttribute('aria-label', 'Switch to dark theme');
  });
});
