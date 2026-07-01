'use client';
import { useEffect, useState } from 'react';
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

export default function PostView({ post }) {
  const [view, setView] = useState('read');
  const content = post.sections.filter((s) => s.key !== 'Title' && s.key !== 'Close');

  useEffect(() => {
    const v = new URLSearchParams(window.location.search).get('view');
    if (v === 'slides' || v === 'scrolly') setView(v);
  }, []);

  function choose(next) {
    setView(next);
    const u = new URL(window.location.href);
    if (next === 'read') u.searchParams.delete('view');
    else u.searchParams.set('view', next);
    window.history.replaceState(null, '', u);
  }

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

      {view === 'read' ? <BlogView sections={content} /> : null}
      {view === 'scrolly' ? <ScrollyView sections={content} /> : null}
      {view === 'slides' ? <SlideDeck steps={post.deckSteps} /> : null}
    </main>
  );
}
