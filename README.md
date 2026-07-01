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

## Tests

```bash
npm test        # vitest
npm run test:cov
```

47 tests · ~98% lines · 100% on pure logic · coverage thresholds enforced.

## License

MIT © [Sanjay Krishna Anbalagan](https://github.com/sanjay1909) — part of the
[footprintjs ecosystem](https://footprintjs.github.io/).
