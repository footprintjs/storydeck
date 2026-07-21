import { describe, it, expect } from 'vitest';
import { buildSections, parseGroup, finalStep, allSteps, isAdditiveSlide, compositeSlides } from './sections';

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

describe('additive builds — isAdditiveSlide', () => {
  it('detects data-build="add" in the opening section tag', () => {
    expect(isAdditiveSlide('<section data-label="X" data-build="add">x</section>')).toBe(true);
  });
  it('ignores slides without the attribute, and empty input', () => {
    expect(isAdditiveSlide('<section data-label="X">x</section>')).toBe(false);
    expect(isAdditiveSlide('')).toBe(false);
    expect(isAdditiveSlide(undefined)).toBe(false);
  });
  it('does NOT trip on data-build appearing only in body content', () => {
    expect(isAdditiveSlide('<section data-label="X"><code>data-build="add"</code></section>')).toBe(false);
  });
});

describe('additive builds — compositeSlides', () => {
  it('is the identity on a deck with no data-build attributes', () => {
    const slides = [
      { label: 'A', html: '<section>a</section>' },
      { label: 'B', html: '<section>b</section>' },
    ];
    expect(compositeSlides(slides)).toEqual(slides);
  });

  it('accumulates a chain: each additive slide = base + every layer up to it', () => {
    const slides = [
      { label: 'Base', html: '<section>base</section>' },
      { label: 'Add1', html: '<section data-build="add">one</section>' },
      { label: 'Add2', html: '<section data-build="add">two</section>' },
    ];
    const out = compositeSlides(slides);
    expect(out[0].html).toBe('<section>base</section>');
    expect(out[1].html).toBe('<section>base</section>\n<section data-build="add">one</section>');
    expect(out[2].html).toBe(
      '<section>base</section>\n<section data-build="add">one</section>\n<section data-build="add">two</section>',
    );
  });

  it('a normal slide resets the canvas (starts a fresh chain)', () => {
    const out = compositeSlides([
      { label: 'Base', html: '<section>base</section>' },
      { label: 'Add', html: '<section data-build="add">one</section>' },
      { label: 'Reset', html: '<section>fresh</section>' },
      { label: 'Add2', html: '<section data-build="add">next</section>' },
    ]);
    expect(out[2].html).toBe('<section>fresh</section>');
    expect(out[3].html).toBe('<section>fresh</section>\n<section data-build="add">next</section>');
  });

  it('an additive FIRST slide degrades to its own base', () => {
    const out = compositeSlides([{ label: 'A', html: '<section data-build="add">solo</section>' }]);
    expect(out[0].html).toBe('<section data-build="add">solo</section>');
  });

  it('preserves the label and every other slide field', () => {
    const out = compositeSlides([{ label: 'A', html: '<section>a</section>', extra: 1 }]);
    expect(out[0].label).toBe('A');
    expect(out[0].extra).toBe(1);
  });
});
