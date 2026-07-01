'use client';
import { useState } from 'react';
import SlideFigure from './SlideFigure';
import { finalStep } from './sections';
import { slugify } from './slug';

// Read lens: each section = ONE figure (its final built step) + authored prose, with a sticky,
// shareable header (anchor deep-link). A grouped section collapses to its last step here.
// API (library-clean): takes `sections` = [{ key, label, heading, steps:[html…], body }],
// already filtered by the consumer (PostView). No consumer-specific chrome lives here.
export default function BlogView({ sections }) {
  const [copied, setCopied] = useState('');

  function copyLink(e, id) {
    e.preventDefault();
    const url = `${window.location.origin}${window.location.pathname}#${id}`;
    if (window.location.hash !== `#${id}`) window.history.replaceState(null, '', `#${id}`);
    try { navigator.clipboard.writeText(url); } catch (_) {}
    setCopied(id);
    setTimeout(() => setCopied((c) => (c === id ? '' : c)), 1600);
  }

  return (
    <article>
      {sections.map((s) => {
        const id = slugify(s.key);
        return (
          <section id={id} className="post-section" key={id}>
            <div className="section-head">
              <a
                className="section-anchor"
                href={`#${id}`}
                onClick={(e) => copyLink(e, id)}
                title="Copy link to this section"
                aria-label={`Copy link to “${s.heading}”`}
              >
                #
              </a>
              <div className="section-head-text">
                <p className="eyebrow">{s.label}</p>
                <h2>{s.heading}</h2>
              </div>
              {copied === id ? <span className="section-copied" aria-live="polite">link copied ✓</span> : null}
            </div>
            <SlideFigure html={finalStep(s)} />
            {s.body ? <div className="prose" dangerouslySetInnerHTML={{ __html: s.body }} /> : null}
          </section>
        );
      })}
    </article>
  );
}
