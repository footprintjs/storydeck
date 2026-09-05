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
