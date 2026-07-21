'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
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
// The only routes back out are (a) this floating dock, mounted inside the .watch-stage wrapper as
// the deck's plain sibling with an explicit z-index so it always paints above the deck's default
// (z-index:auto) stacking layer regardless of DOM order — and inside the wrapper because that
// wrapper is the fullscreen target (see below) — and (b) Esc. Both call the exact same `choose()`
// the header toggle uses.
const ESCAPE_LENSES = LENSES.filter((l) => l.id !== 'slides');

// On small screens the browser chrome eats a big slice of a 16:9 stage — entering Watch there
// should take the deck truly fullscreen. The Fullscreen API needs a user gesture, so the request
// fires synchronously inside the same choose() the lens buttons call.
const NARROW_WATCH_MQ = '(max-width: 700px)';

function isNarrowViewport() {
  return typeof window.matchMedia === 'function' && window.matchMedia(NARROW_WATCH_MQ).matches;
}

// webkit-prefixed forms cover iPad Safari; iPhone Safari has NO element fullscreen at all
// (video-only) — that's the `.is-takeover` CSS fallback's job.
function fullscreenElement() {
  return document.fullscreenElement || document.webkitFullscreenElement || null;
}

export default function PostView({ post }) {
  const [view, setView] = useState('read');
  // takeover = the no-API fallback state (iPhone Safari): a fixed 100dvh CSS maximization.
  const [takeover, setTakeover] = useState(false);
  const [fsApi, setFsApi] = useState(false);
  // The fullscreen target. It must CONTAIN the lens dock (a fullscreened element is the only
  // thing rendered), and it must exist at click time (requestFullscreen wants the gesture's
  // synchronous window) — so the wrapper is always mounted, empty outside Watch.
  const stageRef = useRef(null);
  const viewRef = useRef('read');
  // Distinguishes the mobile auto-fullscreen (leaving it should ALSO leave Watch — one exit,
  // never two stranded states) from the optional desktop toggle (leaving it stays in Watch).
  const autoFsRef = useRef(false);
  const content = post.sections.filter((s) => s.key !== 'Title' && s.key !== 'Close');
  const isWatch = view === 'slides';
  const idle = useIdleFade(isWatch);

  useEffect(() => { viewRef.current = view; }, [view]);

  const enterFullscreen = useCallback((auto) => {
    const el = stageRef.current;
    if (!el) return;
    autoFsRef.current = !!auto;
    const request = el.requestFullscreen || el.webkitRequestFullscreen;
    if (!request) { setTakeover(true); return; }
    let p;
    try { p = request.call(el); } catch (_) { setTakeover(true); return; }
    // Rejection (no user gesture — e.g. a ?view=slides deep link — or a denied permission)
    // falls back to the CSS takeover so mobile Watch is maximized either way.
    if (p && typeof p.catch === 'function') {
      p.catch(() => setTakeover(true));
    } else if (auto) {
      // Legacy webkitRequestFullscreen returns undefined — no promise to reject. If the request
      // silently failed (denied / no gesture), no fullscreenchange arrives either: confirm after
      // a beat and fall back to the takeover so mobile Watch is never left un-maximized.
      setTimeout(() => {
        if (!fullscreenElement() && viewRef.current === 'slides' && autoFsRef.current) setTakeover(true);
      }, 500);
    }
  }, []);

  const leaveFullscreen = useCallback(() => {
    // A deliberate exit: drop the auto flag FIRST so the fullscreenchange this triggers
    // doesn't re-enter choose('read') (autoFs only stays true while an auto fullscreen lives).
    autoFsRef.current = false;
    setTakeover(false);
    if (!fullscreenElement()) return;
    const exit = document.exitFullscreen || document.webkitExitFullscreen;
    if (!exit) return;
    try {
      const p = exit.call(document);
      if (p && typeof p.catch === 'function') p.catch(() => {});
    } catch (_) {}
  }, []);

  const choose = useCallback((next) => {
    setView(next);
    const u = new URL(window.location.href);
    if (next === 'read') u.searchParams.delete('view');
    else u.searchParams.set('view', next);
    window.history.replaceState(null, '', u);
    // Same gesture that entered Watch requests fullscreen; leaving Watch by ANY route
    // (dock, Esc, header toggle) tears fullscreen/takeover down in the same action.
    if (next === 'slides') {
      if (isNarrowViewport()) enterFullscreen(true);
    } else {
      leaveFullscreen();
    }
  }, [enterFullscreen, leaveFullscreen]);

  useEffect(() => {
    const v = new URLSearchParams(window.location.search).get('view');
    if (v === 'slides' || v === 'scrolly') setView(v);
    // Deep-linked Watch on a phone: no user gesture, so the API request (if any) rejects and
    // the catch lands the takeover fallback — maximized either way.
    if (v === 'slides' && isNarrowViewport()) enterFullscreen(true);
    const el = stageRef.current;
    setFsApi(!!(el && (el.requestFullscreen || el.webkitRequestFullscreen)));
  }, [enterFullscreen]);

  // System-level fullscreen exits (Esc under native fullscreen, the mobile swipe/back gesture)
  // bypass choose() — fullscreenchange is the single source of truth. When the mobile
  // auto-fullscreen ends while Watch is still up, fold Watch too: one action, landing on a sane
  // non-fullscreen Read state. The desktop toggle (autoFs=false) exits fullscreen only.
  useEffect(() => {
    function onFullscreenChange() {
      if (!fullscreenElement() && viewRef.current === 'slides' && autoFsRef.current) choose('read');
    }
    document.addEventListener('fullscreenchange', onFullscreenChange);
    document.addEventListener('webkitfullscreenchange', onFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', onFullscreenChange);
    };
  }, [choose]);

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

      {view === 'read' ? <BlogView sections={content} /> : null}
      {view === 'scrolly' ? <ScrollyView sections={content} /> : null}

      {/* Always-mounted fullscreen target: the Watch-entry click can fullscreen it synchronously
          (the gesture requirement), and the dock lives INSIDE it so it stays reachable when the
          browser renders only the fullscreened subtree. Empty (zero-height) outside Watch. */}
      <div ref={stageRef} className={`watch-stage${isWatch && takeover ? ' is-takeover' : ''}`}>
        {isWatch ? (
          <>
            <div className={`watch-lens-dock${idle ? ' is-idle' : ''}`} role="group" aria-label="Switch view">
              {ESCAPE_LENSES.map((l) => (
                <button key={l.id} type="button" onClick={() => choose(l.id)}>{l.label.replace(/ it$/, '')}</button>
              ))}
              {fsApi ? (
                <button
                  type="button"
                  className="watch-lens-fs"
                  aria-label="Toggle fullscreen"
                  title="Full screen"
                  onClick={() => (fullscreenElement() || takeover ? leaveFullscreen() : enterFullscreen(false))}
                >⛶</button>
              ) : null}
              <span className="watch-lens-hint" title="Press Esc to return to Read" aria-hidden="true">Esc</span>
            </div>
            <SlideDeck steps={post.deckSteps} />
          </>
        ) : null}
      </div>
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
