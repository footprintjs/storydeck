// lenses — one page, three ways to take a story in, so what you send needs no site behind it:
//
//   Read    an article: each part's picture, with what is said about it as prose. For a phone, or for looking something up.
//   Scroll  the picture stays while the words go by, and it changes as they do.
//   Slide   the deck, click by click, as every built page is.
//
//   deck.json  "lenses": true                                                  the three, in English
//              "lenses": {"read": "Lire", "scroll": "Défiler", "slide": "Diapos"}   in the deck's own language
//
// All three come from one source: Read and Scroll are the deck's own slides, copied as they rest, and its own headlines and
// notes, so they cannot drift from it. The page opens on Slide; a link ending #read or #scroll opens that one. Its keys
// are the page's: in Read and Scroll, the arrows and Space scroll, and only T still does what it does in Slide. Leaving
// Slide stops the speech and closes the notes. The page carries all this only when a deck asks, so any other deck is byte
// for byte as before.
import {closing, esc} from './html.js';
import {plainText} from './parse.js';
import {writtenText} from '../narration.js';

const WORDS = Object.freeze({read: 'Read', scroll: 'Scroll', slide: 'Slide'});

/**
 * Before the first paint, and before the stage starts: which view the link asks for. The stage writes the slide's number into
 * the address as it starts, so this is the only moment the link can still be read, and no other view flashes up first.
 */
export const LENS_FIRST = "(function(){var h=location.hash;document.documentElement.setAttribute('data-lens',h==='#read'?'read':h==='#scroll'?'scroll':'slide')})();";

/** deck.json "lenses", checked: the three words, or null when the deck does not ask. Throws, naming the fix. */
export function readLenses(value, lang) {
  if (value === undefined || value === false) return null;
  if (value === true) {
    if (!/^en(-|$)/i.test(lang)) throw new Error(`deck.json "lenses": true says Read, Scroll and Slide in English, and the deck is in "${lang}" — give them in its language: {"read": "…", "scroll": "…", "slide": "…"}`);
    return WORDS;
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`deck.json "lenses" is true, or the three words: {"read": "…", "scroll": "…", "slide": "…"}, not ${JSON.stringify(value)}`);
  const names = Object.keys(WORDS), other = Object.keys(value).find((k) => !names.includes(k));
  if (other) throw new Error(`deck.json "lenses" has "${other}", which it does not know (the lenses are ${names.join(', ')})`);
  for (const k of names) if (typeof value[k] !== 'string' || !value[k].trim()) throw new Error(`deck.json "lenses.${k}" is the word for it, not ${JSON.stringify(value[k])}`);
  return Object.freeze({read: value.read.trim(), scroll: value.scroll.trim(), slide: value.slide.trim()});
}

/** What is said on a click, as paragraphs, its [draft] marks dropped. */
const prose = (notes) => notes.map((n) => writtenText(n)).filter(Boolean).map((n) => `<p>${esc(n)}</p>`).join('');
const heading = (c) => (c.headline ? `<h3>${esc(c.headline)}</h3>` : '');

/** The clicks of each part, in order: [{kicker, clicks}]. */
function partsOf(clicks) {
  const parts = new Map();
  for (const c of clicks) {
    if (!parts.has(c.part)) parts.set(c.part, {kicker: c.kicker, clicks: []});
    parts.get(c.part).clicks.push(c);
  }
  return [...parts.values()];
}

/** The text of a slide's first <h1>, or null. One pass: its closing tag is looked for once. */
function firstHeading(html) {
  const start = html.search(/<h1\b/i), open = start < 0 ? -1 : html.indexOf('>', start);
  if (open < 0) return null;
  const shut = closing('h1');
  shut.lastIndex = open + 1;
  const end = shut.exec(html);
  return end ? plainText(html.slice(open + 1, end.index)).trim() : null;
}

/** The switch, and the Read and Scroll views, hidden until asked for: the words as plain HTML, the pictures copied in by lensRuntime. */
export function lensHtml({config, clicks, slides}) {
  const {read, scroll, slide} = config.lenses, [w, h] = config.canvas;
  const frame = (attr) => `<div class="lens-slide" ${attr} style="--lens-w:${w}px;--lens-h:${h}px;aspect-ratio:${w}/${h}"></div>`;
  const all = partsOf(clicks), first = all[0]?.clicks;
  // a title slide says what the article's own title says: an article opens on what is said about it, with no picture of its title
  const opens = first?.length === 1 && first[0].kind === 'plain' && firstHeading(slides[0].html) === config.title;
  const parts = (opens ? all.slice(1) : all).map(({kicker, clicks: told}) => `<section class="lens-part">${kicker ? `<h2>${esc(kicker)}</h2>` : ''}${frame(`data-lens-slide="${told.at(-1).n - 1}"`)}${told.map((c) => `${heading(c)}${prose(c.notes)}`).join('')}</section>`);
  const steps = clicks.map((c) => `<section class="lens-step" data-lens-at="${c.n - 1}">${c.kicker ? `<h2>${esc(c.kicker)}</h2>` : ''}${heading(c)}${prose(c.notes)}</section>`);
  return `<nav class="lens-switch"><a href="#read">${esc(read)}</a><a href="#scroll">${esc(scroll)}</a><a href="#slide">${esc(slide)}</a></nav>
<main class="lens-read" hidden><h1>${esc(config.title)}</h1>${opens ? prose(first[0].notes) : ''}${parts.join('')}</main>
<main class="lens-scroll" hidden><div class="lens-pin">${frame('data-lens-stage')}</div><div class="lens-steps">${steps.join('')}</div></main>`;
}

/** Runs in the page: which view shows, the slides copied in as they rest, each scaled to its frame, and the keys left to the page. */
export function lensRuntime() {
  const stage = document.querySelector('deck-stage'), root = document.documentElement;
  const read = document.querySelector('.lens-read'), scroll = document.querySelector('.lens-scroll');
  if (!stage || !read || !scroll) return;
  const slides = [...stage.children].filter((s) => s.tagName === 'SECTION'), wide = Number(stage.getAttribute('width'));
  const fit = new ResizeObserver((seen) => { for (const e of seen) e.target.style.setProperty('--lens-scale', e.contentRect.width / wide); });
  /** A copy of a slide at rest, nothing of the stage's marks left on it, so nothing plays and nobody tabs into it. */
  const copyInto = (box, i) => {
    const copy = slides[i]?.cloneNode(true);
    if (!copy) return;
    for (const a of [...copy.attributes]) if (a.name.startsWith('data-deck') || a.name === 'data-om-validate' || a.name === 'data-screen-label') copy.removeAttribute(a.name);
    copy.setAttribute('inert', '');
    copy.setAttribute('aria-hidden', 'true');
    box.replaceChildren(copy);
    fit.observe(box);
  };
  const pin = scroll.querySelector('[data-lens-stage]'), steps = [...scroll.querySelectorAll('.lens-step')];
  const showStep = (step) => {
    if (step.hasAttribute('data-lens-on')) return;
    for (const s of steps) s.removeAttribute('data-lens-on');
    step.setAttribute('data-lens-on', '');
    copyInto(pin, Number(step.getAttribute('data-lens-at')));
  };
  // the step crossing a line low in the window is the one the picture shows: low enough to be below a picture pinned above the words
  const watch = new IntersectionObserver((seen) => { for (const e of seen) if (e.isIntersecting) showStep(e.target); }, {rootMargin: '-70% 0px -30% 0px'});
  let readFilled = false, watching = false;
  const links = [...document.querySelectorAll('.lens-switch a')];
  const show = (mode) => {
    if (mode !== 'slide') {
      // what belongs to the slides ends with them: listen answers Escape only while it plays, and the guard below lets it through until the view changes
      if (stage.hasAttribute('data-listening')) window.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape'}));
      document.body.classList.remove('practice');
    }
    root.setAttribute('data-lens', mode);
    read.hidden = mode !== 'read';
    scroll.hidden = mode !== 'scroll';
    for (const a of links) { if (a.getAttribute('href') === `#${mode}`) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current'); }
    if (mode === 'read' && !readFilled) {
      readFilled = true;
      for (const box of read.querySelectorAll('[data-lens-slide]')) copyInto(box, Number(box.getAttribute('data-lens-slide')));
    }
    if (mode === 'scroll' && !watching) {
      watching = true;
      if (steps[0]) showStep(steps[0]);
      for (const s of steps) watch.observe(s);
    }
  };
  window.addEventListener('hashchange', () => {
    const asked = location.hash.slice(1), mode = asked === 'read' || asked === 'scroll' ? asked : 'slide';
    show(mode);
    if (mode !== 'slide') return;
    // on the slides: a number is a slide to go to, and otherwise the address names the slide again, as the stage keeps it
    if (/^\d+$/.test(asked)) stage.goTo(Number(asked) - 1);
    else { try { history.replaceState(null, '', `#${stage.index + 1}`); } catch { /* an address it cannot write: a reload starts over */ } }
    window.dispatchEvent(new Event('resize'));   // the stage fits itself again, having been hidden
  });
  // anything that moves the hidden stage (a presenter window, a print) writes its slide over the address: it says the view again
  const keepAddress = () => {
    const mode = root.getAttribute('data-lens');
    if (mode === 'slide' || location.hash === `#${mode}`) return;
    try { history.replaceState(null, '', `#${mode}`); } catch { /* an address it cannot write: the view still shows */ }
  };
  stage.addEventListener('slidechange', keepAddress);
  window.addEventListener('afterprint', keepAddress);
  // set up before every other key of the page, so the arrows and Space scroll here. T passes, and so do keys typed into a field
  window.addEventListener('keydown', (e) => {
    const t = e.target, typing = t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
    if (root.getAttribute('data-lens') !== 'slide' && e.key !== 't' && e.key !== 'T' && !typing) e.stopImmediatePropagation();
  }, true);
  const first = root.getAttribute('data-lens');
  // the stage has written its slide over what the link said: the address says the view again, so it can be sent on
  if (first !== 'slide') { try { history.replaceState(null, '', `#${first}`); } catch { /* an address it cannot write: the view still shows */ } }
  show(first);
}

/** The three views' look, each rule with no weight, so a deck's rule wins. */
export const LENS_CSS = `/* one page, three ways to take it in (deck/lenses.js) */
:where(html[data-lens="read"], html[data-lens="scroll"]) :where(deck-stage, .notes-panel) { display: none; }
:where(.lens-switch) {
  position: fixed; top: 12px; left: 50%; translate: -50% 0; z-index: 10; display: flex; gap: 2px; padding: 3px; border-radius: 999px;
  border: 1.5px solid var(--line, #c9d0d9); background: var(--bg-elev, #f6f8fa); font: 600 14px/1 var(--sans, system-ui, sans-serif); opacity: .7;
}
:where(.lens-switch:hover, .lens-switch:focus-within, html[data-lens="read"] .lens-switch, html[data-lens="scroll"] .lens-switch) { opacity: 1; }
:where(body:has(.sd-dev) .lens-switch) { top: 52px; }   /* below the dev page's bar */
:where(.lens-switch a) { padding: 7px 12px; border-radius: 999px; color: var(--fg, #14181f); text-decoration: none; }
:where(.lens-switch a[aria-current]) { background: var(--fg, #14181f); color: var(--bg-elev, #ffffff); }
:where(.lens-read, .lens-scroll) { box-sizing: border-box; color: var(--fg, #14181f); font: 400 19px/1.6 var(--sans, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif); }
:where(.lens-read > h1) { margin: 0 0 24px; font-size: 40px; line-height: 1.15; letter-spacing: -.01em; text-wrap: balance; }
:where(.lens-part > h2, .lens-step > h2) { margin: 0 0 12px; font: 600 14px/1.3 var(--mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace); letter-spacing: .08em; text-transform: uppercase; color: var(--accent-ink, #0b6e99); }
:where(.lens-part > h3, .lens-step > h3) { margin: 22px 0 6px; font-size: 24px; line-height: 1.25; text-wrap: balance; }
:where(.lens-read > p, .lens-part > p, .lens-step > p) { margin: 0 0 12px; }
:where(.lens-read) { max-width: 760px; margin: 0 auto; padding: 72px 20px 96px; }
:where(.lens-part) { margin-top: 48px; }
:where(.lens-slide) { position: relative; overflow: hidden; border: 1.5px solid var(--line, #c9d0d9); border-radius: 12px; background: var(--bg, #ffffff); }
:where(.lens-part > .lens-slide) { margin-bottom: 14px; }
:where(.lens-slide > section) {
  position: absolute; left: 0; top: 0; width: var(--lens-w); height: var(--lens-h); transform-origin: 0 0; scale: var(--lens-scale, 0);
  box-sizing: border-box; overflow: hidden; background: var(--bg, #ffffff); color: var(--fg, #14181f);
  font: 400 16px/normal var(--sans, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif);   /* as on the stage, not as in the article around it */
}
:where(.lens-slide .foot) { display: none; }
:where(.lens-scroll) { display: grid; grid-template-columns: minmax(0, 3fr) minmax(0, 2fr); gap: 40px; padding: 64px 32px 0; }
:where(.lens-pin) { position: sticky; top: 64px; align-self: start; }
:where(.lens-steps) { padding-bottom: 50vh; }
:where(.lens-step) { min-height: 70vh; opacity: .45; }   /* tall enough that the first step holds the line at the top of the page */
:where(.lens-step[data-lens-on]) { opacity: 1; }
@media (max-width: 800px) {
  :where(.lens-scroll) { display: block; padding: 56px 16px 0; }
  :where(.lens-pin) { top: 0; z-index: 1; margin-top: -56px; padding: 56px 0 12px; background: var(--bg, #ffffff); }   /* no words pass above it, behind the switch */
  :where(.lens-step) { min-height: 45vh; }
}
/* a short window, such as a phone on its side: the picture leaves room for the words */
@media (max-height: 600px) {
  :where(.lens-pin .lens-slide) { height: 45vh; width: auto; max-width: 100%; margin-inline: auto; }
}
@media print { :where(.lens-switch) { display: none; } }
/* last: a view's own display must not undo its hidden attribute */
:where(.lens-read[hidden], .lens-scroll[hidden]) { display: none; }
`;
