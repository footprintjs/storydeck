'use client';
import { useEffect, useRef, useState } from 'react';
import { useBasePath } from './context';

// Slide (watch) lens: the deck slides (as raw HTML strings, in order) mounted into <deck-stage>
// (the deck's own web component, loaded from /deck-stage.js). We set innerHTML imperatively so
// React doesn't fight the runtime once it restructures the stage; remounts auto-upgrade.
export default function SlideDeck({ steps }) {
  const host = useRef(null);
  const [copied, setCopied] = useState(false);
  const basePath = useBasePath();

  // deck-stage keeps the current slide in location.hash (#1, #2, …), so the URL already points at
  // the visible slide — copying window.location shares that exact slide (same scheme as the blog).
  function copySlideLink() {
    try { navigator.clipboard.writeText(window.location.href); } catch (_) {}
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const inner = (steps || []).join('\n');
    el.innerHTML = `<deck-stage no-rail width="1920" height="1080">${inner}</deck-stage>`;
    if (!document.querySelector('script[data-deck-stage]')) {
      const sc = document.createElement('script');
      sc.src = `${basePath}/deck-stage.js`;
      sc.setAttribute('data-deck-stage', '');
      document.body.appendChild(sc);
    }
  }, [steps]);

  return (
    <>
      <div className="deck-shell deck-scope" ref={host} />
      <div className="deck-actions">
        <p className="deck-hint">← / → to navigate · Home / End to jump</p>
        <button type="button" className="deck-copy" onClick={copySlideLink}>
          {copied ? 'link copied ✓' : 'Copy link to this slide'}
        </button>
      </div>
    </>
  );
}
