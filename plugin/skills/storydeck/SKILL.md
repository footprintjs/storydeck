---
name: storydeck
description: Build, focus, narrate and film talks and posts with StoryDeck — one source shown as a Read article, a Scroll story or a Watch deck; per-click focus on a diagram (grey, zoom, left/right, place, blur); narration from the speaker notes (a clip per click in a voice, cached by its words; notes, presenter and listen mode in the page; captions and chapters); and a narrated video for YouTube. Use when creating or editing a StoryDeck post or deck, adding focus to a diagram slide, voicing a talk, or rendering a talk as a video.
---

# StoryDeck: one source, many lenses — and a deck that tells itself

A talk or a post is written once: **sections** of slide steps plus prose. StoryDeck shows it as an article
(Read), a scrollytelling story (Scroll) or a click-through deck (Watch), decides per click what the audience
looks at (focus), and turns the speaker notes into a voice, captions and a video (narration). Most of it is
plain data and string builders; only `footprint-storydeck/voice`, `footprint-storydeck/video` and `footprint-narration/voice` touch the
file system. The narration rules underneath (what a voice says for a number, captions, chapters, the clip cache)
are footprint-narration's, a package StoryDeck depends on and shares with footprint-storyreel.

## Pick the door

| You need | Import | Where it runs |
|---|---|---|
| the three lenses (React) | `footprint-storydeck` — `PostView`, `BlogView`, `ScrollyView`, `SlideDeck`; styles `footprint-storydeck/storydeck.css` | browser |
| the slide runtime Watch plays on (`<deck-stage>`) | `footprint-storydeck/deck-stage.js` — serve it, or inline it into a built page | browser |
| what a click is about, and what happens to the rest | `footprint-storydeck/focus` — `planFocus`, `focusStep` | anywhere |
| that focus written into slide HTML | `footprint-storydeck/focus-html` + `footprint-storydeck/focus.css`, `focusRuntime` once in the page | build + page |
| what each click says (`narrationText`, `writtenText`: `[draft]`-aware) | `footprint-storydeck/narration` | anywhere |
| the rules beneath (`spokenMap`, `autoRules`, `SPELL`, `SAY`), sentences, captions, YouTube chapters | `footprint-narration` | anywhere |
| notes (N), presenter (P), listen mode (L) in the page | `footprint-storydeck/narration-html` + `footprint-storydeck/narration.css` | build + page |
| a clip per click in a voice, cached (`voiceClips`, `clipFor`, `chatterboxKit`, `pickSteps`) | `footprint-narration/voice` | **Node only** |
| those clips carried inside one page (`embedClips`) | `footprint-storydeck/voice` | **Node only** |
| the deck as a narrated video | `footprint-storydeck/video` (+ ffmpeg 5.0 or newer on the path, Playwright's `chromium` passed in) | **Node only** |

Never import `footprint-storydeck/voice`, `footprint-storydeck/video` or `footprint-narration/voice` into browser code: they use `node:fs`
and child processes.
The main entry (`footprint-storydeck`) re-exports only what runs anywhere.

## Recipes

**Focus a diagram, click by click.** Every element with `data-k="name …"` and an inline `left/top`
(`width/height`) is a piece. A click names its subject (`on`) and a strategy; the rest is context.

```js
import { planFocus } from 'footprint-storydeck/focus';
import { readPieces, drawFocus, wrapStage, slideClass, focusOverlay, focusRuntime } from 'footprint-storydeck/focus-html';

const { html, pieces } = readPieces(mapHtml);
const area = [0, 230, 1920, 1000];                       // below the headline: the blur never touches it
const { looks } = planFocus([
  { in: ['page', 'code'] },
  { on: ['code'], focus: 'left blur', options: { label: 'the click' } },
], { pieces, area });
const slides = looks.map(look => `<section class="${slideClass(look)}"><div class="map">${wrapStage(drawFocus(html, look), look)}</div>${focusOverlay(look, { area })}</section>`);
// in the page, once: `(${focusRuntime})()` — only a forward click animates; a jump lands at once
```

Strategies, one of each kind at most: look `grey` (default) · `hide` · `keep`; mover `zoom` · `left` ·
`right` · `up` · `down` · `place` (named groups moved by amounts you art-direct); overlay `blur`.

**Narrate a deck in a voice.**

```js
import { voiceClips, chatterboxKit } from 'footprint-narration/voice';
import { narrationText } from 'footprint-storydeck/narration';
import { embedClips } from 'footprint-storydeck/voice';
import { notesData, notesRuntime, listenRuntime } from 'footprint-storydeck/narration-html';

// one entry per click: { slide, step, steps, now: [note, …], earlier: [note, …] }
const texts = clicks.map(c => narrationText(c.notes.now));               // '' where a click says nothing
await voiceClips(texts, { cache: 'voice/cache', profile, engine: chatterboxKit({ kit: '../voice-kit' }) });
const voice = embedClips(texts, { cache: 'voice/cache', profile });     // report `voiced ${voice.have} of ${voice.wanted}`
page += notesData(clicks.map(c => c.notes)) + voice.tags + `<script>(${notesRuntime})();(${listenRuntime})();</script>`;
```

The engine is a port — `{ name, synthesize(scenes, { work }) }`, scenes `{ id, text }`, results `{ id, audio,
duration, words: [{ text, start, end }] }` — so a cloud voice or a test fake plugs in the same way as the local kit.
A clip keeps its timed words (`clipFor(…).words`; `null` for a clip voiced before footprint-narration).

**Render the narrated video.** A strip first, then the whole.

```js
import { chromium } from 'playwright-core';
import { renderVideo, deckStageDriver } from 'footprint-storydeck/video';
import { clipFor } from 'footprint-narration/voice';
import { narrationText, writtenText } from 'footprint-storydeck/narration';

const steps = clicks.map(c => {
  const spoken = narrationText(c.notes.now);
  return { label: c.label, written: writtenText(c.notes.now), spoken, clip: clipFor(spoken, { cache: 'voice/cache', profile }) };
});
const done = await renderVideo({ url: `file://${deckHtml}#1`, steps, out: 'out/video', name: 'my-talk',
  driver: deckStageDriver({ chromium }), only: [1, 14],             // drop `only` once the strip looks right
  chapters: c => (/^Part \d+ · /.test(c.label) ? c.label : null), thumbnail: c => c.label === 'Title' });
// → my-talk.mp4 · captions.srt/.vtt · chapters.txt (what YouTube will show; done.chapters.changes says what its rule merged or moved) · thumbnail.jpg · timeline.json
```

## Rules that bite

- **A clip's key is its recipe**: the voice profile's settings and the exact spoken text. Change the words a
  voice reads — a note, or the `spell` list — and those clicks are voiced again; everything else stays cached.
  `spell` replaces the default list: extend it with `{ ...SPELL, K8s: 'K eight s' }` (`SPELL` from `footprint-narration`;
  a value is words — a letter in every word, no digits, no comma, semicolon or colon at its end — or it is refused).
- **Every word needs letters.** A lone symbol that means something is said (`SAY`: & + = < > × % and Greek
  letters; pass `say` to change it); any other (— → ... an emoji) is a pause that keeps its sentence end. The local
  kit's aligner knows Latin letters only: give a word in another script a reading with `spell` (`{ 日本: 'Japan' }`).
- **Acronyms stay as written** unless a voice misreads them as a word. Spelled with spaces ("L L M"), a cloned
  voice said them slowly; written as one word it says quick letters. Measure before and after (forced alignment
  gives a word's length) rather than guess.
- **Runtimes are inlined, not imported**: `(${notesRuntime})()`, `(${listenRuntime})()`, `(${focusRuntime})()` —
  once per page, after the `<deck-stage>` and the data tags. They read `#deck-notes` and `#deck-voice`.
- **A cloned voice is its speaker's**: a page that carries clips stays internal. A public build leaves
  `embedClips` out; listen mode falls back to the browser's voice.
- **Video frames are deterministic**: each click is made forward, every animation paused and stepped. Looping
  motion stops when the entrance ends. Compare two renders by `timeline.json` and `captions.srt` (equal) and
  frames (byte-equal, or within a hair where the GPU blends a backdrop filter).
- **Paths may be relative; scratch folders are temporary.** `voiceClips` and `renderVideo` resolve every path and
  work in a temporary folder of their own unless you name a `work` folder (which they empty before use) — never
  point `work` at a folder holding anything else, such as a voice kit's reference recording.
- **One source, several builds**: what only works in the room (a live demo, the speaker's voice) is a build
  switch over the same parts, never a second copy of the deck.

## Verify

- `npx vitest run` in the StoryDeck repo (coverage thresholds enforced).
- In a deck: the build's `voiced N of M` count; listen mode (L) plays a clip and moves on; screenshots of every
  click before and after a change; a video strip's `timeline.json` and `captions.srt` before and after.
