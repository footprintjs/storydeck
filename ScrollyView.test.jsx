import { describe, it, expect } from 'vitest';
import { render, act } from '@testing-library/react';
import ScrollyView from './ScrollyView';

const sections = [
  { key: 'a', label: 'A', heading: 'First', steps: ['<section>a1</section>'], body: '<p>alpha</p>' },
  {
    key: 'trace', label: 'Trace', heading: 'Grouped',
    steps: ['<section>t1</section>', '<section>t2</section>', '<section>t3</section>'], body: '<p>beta</p>',
  },
];

describe('ScrollyView', () => {
  it('flattens sections into per-step beats with a progress rail', () => {
    const { container } = render(<ScrollyView sections={sections} />);
    // 1 (section a) + 3 (grouped trace) = 4 beats/rail dots
    expect(container.querySelectorAll('.scrolly-rail span')).toHaveLength(4);
    expect(container.querySelectorAll('.scrolly-beat')).toHaveLength(4);
  });

  it('pins a stage figure and marks the first beat active by default', () => {
    const { container } = render(<ScrollyView sections={sections} />);
    expect(container.querySelector('.scrolly-stage .slide-figure')).toBeTruthy();
    expect(container.querySelector('.scrolly-rail span.on')).toBeTruthy();
  });

  it('shows the heading + prose only on the first beat of a section', () => {
    const { container } = render(<ScrollyView sections={sections} />);
    const proseBlocks = container.querySelectorAll('.scrolly-flow .prose');
    expect(proseBlocks).toHaveLength(2); // one per section, not per step
  });

  it('advances the active beat when a beat scrolls into view', () => {
    const { container } = render(<ScrollyView sections={sections} />);
    const io = global.__iobs[global.__iobs.length - 1];
    // simulate beat index 2 (a middle step of the grouped section) entering the viewport centre
    act(() => io.cb([{ isIntersecting: true, target: io.els[2] }]));
    const dots = container.querySelectorAll('.scrolly-rail span');
    expect(dots[2].classList.contains('on')).toBe(true);
    // ignores non-intersecting entries
    act(() => io.cb([{ isIntersecting: false, target: io.els[0] }]));
    expect(dots[2].classList.contains('on')).toBe(true);
  });
});
