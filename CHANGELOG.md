# Changelog

## 0.40.0 — maps in footprint-story's looks

A map can now name one of footprint-story's looks (now `^0.35.0`). A look is a style row under a name, written as a
column of its own on the map's `data-style`:

```html
<i data-style="look: line-art"></i>
<div data-k="floor" data-iso="floor" data-size="8 5" data-label="Production"></div>
<div data-k="server" data-iso="block" data-at="1 1" data-size="2 2 1.4"><b>Server</b></div>
```

`look: outlined` draws a bold contour round each piece over today's tones. `look: line-art` draws paper faces and ink
lines. `look: paper-grain` lays a fine, faint grain over every face. `look: duotone` prints every line in one ink. A
column beside the look replaces that part of it, whole (`look: line-art; texture: human:hatch`). Named or written out,
a look draws the same page; the record keeps its name. Every page that names no look is byte for byte as before.

- **The reader** (`isoStyle.js` · `readLook`): `look` takes one of the kit's names (`ISO_LOOKS`) and no options. Refused,
  naming the fix: a look that is not one (`there are "outlined", "line-art", "paper-grain", "duotone"`), options on a
  look, a look written twice. The kit's own refusals come in the deck's words: a look the row overrides whole ("the
  look draws nothing"), the grain beside a duotone, line-art with `line: none`.
- **One list of hand-drawn choices:** the deck now hands its steps footprint-story's `HUMAN_STYLE_CHOICES`
  (`human:sketchy`, `human:hatch`, `human:grain`), not a list of its own. **Removed:** `isoSpec.js` · `DECK_CHOICES`;
  the compile, the run's map flow and the style check all use the kit's list. A refusal for an unknown choice names
  the new ones too (`"ink", "none", "contour", "human:sketchy"`).
- **A dark page** (`iso.js` · `LOOK_CSS`): a page is light or dark when it is VIEWED (T, the saved choice, else the
  system), so no build can hand the kit the dark page's colours. They reach the map by one route instead, the page's
  variables, with the kit's colour as each one's fallback (`isoPaint.js` · `pagePaper`, `inkOf`). On a paper map (the
  look line-art, or `shading: paper` in any row), the fills come out in one colour, the paper (`paperOf`), written
  `var(--iso-paper, #ffffff)`. Any colour a line carries there (a duotone's ink) is written `var(--sd-ink, …)`, and the
  pieces carry `data-sd-paper`. A contour's colour, on any map, is written `var(--sd-contour, …)`. Under `:root.dark`,
  `LOOK_CSS` sets these to the page's paper (`--bg-elev`) and ink (`--fg`), so a combination themes as its look does:
  `look: line-art; palette: duotone`, `look: duotone; shading: paper` and `look: outlined; palette: duotone` included.
  The fallbacks are the page's own (deck.css), so a deck with no dark tokens draws its dark page as its light one. A
  paper map whose faces would come out in more than one colour is refused, naming the fix; no row the kit has today
  does that. The page carries `LOOK_CSS` only when a map paints a paper or a contour. The map's record says so
  (`made.paper`, `maps made` · `paper`).
- **Measured, every combination, both themes** (`deck/looksDark.test.js`, from the built page's own CSS through
  `deck/test/pageColours.js`): all 24 rows the look columns make (shading × line × palette × texture, less the
  textures the kit refuses beside a duotone), the four looks and the combinations a review found. Block names, floor
  labels and cable labels stand at 4.5 : 1 or more. A block's edge, a contour against the page, and the highlight ring
  round a block and along a floor stand at 3 : 1 or more. The rings render on every look: nothing inline on a floor's
  ground or a piece's art outranks the ring's rule. Chromium's computed styles on the same built pages agree with every
  pinned number, for all 48 rows (24 combinations in two themes). On the base look's dark theme a line-art floor label
  went from 1.1 : 1 to 8.1 : 1 and a contour from 1.0 : 1 to 16 : 1. The look's lines on a dark line-art duotone went
  from 1.3 : 1 to 14.5 : 1.
- **The duotone keeps its own inks on a dark page.** A deck colours its pieces by class and theme, so the duotone
  leaves each face's colour to the page, as footprint-story does for a map with no colours. Those faces are light in
  both themes. Handed the dark page's light ink, the lines would stand at about 1 : 1 on them (pinned). Known limit:
  its floor's tile lines are the ink at 16%, faint on a dark page.
- **A grain's marks are drawn once a page** (`isoPaint.js` · `DRAWN_ONCE`), as 0.39.0's strokes are: every `lines`
  item but the floor's tile lines goes into the hidden `<svg data-sd-strokes>`, and each click draws it with a
  `<use>`. For 64 grained blocks at a 96 px tile, told in five clicks, a click went from 246 KB to 43 KB; the same map
  unstyled is 28 KB. `deck-data.json` writes the marks back in each section. A map with no texture keeps its tile
  lines in place and is byte for byte as before.
- **The budget covers marks** (`isoRules.js`, our numbers, unchanged): a map's record counts its marks
  (`made.strokes.marks`), and the 2 MB note and 16 MB refusal count strokes and marks together. A mark is held by its
  bytes alone; it has no timing. A map past the note is told the grain's fix (`texture: human:grain spacing 32`).
- **Exports are the light theme.** PowerPoint and video take each slide from a browser that `deckStageDriver` opens with
  no colour scheme and no saved choice. So the page starts light, and every export carries the light theme. StoryDeck
  has no theme chosen at build time to set it from. Print uses the viewer's page as it is, light or dark.
- Tests: `deck/looks.test.js` covers the reader, named and written-out looks drawing the same page, a page test for each
  look, a clean check, the 64-block grain sizes and note, `deck-data.json`, and `log --why style --map`
  naming the look. Each look has a still (`deck/test/look-<name>-still.html`), pinned byte for byte.

## 0.39.0 — maps drawn by hand

A map can now be drawn by hand. footprint-story's sketched line and hatch (now `^0.33.1`) are style choices like any
other on a map's `data-style`:

```html
<i data-style="line: human:sketchy; texture: human:hatch"></i>
<div data-k="floor" data-iso="floor" data-size="8 5"></div>
<div data-k="server" data-iso="block" data-at="1 1" data-size="2 2 1.4"><b>Server</b></div>
```

The block's faces keep their fills and lose their ink outline. Its edges are drawn as a hand draws them: the outline
first, then the inner edges, tapered and wobbling. Its left side is hatched and its right side cross-hatched. Every
page that names no hand-drawn style is byte for byte as before.

- **The style:** the deck hands footprint-story's map steps two choices of its own (`isoSpec.js` · `DECK_CHOICES`:
  `human:sketchy`, `human:hatch`). The same list goes to the compile's `buildIsoMap`, the run's map flow
  (`runMapFlow`, so `storydeck log --why … --map` answers for a hand-drawn map too) and the style's check, so a
  name the steps build is never refused, and one they would not build is refused naming every choice there is
  (`there are "ink", "none", "human:sketchy"`). Their options are footprint-story's: `line: human:sketchy width 3
  tremor 1`, `texture: human:hatch spacing 10 angle 45`.
- **The painter draws strokes** (`deck/isoPaint.js` · `isoArt`; it refused them by name before). A stroke has a width
  and a time at each point, and an SVG line has one width, so each stroke is one `<path>` filling the ring
  footprint-story gives (`strokeOutline(points, {cap})`), its two ends capped as the stroke says (round for a sketch).
  StoryDeck works out no geometry of its own. The ring is filled by the non-zero rule (`fill-rule:nonzero`), because
  it can cross itself at a round cap. Its ink is its colour, or the page's line colour
  (`var(--iso-line, var(--iso-ink, #14181f))`, the colour a face's outline uses) when it has none. It has
  `stroke="none"`, so the page's 2.5 px outline does not make it thicker.
- **Drawn once a map, not once a click:** a map's HTML is written again on every click of its part, and a hatched
  map's strokes are most of its bytes. So the page holds each run of strokes once, in a hidden
  `<svg data-sd-strokes>` before the stage (one `<g id>` a run, named by what it draws), and every click draws it with
  a `<use href="#…"/>`, in its place in the paint order. For 64 hatched blocks told in five clicks, a click went from
  1.6 MB to 33 KB (the same map unstyled is 28 KB), and the page from 8.4 MB to 1.9 MB. `deck-data.json` (the Read
  and Scroll lenses) writes the strokes back into each section, since a section is shown on its own. A page with no
  strokes has no such `<svg>` and is byte for byte as before.
- **A stated budget** (`isoRules.js`, our numbers): `storydeck check` notes a map past 2000 strokes or 2 MB of them
  (rule `strokes`, at its first click, with the fix: a wider hatch spacing), and the build refuses a map past 20000
  strokes or 16 MB, naming the fix. The 64-block case is noted (2112 strokes).
- **The records:** StoryDeck's own record of a map (`made.strokes`, `maps made` · `strokes`) keeps how many strokes it
  draws, their bytes and the timing note, never a point. The run's map-flow record (`storydeck log --map`) is
  footprint-story's (`runMapFlow`'s commit log) and still keeps every stroke's points: 3.9 MB for the 64-block case.
  footprint-story will trim it; StoryDeck does not edit another package's record.
- **The time:** a deck page is drawn at rest, so the whole stroke is drawn and its times are not played. A map that
  draws strokes says so in its record (`made.strokes` and the run's `maps made` · `strokes`: how many, and "drawn
  whole, at rest: a page does not play a stroke's timing (StoryReel plays it)"). A map with none records as before.
  Revealing a stroke click by click (footprint-story's `strokeAt`) is left for later.
- **Exports:** PowerPoint and video take a PNG of each settled slide from the browser, and print uses the browser's
  page. The strokes `<svg>` is in that page, so all three carry a stroke as the SVG draws it: whole and still.
- Tests: the ring with each cap (round, butt, square) is checked against a hand-worked one to 1e-6. A hand-drawn map
  is built, drawn, compiled and built again by the run's map flow, which gives the same map. A still of that page
  (`deck/test/sketchy-still.html`, with no words, so no font of the host's) is pinned byte for byte. The 64-block
  case's sizes, the note and the refusal are pinned (`deck/strokes-once.test.js`).
- **The run's map-flow record stays small** (footprint-story 0.33.1): it keeps a hand-drawn map's paint as counts and a
  digest, not every stroke point — a 64-block hatched map's record was megabytes, and now is about 90 KB.

## 0.38.0 — the motion place rules, one copy

Nothing an author sees changes: every page, keyframe, finding and refusal is the same as 0.37.0's.

- **The number rules a moving block is placed and checked by now come from footprint-story** (now `^0.32.0`,
  `footprint-story/isometric`): a block's foot and top, the top it lands on, the rider rule, a foot worked back from
  the slide, the swept pass-through test and the moments a move is checked at, what of a drawing is off the slide, a
  name's box, which resting block hides it, and the paint order at a moment. StoryDeck and StoryReel each held a copy;
  now there is one. `deck/motionPlace.js` and `isoSpec.js · orderAt` are gone, with no stand-ins — the shared
  `orderAt` is the same sort the map steps' `order` runs. StoryDeck keeps the drawing, the `deck:` prefix on its
  critics (`deck:contact`, `deck:covers`) and each fix in its own words.
- Tests: every page, golden and keyframe test passes unchanged. The deleted file's own unit tests went with it;
  footprint-story tests those rules, with a differential against StoryDeck 0.37.0's copy.

## 0.37.0 — blocks on a map move by intent

A click can now move an isometric block. The author writes what happens on the `<step>` — never a number for how —
and footprint-story (now `^0.31.0`) decides the model, the duration from a law and the curve; StoryDeck writes its
samples into the page as keyframes. The deck's twin of StoryReel 0.43–0.44's `motion`: the same words, refusals and
guards. A deck that moves nothing is drawn byte for byte as before: every example page and every expected page in
the tests is unchanged.

```html
<step data-in="floor box server crate"><h2>Here</h2></step>
<step data-move="box fall; crate slide to 4 4.5"><h2>The box drops, the crate slides</h2></step>
<step data-move="box throw to server wrap anticipate"><h2>Up onto the server</h2></step>
<step data-move="lamp hang from 3 2 6"><h2>The lamp swings to rest</h2></step>
```

- **What a block can do** (`deck/motionRead.js`): `fall` (onto the highest top under it, else the floor), `throw`,
  `settle` and `reach` (to `to`: a block's name — the middle of its top — or tiles `col row [lift]`), `hang` (on a rope
  from the pin `from`, swinging to rest below it; the block's last move) and `slide` (along the level it rests on, to
  `to`, planned side on, ending exactly there). `wrap` takes footprint-story's wrappers and `model` its models, each
  with options by name and value (`model coulomb kinetic 0.4`); `accept arc` keeps a critic's finding the move means.
  Plain words in an attribute, not JSON, as every map attribute. A block moves once a click and rests where its move
  ends on every later click.
- **Refused, naming the click, the move and the fix:** `roll` (StoryDeck has no ball yet) and `tumble` (a block is
  drawn only upright, and a turn the page cannot show truly is said, never faked), `draw`/`write`/`sketch` (a pen's),
  a floor, a footprint, a piece that is no isometric block, a name two blocks share, a block a wire joins or a callout
  points at (they would not follow it), a block the click does not show, a block moved from under one resting on its
  top, a move that relies on a block moving on its own click, a move after a hang, tiles or a way off the slide, a
  missing or unwanted `to`/`from`, a slide from the air, to another level or off its top, an accepted critic its move
  is not checked by, more than 64 moves on a map, and whatever footprint-story refuses, in the move's name.
- **The critics reach the check at their own level** (rule `motion`), naming the move and the fix: footprint-story's
  (`arc`, `spacing`, `contact`, …; a note is told as info) and the deck's own — `deck:contact`, a block that passes
  through another, swept between samples so a thin block is never skipped, and `deck:covers`, a block come to rest
  over another's name: the name is hidden only at rest (shown while the block moves), decided from the kit's numbers,
  never a font's width. A finding of an accepted critic is told as accepted advice.
- **How each way of showing a deck carries a move** (`deck/motionDraw.js`): the page plays footprint-story's own
  samples as CSS keyframes, 60 a second, to a millionth of a px, on a forward click once its view has arrived — a
  jump, a step back, reduced motion and motion off land at rest; a moving block's faces and words sit in a wrapper
  (`.iso-motion`) so a click's focus, which moves the piece, is never replaced; its paint level is the map steps' own
  order asked again at each keyframe (`isoSpec.js · orderAt`), and a hang's rope is drawn as links. A video steps
  the same keyframes frame by frame. A print shows each click at rest; a PowerPoint too — its export ends the moves
  before it takes the picture (`video.js · deckStageDriver · rest`, an optional port method `exportPptx` calls). The
  map's record says so (`maps made` · `motion.carriers`), and the export says how its own pictures were taken
  (`exportPptx(…).moves`, on its record too): a driver without `rest()` shows a move where its seek left it, and the
  export says so with the fix (give the driver `rest()`), never claiming a rest.
- **The camera frames where blocks rest:** a click's view fits a moved block where it rests at the click's end.
- **Record:** the run's `maps made` carries each map's moves (`motion.moves`: click, block, word, model, how it was
  chosen, seconds) for a map whose clicks move a block (none otherwise, so other records are as before), and each such
  map's moves are planned again through footprint-story's chart (`runHumanFlow`), their record kept beside the run's:
  `storydeck log --run <id> --why duration-0 --motion <map>` says why a move takes its time (`model-<i>`, `findings-<i>`
  too); the reply offers the call, and a plan that parts from the page's is said. `--motion` on the command line and
  the MCP `log` tool.
- **footprint-story `^0.31.0`:** its paint list has a `stroke` item (hand-drawn strokes, from sketch style choices a
  deck does not offer); `isoPaint.js` refuses one by name rather than drawing nothing.
- A map whose blocks move spreads its paint levels apart (one level between two still blocks for each that moves), so
  it holds fewer pieces (128 with two moving); past that it is refused with the fix.
- The few number rules StoryReel's kit holds too — a foot, the landing under a block, the swept pass-through, the
  rider rule, a name's box — live in one small file (`deck/motionPlace.js`), kept minimal, to move into footprint-story.

## 0.36.0 — a map takes a style

An isometric map can now name its look: `<i data-style="line: ink width 5"></i>` in `map.html` draws every face with
a 5 px outline, `<i data-style="line: none"></i>` with none. The words are footprint-story's style columns (`shape`,
`shading`, `line`, `palette`, `texture`, `effects`), each `column: choice` with its options by name and value, columns
apart with `;`. A map with no `data-style` is drawn byte for byte as before: every example page and every expected
page in the tests is unchanged.

- **New: `deck/isoStyle.js`** — reads a map's style from its own empty `<i data-style>` (taken out of the map, as
  `data-iso-grid`'s is) and hands it to the map steps as the spec's `style`. Plain words, not JSON, because every map
  attribute is written by hand or by a model. Refused in the deck's words, naming the map and the fix: a column, a
  choice or an option it does not have (with the ones there are), an option with no value or said twice, a column
  written twice, a style on a piece or beside `data-iso-grid` on one `<i>`, two styles, a style on a map with no
  `data-iso` piece.
- **Fixed: `deck/isoPaint.js` writes a stroke's width, join, cap and alpha apart from its colour.** Before, a stroke
  with no colour (every stroke the deck's map steps make) wrote nothing, so a 5 px style drew at the CSS's 2.5 px and
  a no-outline style drew the CSS's ink. Now a map that names a style has every stroke value its style gives written
  as SVG presentation attributes (`stroke-width="5" stroke-linejoin="round" stroke-linecap="butt"`, `stroke="none"`),
  so the width it names wins over the `--iso-line-width` token (now documented); a map with none writes only what
  differs from what the page's CSS draws for the role — nothing, so it is unchanged and the token still sets its
  outline. Presentation attributes beat what a face inherits, and lose to any CSS rule that names the element —
  theme.css, a state, and the floor's focus ring (`isoRing` sets the stroke on `.iso-ground`) all still win. What the
  page draws is read from the kit's usual style (`PAGE_STROKES`), which a test pins to `ISO_CSS`. An alpha is written
  only where it differs from the role's (the page's colour already carries it). Every stroke is now checked, coloured
  or not.
- **Record:** the run's `maps made` carries `style: {row, options}` for a map that names one (none for a map that
  does not, so its record is as before), and the map flow's own record says the style of every map
  (`storydeck log --run <id> --why style --map <map>`).

## 0.35.0 — isometric pieces are written from the map's paint list

A block's, a cylinder's and a floor's SVG faces now come from the paint list footprint-story's map steps already make
(the `style` step: `paints`, `floorPaints`), written by one small painter, instead of strings `deck/iso.js` built
itself from the grid. A deck and a film now paint the same list. Nothing on a page changes: every example page is the
same byte for byte, and so is every expected page in the tests.

- **New: `deck/isoPaint.js` · `isoArt(items, box)`** — the deck's one SVG painter. An element per item (`polygon`,
  `ellipse`, `path`, `lines`), classed by its role (`iso-left`, `iso-top`, `iso-side`, …; the tile lines keep
  `iso-lines`), numbers to one decimal inside the piece's box. An arc is written `A rx ry 0 0 sweep x y`, with a line
  to its start only when the pen is somewhere else. The deck hands the steps no colours, so the list carries none and
  the painter writes none: the deck's CSS colours a piece by its classes, as before. An item that does carry a colour
  gets it in a style attribute. A kind of item, a role or a colour it cannot write is refused, never dropped.
- **Changed: `deck/iso.js`** builds no face string and asks the grid for no face. Each piece's box, the middle of
  its top and its faces come from the built map (`shapes`, `floorShapes`, `paints`, `floorPaints`). Names, floor
  labels, cables and heads are written as before.

## 0.34.0 — ask why a map is so, from its own record

A deck with an isometric map now keeps, for each map, a record of how it was built, and `storydeck log` answers from
it: why a block stands where it does, why the grid is fitted or the usual one, why a name is that size.

```
$ storydeck build my-talk
clean — nothing to fix
✓ my-talk/index.html · 5 clicks · 178 KB · 71 ms
maps: map — why a block stands where it does: storydeck log --run 2026-11-21T23-11-07-965Z-build.3c220e --why at --map map
$ storydeck log my-talk --run 2026-11-21T23-11-07-965Z-build.3c220e --why at --map map
at = [[0,5,0],[4,1,0],[7,4,0],[12,2,0]]
place: hand (hand#2) [wrote: at]
  read (read#0) ← via blocks [wrote: who, blocks, floors, wires, obstacles, keep, written, usualGrid, area, style, policy]
    ⚠ also consumed args — slice may be incomplete here
  place (place#1) ← [control: every block has an at: the map placed them] [wrote: placed, placedWhy]
```

- **Where it runs: the run's `maps made` stage**, in `storydeck check` and `storydeck build` alike. The compile still
  draws with `buildIsoMap` (0.33.0). The run also builds each map with footprint-story 0.25.0's map flow
  (`runMapFlow`), handed the very spec the compile handed `buildIsoMap` (`deck/isoSpec.js` · `builtMap` now gives it,
  frozen at every level, as `spec`; the compiled map keeps it as `built`), with the deck's policy. Each map's run keeps
  its own record beside the run's: `<run id>.map-<k>.record.jsonl` (named by the map's place, never by the deck's
  words). New: `deck/run/maps.js` (`flowMaps`) and `deck/run/why.js` (`whyText`).
- **`storydeck log --run <n|id> --why <key> --map <map>`**: the map by the deck's own name for it — the one `data-map`
  gives and `maps made` writes. `--why` with no key is refused (exit 1), naming what there is to ask: with `--map`, what
  that map's run wrote; without, where the run's own stages are listed. An unknown map names the run's maps; a run
  with none says why, and names the deck's other maps. `--run` now takes a run's id too, and an answer asked by id
  names the run by it; an id no kept run has (a dropped run's) says so. The offered call quotes a map's name past
  letters and digits, and never offers one the command line would read as a flag.
- **The MCP `log` tool's schema grew** by the `map` argument and a line in `run`'s description.
- **The two maps must be equal.** A difference is a `drift` line in the reply (where they first part) and heads every
  answer for that map. It counts in no verdict: the page draws the deck's map.
- **Each map flow is a named call** (`map.flow`, 30 s at most): a map flow that throws, returns nothing or never
  settles is a `drift` line, never a failed run, and a record it began is removed. A record that cannot be written
  never costs the run: the reply says `map map: its record was not kept`. At most 32 maps a run; the rest are counted.
- **The reply of a deck with a map gains its `maps:` line**, offering the call by the run's id (a number moves). A
  deck with no isometric map runs nothing new, and its reply is unchanged; its kept run now says it built no maps
  (`maps: []`, `flat`), so a run kept before 0.34.0 is told apart ("kept before 0.34.0, which kept no map records").
- **Pages unchanged**: every example page and expected HTML is the same. Cost: a 100-block map takes about 45 ms
  more (placed by hand) or 65–85 ms more (placed by the build), and keeps a record of about 180–230 KB per map per
  kept run: at the cap of 30 kept runs, tens of MB for a deck of a few such maps (`deck/run/README.md` · Cost).

## 0.33.0 — maps are built with footprint-story's steps

- **An isometric map is built by footprint-story 0.25.0's map steps** (`footprint-story/isometric` · `buildIsoMap`, under
  `ISO_MAP_POLICIES.deck`): placing the blocks, laying the wires along the floor, fitting the floors, choosing the
  tile, fitting each block's name, placing each floor's label and the paint order are the same steps a film builds its
  map with. The deck's own copies of them are gone (`deck/iso.js` · `place`, `gridOf`, `fitName`, the label and order
  code; `deck/cable.js` · `layRoutes`, `reachOf`). The deck still reads the HTML, says what is wrong in its own words,
  and writes the page, its levels, its CSS and the build's record. New: `deck/isoSpec.js` (the adapter: the read
  pieces handed over as the steps' spec, the built map read back in the deck's names) and `deck/isoRules.js` (the
  deck's own refusals, asked before the map is built). footprint-story is now `^0.25.0`.
- **Pages are unchanged.** Every test's expected HTML is as it was. The example deck (`examples/a-request`), the
  starter deck and 6000 generated maps (blocks placed by hand and by the build, groups, cylinders, footprints, floor kept
  clear, labelled floors with icons, ports, written, fitted and usual grids, shared and long names, flat pieces,
  callouts) were built with 0.32.0 and with this release and compared: every page, record (`ways`, `cables`, `tight`,
  `made`) and refusal is the same, apart from StoryDeck's own version where a page names it. That comparison was run
  for this release and is not checked in; `deck/isoSpec.test.js` pins that the deck draws by `buildIsoMap`'s numbers
  for the example map and generated maps, and that no source file imports a map step itself.
- **What a deck writer may see differently** — each only on a map 0.32.0 drew or refused for a reason past the limits:
  - A block's name longer than 2000 letters (the most the steps fit; a name that long fits no block) is drawn whole and
    said not to fit, as before; where it breaks onto two lines now follows its first 2000 letters.
  - A map whose blocks the build places, with a block whose first name is longer than 200 letters, was refused
    ("thing 1 has a name, some text of at most 200 characters"); it is now drawn. The steps know a name past 64 letters
    (or one two pieces share) by a name made for it, and a refusal of theirs puts the deck's name back: it never shows
    the made one (`the build cannot place this map's blocks: "<the name as written>"'s size is […] — or give every
    block its data-at`).
  - A map whose blocks the build places, with more than 1024 wires written between pieces, was refused ("arrange reads
    at most 1024 links"). The build now places by the wires it hands the steps — every wire laid along the floor (up to
    the 1024 the kit lays, a pair joined twice counted twice) and the first wire between each other two blocks — and
    refuses only when those come to more than 1024, counting the wires handed, not those written:
    `the build cannot place this map's blocks: it places them by at most 1024 wires — every wire laid along the floor,
    and the first between each two blocks — and this map has 1043 such wires — split the map in two, or give every
    block its data-at`.
  - A piece whose words are past the 200 UTF-16 units the steps take as its name in a refusal (a data-k of 100 emoji)
    is drawn as before; a refusal of the steps names it by its words cut there, with "…". A name inside a refusal is
    cut at 60 letters, as 0.32.0 cut it.
  - A refusal that none of the deck's own rules says first comes in the steps' words, naming the piece as the deck
    does and without footprint-story's `isometric: `: wires the floor cannot lay (`this map: the wires cannot be laid:
    … — check each wire's ends and the blocks' ports`), a picture that cannot be fitted (`this map: its picture (fitted
    into the area): …`), a floor's label with too much drawn over its edge (`"f" (data-iso="floor"): its label: …`).
    Before, the first two were footprint-story's bare words and the third had no `its label: `. None is known to reach
    a deck the deck itself accepts.
  - A map with two things wrong may name the other one first. On a map whose blocks the build places, these are now
    said before "the build cannot place this map's blocks": a cylinder that is not round; a floor with a data-at and no
    data-size; a floor whose group has no block; a floor whose size is not whole tiles; a wire to a port its block
    lacks (or a port on a name two pieces share, or a port with a bend). And a floor's size is said before the slide's
    area or a fitted grid.
- For whoever calls the deck's modules directly (not the package's doors): `isoDrawn` takes `floorWires(solids)` (which
  wires lie along the floor, asked before the map is built) where it took `lay` and `lines`, and gives `routes`, the
  ways the steps laid; `cable.js · cables` lays by the same steps (`isoSpec.js · layRoutes`). `iso.js · GROUPED_LEAST`
  is gone (the policy's `fit.grouped`); `FITTED_TILE` is read from the policy. `deck/groups.test.js` reads where the
  blocks stand from `isoDrawn`'s `solids`, where it listened on the removed `lay`.

## 0.32.0 — a block picks how its name breaks

- **`data-break="fill"` on a block or a cylinder**: its name's first line takes as many words as fit, the rest go
  beneath ("Logs to S3 / Archive"). `data-break="even"` is the usual and what every page had: the two lines as alike as
  they can be ("Logs to / S3 Archive"). The rules are footprint-story 0.22.0's (`wordsToFit`'s `break`, the names of
  `BREAK_RULES`), so a film breaks a name the same way. Pages that write no `data-break` are unchanged; on a block or a
  cylinder the attribute is read and not written into the page (on any other element it is not read).
- The run's record names the rule each block's writer picked: `maps made` gains `breaks: [[block, rule], …]`, only
  when a map has one (`storydeck log --run N` shows it).
- Refused, naming the piece and the fix: a value that is not exactly `fill` or `even` (no padding, as a film's recipe
  key), a bare or doubled `data-break`, one on a block with no name the build fits (as a film refuses a `break` with no
  label), and one on a floor (a floor holds no words).

## 0.31.0 — a lead into a port ends at its floor corner, worked out by the story library

A lead into a port on a seen side (the stretch of a cable drawn again over its block) now comes from
`footprint-story/isometric` · `cableLead`, and ends where it should: at the end of the floor point's corner.

**A fix, so pages change.** 0.30.1 counted the lead's pieces (4 for a port above the floor: out of the port, a corner,
down the riser, the floor corner). Where the riser is shorter than its two corners' rounding — common at a low port —
there is no straight run down it, and the count ran one piece on along the floor. In a before/after run over 560
generated maps with ports (not checked in), 232 of 822 leads were that piece shorter: 4.7 px at the median, 8.1 px at
most. A packet on such a cable now passes onto the lead at that share of the line. `deck/lead.test.js` pins a low
port's lead (it fails on 0.30.1). Where 0.30.1's count ended at the floor point, the lead is as it was: footprint-story
0.21.0's property test against copies of the code it replaced (`leadOf` as of 0.30.0, `piecesLength` as of 0.29.0;
the same numbers since). `examples/a-request` has no ports; its page is as on 0.30.1 but for the version in its
generator line.

- `deck/transforms.js` · `leadOf` asks `cableLead` for its way, its pieces and their length; which ends have a lead
  stays this deck's to say. `deck/rides.js` · `piecesLength` moved there with it and is no longer exported. A film's
  lead is now the same.
- Needs `footprint-story ^0.21.0`.

## 0.30.1 — a cable's line stops for its head by the story library's rule

Pages are byte for byte as on 0.30.0 but for the version in the page's generator line (checked on `examples/a-request`
built before and after, and by footprint-story 0.20.0's property tests of `cableWay` and `stopShort` against copies of
0.30.0's `cableWay` and `leadOf`).

- `deck/cable.js` · `cableWay` (a cable's line, its tip pulled back for its head, never past 1 px short of its last
  run's start, its corners rounded) moved to `footprint-story/isometric` · `cableWay`, so a film's cable stops where a
  deck's does; `deck/transforms.js` imports it from there. It is no longer exported from `deck/cable.js`.
- `deck/transforms.js` · `leadOf` (a lead into a port on a seen side, drawn again over its block) held a second copy of
  that pull-back; it now asks the kit's `stopShort` (the points alone, before rounding). footprint-story's property test
  holds a lead built this way to a copy of 0.30.0's `leadOf`.
- Needs `footprint-story ^0.20.0`.

## 0.30.0 — a cable's label and a straight wire live in the story library; zoom checks its options

Pages and compiled records are byte for byte as on 0.29.0 but for the version in the page's generator line. Checked on
`examples/a-request` and on 2,500 generated maps (blocks, cylinders, floors with names, groups, ports, cables with
labels, straight wires with bends and in lanes, wires to a flat piece, wires through the air, every packet ride
option) and 150 compiled decks with their pages (`zoom` and `fit` clicks), built before and after — every page, record
and refusal compared — and 2,000 wires through the air measured; and function for function against 0.29.0's copies
in footprint-story's property tests. What moved is where the rules are: a film draws the same cables.

- `deck/cable.js` · `labelPlace`, `held`, `cableWalk`, `cablePoint`, `LABEL_PLACES`, `LABEL_LOOKS`, `WALK_MOST` and the
  numbers `CLEAR`, `CORNER`, `SAMPLE`, `EDGE`, `TIP` → `footprint-story/isometric` (`labelPlace`, `held`, `walkWay`,
  `LABEL_PLACES`, `CABLE`). These exports are gone from `deck/cable.js`: import them from `footprint-story/isometric`.
- `deck/boxes.js` · `exitOutline`, `exit` → `footprint-story/isometric` (`exitOutline`, `exitBox`); gone from
  `deck/boxes.js`.
- `deck/transforms.js` · the straight wire between two pieces (`wiresBetween`: its lanes, its ends 6 px off each edge,
  the too-close case) → `lanesOf`, `straightRun`; a wire's bend and the end short of its head (`wireSvg`) →
  `bentWire`; the head's corners (`headAt`) → `arrowHead`, `headingOf`; a label's plate (`labelBox`) → `labelHalf`;
  `LANE`, `GAP`, `HEAD` and the label's size → `CABLE`. Reading a wire, the SVG and every sentence of a refusal stay
  here, word for word.
- `deck/rides.js` · `curveLength` → `footprint-story/isometric · curveWay(…).length` (gone from `deck/rides.js`);
  `seenOf` words `footprint-story/motion · seenTerms` as CSS, as before.
- `deck/iso.js` · `roundOutline` → `footprint-story/isometric · roundOutline`.
- **Changed on purpose — `zoom` checks its options as `fit` does.** A `share` that is no number, 0 or less, or over 1,
  or a `most` that is no number, under 1 or over 100, is refused at build in fit's words, naming the option and what
  to give: `focus "zoom": share is how much of the area the subject fills, above 0 and 1 at most (0.7) — not "abc"`,
  `focus "zoom": most is how close the view may go, from 1 (zoom never goes further out) to 100 (2.5) — not "x"`.
  Before, a word gave a view of NaN scale, and a share over 1 or a most past the bounds was taken.
- `footprint-story` 0.19.0 or later. `package-lock.json` still resolves 0.18.0: resolve it once 0.19.0 is published.

## 0.29.0 — framing and a part that differs: the rules live in the story library

Pages and compiled records are byte for byte as on 0.28.0 but for the version in the page's generator line. Checked on
`examples/a-request` and 600 decks made from it — every click's camera and side mover (`zoom`, `fit`, `pan`, `left`,
`right`, `up`, `down`, with random `share`, `most`, `least`, `grow`, `fill`, `scale`, `gap`, `align`, including
options that are no number) and a part's random `data-differs-*` — built before and after, every page, record and
refusal compared; and function for function against 0.28.0's `readDiffers`, `refuseEnglishWords`, `refuseStepDiffers`
and focus strategies over 50,000 generated inputs each. What moved is where the rules are: a film needs them too.

- `focus.js` · the size `zoom`, `fit` and the side movers give → `footprint-story/layout · frameZoom` (the box
  contained in the room, a share of that, held between two bounds; the same operations, so a view rounded to 4 places
  rounds as before). An unchecked `zoom` option that is no number still gives the view it gave.
- `deck/differs.js` · the rules a part that differs is held to and its default words → `footprint-story`
  (`differsProblem`, `differsLines`, `timeProblem`, `differsEnglish`, `timeWords`, `analogyWords` and the bounds).
  Reading the attributes and every sentence of a refusal stay here, word for word.
- `footprint-story` 0.18.0 or later.

## 0.28.0 — the numbers a film shares live in the story library

Pages and compiled records are byte for byte as on 0.27.0 but for the version in the page's generator line, and one
wire nobody draws on purpose (below). Checked on `examples/a-request`, a second starter deck, and 430 maps — groups,
floor labels, kept-clear words, ports, hairpins and packet rides, and the edges: a kept-clear box at `left:1.2.3px` or
400 digits wide, a px speed of 2,000,000,000 or 400 digits or too slow to count, a wire through the air 3,000,000,000
px long; 400 of the maps random, 80 also through `check` — built before and after, every output and refusal compared.
The one change: a wire through the air written with numbers near 1e308, whose length overflows to no number, is
refused naming the wire (`its length cannot be measured`), where 0.27.0 drew it with a broken ride. What moved is where the work is done: five helpers a film needs too now live once in `footprint-story`
0.17.1, and the deck imports them.

- `deck/ride.js` → `footprint-story/motion` (`rideProfile`, `rideSeconds`, `speedAt`, `withHold`, `showStops`,
  `hiddenRamps`); `rides.js` reads them, and a ride's eased end is bounded by the kit's `MOST_EASE`. A px speed is
  asked against the 0.5–60 s range first, so one past any run keeps the deck's advice.
- `deck/cable.js · hairpins` → `footprint-story/isometric · hairpins`; the words `check` says for each stay here
  (`readWay`).
- `deck/keepClear.js · floorUnder`, `crossesBox` → the kit's `floorUnder` and `crossesBox`. The kit answers a box it
  has no floor for with a reason; `keptFloor` (the deck's) says it in the deck's words, as before.
- `deck/floorLabel.js` → the kit's `floorLabelPlace` (the file is gone; `iso.js` draws the label as before).
- `deck/groups.js · arrangeByGroup`, `GROUP_MARGIN` → the kit's; `groups.js` keeps reading `data-iso-group`.
- `footprint-story` 0.17.1 or later (0.17.0 was never published).

## 0.27.0 — cables that keep off words

- **`data-keep-clear`** on a piece placed by its own style (a name, a note): the cables the build lays keep off the
  floor under its box where there is another way (footprint-story 0.16.0's `keep`: a cost to the router, never a
  wall). Where there is none, the cable runs under the words and `check` (`wire-way`) warns which cable runs under
  which piece, with the fix (`under …` in the way note), asked of the piece's own box and the cable's way on the
  floor. It works on a raised floor (the floor under the box at the blocks' height). A piece no cable comes near
  changes nothing; a cable that goes round words may take another's lane, or pass behind a block (said). Refused with
  the fix: a mark with no box or on an element with no `data-k`, a fitted grid or blocks without `data-at` beside it,
  a box far larger than a picture needs or far off the slide, more kept floor than a map keeps (512 stretches,
  counted as they are made).
- `footprint-story` 0.16.0 or later.

## 0.26.0 — named areas: a floor with a name, and groups

- **`data-label` on a floor** (and `data-icon`, an icon of the deck beside it) names the area it is: the words lie
  flat on the floor along its front edge, part of the floor (they grey, light and hide with it), sized from the tile
  (14 to 28 px), fitted to the edge as a block's name is fitted to its top (an icon and capitals take more room), and
  moved along the edge clear of blocks, footprints and cables drawn over it. `check` (`name-fit`) says a label that
  does not fit (or is deeper than its floor) or that is covered all along, with the fix. A labelled floor stays
  ground unless it names a group. A floor written as an empty `<i>` keeps its `data-icon` for its label. Refused with
  the fix: an empty label or one over 120 letters, a control, direction or other unseen character, an icon without a label or one
  the deck does not have, `data-icon` on a block. The page carries the label's stylesheet only when a floor has one.
- **`data-iso-group`** on blocks and on a floor: when the build places the blocks it places each group together (from
  the wires inside it), then the groups (from the wires between them, with arrange's own gaps), left to right, each
  on its own floor fitted round its blocks alone with a clear tile between floors. The fitted picture holds every
  group's floor, at a tile down to 64 px; `check` (`map-fit`, new) says when it still runs past the slide. A group's
  labelled floor is not ground. Placed by hand, a group still fits its floor. A floor whose group has no block is
  refused, naming the fix.
- An attribute's value written over more than one line is read whole, as a browser reads it (before, such a value
  was refused as unquoted). A floor's label wrapped onto two lines in the file is one line of words.

## 0.25.0 — how a wire's packets ride

- **How a wire's packets ride**, each an attribute on the wire beside `data-packets` (and refused without it):
  `data-speed="300px"` (px a second: the run takes the wire's length over it — the build measures, a deck never does;
  a bare number is still seconds), `data-ride="ease-ends 0.15 0.2"` (out of the start over the first 15% of the
  length, one steady speed, into the end over the last 20%; with a px speed that speed is the steady one),
  `data-rest="end"` (it stays at the end when it arrives, 1 s or `"end 3s"`, and rests there where loops do not run),
  `data-keep-size` (its size on the slide kept under the camera's zoom, through the view's move too),
  `data-trail="3px var(--l1)"` (a line behind it as it rides) and `data-behind="fade"` (out over about three frames
  before a stretch a block hides, from the build's record, and back after it). On a cable into a port on a seen side
  the lead carries the packets too, so one resting at the port is seen there, over its block. Each works on a wire
  through the air too; a wrong value is refused at build, naming the wire and the fix. Under reduced motion, in print
  and with motion off a packet rests as before (at the end with `data-rest="end"`, at its kept size, no trail). The
  numbers are one small module, `deck/ride.js` (plain numbers in and out, so a film can ride the same packets later),
  and `deck/rides.js` turns them into CSS; the page carries their stylesheet only when a wire asks, so every page
  without them is byte for byte as before.
- A wire through the air that asks how its packets ride carries them along its curve by length (offset-path, as a
  cable's), so its eased ends, its px speed and its trail are shares of its length, not of its curve's parameter. A
  packet that fades behind a block is gone before its edge reaches it (its radius more; over the zoom when it keeps
  its size). On a lead's stretch only the lead's copy shows, never both, and a resting packet is drawn under the
  lead's arrowhead. An error quotes at most 60 letters of a value; a trail's colour is at most 100 letters and three
  brackets deep; a wire with no length is refused a px speed, with seconds as the fix.
- Known: without a ride option, a packet riding into a port on a seen side still passes under its block for the last
  short stretch (a page without them stays byte for byte as it was).

## 0.24.0 — a cable that doubles back is said

- **`check` (rule `wire-way`) says when a cable doubles back on itself near a port, or in a tight U.** It warns when
  a cable leaves a port one way and, within two tiles, runs back the other while the port faces away from the cable's
  other end or sideways to it (the port is on the wrong side: put it on the side that faces the way, or turn the block), and when it
  makes a tight U-turn on the floor (two stretches of half a tile or more, one each way, less than half a tile
  apart). A port that faces sideways to the way counts as facing away. A short loop near a port that faces the other
  end is a note (moving the port along its side may straighten it). Jogs under a tenth of a tile, a foot's step to change lanes and a wide U (more than two tiles
  out before turning) are not said. The note is `hairpin start|end|start-hook|end-hook|middle` in `maps[name].ways`.
  The build does not yet lay a way round a hairpin; it says so instead (`cable.js · hairpins`, on the kit's 3D path).
  New warnings: `check --strict` fails on a deck whose ports face away.

## 0.23.0 — pictures that stand on the floor

- **`data-footprint="col row wide deep [high]"`** on a piece you place yourself (a picture, an icon, a card): the
  floor it takes, in tiles. A cable laid along the floor goes round it as it goes round a block, and plugs into its
  ports (`data-ports`, written as a block's are: `data-arrow="lap.rj45 to sw.p1"`); with no height it is floor kept
  clear. A map of footprints alone, with no block, lays its cables too. The piece keeps its place and size and is
  painted in the floor's order with the blocks (its `z-index` is the build's; one in its style is refused). A floor
  with no size is fitted round footprints too. Refused, with the fix: a fitted grid (`fit`) or blocks without
  `data-at` beside a footprint (the piece would not move with them), a footprint on an isometric piece, a wire or a
  callout, one whose style lacks a left, top, width or height, one holding a block or a footprint, a size that is none.
- **Ports on a piece that is neither a block nor a footprint are refused**, on any map (before 0.23.0 they were
  ignored, so a wire to them was drawn straight with no word why).
- The run's record says how many pieces stand on the floor by a footprint (`maps[name].footprints`, stage `maps made`).

## 0.22.0 — cables that plug into a port

- **Ports.** A block names points on its sides where a cable plugs in — `data-ports="p1: 0.4 2 0.3 | up: 4.7 1 0.3"`,
  in its own tiles (x along its width, y along its depth, z up from its base) — and a wire names one as `piece.port`:
  `data-arrow="lap.rj45 to sw.p1"`. The cable leaves the port straight out of its side, drops to the floor, runs
  along the tile lines and comes up into the other port: its line ends on the port itself. The side is read from the
  point (named after the numbers at a corner, and a wrong one refused with the right one). A port on a side behind is
  allowed: its stretch runs behind its block, and `check` (rule `wire-way`) says so, as that, not as a block to move.
  A port that is no port of its block, a port on a piece that is no block, and a bend on a wire to a port are refused,
  naming the fix. A name with a dot that some piece (not a wire) goes by is still that piece. Not yet: the top, cylinders.
- **The lead into a port on a seen side is drawn over its block.** The cable lies under every block; the stretch out
  of such a port and its riser stand in front of the block's face, so that stretch is drawn again just above its
  block (it is the cable's own piece: shown, lit and hidden with it, without a ring of its own; the one at the far end
  shows when the cable's sweep reaches it), and a head into that port with it. The dev page moves pieces on such a map
  as on any: a lead is the build's own drawing, in no file.
- **The paint levels of an isometric piece are even now** (2, 4, …, and a callout's 514): the odd level above a block
  is a lead's. Nothing looks different; a test that read a block's `z-index` reads twice the number.
- The build's record of a cable (`maps[name].cables`) runs from port to port, risers included, and names its `ports`.
- `footprint-story` 0.15.0 or later. Known: a packet riding into a port on a seen side passes under its block for the
  last short stretch (packet options are the next step).

## 0.21.0 — a run can say why

- **`storydeck log --run <n> --why <value>`** (and the MCP tool `log` with `why`): where a value of a run came from,
  walked back from the run's own record — its value, the stage that wrote it, the rule that chose that stage and what
  each had read. `--why verdict` goes from the verdict to the counts, to the stage that last changed the problems and
  to the deck that was read. Nothing is
  run again, and a value no stage wrote is said so. The reader is `footprint-story/record`, the one StoryReel uses:
  the record is read as a file anyone may have written, and one that is not whole says so first.
- A run's record now keeps, with each write, the keys its stage had read by then, and the run keeps which decision
  let each step run. Every decider writes its reason (`compiledWhy`, `measureWhy`, `writeWhy`, `verdictWhy`), so the
  walk goes through it; `storydeck log --run <n>` shows those four writes in the run in words. A run that measured
  in a browser says that the browser's chart keeps a log of its own; a run kept before this version says its record
  holds no reads.
- `footprint-story` 0.14.1 or later.

## 0.20.0 — a picture that holds its wires, names that fit, and the build's record of a map

- **The floor and the picture hold the wires too.** A wire that goes round a block reaches past the blocks, and a
  fitted picture cut it off at the slide's edge. The wires are now laid as soon as the blocks stand, before anything
  is fitted: a fitted floor lies under every wire, and the fitted picture keeps every wire on the slide. A map the
  build places, or one with `data-iso-grid="fit"`, may stand a little differently on the slide than in 0.19.0.
- **A block's name fits its top face.** The name (its first `<b>`, inside no other element) stays as written when it
  fits on one line; else it is broken onto two lines where they are most alike; else it is made smaller, down to
  16 px. A name that still does not fit is drawn at 16 px, and a new rule, `name-fit`, warns with the two ways out
  (shorten it, or give the block a bigger top). The room is the top's own: a diamond, as wide across its middle as
  the block's shorter side is long, and narrower where a second line stands.
  Counted in letters, since a build has no browser; `build --layout` measures the page. A no-break space (`&nbsp;`)
  keeps two words on one line. A `<b>` with a style or markup of its own is left alone. Names that ran past their block in 0.19.0 are drawn differently now.
- **`data-head="none"`** on any wire: a plain line that runs its whole length, with no arrow's head. `none` is its
  one value: a wire with any other `data-head` (it meant nothing before) is now refused, naming the fix.
- **The build's record of a map**, beside the page: `compileDeck(source).maps[name]` has `made` (who placed the
  blocks, the tile, whether the picture was fitted), `cables` (each cable's corners and its line's length in slide
  px, the stretches a block hides, what it passes behind, crosses and shares) and `tight`. The run's log has a new
  stage, `maps made`, with the same facts. Each cable carries its line's length in the page as `--sd-length`, so a
  deck's own CSS can time a thing to a cable without measuring.
- **A map is made in one order, each step one function**: icons, blocks placed, wires laid in tiles, floor and
  picture fitted, pieces drawn, callouts, wires drawn. A wire's way is found once.
- `footprint-story` 0.13.0 or later (`gridFor` · `also`, `wordsToFit`, `unseen` on a route, a top's `room`).

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
