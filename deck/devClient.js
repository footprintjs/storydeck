// devClient — runs in the page `storydeck dev` serves (inlined with `(${devClient})()`; it cannot import). The page
// is the built page itself; this only adds what an editing loop needs:
//
//   · a save reloads the page on the same click (the deck keeps its click in the URL hash), and plays that click
//     again, forward, so the edit is seen in motion ("replay on save", on by default; kept for the tab);
//   · a build that stops shows why, over the last good page, until the next save fixes it;
//   · a small bar names where you are (click n of N · its label) and replays the click on demand.
//
// Nothing of it ships: `storydeck build` writes the page without it.
export function devClient() {
  if (window.__sdDev) return;
  window.__sdDev = true;
  const KEY = 'storydeck-dev';
  const built = Number(document.querySelector('meta[name="storydeck-dev"]')?.getAttribute('content') ?? 0);
  const stage = document.querySelector('deck-stage');
  const read = () => { try { return JSON.parse(sessionStorage.getItem(KEY) ?? '{}') ?? {}; } catch { return {}; } };
  const write = (v) => { try { sessionStorage.setItem(KEY, JSON.stringify({...read(), ...v})); } catch { /* storage refused: no replay after a reload */ } };

  const css = document.createElement('style');
  // Top centre: the deck's own chrome sits in the corners (kicker, footer, count) and its nav at the bottom centre.
  css.textContent = '.sd-dev{position:fixed;top:8px;left:50%;transform:translateX(-50%);z-index:2147483600;display:flex;gap:10px;align-items:center;'
    + 'font:12px/1.2 ui-monospace,SFMono-Regular,Menlo,monospace;color:#e8ecf1;background:rgba(15,18,22,.82);padding:6px 10px;border-radius:8px}'
    + '.sd-dev b{color:#7ee2a8}.sd-dev button{font:inherit;color:inherit;background:#2a313b;border:1px solid #47515e;border-radius:5px;padding:2px 8px;cursor:pointer}'
    + '.sd-dev label{display:flex;gap:4px;align-items:center;cursor:pointer}'
    + '.sd-dev-problem{position:fixed;left:10px;right:10px;top:48px;z-index:2147483601;max-height:45vh;overflow:auto;'
    + 'font:13px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace;color:#fff;background:#7f1d1d;border-radius:8px;padding:12px 14px;white-space:pre-wrap}'
    + '.sd-dev-problem small{display:block;margin-top:8px;opacity:.85}@media print{.sd-dev,.sd-dev-problem{display:none}}';
  document.head.append(css);

  const bar = document.createElement('div');
  bar.className = 'sd-dev';
  bar.setAttribute('role', 'status');
  const tag = document.createElement('b');
  tag.textContent = 'dev';
  const where = document.createElement('span');
  const again = document.createElement('button');
  again.type = 'button';
  again.textContent = 'replay';
  again.title = 'Play this click again, forward';
  const auto = document.createElement('label');
  const box = document.createElement('input');
  box.type = 'checkbox';
  box.checked = read().auto !== false;
  auto.append(box, document.createTextNode('replay on save'));
  bar.append(tag, where, again, auto);
  document.body.append(bar);

  const slides = () => (stage ? [...stage.children].filter((s) => s.tagName === 'SECTION') : []);
  const update = () => {
    if (!stage) { where.textContent = 'no <deck-stage> on the page'; return; }
    const i = stage.index ?? 0, s = slides()[i];
    where.textContent = `${i + 1} / ${slides().length} · ${s?.getAttribute('data-label') ?? ''}`;
  };
  /** The click again, forward: one click back at once, then a step on, so its entrance plays as in the room. */
  const replay = () => {
    if (!stage || typeof stage.goTo !== 'function') return;
    const i = stage.index ?? 0;
    if (i < 1) return;
    stage.goTo(i - 1);
    requestAnimationFrame(() => requestAnimationFrame(() => stage.next()));
  };
  stage?.addEventListener('slidechange', update);
  again.addEventListener('click', (e) => { e.stopPropagation(); replay(); again.blur(); });
  box.addEventListener('change', () => write({auto: box.checked}));
  bar.addEventListener('click', (e) => e.stopPropagation());   // the bar is not the deck: a tap on it never steps
  update();

  let shown = null;
  const show = (message) => {
    shown ??= Object.assign(document.createElement('div'), {className: 'sd-dev-problem'});
    shown.setAttribute('role', 'alert');
    shown.textContent = `The build stopped:\n${message}`;
    const hint = document.createElement('small');
    hint.textContent = built ? 'The page shows the last good build. Fix the file and save.' : 'Fix the file and save: the deck appears here.';
    shown.append(hint);
    if (!shown.isConnected) document.body.append(shown);
  };
  const clear = () => shown?.remove();

  if (read().replay) {
    write({replay: false});
    if (box.checked) setTimeout(replay, 120);   // after the deck has settled on the restored click
  }
  if (typeof EventSource !== 'function') return;
  const events = new EventSource('/__storydeck/events');
  events.addEventListener('hello', (e) => {
    const d = JSON.parse(e.data);
    if (d.problem) show(d.problem);
    else if (d.version !== built) location.reload();   // a save landed while this page loaded
    else clear();
  });
  events.addEventListener('reload', () => { write({replay: true}); location.reload(); });
  events.addEventListener('problem', (e) => show(JSON.parse(e.data).message));
}
