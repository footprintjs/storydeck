'use client';
import { useEffect, useRef, useState } from 'react';
import SlideFigure from './SlideFigure';
import { slugify } from './slug';

// Scrolly lens (the agentfootprint-homepage pattern, generalized): a pinned figure "stage" whose
// content advances as you scroll the narrative. Each section flattens into one or more "beats" (its
// steps); an IntersectionObserver marks the beat nearest the viewport centre as active, and the
// pinned stage shows that beat's step. A progress rail tracks position. Mobile: no pin — figures
// render inline per beat.
//
// API (library-clean): takes `sections` = [{ key, label, heading, steps:[html…], body }] — already
// filtered by the consumer. Reuses SlideFigure + the grouping steps; no new data model.
export default function ScrollyView({ sections }) {
  const beats = [];
  sections.forEach((s) => {
    s.steps.forEach((html, stepIdx) => {
      beats.push({
        key: `${slugify(s.key)}-${stepIdx}`,
        html,
        label: s.label,
        heading: s.heading,
        body: s.body,
        firstOfSection: stepIdx === 0,
      });
    });
  });

  const [active, setActive] = useState(0);
  const refs = useRef([]);

  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            const i = Number(e.target.dataset.beat);
            if (!Number.isNaN(i)) setActive(i);
          }
        });
      },
      { rootMargin: '-45% 0px -45% 0px', threshold: 0 }, // fire as a beat crosses the viewport centre
    );
    refs.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, [beats.length]);

  const activeBeat = beats[active] || beats[0];

  return (
    <div className="scrolly">
      <div className="scrolly-stage">
        {activeBeat ? <SlideFigure html={activeBeat.html} key={active} /> : null}
        <div className="scrolly-rail" aria-hidden="true">
          {beats.map((b, i) => (
            <span key={b.key} className={i === active ? 'on' : ''} />
          ))}
        </div>
      </div>

      <div className="scrolly-flow">
        {beats.map((b, i) => (
          <div className="scrolly-beat" key={b.key} data-beat={i} ref={(el) => (refs.current[i] = el)}>
            {b.firstOfSection ? (
              <>
                <p className="eyebrow">{b.label}</p>
                <h2>{b.heading}</h2>
                {b.body ? <div className="prose" dangerouslySetInnerHTML={{ __html: b.body }} /> : null}
              </>
            ) : null}
            <div className="scrolly-beat-figure"><SlideFigure html={b.html} /></div>
          </div>
        ))}
      </div>
    </div>
  );
}
