'use client';
import { useEffect, useRef } from 'react';

// Renders one deck section as a static 16:9 figure: a fixed 1920×1080 canvas holding the exact
// slide HTML, scaled to the column width. The globals.css override reveals the deck's
// progressive-build elements at their final state so the still shows the fully-composed slide.
export default function SlideFigure({ html }) {
  const box = useRef(null);
  const canvas = useRef(null);

  useEffect(() => {
    const el = box.current, c = canvas.current;
    if (!el || !c) return;
    const fit = () => {
      const s = el.clientWidth / 1920;
      c.style.transform = `scale(${s})`;
      el.style.height = 1080 * s + 'px';
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="slide-figure deck-scope" ref={box} aria-hidden="true">
      <div className="slide-figure-canvas" ref={canvas} dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}
