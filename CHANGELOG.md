# Changelog

## 0.3.0 — the narration rules move into footprint-narration

The rules a voice reads by, the sentences, the captions, YouTube's chapter rule and the clip cache now live in
[footprint-narration](https://github.com/footprintjs/footprint-narration) — one package that StoryDeck and
footprint-storyreel both use, so the two stop keeping copies that drift. StoryDeck keeps what is the deck's own.
**What each note says is unchanged**: the four clip-key goldens and a real deck's 198 clips still match.

- **`storydeck/narration`** keeps `narrationText` (now footprint-narration's automatic rules over `writtenText`) and
  `writtenText`. Removed, now imported from `footprint-narration`: `numberWords`, `SPELL`, `SAY`, `sentences`,
  `saidSentences`, `captionCues`, `stamp`; `toSrt` / `toVtt` → `captionFile(cues, 'srt' | 'vtt')`; `clock` →
  `clockText`; `chapterList` → `youtubeChapters`. The main `storydeck` door re-exports only `narrationText` and
  `writtenText`.
- **`storydeck/voice`** keeps `embedClips`. Removed, now imported from `footprint-narration/voice`: `clipKey`,
  `clipFor`, `voiceClips`, `chatterboxKit`, `pickSteps`; `sentenceStarts` is `footprint-narration`'s. A clip
  voiced from now on keeps its timed words (`clipFor(…).words`); a clip voiced before keeps working.
- **`narrationText(notes, { spell, say })`**: what a rule says is final (a custom list no longer chains `A → B → C`),
  and a list that cannot be said is refused — a key must be one word; a value must be words, a letter in every
  word and no digits (`{ Win: 'Windows 11' }`: write `'Windows eleven'`). A number from a million is said in
  millions. Every default-list note says what it said.
- **`renderVideo`**: `chapters.txt` holds the chapters YouTube will show, by its rule — a chapter shorter than 10 s
  merges into the one before, an opening shorter than 10 s yields 0:00 to the next, and fewer than three is no
  chapters (an empty file) — and `done.chapters` is `{ lines, text, kept, changes, problems }` (it was
  `{ text, problems }`). `captions.vtt` numbers its cues, and a caption longer than 42 characters breaks onto two
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
