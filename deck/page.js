// page — a compiled deck as ONE self-contained HTML page: the slides on <deck-stage>, every stylesheet and runtime
// inlined, no network request. The same page in development and in the room: `storydeck dev` serves this page
// with a small dev client added (dev.js · devClient), so what you preview is what ships.
//
// Keys in the page: ← → or Space step, T switches light and dark, N shows the notes, P opens the presenter
// window, L plays the deck in the speaker's voice (or the browser's).
import {focusRuntime} from '../focusHtml.js';
import {notesData, notesRuntime, listenRuntime} from '../narrationHtml.js';
import {esc} from './compile.js';

/** Runs in the page: the theme toggle (its button, or T). Light or dark follows the system until a choice is saved. */
export function themeRuntime() {
  const root = document.documentElement, btn = document.querySelector('.theme-toggle');
  const set = (dark) => { root.classList.toggle('dark', dark); btn?.setAttribute('aria-label', `Switch to ${dark ? 'light' : 'dark'} theme`); };
  const flip = () => {
    const dark = !root.classList.contains('dark');
    set(dark);
    try { localStorage.setItem('theme', dark ? 'dark' : 'light'); } catch { /* storage refused: the choice lasts this visit */ }
  };
  set(root.classList.contains('dark'));
  btn?.addEventListener('click', (e) => { e.stopPropagation(); flip(); btn.blur(); });
  window.addEventListener('keydown', (e) => {
    if ((e.key === 't' || e.key === 'T') && !e.metaKey && !e.ctrlKey && !e.altKey) { e.preventDefault(); flip(); }
  }, true);
}

/** Before the first paint: dark when the saved choice (or, with none, the system) says so — no flash of the other theme. */
const THEME_FIRST = "(function(){var d;try{var t=localStorage.getItem('theme');d=t?t==='dark':matchMedia('(prefers-color-scheme: dark)').matches}catch(e){d=false}if(d)document.documentElement.classList.add('dark')})();";

const TOGGLE = '<button class="theme-toggle" type="button" aria-label="Switch theme" title="Light / dark (T)">'
  + '<svg class="sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path stroke-linecap="round" d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M19 5l-1.5 1.5M6.5 17.5L5 19"/></svg>'
  + '<svg class="moon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg></button>';

/** Text safe inside a <script> (no `</script` can close it early). */
export const scriptSafe = (code) => String(code).replace(/<\/(script)/gi, '<\\/$1');
/** Text safe inside a <style> (no `</style` can close it early). */
export const styleSafe = (css) => String(css).replace(/<\/(style)/gi, '<\\/$1');

/**
 * The page. `assets`: {stageJs, css: [stylesheet …] (focus.css, narration.css, deck.css), version} — what the
 * library ships, read once by assets.js. `dev`: {client, version} adds the dev client (dev.js) and the build number
 * it compares with, or null for the page that ships.
 */
export function deckPage(compiled, assets, {dev = null} = {}) {
  const {config, slides} = compiled;
  const css = [...assets.css, compiled.themeCss ?? ''].join('\n');
  const runtimes = [focusRuntime, notesRuntime, listenRuntime, themeRuntime].map((fn) => `<script>(${scriptSafe(fn)})();</script>`);
  return `<!doctype html>
<html lang="${esc(config.lang)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="generator" content="footprint-storydeck ${esc(assets.version)}">
<title>${esc(config.title)}</title>
${config.description ? `<meta name="description" content="${esc(config.description)}">\n` : ''}${dev ? `<meta name="storydeck-dev" content="${Number(dev.version)}">\n` : ''}<script>${THEME_FIRST}</script>
<style>${styleSafe(css)}</style>
</head>
<body>
<deck-stage width="${config.canvas[0]}" height="${config.canvas[1]}" no-rail>
${slides.map((s) => s.html).join('\n')}
</deck-stage>
${TOGGLE}
<!-- deck-stage.js, focus and narration runtimes: footprint-storydeck ${esc(assets.version)} (MIT) -->
${notesData(slides.map((s) => s.notes))}
<script>${scriptSafe(assets.stageJs)}</script>
${runtimes.join('\n')}
${dev ? `<script>(${scriptSafe(dev.client)})();</script>\n` : ''}</body>
</html>
`;
}
