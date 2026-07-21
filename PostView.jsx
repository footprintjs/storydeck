'use client';
import { useCallback, useEffect, useState } from 'react';
import BlogView from './BlogView';
import ScrollyView from './ScrollyView';
import SlideDeck from './SlideDeck';

// The dual/tri-view controller and the library/consumer seam: it takes the normalized `post`,
// filters out deck bookends once, and hands each lens exactly the minimal data it needs
// (sections → Read/Scrolly, deckSteps → Watch). Defaults to 'read' so the SSR HTML is the article
// (SEO surface). Deep-linkable via ?view=slides|scrolly; the toggle keeps the URL in sync.
const LENSES = [
  { id: 'read', label: 'Read it' },
  { id: 'scrolly', label: 'Scroll it' },
  { id: 'slides', label: 'Watch it' },
];

// Watch mode's <deck-stage> renders its shadow :host as `position: fixed; inset: 0` (it owns the
// whole viewport for slide chrome/keyboard nav) — that fixed layer paints over the page header,
// so the .view-toggle up there becomes visually covered and unclickable the instant Watch mounts.
// The only routes back out are (a) this floating dock, mounted as a plain sibling with an explicit
// z-index so it always paints above the deck's default (z-index:auto) stacking layer regardless of
// DOM order, and (b) Esc. Both call the exact same `choose()` the header toggle uses.
const ESCAPE_LENSES = LENSES.filter((l) => l.id !== 'slides');

export default function PostView({ post }) {
  const [view, setView] = useState('read');
  const content = post.sections.filter((s) => s.key !== 'Title' && s.key !== 'Close');
  const isWatch = view === 'slides';
  const idle = useIdleFade(isWatch);

  useEffect(() => {
    const v = new URLSearchParams(window.location.search).get('view');
    if (v === 'slides' || v === 'scrolly') setView(v);
  }, []);

  const choose = useCallback((next) => {
    setView(next);
    const u = new URL(window.location.href);
    if (next === 'read') u.searchParams.delete('view');
    else u.searchParams.set('view', next);
    window.history.replaceState(null, '', u);
  }, []);

  // Esc is the deck's own convention for "back out" everywhere else in the app; deck-stage's own
  // keydown handler only claims Escape while a rail context-menu/confirm dialog is open, so it's
  // free here and always bubbles to window.
  useEffect(() => {
    if (!isWatch) return;
    function onKeyDown(e) {
      if (e.key === 'Escape') choose('read');
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isWatch, choose]);

  return (
    <main id="main" className="wrap wide">
      <header className="post-head">
        <p className="eyebrow">Primer</p>
        <h1>{post.title}</h1>
        <p className="lead">{post.description}</p>
        <p className="byline">
          By {post.author} · {new Date(post.date + 'T00:00:00Z').toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })}
        </p>
      </header>

      <div className="view-toggle" role="group" aria-label="Choose a view">
        {LENSES.map((l) => (
          <button key={l.id} aria-pressed={view === l.id} onClick={() => choose(l.id)}>{l.label}</button>
        ))}
      </div>

      {isWatch ? (
        <div className={`watch-lens-dock${idle ? ' is-idle' : ''}`} role="group" aria-label="Switch view">
          {ESCAPE_LENSES.map((l) => (
            <button key={l.id} type="button" onClick={() => choose(l.id)}>{l.label.replace(/ it$/, '')}</button>
          ))}
          <span className="watch-lens-hint" title="Press Esc to return to Read" aria-hidden="true">Esc</span>
        </div>
      ) : null}

      {view === 'read' ? <BlogView sections={content} /> : null}
      {view === 'scrolly' ? <ScrollyView sections={content} /> : null}
      {isWatch ? <SlideDeck steps={post.deckSteps} /> : null}
    </main>
  );
}

// Visible on mount / any pointer or key activity; recedes to a low-opacity corner chip after
// `ms` of inactivity so it doesn't compete with the slide underneath. Never removed from the DOM
// or made unfocusable — CSS keeps it hoverable/focusable at any opacity, so keyboard users always
// land on live buttons.
function useIdleFade(active, ms = 2600) {
  const [idle, setIdle] = useState(false);

  useEffect(() => {
    if (!active) {
      setIdle(false);
      return;
    }
    let timer = setTimeout(() => setIdle(true), ms);
    function wake() {
      setIdle(false);
      clearTimeout(timer);
      timer = setTimeout(() => setIdle(true), ms);
    }
    window.addEventListener('pointermove', wake);
    window.addEventListener('touchstart', wake, { passive: true });
    window.addEventListener('keydown', wake);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('pointermove', wake);
      window.removeEventListener('touchstart', wake);
      window.removeEventListener('keydown', wake);
    };
  }, [active, ms]);

  return idle;
}
