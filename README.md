# Footprint StoryDeck

**One source, many lenses.** Write a piece of content once, render it three ways:

- **Read** — a detailed, SEO-first article (figure + prose per section).
- **Scroll** — scrollytelling: a pinned figure "stage" that advances as the narrative scrolls.
- **Watch** — an animated, click-through slide deck.

Same content, your lens. It's the footprintjs idea — *one canonical record, you choose the view* —
applied to content. A React library; theme-agnostic; ships compiled ESM that Node and any bundler load as-is.

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

### A figure in any framework: `StoryFigure`

A section's `figure` may instead be a **`StoryFigure`** — three plain methods, no React:

```ts
interface StoryFigure {
  mount(el: HTMLElement): void;                         // draw into this element
  seek(beat: StoryFigureBeat): Promise<string | void>;  // the reader is on this beat: move there
  dispose(): void;                                      // take down what mount drew
}
// StoryFigureBeat = { key, index, sectionKey, step } — plain data
```

```js
const figure = { mount(el) { chart.attach(el); }, seek: (beat) => chart.goTo(beat.sectionKey), dispose() { chart.detach(); } };
<ScrollyView sections={sections.map((s) => ({ ...s, figure }))} />
```

It is the seam for a figure the story should not have to know: a chart library, a canvas, another
framework's component. `ScrollyView` adapts it in a thin host — mounted once while it is on stage (a
different section's figure is disposed and the new one mounted), and asked to `seek` on every beat change.
**A seek that cannot move says why:** it resolves to a sentence, and the lens prints that sentence under the
figure, verbatim, until a later seek answers; it resolves nothing when it moved. Only the latest seek's
answer is shown, and a seek that rejects is shown as the lens's own sentence. The lens judges nothing — the
figure knows whether it can stand on a beat. `isStoryFigure(value)` is the check the lens uses.

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
| mover | `left` · `right` · `up` · `down` | the context steps aside that way, smaller (`scale`), and the subject grows into the room it leaves (`grow`, `fill`, `gap`, `align`; `move: 'aside'` keeps the subject where it is) |
| mover | `place` | named groups moved by the amounts you give (`groups: 'page floor: -90 -200 0.5 \| tl: 0 -230 1.1 @ 960 968'`): a layout you art-direct, still animated from wherever the last click left it |
| mover | `apart` | the exploded view: named groups fly apart along the vectors you give (`apart: 'lid: 0 -120 \| core: 160 0 \| base: 0 120 1.1'`), one spring each, `stagger` ms apart (35), and come back together on a later click without it — the last one out is the first one back |
| overlay | `blur` | everything outside the subject's frame is blurred; a frame (and a `label`) on it, or on the `rect`s you give |
| order | `path` | the subject comes on piece after piece along a route, as a request travels it — node, wire, node: each lit piece on it lights at its turn (`step` seconds apart, 0.35) and glows as it is reached; `route` names the order (default — and for an empty `route` — the click's `on`, or its `in`); a greyed piece on it takes no turn, and a route with no order at all (`on: ['*']`) is refused; a `line` ("agent → MCP → gateway") names the route, shown as the last turn starts. A deck's own `filter` on a path piece is not carried through the glow: it steps where the glow starts and ends |

`'left blur'` reads: the context steps aside to the left, greyed, under a blur, and the subject grows on
the right, framed. `'path grey'` lights a route in turn and greys the rest. Bring your own strategy of any kind
(`strategies: { name: { kind, … } }`); what your own order's `route()` gives is checked like the built-in's — piece
names, a `step` of 0–5 s, a text `line`, a `lineAt` of `'x y'` — and refused with the fix when it is not.

**A path, on a diagram of an app.** An architecture slide is a route more often than a picture: who calls whom.
Write the click's `on` in the order a request travels it, wires included, and the path lights it that way:

```html
<step data-on="agent link-mcp mcp link-gw gw" data-focus="path" data-focus-line="agent → MCP → gateway"></step>
```

Everything on a path keeps its turn: a piece lit from grey glides into colour and the glow in one animation (two
on one `filter` would flash), its ring (`hot`) comes .3 s after its turn, and a dashed twin stays until its solid
twin's turn and only then steps aside, so the wire is never missing. Under a new blur the whole path, line included,
waits .4 s for it, as what a click adds does.

**An exploded view, on a figure of parts.** A figure built of parts — an engine, a stack, a page and the layers
under it — explains itself best when the parts come apart: the audience sees what it is made of, then sees it whole
again. Name the parts as groups and the way each one leaves:

```html
<step data-focus="apart" data-focus-apart="lid: 0 -120 | core: 160 0 | base: 0 120 1.1"></step>
<step data-on="core"></step>   <!-- no apart: the parts come back together, the core lit -->
```

Each group has one spring, its value 0 together and 1 apart, a little under critical damping, so a part settles with
a hint of weight instead of stopping dead. The groups set off `stagger` ms apart (`data-focus-stagger`, 35) — out in
the order written, back in reverse — so the last one out is the first one back. A click that turns the parts round
mid-way reschedules only the groups not yet at its target (those turning round, and those still waiting to set off),
in order, each a stagger after the one before and never sooner than a start it was already waiting for — so the
order is kept: among them the earlier groups always lead, and a click that keeps a group's target keeps its time.
The order is what the library keeps; where the parts go is yours — vectors that cross make paths that cross, so give
each part its own way out. The click after a close keeps the closing groups on their springs one click more, so a
quick click lets them settle from wherever they are. A line or connector that carries a group's name
(`data-k="wire core"`) moves with that group, keeping its place against it. `apart` is a mover, so it goes with a look (the rest
greyed), an overlay and an order, and a click that also asks for `place` is refused, naming the fix; across clicks
the two compose: the parts fly out from the layout `place` left, and back into it.

The springs run in `focusRuntime` (the Watch lens, `SlideDeck`, installs it; a built page inlines it), each deck on
the page its own, played as Web Animations of the same `translate`/`scale` every mover uses (so a piece's own
transform, an SVG group's `transform` attribute included, is never overwritten), which means the video renderer
steps them like any animation. Nothing of a spring is written on the piece: at rest the animation is over and the
piece is exactly as drawn — closed, the figure is its static art. A jump, a step back, print and reduced motion land
at once, as every focus does.

The plan is plain data (each piece's state, what changed since the last click, how far it moved), so a
renderer only draws it. `footprint-storydeck/focus-html` writes it into slide HTML at build time and
`footprint-storydeck/focus.css` animates **only what changed, only on a forward click** — a jump or a step back
lands at once (inline `focusRuntime` in the page), and print shows every click as it lands.

```js
import { planFocus } from 'footprint-storydeck/focus';
import { readPieces, drawFocus, wrapStage, slideClass, focusOverlay, focusRuntime } from 'footprint-storydeck/focus-html';

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

## Tour: a deck that shows its point while nobody is using it

A deck left on a screen with nobody presenting it — at a booth, on a post's Watch lens, as a page's hero figure — is
mostly looked at by people who have not touched it yet. If it sits on its first slide, they never see what it is
for. So, left alone for a moment (1.4 s), it plays a short loop of **stops**, the clicks that make its point, and the
moment someone reaches for it, it hands itself over:

- it drives the **same targets a person would** — the deck's own `goTo`, so a stop one click on animates as that click
  does (focus, `apart`'s springs and all) and a jump lands, as a person's jump does; there is no second animation to
  keep in step;
- **accessibility first**: the moment someone uses it — a key, a tap, a click, a focus, a real move of the pointer
  over it (looked at every 250 ms, so a resting mouse or the deck moving under it is no move, and a finger lifting off
  is not someone leaving), or a move it did not make (the presenter window) — it hands itself over, and it does not
  take the deck back soon: only after **45 s of quiet** (`resumeMs`), or once the deck has left sight and come back.
  It then goes on from the stop they left it on, when that is a stop;
- **Escape**, or the small **"Stop tour"** control it shows while a tour can move in view (or the page's own element
  marked `data-tour-stop`, which it uses instead), stops every tour for the rest of the page view (WCAG 2.2.2). Escape
  is one key with three meanings on a StoryDeck page, each by what is running: while listen mode plays, it stops listen
  mode, and only that; in `PostView`'s Watch lens it returns to Read; and wherever a tour runs it stops every tour on
  the page — so in a touring Watch lens one Escape does both;
- it **waits while out of sight** — scrolled away (IntersectionObserver, reading the newest entry) or the page
  hidden — and while listen mode plays the deck (the deck carries `data-listening`); under **reduced motion** there
  is no tour.

The plan is plain data — the stops, each one's hold, the waits — that a person or an LLM can read, and that the
deck's notes can say in one line (`tourText`):

```js
import { idleTour, tourPlan, tourText } from 'footprint-storydeck/tour';

idleTour(document.querySelector('deck-stage'), { stops: '3 4 5 9:6s', hold: '3s' });   // clicks as the deck counts them
tourText({ stops: '3 4 5 9:6s' });
// "Left alone for 1.4 s, it tours itself: slide 3 for 3 s, then slide 4 for 3 s, then slide 5 for 3 s, then slide 9
//  for 6 s, and round again. A key, tap, click or move hands it over until 45 s of quiet; Escape or "Stop tour" stops it."
```

Declared on the deck instead, for a page built as HTML: `<deck-stage data-tour="3 4 5 9:6s" data-tour-hold="3s">` (and
`data-tour-idle`, `data-tour-resume`), with `(${idleTour})()` once in the page; a deck whose `data-tour` it cannot
read is left out with a console warning naming the fix, and the others still tour. A stop is held 300 ms or more. In
React, the Watch lens takes the same spec — `<SlideDeck steps={…} tour="3 4 5 9:6s" />` — and `PostView` passes the
post's own `tour` (post.json), so a post opts in where its structure is written. A figure that is not a deck tours
through its own function: stops are its names, `go` is what a person's click calls
(`idleTour(figure, { stops: ['lid', 'core'], go: (part) => show(part) })`). The tour's state rides on the element as `data-tour-state` (`waiting`,
`touring`, `paused`, `hidden`, `still`, `done`), so a page can say "touring — touch to explore"; the control is
`.sd-tour-stop`, styled as weakly as can be, so a page restyles it.

It lives on the Watch deck, not in the Scroll or Read lenses: their figure follows the reader's scroll position, so a
tour there would move the page under the reader's eyes; a deck is a place a person steps through, and the tour steps
through it the same way.

## Narration: the deck tells itself, in your voice

A talk lives on after the room: someone opens the deck alone, or it becomes a video. The words were in the
speaker notes all along, so narration is data on each click, and the library turns it into speech, captions and
timing — the same words, three uses. The rules underneath — what a voice says for a number or a symbol, the clip
cache, the captions and YouTube's chapter rule — are [footprint-narration](https://github.com/footprintjs/footprint-narration)'s,
shared with footprint-storyreel; StoryDeck adds what is the deck's own:

- **what the voice says** — `narrationText(notes)`: the notes as a voice reads them. An acronym stays as written
  (a cloned voice says LLM, HCI, MCP as quick letters; spaced out, "L L M" came out slow and odd), only the words
  a voice misreads as a word are spelled (`SPELL`: UI, API — pass your own `spell`, which also gives a word in
  another script its reading), numbers become words, a lone symbol that means something is said (`SAY`: & + = < > ×
  % and Greek letters), any other word without a letter is a pause that keeps its sentence end (a forced aligner
  needs letters in every word), and a line after `[draft]` (a bridge you wrote for the deck) is said, and shown apart;
- **a clip per click, cached by what it says** — `footprint-narration/voice` (Node). A clip's key is a hash of the
  voice settings and the exact words, so editing one note re-voices that click and nothing else, and an interrupted
  run keeps every batch it finished. The voice is a port (`{ name, synthesize(scenes, { work }) }`); `chatterboxKit`
  is one adapter — a local voice kit (Chatterbox, words aligned with MMS_FA; nothing is uploaded). `footprint-storydeck/voice`
  carries the clips inside one page (`embedClips`);
- **in the page** — `footprint-storydeck/narration-html`: N shows this click's notes, P opens a presenter window that
  stays in step, and L plays the deck by itself — each click in your voice (the clips carried in the page), or
  the browser's where a click has none — captions lighting sentence by sentence (styles: `footprint-storydeck/narration.css`).

```js
import { voiceClips, chatterboxKit } from 'footprint-narration/voice';
import { narrationText } from 'footprint-storydeck/narration';
import { embedClips } from 'footprint-storydeck/voice';
import { notesData, notesRuntime, listenRuntime } from 'footprint-storydeck/narration-html';

const texts = clicks.map(c => narrationText(c.notes.now));   // one per click; '' where a click says nothing
await voiceClips(texts, { cache: 'voice/cache', profile, engine: chatterboxKit({ kit: '../voice-kit' }) });
const voice = embedClips(texts, { cache: 'voice/cache', profile });   // { tags, have, wanted }: "voiced 198 of 198"
page += notesData(clicks.map(c => c.notes)) + voice.tags
  + `<script>(${notesRuntime})();(${listenRuntime})();</script>`;
```

A cloned voice is the speaker's own: keep a page that carries the clips internal, and build the public one
without them (the listen mode falls back to the browser's voice).

## Video: the deck as a narrated video

`footprint-storydeck/video` (Node, with ffmpeg 5.0 or newer) renders a deck with its clips into a video for YouTube: every click on
screen while its clip plays. Each click is made forward, so its entrance plays as in the room; then every
animation on the page is paused and **stepped frame by frame** — the same deck renders the same frames — until
the last entrance ends, and that frame is held for the rest of the clip. Beside the video come what an upload
asks for: `captions.srt` / `.vtt` (by sentence, timed by the clips' aligned starts, the words as written),
`chapters.txt` (the chapters YouTube will show, by its rule — the first at 0:00, three or more, 10 s each: a chapter
too short is merged into the one before, and `chapters.changes` says what moved), a `thumbnail.jpg` and a
`timeline.json`. The frames and sounds are made in a temporary folder and removed (name a `work` folder to keep
them); `out` gets the finished files only. Each picture is read at the video's frame rate — an image's own 1/25 s
would drop one entrance frame in six at 30 fps, and a test with the real ffmpeg holds that line.

```js
import { chromium } from 'playwright-core';
import { renderVideo, deckStageDriver } from 'footprint-storydeck/video';
import { clipFor } from 'footprint-narration/voice';
import { narrationText, writtenText } from 'footprint-storydeck/narration';

const steps = clicks.map(c => {
  const spoken = narrationText(c.notes.now);
  return { label: c.label, written: writtenText(c.notes.now), spoken, clip: clipFor(spoken, { cache: 'voice/cache', profile }) };
});
await renderVideo({
  url: 'file:///…/deck.html', steps, out: 'out/video', name: 'my-talk',
  driver: deckStageDriver({ chromium }),            // the browser is a port; this drives storydeck's <deck-stage>
  chapters: c => (/^Part \d+ · /.test(c.label) && !/ · \d+$/.test(c.label) ? c.label : null),
  thumbnail: c => c.label === 'Title',
  only: [1, 14],                                    // a test strip first: a minute, not half an hour
});
```

## PowerPoint: the deck as a .pptx

Conferences often ask for the talk as a PowerPoint file. `footprint-storydeck/pptx` (Node, no ffmpeg) exports one
through the same browser port as the video, so a deck that can be filmed can be exported:

- **one slide per click** — the click's settled picture (made forward, its entrance played to the end, as the
  video's held frame) full-bleed on a 16:9 slide; its written notes as the speaker notes, a paragraph per note;
  its headline (or label) as the slide's title, in the title placeholder just above the page, so the outline, the
  slide list and a screen reader read it and the audience does not see it; a fade between slides;
- **a narrated deck that runs by itself** — with clips (as the video takes them, or found in the voice cache), each
  slide carries its clip, which plays as the slide starts, and moves on after the clip plus `gap` (a click without
  a clip after `noclip` plus `gap`, the video's timing). Without clips no slide moves on by itself: the speaker clicks.

**What it is, honestly:** pictures plus notes plus sound. A slide's words and shapes are in its picture, not
native PowerPoint text or shapes, so they cannot be edited there. Turning a deck's HTML into native shapes is a
possible later step.

**Why a flowchart.** The export is a [footprintjs](https://github.com/footprintjs/footPrint) flowchart —
PlanClicks → GatherClips → CheckClips → TimeTheDeck → ShootPictures → CheckPictures → WriteParts → Zip →
CheckPackage → Verdict → Deliver — so every run leaves a record that explains it, to a person or an LLM
(`done.narrative`). Each check is a `decide()` that records its evidence: a clip whose file is gone, one PowerPoint
cannot play (not a .wav, .m4a or .mp3; an empty file; or bytes that do not begin as their kind of file — RIFF…WAVE,
ID3 or an MP3 frame, ftyp), one over `maxClip` (300 s), a click that says words with no clip;
a click without a 16:9 PNG; a package that does not read back as planned. A refusal names each click and its fix,
carries the record (`error.narrative`), and writes nothing to `out`. The clips are checked before a browser opens.
footprintjs is an optional peer dependency: StoryDeck does not install it (a browser-only install stays small), so
install it beside StoryDeck to export — `npm i footprintjs` — and an export without it is refused, saying so. It is
loaded only when an export runs; the deck's browser runtime never loads it.

```js
import { chromium } from 'playwright-core';
import { deckStageDriver } from 'footprint-storydeck/video';
import { exportPptx } from 'footprint-storydeck/pptx';   // and `npm i footprintjs`: an optional peer, needed to export

const done = await exportPptx({
  url: 'file:///…/deck.html', steps, out: 'out/my-talk.pptx',   // the steps the video takes; or `out` a folder → <name>.pptx
  driver: deckStageDriver({ chromium }),
});
// done: { file, slides, voiced, runtime (s the deck runs by itself, or null), bytes, clicks, narrative }
// [Condition]: No rules matched, fell back to default "Every clip is there, playable and within maxClip": TimeTheDeck.
// …or, refused: exportPptx: a clip is not ready: click 12: its clip lasts 412 s, over maxClip (300 s) — split its notes across clicks, or raise maxClip

// From the deck's clicks and the voice cache instead of steps (give `voice` the `spell`/`say` the clips were voiced with):
await exportPptx({ url, deck: clicks.map(c => ({ label: c.label, notes: c.notes })), voice: { cache: 'voice/cache', profile }, out: 'out', driver });
```

The file is written by hand, with no dependency: a small ZIP writer (`zlib`'s raw deflate and a CRC-32) and a
minimal PresentationML part set (ECMA-376) — content types, relationships, the presentation, one master and one
title-only layout, a theme for each master, the slides, a notes master and a notes page per slide, the media (a
sound said on two clicks is stored once, matched by its bytes) and the document properties. The pieces are
exported for pictures made elsewhere: `pptxParts({ slides })` gives the parts, `zip(parts)` the file, and
`checkPptx(bytes)` reads one back — the ZIP against its CRC-32s, every part well-formed and typed, every
relationship's target there, every `r:id` known, slide, master and layout ids in PowerPoint's ranges, shape ids
unique on each slide — and lists each slide's title, notes, pictures, sound and time. Each export runs that check
before it writes to `out`. The tests also run Info-ZIP's `unzip -t`; LibreOffice, where it is installed, opens
the file and prints it to PDF; and with `STORYDECK_OOXML_SCHEMAS` pointing at the ISO/IEC 29500 schemas, every part
is validated against them. Limits: a clip is embedded as it is (a .wav as voiced: about 3 MB a minute at 24 kHz
mono — convert to .m4a to shrink a long talk); no ZIP64, so a file stays under 4 GB; the slides advance by
themselves when the show's "use timings" is on (PowerPoint's default).

## A deck from a folder: `storydeck`

Building a talk by hand meant writing a build script for it: reading the maps, planning each click's focus,
wrapping the slides, inlining every runtime. That script was the same for every deck, and it was where an editing
session spent its time. So a deck is now a **folder**, and the library builds it:

```
my-talk/
  deck.json      { "title": "A request, end to end" }   — and footer, area, checks when you need them
  clicks.html    a <section> per part; on a map, a <step> per click (data-in, data-on, data-focus, <h2>, notes)
  map.html       the picture: every data-k element with an inline left/top/width/height is a piece
  theme.css      tokens (light, :root.dark) and the look of your pieces
  icons/*.svg    drawn identities, used as <i class="ic" data-icon="server"></i>
```

```bash
npx footprint-storydeck init my-talk      # a starter deck that builds and checks clean
npx footprint-storydeck dev my-talk       # live preview: a save rebuilds, reloads on the same click, plays it again
npx footprint-storydeck build my-talk     # my-talk/index.html — one page, every runtime inside, no network request
```

- **One page, in development and in the room.** `dev` serves the very page `build` writes, with a small dev client
  added: a save reloads on the click you were on and plays that click again (*replay on save*), a save that breaks the
  build shows why over the last good page, and a bar names the click you are on. Nothing of it ships. The page keeps the
  keys a talk needs: ← → Space step, **T** light/dark, **N** notes, **P** presenter window, **L** read aloud.
- **Read first, look last.** A reviewer — a person, or a model that pays for every screenshot — reads the deck as text:
  `outline` (a line per click), `review --click 14` (its headline and words, what it lights, greys, brings in and moves,
  its route, its notes), `check` (what to fix, each with its click and its fix: a headline over 12 words, pieces that
  light just by coming in, a click that changes nothing, a piece never shown, clicks without notes). `check --layout`
  opens the page in a browser and finds text that spills out of its box (it needs `playwright-core`; without it, it says
  so and the other checks run). `mcp` serves the same tools to an AI assistant:
  `claude mcp add storydeck -- npx footprint-storydeck mcp my-talk`.
- **The helpers a diagram needs.** `<i data-k="w1" class="wire pkt" data-arrow="252 352 318 352"></i>` is a wire (an
  SVG arrow, with an optional bend; class `pkt` adds a packet that rides it on a `path` click, at its turn).
  `<i class="ic" data-icon="server"></i>` is `icons/server.svg`. `deck.css` styles the chrome (kicker, headline, footer
  and count), wires, packets, icons and the theme toggle from the token contract, every rule `:where()`, so your
  theme wins.
- **A deck is files, never a program.** Nothing in a deck folder runs: no build script, no deck code. A deck reads only
  its own files (a link that leaves the folder is refused, so a deck someone sent you cannot pull in a file from
  elsewhere), the build never writes through a link, and `dev` listens on the loopback address only, answers only
  requests addressed to localhost, and only reads. The browser for `check --layout` is found in the project you run
  in, never in the deck folder.

The same parts are a Node door, for a script or a test of your own:

```js
import { loadDeck, buildDeck, reviewClick, checkDeck, serveDeck } from 'footprint-storydeck/deck';

const { compiled } = loadDeck('my-talk');
console.log(reviewClick(compiled, 3));      // click 3 of 6 · "1 · The route · 2" (map "map", step 2 of 3) …
console.log(checkDeck(compiled));           // [{ level, rule, click, label, message }]
buildDeck('my-talk');                       // { file, bytes, slides, clicks, ms }
```

## Faster edits — what making one talk taught us

- **Cache by content, not by position.** A clip is keyed by its words and settings: inserting or removing a
  click moves nothing, and a re-voiced note costs one clip. Do the same for anything slow (a film, a render).
- **A strip before the whole.** `only` (video) and `only` (voice, a set of clicks) work on a few clicks: check
  a minute before rendering half an hour.
- **Measure what you hear.** "LLM is said slowly" became a number: forced alignment gave the word's length
  (0.48–0.70 s spaced out, 0.24–0.28 s as written) — fix, re-voice those clips, measure again.
- **One source, several builds.** The room's build carries the presenter's voice and a live demo; the public
  one (slides page, video) leaves both out — a build switch over the same parts, never a second copy.
- **Read a click before you look at it.** On a 37-click talk ported to a deck folder (its 12 KB build script no longer
  needed; the library rebuilds its 37 slides byte for byte), a rebuild after a save takes 3.7 ms, and reviewing a click as
  text costs about 154 tokens against about 1,844 for a screenshot of it — the whole deck about 5,800 tokens as text, about
  68,000 as screenshots. Measured with `node bench/devloop.mjs <deck>` (an Apple M5 Pro, Node 24); text tokens are
  estimated as characters ÷ 4 and a screenshot's by Anthropic's image formula (width × height ÷ 750, at 1568 × 882), not a
  model run. The layout check found a word spilling 17 px out of its box on 24 of those clicks, which the earlier screenshot checks had missed.

## Quick start

```bash
npm install footprint-storydeck
```

```jsx
import { PostView, StoryDeckProvider } from 'footprint-storydeck';
import 'footprint-storydeck/storydeck.css';

export default function App({ post }) {
  return (
    <StoryDeckProvider basePath="/blog">
      <PostView post={post} />
    </StoryDeckProvider>
  );
}
```

`PostView` renders the Read · Scroll · Watch toggle and each lens. Bring your own `post` (see
**Authoring**). For a talk on its own page, start from a folder instead: `npx footprint-storydeck init my-talk`, then
`npx footprint-storydeck dev my-talk` (see **A deck from a folder**). Requires `react`/`react-dom` (peer) and a slide runtime for Watch (a
`deck-stage.js` web component served at `${basePath}/deck-stage.js` — it ships as `footprint-storydeck/deck-stage.js`).

**For agents:** a skill ships in the package — `plugin/skills/storydeck/SKILL.md` (which door for which job,
three recipes, the rules that bite, how to verify). Point a coding agent at it, or install the folder as a
Claude Code skill.

## Authoring (JSON structure + Markdown prose)

A post is a folder — **JSON** for structure + grouping, **Markdown** for prose:

```
post.json     { …meta, sections: [{ key, label, heading, slides: [deckLabel…] }] }
body.md       Markdown per section, split by  <!--section:key-->  markers
deck-data.json  the slides ({ label, html }[]) — e.g. imported from a Claude Design deck
```

The consumer wires these together with the adapter:

```js
import { assemblePost } from 'footprint-storydeck';
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
import { useTheme, ThemeToggle } from 'footprint-storydeck';
const { theme, toggle, setTheme } = useTheme();   // flips an html class + persists
// …or drop in <ThemeToggle />
```

## API

| Export | What |
|---|---|
| `PostView` | the lens controller (Read · Scroll · Watch toggle) |
| `BlogView` · `ScrollyView` · `SlideDeck` | the three lenses (take `sections` / `sections` / `steps`; `SlideDeck` also a `tour`) |
| `SlideFigure` | one slide rendered as a scaled static figure |
| `StoryDeckProvider` · `useBasePath` | inject deploy config (asset base path) |
| `useTheme` · `ThemeToggle` | headless theming + a default toggle |
| `assemblePost` | build a normalized `Post` from JSON + Markdown + slides |
| `renderMarkdown` · `splitBodyByMarkers` | the Markdown adapter pieces |
| `buildSections` · `finalStep` · `allSteps` · `parseGroup` | grouping helpers |
| `slugify` · `scopeDeckCss` | utilities |
| `planFocus` · `focusStep` · `readFocus` · `FOCUS` | focus: per click, what it is about and what happens to the rest (also `footprint-storydeck/focus`) |
| `readPieces` · `readStep` · `drawFocus` · `wrapStage` · `slideClass` · `focusOverlay` · `focusRuntime` | focus, written into slide HTML (also `footprint-storydeck/focus-html`; styles in `footprint-storydeck/focus.css`) |
| `idleTour` · `tourPlan` · `tourText` | tour: a deck (or a figure) that shows its point while nobody is using it, and its plan in data and in one line (also `footprint-storydeck/tour`) |
| `narrationText` · `writtenText` | narration: what a click says (also `footprint-storydeck/narration`); the rules beneath, sentences, captions and chapters are `footprint-narration`'s |
| `notesData` · `notesRuntime` · `listenRuntime` | narration in the page: notes, presenter window, listen mode (also `footprint-storydeck/narration-html`; styles in `footprint-storydeck/narration.css`) |
| `embedClips` | `footprint-storydeck/voice` (Node only): a deck's clips inside one page; the clip cache, the voice port and its local-kit adapter are `footprint-narration/voice`'s |
| `renderVideo` · `planVideo` · `deckStageDriver` · `ffmpegMajor` | `footprint-storydeck/video` (Node only, ffmpeg 5.0+): the deck as a narrated video, with captions and chapters |
| `exportPptx` · `pptxParts` · `zip` · `unzip` · `checkPptx` | `footprint-storydeck/pptx` (Node only): the deck as a PowerPoint file — a slide per click, its picture, notes and clip — through a footprintjs flowchart that records why |
| `loadDeck` · `buildDeck` · `serveDeck` · `outline` · `reviewClick` · `checkDeck` · `layoutCheck` · `initDeck` · `serveMcp` · `runCli` | `footprint-storydeck/deck` (Node only): a deck folder made into one page, served for editing, read back as text — the `storydeck` command (also `npx footprint-storydeck`); its page's base styles are `footprint-storydeck/deck.css` |

The package ships compiled JavaScript (`dist/`, built by `npm run build`: each source file compiled on its
own, JSX turned into `react/jsx-runtime` calls, every relative import given its `.js`, `'use client'` kept), so
plain Node and every bundler load it with no transform of their own; `npm run check:dist` loads every door in
plain Node and refuses a package that ships source JSX. Types ship in `index.d.ts` — hand-kept (nothing
type-checks the JSX to generate them from), and here rather than in a consumer's shim, because a package's
shape belongs in the package.

## Tests

```bash
npm test        # vitest
npm run test:cov
```

438 tests (and 2 that run where LibreOffice or the ECMA-376 schemas are found) · ~99% lines · coverage thresholds enforced (90% statements, 85% branches, 90% functions, 95% lines).

## License

MIT © [Sanjay Krishna Anbalagan](https://github.com/sanjay1909) — part of the
[footprintjs ecosystem](https://footprintjs.github.io/).
