import { describe, it, expect } from 'vitest';
import { buildSections, parseGroup, finalStep, allSteps } from './sections';

describe('parseGroup', () => {
  it('reads a data-group attribute', () => {
    expect(parseGroup('<section data-group="trace">x</section>')).toBe('trace');
  });
  it('returns null when there is no group', () => {
    expect(parseGroup('<section data-label="Intro">x</section>')).toBe(null);
  });
});

describe('buildSections — the grouping feature', () => {
  const slides = [
    { label: 'Intro', html: '<section>a</section>' },
    { label: 'Build 1', html: '<section data-group="trace">b1</section>' },
    { label: 'Build 2', html: '<section data-group="trace">b2</section>' },
    { label: 'Build 3', html: '<section data-group="trace">b3</section>' },
    { label: 'Outro', html: '<section>c</section>' },
  ];
  const sections = buildSections(slides, {
    headings: { trace: 'The Trace', Intro: 'Intro heading' },
    bodies: { trace: 'trace body' },
  });

  it('folds consecutive same-group slides into ONE section', () => {
    expect(sections).toHaveLength(3); // Intro · trace(3 steps) · Outro
    expect(sections[1].key).toBe('trace');
    expect(sections[1].steps).toHaveLength(3);
  });

  it('applies group-keyed heading + body to the folded section', () => {
    expect(sections[1].heading).toBe('The Trace');
    expect(sections[1].body).toBe('trace body');
  });

  it('leaves ungrouped slides as 1-step sections', () => {
    expect(sections[0].steps).toHaveLength(1);
    expect(sections[0].heading).toBe('Intro heading');
    expect(sections[2].label).toBe('Outro');
  });

  it('Read view figure = the final built step', () => {
    expect(finalStep(sections[1])).toContain('b3');
  });

  it('Watch deck = every step of every section, in order', () => {
    const steps = allSteps(sections);
    expect(steps).toHaveLength(5);
    expect(steps.map((s) => s.match(/>(\w+)</)[1])).toEqual(['a', 'b1', 'b2', 'b3', 'c']);
  });

  it('does NOT merge same-group slides separated by a gap (only consecutive fold)', () => {
    const s = buildSections([
      { label: 'A', html: '<section data-group="g">1</section>' },
      { label: 'B', html: '<section>2</section>' },
      { label: 'C', html: '<section data-group="g">3</section>' },
    ]);
    expect(s).toHaveLength(3);
  });

  it('falls back to the label as heading when none is provided', () => {
    const s = buildSections([{ label: 'Solo', html: '<section>x</section>' }]);
    expect(s[0].heading).toBe('Solo');
    expect(s[0].body).toBe('');
  });
});
