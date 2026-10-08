# Changelog

## 0.4.0 — a path: the subject piece after piece along a route

- **A fourth kind of focus strategy, the order — how the subject comes on — and its first strategy, `path`.**
  A click lights its subject piece after piece along a route, as a request travels it (node, wire, node): each lit
  piece on it lights at its turn, `step` seconds apart (0.35), and glows as it is reached — on every forward click,
  so the request travels again; `route` names the order (default, and for an empty `route`: the click's `on`, or its
  `in`), a name shared by several pieces is one turn, a name with nothing lit takes none (a greyed piece never waits
  or glows grey), and a lit piece off the route lights at once. A click that asks for a path with no order at all
  (`on: ['*']`) is refused, naming the fix: write the pieces in the order they light. A `line` names the route once
  it is done (`lineAt` places it; default the area's bottom left). Borrowed from the isometric figures where a
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
