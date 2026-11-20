# Changelog

## 0.20.0 — a picture that holds its wires, names that fit, and the build's record of a map

- **The floor and the picture hold the wires too.** A wire that goes round a block reaches past the blocks, and a
  fitted picture cut it off at the slide's edge. The wires are now laid as soon as the blocks stand, before anything
  is fitted: a fitted floor lies under every wire, and the fitted picture keeps every wire on the slide. A map the
  build places, or one with `data-iso-grid="fit"`, may stand a little differently on the slide than in 0.19.0.
- **A block's name fits its top face.** The name (the `<b>`) stays as written when it fits on one line; else it is
  broken onto two lines where they are most alike; else it is made smaller, down to 16 px. A name that still does not
  fit is drawn at 16 px, and a new rule, `name-fit`, warns with the two ways out (shorten it, or widen the block).
  Counted in letters, since a build has no browser; `build --layout` measures the page. A no-break space (`&nbsp;`)
  keeps two words on one line. A `<b>` with a style or markup of its own is left alone. Names that ran past their block in 0.19.0 are drawn differently now.
- **`data-head="none"`** on any wire: a plain line that runs its whole length, with no arrow's head.
- **The build's record of a map**, beside the page: `compileDeck(source).maps[name]` has `made` (who placed the
  blocks, the tile, whether the picture was fitted), `cables` (each cable's corners and its line's length in slide
  px, the stretches a block hides, what it passes behind, crosses and shares) and `tight`. The run's log has a new
  stage, `maps made`, with the same facts. Each cable carries its line's length in the page as `--sd-length`, so a
  deck's own CSS can time a thing to a cable without measuring.
- **A map is made in one order, each step one function**: icons, blocks placed, wires laid in tiles, floor and
  picture fitted, pieces drawn, callouts, wires drawn. A wire's way is found once.
- `footprint-story` 0.12.0 or later (`gridFor` · `also`, `wordsToFit`, `unseen` on a route).

## 0.19.0 — wires that find their way, and say so

- **A wire between two blocks finds its way along the floor.** In 0.18.0 it was one curve between two fixed feet,
  and where that curve could not lie (a block straight in front of another, close beside it, a request and its answer
  that would cross) the wire stayed straight; a wire to a block two steps away ran behind the block between. Now the
  way is found on the floor's own tile lines: it leaves a block at a foot a viewer sees, turns in rounded corners,
  goes round a block that stands in its way, keeps off floor a block hides when it can, and comes into the other
  block at a foot that is seen. A request and its answer lie in two lanes. A block straight in front of another,
  behind it or against it is reached the same way. A wire has no way, and is drawn straight as before, when the two
  blocks stand at different heights, a block's feet are closed in, the pair is walled apart, the map is too wide for
  its smallest block, or the map is too big to lay every wire. You still write only what is joined to what.
- **The build says what it could not do.** `check` and `build` have a new rule, `wire-way`. A warning: a wire
  passes behind a block (which block, and the two ways out), lies on another for want of room at a foot, or is drawn
  straight because there is no way along the floor or no place at a foot. A note: a wire is drawn straight because
  the two blocks stand at different heights, the map is too big to lay every wire (a count of work, and 1,024 wires
  at most) or too wide for its smallest block; it crosses three or more others; or it turns more than three times.
  The build keeps what it knows beside the page, so nobody, person or model, has to look at the picture to find out,
  and nothing a deck writes can pass for the build's word. **A deck that passed `check --strict` may now fail it**:
  these warnings are new, about wires that were drawn the same way, or worse, before.
- **One way for a deck and a film.** The way is `footprint-story/isometric`'s `routes`, and its rounded corners and
  the place of a packet along it are `rounded` (0.11.0): a film lays the same wires and rides them the same.
- **What changes in a deck you have (the picture, not the files).** Every cable is drawn anew: straight runs along
  the tile lines with rounded corners, where 0.18.0 drew one long curve. Wires 0.18.0 left straight between two
  blocks on one floor are cables now. A cable's packets ride its line by `offset-path` (every current browser).
  Unchanged: wires between flat pieces, wires by numbers, a wire from a block to a flat piece, a wire with a bend
  (`0` too), a wire between blocks at different heights, and where a cable's label stands (on it, on a plate).
- **Not promised.** Wires are laid in the order written and an earlier one is never moved for a later one, so the
  fewest crossings there could be are not promised. A foot has room for three wires; a fourth lies on another, and
  `check` says so.
- `footprint-story` 0.11.0 or later.

## 0.18.0 — wires that lie on the floor

- **A wire between two blocks is a cable on the floor, where one can lie.** It ran straight from one block's
  outline to the other's, through the air over the floor. Now it leaves the foot of one block and arrives at the foot
  of the other, along the floor's tile lines, as one smooth curve. Of two blocks, one stands to the right on the
  slide: the cable joins the foot under the right face of the block on the left to the foot under the left face of
  the block on the right, whichever of them it starts from. So its arrow's tip is on a face the viewer sees, and a
  request and its answer lie side by side, one inside the other. Several cables at one foot share it out, the one
  whose other end is furthest up the slide nearest the back, which keeps most of them from crossing. A cylinder's
  feet are on its round base. A packet (`pkt`, `data-packets`) rides the curve itself.
- **Where a cable cannot lie, the wire stays straight.** Each cable is laid and then looked at. One that would pass
  under what either of its own two blocks draws is not kept: that is a block standing straight in front of the other,
  behind it, or close beside it along a tile line (under about two tiles between them) — and, now and then, a cable
  whose own place on a foot many cables share would put it under its block. A request and its answer that would cross
  as cables are not kept either, and the two are always drawn alike. Such a wire is drawn as 0.17.0 drew it. On a map
  the build places, nearly every wire is a cable.
- **A cable's label stands on the cable.** `data-label` on a cable is written on the cable, on a plate of the
  slide's ground (`--bg`; a new token, `--wire-plate`, for a tinted floor), where a wire's label stands beside it. It
  takes the cable's middle, or the nearest place along the cable where no block is drawn over it, no label placed
  before it is under it, no other cable runs through it and it is off the cable's own two ends; where there is no
  such place, the one where the least of it is hidden. A packet passes under the plate, the arrow's head is drawn
  over it, and where packets do not run (reduced motion, print) one rests beside the plate, not under it. The search
  has a fixed amount of work for one map (enough for some hundreds of labelled cables), so a map of thousands still
  builds in a second or two; a label past that takes its cable's middle.
- **What changes in a deck you have (the picture, not the files).** A wire written between two isometric pieces
  with no bend is now a cable wherever one can lie, and its label moves onto it. To keep one straight, give it a
  bend, `0` too: `data-arrow="you to server 0"`. Drawn exactly as before: wires between flat pieces, wires by numbers,
  a wire from a block to a flat piece, a wire with a bend, and a wire between blocks standing at different heights —
  with two small exceptions. A straight wire between two blocks that also have a cable between them no longer leaves
  a lane free for it. And a label's width is measured by the letters it shows, so the box of a wire whose label
  holds an entity (`&amp;`) is a little narrower.
- **What a cable does not do.** It lies on the floor, so a block standing nearer the viewer is drawn over it. It
  does not go round other blocks: a cable to a block two steps away may pass behind the block between. A label
  longer than its cable covers it, and a long label beside a cable's twin may have the twin's line through it.
- New files: `deck/cable.js` (the geometry: plain numbers in, plain numbers out) and `deck/REFERENCES.md` (whose
  methods the folder uses).

## 0.17.0 — blocks nobody has to place

- **An isometric map with no places typed.** Leave `data-at` off every block and say what is joined to what with the
  wires (`data-arrow="you to server"`): the build places the blocks. On the slide a block stands one step to the right
  of what leads to it, the blocks led to from one place stand one below the other, and they are far enough apart that
  no block covers another and a wire has room for its arrow. So a system reads left to right and fills the slide. The
  same map always gives the same picture. The placing is `footprint-story/isometric`'s `arrange` (0.10.0), so a film
  can place the same blocks the same way.
- **Nothing else needs a number either.** A block or a cylinder with no `data-size` is `2 2 1`. A floor with no
  `data-size` is fitted round the blocks, a tile of floor on every side. With no `data-iso-grid`, a map the build
  placed gets the tile that lets the blocks fill the slide's area, from 96 to 160 px wide; a picture too big for
  that runs past the slide, `build --layout` names a lit block that does, and a click's camera frames what the click
  shows. A floor is at most 256 tiles a side: a map so long that its fitted floor would pass that is refused, with the
  fix (take the floor out, or size it yourself). `data-iso-grid="fit"` asks for that
  tile on a map that places its own blocks.
- **A wire to a block ends on the block.** A wire between pieces ran from box to box, and the box a block is placed
  by has empty corners: the arrow stopped short of the block, and two blocks standing clear of each other were refused
  as "too close" because their boxes met. A wire to an isometric piece now runs to the outline of what it draws.
  Wires in a deck that has isometric pieces move a little; wires between flat pieces are drawn exactly as before. A
  name that a block shares with another piece still stands for one box round them all: that end of a wire is where it
  was.
- **It is all or none (breaking for one case).** A map that places some of its blocks and not the others is refused,
  naming them. Before, a block with no `data-at` stood at `0 0`: write `data-at="0 0"` on it to keep that. A map with
  one block and no `data-at`, and no `data-iso-grid`, now gets the fitted tile where it had a tile 120 px wide.
- `footprint-story` 0.10.0 or later.

## 0.16.0 — one call after an edit, and a record of how it went

- **`build` is the one call after an edit.** It reads the deck once, checks it, writes the page, and answers in one
  order: the verdict first (`clean`, `fix <n>` or `broken`), then each thing to fix with its click and its fix, then
  what was written, then what changed since the run before (`since the last run: 2 fixed, 1 new · round 3`).
  `--layout` also measures the page in a browser. `check` is the same run with nothing written, so the two can never
  disagree about a deck. A build that finds something to fix still writes its page; `check --strict` is the gate.
- **The reply changed (breaking for anything that reads it).** A clean check says `clean — nothing to fix` where it
  said `no problems`. A build's first line is the verdict, and its `✓` line follows the problems. A deck that does not
  compile is the verdict `broken`: `build` prints it with the reason and exits 1, as before, and over MCP it is an
  error result. A reply lists the first 30 problems and counts the rest by rule; `--all` (MCP: `all: true`) lists
  every one. Notes (pieces never shown, missing notes, open feedback) follow what there is to fix.
- **What a browser found stays open until a browser measures again.** A run without `--layout` cannot know whether a
  spill is gone, so it never counts one as fixed: it begins `clean so far — 1 problem a browser found before was not
  measured again (--layout measures)`, and only a measure that finds it gone says `clean`.
- **`storydeck log`: how a result was made.** Every check and build leaves a small file with you (`STORYDECK_HOME`, or
  `~/.storydeck`), never in the deck: its verdict, its counts, each stage's time, each browser call, and the run in
  words, with every choice it made and the value it read. `log` lists a deck's last 30 runs, how its fixing went
  (rounds, and how many problems it began with) and how often each tool was called; `--run 1` shows one run in full.
  Over MCP it is the `log` tool. Beside each run the record itself is kept, written as the run goes. To count the
  calls, every read-first command (`outline`, `review`, `feedback`, `narrate`, `log`, in the command line and over
  MCP) now writes one small file there, `calls.json`; they wrote nothing before. A folder that cannot be written
  counts nothing, and no command waits on it.
- **`check` and `build` are a flowchart.** They run on [footprintjs](https://github.com/footprintjs/footPrint), as the
  PowerPoint export does: each go or no-go is a recorded decision, and the browser is an adapter with a chart of its
  own, each of its steps a named call. So `footprintjs` (14.1 or later) and `foottrace` now come with StoryDeck; they
  were an optional peer you installed for the export. That adds about 20 MB to an install. They load only when a run
  or an export starts: the page's browser runtime never loads them.
- **What is checked is what is written.** A build read the deck twice, once to check and once to write, so an edit
  made in between could put an unchecked page on disk. A run reads it once.
- **Every browser call has a time limit of its own,** above the browser's own time-outs: opening the page (2
  minutes), measuring a click (1 minute) and closing (30 seconds). A call that never answers ends there, the measure
  stops as one error naming the call (`browser.measure did not answer within 60000 ms`), and the run goes on to say so.
- **Fixed: `--layout` no longer reports a floor as past the slide's edge.** An isometric floor is ground: no view
  frames it, so it runs past the edge by design. Every isometric deck got an `outside` warning for it. A piece that
  says `data-ground="false"` is part of the picture, and is still measured.
- **Fixed: a browser still starting is closed.** `deckStageDriver`'s `close()` did nothing when the browser had not
  finished starting, so an opening that was given up on left it running. It now closes that browser as it arrives.
- **`layoutCheck` rejects with the first step that failed.** A close that failed after a failed open or measure took
  its place, and named the wrong step.
- **`runDeck`** is exported from `footprint-storydeck/deck`: the run a script can make itself, returning the verdict,
  the problems, what was written and where the run stands.

## 0.15.1 — a ring follows what a piece draws

- **A ring round an isometric piece follows its faces.** In a deck that explores (`"explore": true`), a piece that
  leads to another click shows a ring on hover. The ring was drawn round the piece's box, so a block seen from a corner
  got a flat rectangle over it, and a wire got one round its whole box. Now a block or a cylinder is ringed round its
  faces, a floor along its edge, and a wire is marked along its line (its colour and a thicker line). A box keeps the
  ring it had. A highlight (`data-hot`) on an isometric piece follows its faces too, and comes in when a box's ring
  does (.3 s after the click, or after its turn on a route). A highlighted piece keeps the highlight's ring on hover.
- **An isometric piece takes the pointer where it is drawn.** On the slide shown, its faces and its words do; the empty
  corners of the box it is placed by do not. Before, a nearer block's box covered part of the block behind it, so a
  hover or a click on the further block could land on the nearer one.
- **`--sd-hot-width`** is a new token: the width of the highlight's ring round a box (5px). An isometric piece sets it
  to 0 and draws its own ring round its faces, 5px wide.

## 0.15.0 — stages that stay put, a camera that pans, and when the view has arrived

- **Stages: what stays put while the view moves.** `data-stage="panel"` on a piece puts it on a stage of its own. Every
  stage has its own view, and a click's camera moves one of them: the main stage, or the one it names
  (`data-focus-stage`). Every other stage keeps the view the last click left it, so a panel, a legend or a small overview
  stays where it is while the map's view moves. A camera sees the pieces of its stage only. A wire or a callout stands on
  the stage of the pieces it touches when they share one, and `check` warns when it joins two (`across-stages`). From a
  field report: a deck that could not say "this stays put" built its own camera out of a mover and lost what a camera
  gives. One stage moves on a click. A map with stages may not have a piece inside another, or a stage on a part of
  an `<svg>` drawing: both are refused with the fix. A map with no stage of its own builds byte for byte as before
  (60,000 random maps planned and drawn by 0.14.1 and by this, compared).
- **A camera that keeps its size: `pan`.** `data-focus="pan"` moves the view to the subject at the scale the last click
  left it. Choose the size once with `zoom` or `fit`, then pan. With nothing to go to, it stays where it is. The same report counted 27 of 62 moves that changed scale
  by more than a quarter, alternating in and out.
- **`--sd-arrive-at`: when the view of this click has arrived.** 0 when no view moves and on an arrival that plays
  nothing (a jump, a step back, reduced motion), the view's move time when one moves, the end of its turn when a route
  gives it one. A deck's own animation waits on it: `animation-delay: var(--sd-arrive-at)`. `slideStyle(look)` is the
  new export that writes the turn's moment on the slide, so a 0.14 deck whose route gives the view a turn gets one more
  style on that slide.
- **A table of "I want this, write that"** in the README and the skill. Four of ten asks in the report were for things
  StoryDeck already did (wires and packets, leave timing, a part arriving with a fade, one name of several in a CSS
  rule), which says the guide was hard to find things in.
- **A piece that holds a tag closing itself (`<g/>`) is read to its own end.** The scan for an element's end counted
  such a tag as one more to wait for, so a callout or an isometric piece holding one was read too far or refused as
  never closed. `closeOf` moved to `pieceRules.js`.

## 0.14.1 — one engine: footprintjs 14

- **The optional footprintjs peer is `^14.0.0`** (0.14.0 said `^11 || ^12 || ^13 || ^14`). StoryDeck's PowerPoint export is
  tested on footprintjs 14 only, and StoryReel 0.30 and the rest of the family ask for 14, so the range now says what is
  tested and an app keeps one engine. footprintjs 14 needs foottrace `^2.1.0` beside it. An app that exports with an
  older engine stays on StoryDeck 0.14.0; an app that does not export to PowerPoint needs no engine and is not affected.
- Nothing else in the published package changes.

## 0.14.0 — the isometric look, a view that follows, and an order inside a click

- **A camera that keeps the whole picture in view: `fit`.** `data-focus="fit"` frames everything a click shows, lit and
  greyed, so the view slides to a piece that comes in and pulls back as the picture grows. It is for a picture larger than
  the slide: `zoom` closes in on what a click is about and never goes further out than the picture as drawn. It fills
  `share` (0.8) of the area, never closer than `most` (2.5) and never further than `least` (0.25); under the look `hide`
  only what is lit is framed. It goes with every mover, `left`/`right`/`up`/`down` too, because it keeps the context in
  view. A deck's own camera says the same with `keepsContext: true`, and a camera is now told the click's `look`.
  A deck that does not ask for `fit` builds byte for byte as before.
- **An order you write inside a click.** A path's route (`data-focus-route`) is now written as turns:
  `camera w1:1.2 dns (w2 server)`. Names alone come one after another, as a route always did. `(a b)` puts names in
  one turn, so they come together. `name:seconds` gives a turn its own time before the next starts, and a wire's packet
  rides that long. The word `camera` gives the view's move a turn: what comes after it waits until the view has arrived,
  and the turn's time (1 s, or `camera:0.6`) is the move's time. On a click where the view stays, its turn takes none; a
  piece really called `camera` is itself. `review` reads the route back as it plays. The written form is read by
  footprint-story 0.9 (`readTurns`), which StoryDeck now needs, so a film can say an order the same way. A deck's own
  order strategy may give `turns`, and is told `isName`. A route written before turns plays exactly as it did: each
  turn starts at the same millisecond (a test pins it), and nothing new is written into its slides. `focus.css` gains
  one rule, for a view with a turn.
- **Blocks on a floor: the isometric look.** In a map, `data-iso="block"` (or `cylinder`, or `floor`) with
  `data-at="col row"` and `data-size="wide deep high"` draws a piece as seen from a corner: three faces, its words flat on
  its top. The build places it, sizes it and gives it its level, so the nearer block is painted over the further and the
  map's own order never moves. `<i data-iso-grid="150 at 1500 150"></i>` sets the tile and where the floor stands. It
  is a piece like any other, so every click, `fit`, a route, a wire and a callout work on it. One colour a piece
  (`--iso-color`). The numbers come from footprint-story 0.9 (`footprint-story/isometric`). The page carries its
  stylesheet only when a deck has such a piece; a deck without one builds byte for byte as before.
- **Ground.** `data-ground` on a piece (a floor has it by itself) says it lies under the picture: a camera and a blur
  frame what stands on it, never the ground, so a view follows the pieces though the whole floor is shown.
- **A callout stays beside a piece that stands wholly off the slide.** A picture larger than the slide, shown by a
  camera, has pieces past the slide's edge; a callout about one was held at the edge, far from its piece. A piece on the
  slide, or partly on it, keeps its bubble on the slide as before.
- **StoryDeck now needs footprint-story `^0.9.0`** (it was `^0.7.0`), for the order and the grid above. For a 0.x version
  the two ranges do not overlap, so an app that also uses StoryReel needs a StoryReel that asks for `^0.9.0` too, or it
  installs two copies of the package they share. A voice you have already paid for is still found: a clip's key and its
  files in `voice/cache` are the same.
- **Works beside footprintjs 13 and 14.** The optional peer range is now `^11 || ^12 || ^13 || ^14`, and the PowerPoint
  export is tested on 14.0.0 (which needs foottrace `^2.1.0` beside it).
- **`check` warns when a view stands far out** (`view-far`): further out than half size, the words on the picture show
  that much smaller, and the warning says how small and what to do.

## 0.13.3 — one copy of footprint-story, shared with StoryReel

- **StoryDeck now needs footprint-story `^0.7.0`** (it was `^0.6.0`), the same range as StoryReel 0.29. For a 0.x version the two
  ranges did not overlap, so an app that used both installed two copies of the package they exist to share; it now installs one.
- **Nothing you use changes.** StoryDeck uses only footprint-story's main door, `/voice` and `/motion`, and those files are
  byte for byte the same in 0.6.0 and 0.7.0; 0.7.0 adds the `/shot` door and storyboard briefs, which StoryDeck does not use.
  A voice you have already paid for is found by both versions: a clip's key and its files in `voice/cache` are the same, so a
  deck voiced with one is not voiced again by the other.
- Nothing else in the published package changes.

## 0.13.2 — needs markdown-it 14.3.3 or newer

- **StoryDeck now requires markdown-it `^14.3.3`** (it was `^14.1.0`). Versions before 14.3.3 have four published advisories about
  very slow parsing of crafted Markdown, and the `linkify-it` package that comes with them has a fifth:
  - [GHSA-r7fv-28h4-cvq7](https://github.com/advisories/GHSA-r7fv-28h4-cvq7): quadratic time in smart quotes with unmatched closing quotes.
  - [GHSA-vfgh-jcmw-g37q](https://github.com/advisories/GHSA-vfgh-jcmw-g37q): quadratic time in inline HTML, only when `html` is on (StoryDeck keeps it off).
  - [GHSA-gfr2-rv44-r23c](https://github.com/advisories/GHSA-gfr2-rv44-r23c): quadratic time for one multi-line link reference definition, with default options.
  - [GHSA-253c-mchw-3w2r](https://github.com/advisories/GHSA-253c-mchw-3w2r): two quadratic paths when `linkify` is on, so a few hundred KB of Markdown can block the event loop.
  - [GHSA-v245-v573-v5vm](https://github.com/advisories/GHSA-v245-v573-v5vm): `linkify-it` up to 5.0.1, quadratic time in its `mailto:` check.
- **Who is affected:** someone who renders Markdown they did not write (a post from a stranger, a pasted file). The Markdown the
  repository ships renders the same bytes before and after. A fresh install already took the fixed version, because the old range allowed
  it; this release makes it the minimum, so everyone who updates gets it. Nothing in the published package changes except the
  `markdown-it` range.
- **First release made by the shared release route:** merging the release pull request publishes it. See `RELEASING.md`.

## 0.13.1 — works beside footprintjs 12

- **The PowerPoint export works beside footprintjs 12.** footprintjs is an optional peer: StoryDeck needs it only to export a
  deck as a PowerPoint file. Its range is now `^11.0.0 || ^12.0.0`. Before this, npm refused `npm i footprintjs` beside
  StoryDeck as soon as footprintjs 12 was the newest version. The export's tests pass on footprintjs 11 and on the 12
  candidate. Nothing else changes.

## 0.13.0 — narrate: one command for a deck's voice

- **`storydeck narrate`: one command for a deck's voice.** It says what each click says and whether it is voiced, for nothing.
  With `--kit <folder>` it voices what is missing, and `--takes <folder>` uses your own recordings. `--only 1-3,7` picks a few
  clicks. The clips stay in the deck's `voice/cache`. `storydeck build --voice` then carries them in the page. A deck that
  doesn't ask builds byte for byte as before.
- **`narrate` as an MCP tool.** It only reads, unless the server was started with a voice and the call says what to voice with
  `say`. A call can't name a kit, and `build` over MCP never carries a voice.
- **A deck voiced by your own script:** run `storydeck narrate --kit <folder>` once. It finds the clips you have and voices only
  what is missing, and from then on `narrate` and `build --voice` find them with no voice named.
- **A clip cache from someone's folder is not trusted.** A link at a clip's name is never read into a page or written through,
  a link out of the deck at `voice/cache` is refused, and ffmpeg reads a clip's sound only as a WAV.

## 0.12.0 — a base look, callouts, and one page to read, scroll or click through

- **The deck as MCP tools, documented.** The README now shows an assistant's whole path over `outline`, `feedback`, `review`,
  `check` and `build`, and what to expect from them.
- **One page to read, scroll or click through.** `"lenses": true` in deck.json adds Read (an article) and Scroll (the picture
  stays while the words go by) to the built page, beside the slides, from the deck's own slides, headlines and notes.
  No site or React is needed. A link ending `#read` or `#scroll` opens that one. A deck in another language gives its own
  words. A deck that doesn't ask builds byte for byte as before.
- **A film or a PowerPoint no longer shows the theme toggle** (or the new switch) in its pictures.
- **Words pinned to a piece.** `<div data-k="why" data-callout="server above">Most of the wait is here</div>` puts a bubble
  beside the piece with a tail pointing at it, sized by its words and kept on the slide. It is a piece like any other,
  it follows its piece when the piece is moved, and `server+` in a click takes it in. Its look is yours to change in
  theme.css: `--callout-bg`, `--callout-fg`, `--callout-size`, `--callout-radius`, `--callout-lag`, or any rule for `.callout`
  and `.callout-tail`. `check` and `check --layout` warn about one shown without its piece, one that meets another or the
  headline, and a tail that no longer reaches its piece. The starter shows one. A deck with none builds byte for byte
  as before.
- **A ready-made look, so a deck starts finished.** `"look": "base"` in deck.json brings the tokens, light and dark, and
  the pieces a picture is made of: `box`, `chip`, `area`, `group`, `card` (with `.cards` for a row of them on a plain
  slide), `title-block` and `points`, and `ok`, `warn` and `bad` to colour one. Change a token in theme.css to make it
  yours, and any rule you write wins without `!important`. New decks from `init` ask for it, and their theme.css is now a
  few tokens. A deck that doesn't ask builds byte for byte as before.
- **deck-data.json carries the same stylesheet as the page.** It was missing what a deck asks for beyond its theme, so in
  the Read and Scroll lenses a part's label on how it differs and a named loop's moves had no styles. A deck that asks
  for none of these (a look, a label, a named loop, `explore`, `data-enter`, `data-arrive`) writes the same file as
  before.
- **A part told as an analogy says so.** `data-differs-analogy="people stand in for the services"` shows "An analogy:
  people stand in for the services", or say it in the notes with `data-differs-said`. It is a statement like time and
  scale: it needs a line or a phrase of its own, it fits the label it goes on, and a deck in another language gives its
  own words.
- **How a part's pieces arrive and leave, with no CSS of your own.** `data-arrive` (`grow` or `fade`),
  `data-arrive-time`, `data-arrive-delay` and `data-leave-time` on a `<section>` set it for all of its clicks. It plays
  only on a forward step, and a jump, a step back, reduced motion and print land at once. A value it cannot play, or one
  of these on a `<step>`, is refused. A deck that asks for none builds byte for byte as before.
- **A part's label moved in from the corner.** The labels on how a part differs sit 60 slide pixels further left, so they
  clear the theme toggle at usual window sizes (it stays the same size as the slide scales, so a very small window can
  still crowd them). Rebuilding a deck that shows one may change what `check --layout` says about it and its headline.

## 0.11.0 — FootPrint 11 and a part that says how it differs

- **Migration:** PowerPoint export requires FootPrint 11. Install `footprintjs@^11.0.0` beside Storydeck;
  the peer stays optional and is loaded when an export runs. Older FootPrint majors are no longer supported.

- **A part that differs from the real thing says so.** A picture is believed, so a process run 30 times faster or a part
  drawn far larger than it is reads as how the thing is. A part now declares it (`data-differs-time="30"`,
  `data-differs-scale="…"`), and the deck says it: a label at the top right of its slides by default, in the notes with
  `data-differs-said` (`"A | B"` gives one phrase per statement), or both. Each statement declared needs a line or a
  phrase of its own, a number in the time's line must be the one declared, and a deck in another language gives its own
  words. A time factor is 1.01 or more or 0.99 or less, up to a billion times either way. `check` refuses a phrase the
  notes do not hold (`differs-unsaid`), matching words as StoryReel matches a phrase, never inside a word, and `check
  --layout` warns when a label meets the kicker, the headline or a lit piece (`differs-overlap`). `review` says how each
  click differs. A `>` in a value, or `data-differs-*` on a `<step>`, is refused instead of lost. A deck that declares no
  label builds byte for byte as before: the page carries the label's CSS only when a part shows one. It cannot see a
  speed-up nobody declared.
- **Loops keep running in a video.** `renderVideo` stepped a click until its last entrance ended and held that frame,
  so a loop (a pulse, packets on a wire) stood still for the rest of the click and started again at the next. A click
  whose loops run is now stepped on to its end, each loop at the video's own time, so they run on from click to click
  as in the room; a click without loops renders as before, and the timeline is unchanged. It costs frames — a looping
  click is one frame per 1/fps of its length — so `loops: false` holds the frame as before, for a fast draft. The
  browser port gains an optional `loops()` and `seek(ms, {loop})`; a driver without them renders as before.

## 0.10.0 — a part arrives with a change of picture, and a deck a viewer can explore

- **A part arrives with a change of picture: `data-enter`.** `<section … data-enter="push" data-enter-from="right">`
  plays one of the editor's changes StoryReel's films use (footprint-story/motion's table: the same names, settings,
  lengths and eases) as the deck steps into the part: cut, fade, dip, wipe, split, iris, push, slide, whip or zoom,
  each with its settings as `data-enter-*` (`from`, `line`, `at` as "x y" in slide px or "centre", `color`) and
  `data-enter-seconds` / `data-enter-ease`. The build samples each distinct change once into keyframes for both slides
  (30 a second, the same curves a film draws); the page plays them with Web Animations only on a forward step into the
  part — a jump, a step back, reduced motion and motion off land at once — keeping the slide it leaves in view until
  it ends, and a video steps them like any animation. A dip shows its colour behind both slides (black unless
  `data-enter-color` says otherwise): `<deck-stage>` now paints what shows behind its slides with `--deck-canvas` (white,
  as before, when unset). A change a page cannot play (clock, page, through, match: they need a canvas), a setting the
  change does not take and a value out of range are refused at build, naming the part and the fix. `review` says how
  each part arrives. While a change plays the frame clips both slides (a push never crosses the letterbox: `<deck-stage>`
  clips its canvas while it carries `data-deck-changing`), the slide being left keeps its loops running, and printing
  puts everything back first. Settings are read as a browser reads the tag. A deck without `data-enter` carries none
  of it (no keyframes, rule or runtime); the `<deck-stage>` every page carries gained the two hooks, and draws as
  before without them.

- **Explore: a viewer clicks a piece to go to the click about it.** With `"explore": true` in deck.json, a click on a
  piece goes to the click that is about it — the first click whose `data-on` names it (`gw+`'s gw too), or, when none
  does, the first that takes it in through a `name+` — and a "Back to click N" control (or Backspace) returns, a step
  at a time, as a browser's Back does (to where the viewer was before each jump, whatever they stepped through since).
  Pieces that lead somewhere get a pointer and a ring on hover; a piece whose click is the one shown, or one that
  cannot be seen, leads nowhere; a link or control inside a piece keeps its click; a drag (the dev page's Alt-drag) is
  never a click. On a touch screen a tap on a piece that leads somewhere explores — tap beside the pieces to step. The
  pieces are reached by pointer, not by keyboard: arrow keys still step through the clicks in order. The presenter
  window does not explore (it follows the room's deck). The authored order never changes: explore is a way through the
  same clicks. A deck without `"explore"` carries none of it (its look comes with it, not in deck.css).

## 0.9.0 — living system diagrams: loops, wires between pieces, a wire's label, halo and running packets

- **A wire between pieces: `data-arrow="client to server"`.** The wire runs from the edge of one piece's box to the
  edge of the other's (6 px clear), so it follows them: move a box, in the file or by Alt-drag, and its wires come
  along — no four numbers to keep in step. Two or more wires between the same pieces each take a lane (80 px apart at
  most, always inside both boxes), keeping to their left, so a request going right runs above its answer coming back
  whatever the pieces are called. A bend may follow the names (`"gw to db 40"`). Words, not `>`, because a `>` would
  end the tag. A name not placed, a wire to itself and pieces too close for a wire are refused, naming the fix; a
  numbered wire is drawn byte for byte as before. Alt-dragging a wire between pieces is refused with its fix (move one
  of its pieces). The starter deck now writes its four wires this way (they land within 5 px of where its numbers put them).
- **A wire's label, halo and running packets.** Three attributes on any wire: `data-label="InvokeAgentRuntime"` writes
  its name beside its middle, on its left — above a level wire going right, below one coming back, beside a standing
  one by half its width — in the wire's colour on an edge of the ground (the wire's box grows to hold it, so a wire
  showing itself in shows its label too); class `halo` gives the line and its head a soft glow (`--wire-halo`); and
  `data-packets="2" data-speed="5"` keeps packets running along the curve, evenly spaced, 5 s a run (3 by default;
  1–6 packets, 0.5–60 s), fading in at the start and out before the head (`--packet`, `--packet-glow`). The packets are
  loops, so they run only on the slide shown, in step from click to click, and where loops do not run (reduced motion,
  print, motion off) the first rests at the wire's middle. They are the wire's, not the deck's loops: `review` and
  `check` do not list them. A wire without these is drawn byte for byte as before; packets it cannot run, and a speed
  with no packets, are refused naming the fix. They are read as a browser reads the tag (never from inside another
  attribute's value, in any case, quoted or not); a `>` or `<` in a value is written `&gt;` or `&lt;`, since a tag ends
  at its first `>`. A deck that already put its own `data-label`, `data-packets` or `data-speed` on a wire (for its
  own CSS) now gets them drawn: rename them. A loop an icon file carries is now found by `review` and `check` too.
- **A piece and what it touches: `name+`.** A wire between pieces carries `data-ends` (the pieces it joins; a wire in
  numbers may carry it too), so a click can name `gw+`: the gateway, the wires with it as an end, and the pieces at
  their other ends — `data-on="gw+"` lights that neighbourhood and greys the rest. It reads anywhere a click names
  pieces (`data-in`, `data-out`, `data-on`, `data-hot`, and the groups a mover moves: `subject`, `aside`, `place`,
  `apart`); `check`'s lit-on-entry reads it the same way, and `review` lists what it lit. A piece actually called `gw+`
  is itself. On a `path` click it lights the piece, then its wires, then what they reach — for a request's own order,
  write the route out (`data-focus-route`), where `+` is not read. `footprint-storydeck/focus` exports `expandNames`.

- **Motion that keeps going: loops.** `data-loop="pulse"` on a piece keeps it pulsing while its slide is shown.
  `pulse`, `float` and `marquee` are the endless moves of the motion table StoryReel's films use
  (`footprint-story/motion`), sampled from the same curves and drawn into the page only when a deck names them
  (`data-loop="float 4s"` sets the pace; any other name is refused at build, naming the piece and the loops there are).
  A named loop moves its element by `transform` (a shape inside a drawing about its own middle), so a tag that sets a
  transform of its own is refused, naming the fix: put data-loop on an element inside it. `data-loop` alone runs the
  piece's own animation, `--loop` in theme.css (`.gear { --loop: spin 6s linear infinite; }`); a theme.css rule that
  gives the element its own `animation` wins, so list `var(--loop)` in it to keep both.
  <deck-stage> owns where loops run, so it works in any deck on the stage: only on the slide shown and the layers under
  it (it stamps `data-deck-loop` on them), so a deck of 40 map clicks runs one slide's loops, not 40. Every loop runs
  on one clock (only a data-loop element's animations are set to it: a deck's other animations are left as they were), so a map drawn again for the next click shows each loop where the last click left it, and a jump or a
  step back keeps it running (a static arrival no longer zeroes a loop, only entrances). A loop never runs under
  reduced motion (switched live), in print, or with motion off: there the piece rests in its own style. A piece that
  loops and changes on the same click (comes in, lights up) does both: focus.css keeps the loop as the last animation
  of the piece's list. Loop CSS is drawn only for decks that use loops, so a deck without one gains none; the
  `<deck-stage>` every page carries changed, and a deck without loops draws as before. (Corrected after release: this
  line first said such a deck builds byte for byte as before — its page carries the changed stage.)
- **Motion off: a still deck.** `?motion=off` after the page's address, or `<deck-stage data-motion="off">` (switched
  live too): no loops, and every click lands at once, as a jump does — so a screenshot of a click is the same every
  time.
- **The checks know loops.** `review` lists each click's loops (`loops (2): db pulse, gear (its own --loop)`). `check`
  warns (`loop-unset`) about a `data-loop` that neither theme.css nor its own style gives a `--loop` (nothing would
  loop). `check --layout` reports an endless animation that is not a loop: one running on a slide no one sees is an
  error (`hidden-loop`, with how many and on which pieces, one problem for all the slides it runs on); one shown on a
  click is a warning (`loose-loop`: it starts over at each click and stops on a jump).

## 0.8.1 — footprint-narration is now footprint-story

- **footprint-narration is now footprint-story.** StoryDeck's shared narration code (shown-vs-spoken text, captions,
  chapters, the voice cache) comes from `footprint-story` 0.3.0, the same package under its new name: what StoryDeck
  and footprint-storyreel share, now with a `/motion` door too. Nothing a deck says, shows or voices changes. A project
  that imports `footprint-narration` itself beside StoryDeck should move to `footprint-story` (the two doors export
  exactly what they did).

## 0.8.0 — a part can have its own look (data-theme)

- **A part can have its own look: `data-theme`.** `<section … data-theme="ledger">` in clicks.html puts
  `data-theme="ledger"` on each slide of that part (plain or on a map), so a deck's theme.css can give one part its own
  tokens and pieces — a talk in several parts, each dressed for its subject. A theme is one lower-case name (letters,
  digits, dashes; 40 at most), refused otherwise with the part's name. A part without one is drawn byte for byte as
  before.
  The title and closing slides are parts, so they can have a look of their own. `check` warns (`theme-unstyled`) when a
  part asks for a theme that theme.css never selects, and `review` ends a click's first line with its theme. The README
  shows how the page around the slide follows the part on screen (`:root:has([data-deck-active][data-theme=…])`).

## 0.7.0 — a deck from a folder, an editing loop, co-editing and wire motion

- **A packet rides its wire's curve, and a wire shows itself in.** On a `path` click, a `pkt` packet now follows the
  wire's quadratic curve (it crossed a bent wire in a straight line, up to 78 px off it); in Chromium, Firefox and
  WebKit it stays within 0.15 px of the drawn line. CSS only: one registered number, `--sd-t`, runs 0 → 1 and the
  packet stands at B(t) from the control point and end each wire gives it (`--cdx`/`--cdy`, beside `--pdx`/`--pdy`).
  A wire that comes in shows itself from start to tip behind a sweeping soft edge — a mask, so a theme's dashes and
  colours stay as they are — at its own moment (its turn on a path, after a new blur); a highlighted wire just fades
  in, so its ring (drawn outside its box) shows. focus.css gains one more animation slot a stylesheet may give a piece,
  `--sd-a-more`, and `--sd-twin-lag`, so a wire stepping aside for its twin leaves as the twin's sweep nears the tip.
  Reduced motion, a jump and print show the plain wire.

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
  itself. The note key is never read through a link or a second name, nor kept inside the deck folder. Every rule that
  compares paths does so as the disk spells them (`realpathSync.native`), so on a disk that ignores case one folder is
  never taken for two. `loadDeck`/`compileDeck` take `{dev}`; `deckHtml` also returns the source.
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
