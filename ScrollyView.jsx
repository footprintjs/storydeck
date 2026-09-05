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
// API (library-clean): takes `sections` = [{ key, label, heading, steps:[html…], body, figure? }] —
// already filtered by the consumer. Reuses SlideFigure + the grouping steps; no new data model.
//
// ── The LIVE figure (`section.figure`) ────────────────────────────────────────
// A section may carry a `figure(beat)` render function BESIDE its `steps` HTML. When it does, the
// pinned stage renders `figure(beat)` instead of the slide canvas, and it renders it OUTSIDE the
// canvas: `SlideFigure` scales a fixed 1920×1080 box with a CSS transform, and a live chart under
// a transform mis-hits its own pointer events (the browser hit-tests in the transformed space, the
// chart measures in its own) — so a brush lands in the wrong place. The live figure gets a plain
// block instead, sized by the column.
//
// It is deliberately ONE mount for the whole scroll. The stage renders it WITHOUT a key, so a beat
// change re-renders the same subtree rather than tearing it down: a live figure is usually bound to
// something that persists (a session, a socket, a chart's own scales), and remounting it on every
// beat would throw that away and flash. The HTML path keeps its `key={active}` — a new string is a
// new figure and has nothing to preserve.
//
// A `figure` cannot come from JSON, so it is not part of the authoring model: `assemblePost` builds
// sections from post.json + Markdown, and the consumer attaches `figure` to those sections before
// handing them here. The Read and Watch lenses are untouched — a live figure cannot be joined as
// markup (SlideDeck concatenates every step into one canvas, BlogView shows the last), so those
// lenses go on showing the slide HTML, which is the snapshot of the same beat.
export default function ScrollyView({ sections }) {
  const beats = [];
  sections.forEach((s) => {
    s.steps.forEach((html, stepIdx) => {
      beats.push({
        key: `${slugify(s.key)}-${stepIdx}`,
        index: beats.length,
        html,
        label: s.label,
        heading: s.heading,
        body: s.body,
        // the section this beat belongs to, and which of its steps it is — what a live figure needs
        // to know WHICH beat it is being asked to draw
        sectionKey: s.key,
        step: stepIdx,
        firstOfSection: stepIdx === 0,
        figure: typeof s.figure === 'function' ? s.figure : null,
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
  // one live figure anywhere makes the stage the only figure: on mobile the inline canvases would
  // be a second, STALE copy of what the stage is already showing live (storydeck.css)
  const live = beats.some((b) => b.figure !== null);

  return (
    <div className={`scrolly${live ? ' scrolly-live' : ''}`}>
      <div className="scrolly-stage">
        {activeBeat ? (
          activeBeat.figure !== null ? (
            <div className="scrolly-stage-live">{activeBeat.figure(activeBeat)}</div>
          ) : (
            <SlideFigure html={activeBeat.html} key={active} />
          )
        ) : null}
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
