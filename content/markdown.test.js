import { describe, it, expect } from 'vitest';
import { renderMarkdown, splitBodyByMarkers } from './markdown';

describe('renderMarkdown', () => {
  it('renders bold + paragraphs', () => {
    const html = renderMarkdown('Hello **world**');
    expect(html).toContain('<strong>world</strong>');
    expect(html).toContain('<p>');
  });
  it('returns empty for empty/null input', () => {
    expect(renderMarkdown('')).toBe('');
    expect(renderMarkdown(null)).toBe('');
  });
});

describe('splitBodyByMarkers', () => {
  it('splits a body by <!--section:key--> markers', () => {
    const body = '<!--section:a-->\nAlpha prose\n<!--section:b-->\nBeta prose';
    const out = splitBodyByMarkers(body);
    expect(out).toEqual({ a: 'Alpha prose', b: 'Beta prose' });
  });
  it('returns an empty map when there are no markers', () => {
    expect(splitBodyByMarkers('just text')).toEqual({});
  });
});
