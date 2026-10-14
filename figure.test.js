import { describe, it, expect } from 'vitest';
import { isStoryFigure } from './figure';

describe('isStoryFigure', () => {
  const noop = () => {};
  it('knows a figure by its three doors', () => {
    expect(isStoryFigure({ mount: noop, seek: noop, dispose: noop })).toBe(true);
    expect(isStoryFigure(Object.assign(() => null, { mount: noop, seek: noop, dispose: noop }))).toBe(true);
  });
  it('refuses a render function, a partial figure, and nothing at all', () => {
    expect(isStoryFigure(() => null)).toBe(false);
    expect(isStoryFigure({ mount: noop, seek: noop })).toBe(false);
    expect(isStoryFigure({ mount: noop, seek: 'x', dispose: noop })).toBe(false);
    expect(isStoryFigure(null)).toBe(false);
    expect(isStoryFigure(undefined)).toBe(false);
    expect(isStoryFigure('figure')).toBe(false);
  });
});
