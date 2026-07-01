import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StoryDeckProvider, useBasePath } from './context';

function Show() {
  return <div>{useBasePath() || 'EMPTY'}</div>;
}

describe('StoryDeckProvider / useBasePath', () => {
  it('provides the base path to descendants', () => {
    render(<StoryDeckProvider basePath="/blog"><Show /></StoryDeckProvider>);
    expect(screen.getByText('/blog')).toBeInTheDocument();
  });
  it('defaults to empty string without a provider', () => {
    render(<Show />);
    expect(screen.getByText('EMPTY')).toBeInTheDocument();
  });
});
