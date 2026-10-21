# Changelog

## Unreleased — a deck from a folder, an editing loop, and co-editing

- **`storydeck`: a deck is a folder, and the library builds it.** deck.json, clicks.html (a `<section>` per part; on a
  map, a `<step>` per click), the maps, theme.css and icons/ become one self-contained page (`storydeck build`): every
  stylesheet and runtime inlined, notes, presenter and listen mode, a light/dark toggle (T), no network request. No
  build script per deck: a 37-click talk's own script is replaced, and its slides come out byte for byte. Built-in
  helpers: `data-arrow` wires (with a packet, class `pkt`, that rides the wire at its turn on a `path` click) and
  `data-icon` icons. New `footprint-storydeck/deck.css`: the page's chrome, wires, packets, icons and toggle, every rule
  `:where()` so a deck's theme wins.
- **`storydeck dev`: one page in development and in the room.** It serves the page `build` writes, plus a dev client: a
  save rebuilds (milliseconds), reloads on the same click and plays it again; a save that breaks the build shows why over
  the last good page. Loopback only, localhost requests only, read-only, nothing hidden or outside the deck folder.
- **Co-editing: the person points, the agent edits.** In `storydeck dev`, **note** leaves a note on the click you are on
  (appended to `feedback.md`, a checklist with the click, its label and the time), and **Alt-drag** moves a piece of the
  map: its inline left/top, or a wire's `data-arrow`, is written into the map file — every other byte kept — and the
  page reloads on the same click. `storydeck feedback` (and the MCP `feedback` tool) lists the open notes; `check`
  counts them. The server takes these two edits only from its own page: its origin, a per-session token only that page
  carries, JSON, 16 KB at most; written never through a link; no other origin may frame it. A note is signed with a key
  kept with the person (`~/.storydeck/key`, or STORYDECK_HOME), and only signed notes are listed — a feedback.md that
  came with someone else's deck is counted, never read as your requests. A move names the piece by the number the build
  gave it (in the dev page only) and is refused while the build fails, when the map changed since the build, or when a
  browser would read the piece's tag differently; a bare `0` moved is written in px. Everything the tools print is
  text, never what a reader cannot see (controls, bidi marks, Unicode tag characters, runs of selectors); a note's
  signature covers the person's words and the deck's folder, never the click's label (the deck's text), which is never
  listed. In development only StoryDeck's own scripts run (a nonce policy on every answer): a deck's own scripts run in
  the built page, and none can reach the dev page's edits. The build refuses a `data-sd-…` attribute a deck writes
  itself. The note key is never read through a link nor kept inside the deck folder. `loadDeck`/`compileDeck` take `{dev}`; `deckHtml` also returns the source.
- **Every scan of a deck's text is one pass.** Stripping comments, reading a map's pieces and drawing a slide's focus
  (`readPieces`, `drawFocus`, also on `footprint-storydeck/focus-html`), reading an icon file, and drawing wires and
  icons were quadratic on unfinished tags, unclosed comments or one tag repeating an attribute: a hostile 4 MB map took
  minutes, and `storydeck dev` never came up. Each now reads in one pass (a 4 MB hostile map builds in about 30 ms),
  proved equal to the regex it replaced on thousands of generated inputs, with one deliberate difference: a tag ends at
  its first `>`, so a `data-k` name holding `>` is not read. An `<i data-icon>` naming a property every object has
  (`constructor`) is now refused as an unknown icon.
- **Read first, look last.** `storydeck outline` (a line per click), `review --click n` (headline and words, focus, route,
  lit, greyed, what enters, leaves and moves, notes) and `check` (headline words, pieces lit by coming in, clicks that
  change nothing, pieces never shown, missing notes — each with its click and its fix). `check --layout` measures each
  click in a browser for text that spills out of its box (through the video driver's new `measure(n)`; needs
  `playwright-core`). `storydeck mcp` serves the same tools to an AI assistant over stdio. `storydeck init` writes a
  starter that builds and checks clean.
- **A deck is files, never a program — on your machine.** No deck code runs in Node; Playwright, for the layout check,
  is loaded only from beside StoryDeck (never from the deck folder or the folder you run in), and the page is measured
  offline (`deckStageDriver({offline: true})`: no name resolves, the context is offline and routed to the page's own
  file, WebSockets and popups closed; Playwright 1.48 or newer). A deck reads only its own files: a link out of the
  folder, or to a hidden file, is refused. A build renames a new file into place (never writing through a link) and a
  file deck.json names never lands outside the deck; `--out` writes where you say. The dev server is loopback-only and
  survives any request; the MCP server reaches only decks inside the folder it was started with. A deck's own HTML still
  runs in the browser, like any page: open decks you trust.
- **`zoom` is a camera, so it goes with a mover.** A click can close in while its parts fly apart (`zoom apart`) or move
  (`zoom place`): the camera frames the subject where the mover leaves it. A new strategy kind, `camera` (one a click);
  a camera sees the click as the mover leaves it (subject, context and named groups moved). `zoom` alone draws exactly
  as before, its `subject`/`aside` options included. Refused, naming the fix: a camera with `left`/`right`/`up`/`down`
  (they keep the context in view beside the subject, which closing in would push off the slide), and a camera with a
  deck's own mover that moves the view itself.
- **A blur frames the subject where it ends up.** On an `apart` or `place` click, the subject's box in the plan
  (`look.subject`) and the blur's frame now follow the subject to where its group moved it (before, they kept where it
  stood). Other clicks are unchanged.
- `footprint-storydeck/deck` exports the same parts for a script; `deckStageDriver` gains `measure(n)`, and
  `measureSlide` is exported from `footprint-storydeck/video`.

## 0.6.0 — a figure in any framework, and compiled JavaScript

- **`StoryFigure`: the Scroll lens drives a figure it does not know how to draw.** A section's `figure` may
  now be `{ mount(el), seek(beat), dispose() }` beside the React render function it already took. The lens
  mounts it once into a plain element in the pinned stage, asks it to `seek` with the beat's plain coordinates
  (`{ key, index, sectionKey, step }`) on every beat change, and prints the sentence a seek resolves to under
  the figure (a refusal, verbatim) until a later seek answers; only the latest seek's answer is shown.
  `isStoryFigure` is exported. Additive: render-function figures and HTML steps are unchanged.
- **The package ships compiled JavaScript.** `dist/` holds each source file compiled on its own (JSX to
  `react/jsx-runtime`, relative imports with `.js`, `'use client'` kept), so plain Node and any bundler load
  it with no transform: the `.jsx` workarounds consumers needed (`transpilePackages`, a test runner's
  inline list) are no longer required. Types stay the hand-kept `*.d.ts`. `npm run check:dist` loads every
  door in plain Node and refuses a package that ships source JSX; CI runs it.

## 0.5.0 — PowerPoint, the exploded view, and a tour for decks nobody presents

- **`footprint-storydeck/pptx`: the deck as a PowerPoint file.** `exportPptx` makes a slide per click: its settled
  picture full-bleed, its notes as speaker notes (a paragraph per line), its headline or label as an off-page title
  (the outline and screen readers read it, the audience does not see it), and a fade. With clips, each slide plays
  its clip and moves on after it (plus `gap`): a narrated deck that runs by itself. It drives the browser through
  the video's port (`deckStageDriver`). The export is a footprintjs flowchart, so every run leaves a record
  (`narrative`), and each check is a `decide()` with its evidence. A clip that is missing, empty, not the sound its
  name says, over `maxClip` or never voiced, a click without a 16:9 PNG, or a package that does not read back is
  refused before a browser opens or a file is written, naming the fix. Media are shared by their bytes, never by
  name. The ZIP, the PresentationML parts and the read-back are written by hand and exported (`zip`, `unzip`,
  `pptxParts`, `checkPptx`). Opened in PowerPoint 16 with no repair prompt; every part validates against the
  ISO/IEC 29500 schemas. It is pictures, notes and sound, not editable native shapes. footprintjs is an optional
  peer dependency: `npm i footprintjs` beside StoryDeck to export; nothing else loads it.
- **`apart`, the exploded view.** A focus mover: named groups fly apart along the vectors you give
  (`data-focus-apart="lid: 0 -120 | core: 160 0 | base: 0 120 1.1"`), one spring each, `data-focus-stagger` ms apart
  (35), out in the order written and back in reverse on a later click without it; closing groups settle for one
  more click. A click reschedules only the groups not yet at its target, in order, never sooner than a start they
  were already waiting for, so the earlier groups lead. `focusRuntime` plays the springs as Web Animations, each deck
  its own, so at rest a piece is exactly as drawn and the video renderer steps them; `SlideDeck` now installs it.
  Two movers on one click are refused, naming the fix; a group's numbers are strict and its scale must be above 0
  (for `place` too). Every `focusStep` look now carries `apart` (`null` without it), and every piece `apart`.
- **`footprint-storydeck/tour`: a tour for decks nobody presents.** `idleTour` plays a deck's stops through its own
  `goTo` after 1.4 s with nobody touching it. A key, tap, click or real move hands the deck over until 45 s of quiet;
  Escape or the "Stop tour" control (its name is its visible words; hidden while no tour can move in view) stops
  every tour for the page view (WCAG 2.2.2). It waits while out of sight or while listen mode plays the deck
  (`data-listening`, now set by `listenRuntime`), and never runs under reduced motion. Declared as
  `<deck-stage data-tour>`, `SlideDeck`'s `tour`, or post.json's `tour`; `tourPlan` and `tourText` give the plan as
  data and in one line.
- **Video:** the driver finishes click n−1's motion before stepping on, so a strip renders the same frames as the
  full video. `focusRuntime`'s install flag is its version, so an older inlined runtime no longer blocks it.

## 0.4.0 — a path: the subject piece after piece along a route

- **A fourth kind of focus strategy, the order — how the subject comes on — and its first strategy, `path`.**
  A click lights its subject piece after piece along a route, as a request travels it (node, wire, node): each lit
  piece on it lights at its turn, `step` seconds apart (0.35), and glows as it is reached — on every forward click,
  so the request travels again; `route` names the order (default, and for an empty `route`: the click's `on`, or its
  `in`), a name shared by several pieces is one turn, a name with nothing lit takes none (a greyed piece never waits
  or glows grey), and a lit piece off the route lights at once. A click that asks for a path with no order at all
  (`on: ['*']`) is refused, naming the fix: write the pieces in the order they light. A `line` names the route, shown
  as the last turn starts (`lineAt` places it; default the area's bottom left; a blank one is none). Borrowed from the isometric figures where a
  request lights its path.
- Everything on a path keeps its turn. A piece lit from grey plays one animation, `sdLightPulse`, whose filter lists
  the same functions at every keyframe, so it glides into colour and the glow (a light and a pulse on one filter
  would flash); a ring (`hot`) comes .3 s after its piece's turn; a dashed twin stays until its solid twin's turn,
  then steps aside, so the wire is never missing; and under a new blur the whole path, line included, waits .4 s for
  it, as what a click adds does. One variable carries a piece's moment, `--sd-turn`.
- `focusStep` gives each piece its `path` (its turn's delay, or null) and `twinTurn` (stepping aside for a lit twin
  on the route: that twin's turn, or null), and the look its `path` ({turns, step, done, line, lineAt}; `line` '' and
  `lineAt` null when none is given). What an order's `route()` gives — a deck's own too — is checked (names, a
  `step` of 0–5 s, a text `line`, a `lineAt` of 'x y' or null) and refused with the strategy's name and the fix,
  and is only read, never written to (a frozen result is fine). `focusOverlay` writes the line; `focus.css` animates
  the path only on a forward click, never under reduced motion (`--sd-glow` colours the pulse). A click without a
  path is drawn byte for byte as 0.3.0 drew it.

## 0.3.0 — `footprint-storydeck`; the narration rules move into footprint-narration

- **The package is renamed `footprint-storydeck`** — the footprintjs family's name, as footprint-storyreel and
  footprint-narration. Install `footprint-storydeck` and import from it: every door keeps its path under the new
  name (`footprint-storydeck/focus`, `/focus-html`, `/narration`, `/narration-html`, `/voice`, `/video`,
  `/deck-stage.js`, the CSS files). `storydeck` (0.1.0, 0.2.0) is deprecated and points here; the repository stays
  `footprintjs/storydeck`.

The rules a voice reads by, the sentences, the captions, YouTube's chapter rule and the clip cache now live in
[footprint-narration](https://github.com/footprintjs/footprint-narration) — one package that StoryDeck and
footprint-storyreel both use, so the two stop keeping copies that drift. StoryDeck keeps what is the deck's own.
**What each note says is unchanged**: the four clip-key goldens and a real deck's 198 clips still match.

- **`footprint-storydeck/narration`** keeps `narrationText` (now footprint-narration's automatic rules over `writtenText`) and
  `writtenText`. Removed, now imported from `footprint-narration`: `numberWords`, `SPELL`, `SAY`, `sentences`,
  `saidSentences`, `captionCues`, `stamp`; `toSrt` / `toVtt` → `captionFile(cues, 'srt' | 'vtt')`; `clock` →
  `clockText`; `chapterList` → `youtubeChapters`. The main door re-exports only `narrationText` and `writtenText`.
- **`footprint-storydeck/voice`** keeps `embedClips`. Removed, now imported from `footprint-narration/voice`: `clipKey`,
  `clipFor`, `voiceClips`, `chatterboxKit`, `pickSteps`; `sentenceStarts` is `footprint-narration`'s. A clip
  voiced from now on keeps its timed words (`clipFor(…).words`); a clip voiced before keeps working. The types
  `Clip`, `VoiceProfile`, `VoiceEngine` (voice) and `Cue`, `CaptionStep`, `ClipTiming` (narration) are
  footprint-narration's too. From its CHANGELOG: `pickSteps` refuses anything but steps and ranges, `voiceClips`
  logs "N clips wanted · M to voice · the rest are cached", and a caption file leaves out a cue under 0.05 s.
- **`narrationText(notes, { spell, say })`**: what a rule says is final (a custom list no longer chains `A → B → C`),
  and a list that cannot be said is refused — a key must be one word; a value must be words, a letter in every
  word, no digits and no comma, semicolon or colon at its end (`{ Win: 'Windows 11' }`: write `'Windows eleven'`).
  Every other note says what it said, except a number: from a million it is said in millions, and a run of more
  than fifteen significant digits digit by digit — a click with one is voiced again.
- **`renderVideo`**: `chapters.txt` holds the chapters YouTube will show, by its rule — a chapter shorter than 10 s
  merges into the one before, an opening shorter than 10 s yields 0:00 to the next, and fewer than three is no
  chapters (an empty file) — and `done.chapters` is `{ lines, text, kept, changes, problems }` (it was
  `{ text, problems }`). A chapter title is words: a blank one (or `null`) names no chapter, a number is its digits,
  and a blank `intro` is "Intro" (0.2.0 wrote them as given). `done.cues` counts the cues the caption files hold. `captions.vtt` numbers its cues, and a caption longer than 42 characters breaks onto two
  lines at the space nearest its middle (both files; a long sentence still makes long lines — nothing is cut).
- **Node 22 or newer** (`engines`): Node 18 and 20 have reached their end of life.

## 0.2.0 — the deck tells itself, and becomes a video

- **Narration** (`storydeck/narration`): what each click says, from its speaker notes — `narrationText` (an
  acronym stays as written; only the words a voice misreads as a word are spelled, `SPELL`: UI, API; numbers as
  words; `[draft]` bridge lines), `sentences`, `captionCues` → `toSrt` / `toVtt`, `chapterList` (YouTube's rules
  checked).
- **Voice** (`storydeck/voice`, Node): a clip per click, cached by what it says — editing one note re-voices that
  click alone. The voice is a port; `chatterboxKit` is the adapter for a local voice kit. `embedClips` carries
  the clips in a single-file page.
- **Narration in the page** (`storydeck/narration-html`, `storydeck/narration.css`): notes (N), a presenter
  window (P) and listen mode (L) — the deck plays itself in the speaker's voice or the browser's, with captions.
- **Video** (`storydeck/video`, Node + ffmpeg): `renderVideo` — every click made forward, its animations stepped
  frame by frame, held for its clip; captions, chapters, a thumbnail and a timeline beside the video. The browser
  is a port; `deckStageDriver` drives `<deck-stage>` with Playwright.
- **`storydeck/deck-stage.js`**: the slide runtime Watch plays on, now in the package.
- **An agent skill** ships in the package: `plugin/skills/storydeck/SKILL.md`.
- **The package holds the library only**: no tests, no demo-site files (0.1.0 carried both).

## 0.1.0 — one source, many lenses

The first version on npm. Read · Scroll · Watch from one source (`PostView`, `BlogView`, `ScrollyView`,
`SlideDeck`), additive builds in `<deck-stage>`, a live figure in Scroll, mobile Watch in full screen, and
**focus** (`storydeck/focus`, `storydeck/focus-html`, `storydeck/focus.css`): per click, what the click is about and
what happens to the rest — looks `grey` · `hide` · `keep`, movers `zoom` · `left` · `right` · `up` · `down` ·
`place`, overlay `blur`; only a forward click animates.
