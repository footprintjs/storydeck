import { describe, it, expect } from 'vitest';
import { assemblePost } from './loadPost';

const deckSlides = [
  { label: 'Title', html: '<section>title</section>' },
  { label: 'A', html: '<section>a</section>' },
  { label: 'B1', html: '<section>b1</section>' },
  { label: 'B2', html: '<section>b2</section>' },
];
const meta = { slug: 'p', title: 'P', date: '2026-01-01' };
const sections = [
  { key: 'a', label: 'A', heading: 'Heading A', slides: ['A'] },
  { key: 'trace', label: 'Trace', heading: 'Heading Trace', slides: ['B1', 'B2'] }, // grouping via JSON
];
const bodyMd = '<!--section:a-->\nAlpha\n<!--section:trace-->\n**Trace** body';

describe('assemblePost', () => {
  const post = assemblePost({ meta, sections, bodyMd, deckSlides });

  it('carries meta + a full-deck deckSteps in order (for Watch)', () => {
    expect(post.slug).toBe('p');
    expect(post.deckSteps).toHaveLength(4);
    expect(post.deckSteps[0]).toContain('title');
  });

  it('resolves each section’s slides → steps by label (JSON grouping)', () => {
    expect(post.sections[0].steps).toEqual(['<section>a</section>']);
    expect(post.sections[1].steps).toEqual(['<section>b1</section>', '<section>b2</section>']);
  });

  it('renders the section body from its Markdown', () => {
    expect(post.sections[0].body).toContain('Alpha');
    expect(post.sections[1].body).toContain('<strong>Trace</strong>');
  });

  it('drops unknown slide labels and falls back for heading/body', () => {
    const p = assemblePost({ meta, sections: [{ key: 'x', slides: ['NOPE'] }], bodyMd: '', deckSlides });
    expect(p.sections[0].steps).toEqual([]);
    expect(p.sections[0].heading).toBe('x');
    expect(p.sections[0].body).toBe('');
  });
});
