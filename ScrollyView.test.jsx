import { describe, it, expect, vi } from 'vitest';
import { useEffect } from 'react';
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

// ── the live figure (a section's `figure(beat)`) ─────────────────────────────
describe('ScrollyView — a live figure', () => {
  const live = [
    {
      key: 'one', label: 'A', heading: 'First',
      steps: ['<section>a1</section>', '<section>a2</section>'], body: '<p>alpha</p>',
      figure: (beat) => <div data-testid="live">{`${beat.sectionKey}/${beat.step}`}</div>,
    },
    { key: 'two', label: 'B', heading: 'Second', steps: ['<section>b1</section>'], body: '', figure: (beat) => <div data-testid="live">{`${beat.sectionKey}/${beat.step}`}</div> },
  ];

  it('renders it in the stage, outside the scaled canvas, with the beat it is drawing', () => {
    const { container, getByTestId } = render(<ScrollyView sections={live} />);
    const stage = container.querySelector('.scrolly-stage');
    expect(stage.querySelector('.scrolly-stage-live')).toBeTruthy();
    expect(stage.querySelector('.slide-figure')).toBeNull(); // never under the 1920×1080 transform
    expect(getByTestId('live')).toHaveTextContent('one/0');
    expect(container.querySelector('.scrolly.scrolly-live')).toBeTruthy();
  });

  it('keeps ONE mount across beats — the stage is not torn down when the story moves', () => {
    const mounted = vi.fn();
    function Live({ beat }) {
      useEffect(() => { mounted(); }, []);
      return <div data-testid="live">{`${beat.sectionKey}/${beat.step}`}</div>;
    }
    const sections = live.map((s) => ({ ...s, figure: (beat) => <Live beat={beat} /> }));
    const { getByTestId } = render(<ScrollyView sections={sections} />);
    expect(mounted).toHaveBeenCalledTimes(1);
    const io = global.__iobs[global.__iobs.length - 1];
    act(() => io.cb([{ isIntersecting: true, target: io.els[2] }])); // the second section's only beat
    expect(getByTestId('live')).toHaveTextContent('two/0');
    expect(mounted).toHaveBeenCalledTimes(1); // re-rendered, never remounted
  });

  it('falls back to the slide canvas for a section that carries no figure', () => {
    const { container } = render(<ScrollyView sections={sections} />);
    expect(container.querySelector('.scrolly-stage .slide-figure')).toBeTruthy();
    expect(container.querySelector('.scrolly-stage-live')).toBeNull();
    expect(container.querySelector('.scrolly-live')).toBeNull();
  });

  it('still renders one inline figure per beat for the unpinned (mobile) layout', () => {
    // the flow's per-beat figures are what mobile shows when the stage is unpinned; the HTML path
    // keeps them (one per beat), and a live stage hides them in CSS rather than drawing a second copy
    const { container } = render(<ScrollyView sections={sections} />);
    expect(container.querySelectorAll('.scrolly-beat-figure .slide-figure')).toHaveLength(4);
  });
});
