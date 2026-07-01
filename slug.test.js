import { describe, it, expect } from 'vitest';
import { slugify } from './slug';

describe('slugify', () => {
  it('lowercases and hyphenates', () => {
    expect(slugify('The Whiteboard')).toBe('the-whiteboard');
  });
  it('strips punctuation (incl. curly quotes)', () => {
    expect(slugify('“Why did it do that?”')).toBe('why-did-it-do-that');
  });
  it('collapses runs of spaces and hyphens', () => {
    expect(slugify('a   b - c')).toBe('a-b-c');
  });
  it('coerces non-strings', () => {
    expect(slugify(42)).toBe('42');
  });
});
