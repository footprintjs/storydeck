# storydeck

**One source, many lenses.** Write a piece of content once, render it three ways:

- **Read** — a detailed, SEO-first article (figure + prose per section).
- **Scroll** — scrollytelling: a pinned figure "stage" that advances as the narrative scrolls.
- **Watch** — an animated, click-through slide deck.

Same content, your lens. It's the footprintjs idea — *one canonical record, you choose the view* —
applied to content. A React library; theme-agnostic; ships as source.

> Demo (dogfooded — storydeck explaining storydeck): **[footprintjs.github.io/storydeck](https://footprintjs.github.io/storydeck/)**
> First consumer: the **[footprintjs blog](https://footprintjs.github.io/blog/)**.

## The model

The unit is a **Section** that owns **1..N slide steps** plus authored prose:

```
Section = { key, label, heading, steps: [slideHtml, …], body }   // body = rendered HTML
Post    = { …meta, sections: [Section, …], deckSteps: [slideHtml, …] }
```

- **Read** shows each section's *final* step as one figure + the prose.
- **Scroll** pins the figure and advances through the steps on scroll.
- **Watch** plays `deckSteps` (every slide) in a deck.

A section with several steps is a **group** — a progressive build collapses to one figure in Read,
plays in full in Watch/Scroll. One data model, three behaviours.

### A live figure, in Scroll

A section may carry a **`figure(beat)`** render function beside its `steps`. When it does, Scroll's
pinned stage renders `figure(beat)` instead of the slide canvas:

```jsx
const sections = assemblePost({ meta, sections: meta.sections, bodyMd, deckSlides }).sections
  .map((s) => ({ ...s, figure: (beat) => <MyChart beat={beat} /> }));

<ScrollyView sections={sections} />
```

Three things are true of it, and each is a decision:

- **It is hosted outside the scaled canvas.** `SlideFigure` fits a fixed 1920×1080 box to the column
  with a CSS transform; a live chart under a transform hit-tests in the transformed space while it
  measures in its own, so a brush lands in the wrong place. The live figure gets a plain block.
- **It is mounted once for the whole scroll.** The stage renders it without a key, so moving a beat
  re-renders the same subtree rather than tearing it down — a live figure is usually bound to
  something that persists, and remounting it every beat would throw that away and flash. The HTML
  path keeps its per-beat key: a new string is a new figure and has nothing to preserve.
- **Read and Watch are untouched.** A live figure cannot be joined as markup — `SlideDeck`
  concatenates every step into one canvas and `BlogView` shows the last — so those lenses go on
  showing the slide HTML, which is the snapshot of the same beat. One data model, one additive
  field, two lenses that never learn about it.

A function cannot come from JSON, so `figure` is not part of the authoring model: `assemblePost`
builds sections from post.json + Markdown, and the consumer attaches `figure` to them. The beat a
figure is handed carries `sectionKey`, `step` and `index` — which beat it is being asked to draw.

## Focus: what a click is about, and what happens to the rest

A talk often tells its story on **one picture** — a diagram, a page, a timeline — click by click. Each
click is *about* something, and the audience must see what, without losing where they are. That is a
decision every click makes again, so it is data on the click, and the library does the rest:

- the click names its **subject** (the pieces it lights); everything else shown is the **context**;
- it picks a **strategy** for showing the two — one of each kind at most:

| Kind | Strategies | What happens |
|---|---|---|
| look | `grey` (default) · `hide` · `keep` | how the context looks: greyed in place, hidden, or left as it is |
| mover | `zoom` | the view closes in on the subject (`share`, `most`) |
| mover | `left` · `right` · `up` · `down` | the context steps aside that way, smaller (`scale`), and the subject grows into the room it leaves (`grow`, `fill`, `gap`, `align`) |
| overlay | `blur` | everything outside the subject's frame is blurred; a frame (and a `label`) on it, or on the `rect`s you give |

`'left blur'` reads: the context steps aside to the left, greyed, under a blur, and the subject grows on
the right, framed. Bring your own strategy of any kind (`strategies: { name: { kind, … } }`).

The plan is plain data (each piece's state, what changed since the last click, how far it moved), so a
renderer only draws it. `storydeck/focus-html` writes it into slide HTML at build time and
`storydeck/focus.css` animates **only what changed, only on a forward click** — a jump or a step back
lands at once (inline `focusRuntime` in the page), and print shows every click as it lands.

```js
import { planFocus } from 'storydeck/focus';
import { readPieces, drawFocus, wrapStage, slideClass, focusOverlay, focusRuntime } from 'storydeck/focus-html';

// Every element with data-k="name …" and an inline left/top (width/height) is a piece.
const { html, pieces } = readPieces(`
  <div data-k="page" style="left:120px;top:370px;width:700px;height:460px">…</div>
  <div data-k="code" style="left:930px;top:260px;width:500px;height:250px">…</div>`);

const area = [0, 230, 1920, 1000];   // below the headline, above the footer
const { looks } = planFocus([
  { in: ['page', 'code'] },                                        // both come in, lit
  { on: ['code'], focus: 'left blur', options: { label: 'the click' } },
  { on: ['code'] },                                                // the page glides back, greyed
], { pieces, area });

// The stage (a zoom) goes inside the map's own box; the blur, in slide pixels, outside it.
const slides = looks.map(look => `<section class="${slideClass(look)}">`
  + `<div class="map">${wrapStage(drawFocus(html, look), look)}</div>${focusOverlay(look, { area })}</section>`);
// …and once in the page (inline it in a built page: `(${focusRuntime})()`), so only a forward click animates.
```

Pieces don't nest, so each one greys and moves on its own; a mover keeps every group's shape (the
pieces of the subject move together, around the subject's centre) and composes with a piece's own
transform (it uses CSS `translate`/`scale`, not `transform`). A mover's `aside` and `subject` options
name its two groups when they are not simply the greyed and the lit pieces, and `data-twin="name"` makes
a piece (a dashed wire under a solid one) step aside while its twin is lit. A piece that leaves fades out
from how it looked and where it stood; a blur that moves to another subject stays, and only its frame is
new; overlapping holes stay clear, and nothing outside the `area` is blurred.

## Quick start

```jsx
import { PostView, StoryDeckProvider } from 'storydeck';
import 'storydeck/storydeck.css';

export default function App({ post }) {
  return (
    <StoryDeckProvider basePath="/blog">
      <PostView post={post} />
    </StoryDeckProvider>
  );
}
```

`PostView` renders the Read · Scroll · Watch toggle and each lens. Bring your own `post` (see
**Authoring**). Requires `react`/`react-dom` (peer) and a slide runtime for Watch (a
`deck-stage.js` web component served at `${basePath}/deck-stage.js`).

## Authoring (JSON structure + Markdown prose)

A post is a folder — **JSON** for structure + grouping, **Markdown** for prose:

```
post.json     { …meta, sections: [{ key, label, heading, slides: [deckLabel…] }] }
body.md       Markdown per section, split by  <!--section:key-->  markers
deck-data.json  the slides ({ label, html }[]) — e.g. imported from a Claude Design deck
```

The consumer wires these together with the adapter:

```js
import { assemblePost } from 'storydeck';
const post = assemblePost({ meta, sections, bodyMd, deckSlides });
```

## Theming (bring your own)

storydeck hardcodes **no colours** — it reads a CSS-variable token contract, so the consumer owns
the look:

```
--bg --bg-elev --fg --fg-muted --fg-faint --line --line2
--yellow (accent)  --accent-ink (readable accent)  --sans --mono --content
```

Headless theme control:

```jsx
import { useTheme, ThemeToggle } from 'storydeck';
const { theme, toggle, setTheme } = useTheme();   // flips an html class + persists
// …or drop in <ThemeToggle />
```

## API

| Export | What |
|---|---|
| `PostView` | the lens controller (Read · Scroll · Watch toggle) |
| `BlogView` · `ScrollyView` · `SlideDeck` | the three lenses (take `sections` / `sections` / `steps`) |
| `SlideFigure` | one slide rendered as a scaled static figure |
| `StoryDeckProvider` · `useBasePath` | inject deploy config (asset base path) |
| `useTheme` · `ThemeToggle` | headless theming + a default toggle |
| `assemblePost` | build a normalized `Post` from JSON + Markdown + slides |
| `renderMarkdown` · `splitBodyByMarkers` | the Markdown adapter pieces |
| `buildSections` · `finalStep` · `allSteps` · `parseGroup` | grouping helpers |
| `slugify` · `scopeDeckCss` | utilities |
| `planFocus` · `focusStep` · `readFocus` · `FOCUS` | focus: per click, what it is about and what happens to the rest (also `storydeck/focus`) |
| `readPieces` · `drawFocus` · `wrapStage` · `focusOverlay` · `focusRuntime` | focus, written into slide HTML (also `storydeck/focus-html`; styles in `storydeck/focus.css`) |

Types ship beside the source in `index.d.ts` — hand-kept (there is no build to generate them from),
and here rather than in a consumer's shim, because a package's shape belongs in the package.

## Tests

```bash
npm test        # vitest
npm run test:cov
```

47 tests · ~98% lines · 100% on pure logic · coverage thresholds enforced.

## License

MIT © [Sanjay Krishna Anbalagan](https://github.com/sanjay1909) — part of the
[footprintjs ecosystem](https://footprintjs.github.io/).
