# deck/ — a deck folder made into one page

`footprint-storydeck/deck` and the `storydeck` command. A deck is a folder of files (deck.json, clicks.html, maps,
theme.css, icons/); this folder turns it into one self-contained page, serves it for editing, and reads it back as
text. Each module does one job, and they compose in one direction:

| Module | Its one job |
|---|---|
| `paths.js` | where a deck may read and write — the one owner of every path rule |
| `html.js` | the shared HTML string rules: escaping, comments (found in one pass), closing-tag safety, the one-pass element scan |
| `config.js` | deck.json read: defaults filled, an unknown key refused with the keys there are |
| `parse.js` | clicks.html read into parts and clicks (a step holds its `<h2>` and notes; anything else is refused) |
| `transforms.js` | the built-in drawing helpers: `data-arrow` wires (with packets) — by numbers, or between pieces ("client to server": edge to edge, in lanes, carrying `data-ends` for a click's `name+`), with a label, a halo and running packets (loops), and how those ride (`rides.js`) — and `data-icon` icons. A wire between two isometric pieces is drawn along the line `cable.js` gives, and what the build knows of its way is handed on beside the page (`wiresDrawn`, `transformed`: `ways`) for `check.js` · `wire-way` |
| `rides.js` | how a wire's packets ride, as a page draws it: the options read and refused with the fix (`readRide`: `data-speed` in px, `data-ride`, `data-rest`, `data-keep-size`, `data-trail`, `data-behind`, a quoted value cut at 60 letters), the ride's numbers for one line (`rideOf`: `footprint-story/motion` · `rideProfile`, `rideSeconds`, `withHold`, `showStops`, `hiddenRamps` — plain numbers, nothing drawn, so a film rides the same packets the same way; `deck/ride.js` until 0.28.0), the packets and trails as SVG riding the wire's own line by length (`ridersSvg`, `rideMarks`: a cable's floor line, a lead's copy on its own stretch, a wire through the air its curve) and `RIDE_CSS`, which a page carries only when a wire asks. WHY apart from `transforms.js`: that is a wire's shape, this its packets' motion |
| `cable.js` | a wire between two isometric pieces, laid along the floor: the way footprint-story's map steps laid for it (`footprint-story/isometric` · `routes`: along the tile lines, round what stands in its way, from a foot that is seen to a foot that is seen; handed by `isoSpec.js`) put on the slide, and what the build notes of its way for `check` to say (`wayNote`, `readWay`; where a cable doubles back is the kit's `hairpins`, the words for it are `readWay`'s) — plain numbers in, plain numbers out. Where its label stands on it (`labelPlace`), the cable's numbers (`CABLE`) and a straight wire's lanes, ends, bend, curve and head (`lanesOf`, `straightRun`, `bentWire`, `curveWay`, `arrowHead`) are the kit's since 0.30.0: a film draws the same cable and the same label. Its line, stopped for its head and its corners rounded, is the kit's `cableWay` since 0.30.1 and a lead into a port on a seen side (its way, its pieces and the share of the line where a packet passes onto it) is the kit's `cableLead` since 0.31.0, both asked by `transforms.js`. WHY its own file: it is geometry, and `transforms.js` is strings. WHY the way is the kit's: a film lays the same wires, and one curve of our own (0.18.0) could not go round a block A wire to a port (`piece.port`) plugs in there: the kit's way leaves the port and comes into it, and its lead into a port on a seen side is drawn again over that block (`transforms.js · leadSvg`, one paint level above the block's). |
| `boxes.js` | where a map's pieces stand, for the helpers that draw between them (a wire, a callout); where a line leaves a box or an outline is the kit's (`exitBox`, `exitOutline`) since 0.30.0 |
| `iso.js` | blocks on a floor seen from a corner (`data-iso`: block, cylinder, floor; `data-iso-grid`): read from the map's HTML, the map built by footprint-story's map steps (`isoSpec.js`), and the page written from what they built — each piece's element placed, sized and given its level, its faces painted from the built map's paint list (`isoPaint.js`), its name as the steps fitted it to its top face (`wordsToFit`: two lines, then smaller; `tight` when it cannot) and a floor's label (`data-label`, `data-icon`) as a span inside the floor where the steps laid it (flat along its front edge, clear of what is drawn over it), with the CSS the page adds only when a deck has one. WHY the steps are not here: a deck and a film build a map the same way, so the order — place, lay, fit the floors, choose the tile, fit the names, place the labels, paint — is one list of steps both call (here until 0.33.0) |
| `isoPaint.js` | the one SVG painter: a piece's paint list, as footprint-story's map steps made it (`style`: `paints`, `floorPaints`; the format is `footprint-story/isometric` · paint.js), written as the SVG inside its box (`isoArt`) — an element per item, classed by its role (`iso-<role>`, the tile lines `iso-lines`), a colour written only when the item carries one, and a stroke's width, join, cap and alpha apart from colour — as presentation attributes: every value on a map that names a style (`isoArt(…, {styled})`), else only where they differ from what the page's CSS draws for that role (`PAGE_STROKES`, the usual style's: so a page with no style is as before). WHY: a deck and a film paint the same list, so they draw one picture; the deck's CSS still colours a piece by its classes. `iso.js` builds no face of its own (since 0.35.0). A hand-drawn `stroke` item (0.39.0; `data-style="line: human:sketchy; texture: human:hatch"`, the human door's `HUMAN_STYLE_CHOICES`, which `isoSpec.js` hands the steps) is filled as footprint-story's capped ring round it (`human` · `strokeOutline(points, {cap})`, non-zero), whole and at rest, and drawn ONCE for the page (`isoArt(…, {strokes})`: each run a `<g id>` in `<svg data-sd-strokes>`, each click a `<use>`; `inlineStrokes` writes them back for deck-data.json); `strokesDrawn` gives the map's record of them (counts and bytes, never a point), checked against `isoRules.js` · `STROKES_NOTE` / `STROKES_MOST`. A texture's marks (`lines` other than the tile lines: a grain's flecks, 0.40.0) are drawn once the same way (`DRAWN_ONCE`). On a paper map (`paperOf`: the look `line-art`) a fill in the paper is written `var(--iso-paper, <paper>)`, so a dark page draws its own paper (`iso.js` · `LOOK_CSS`) |
| `isoStyle.js` | a map's style (`<i data-style="line: ink width 5"></i>`): read from its own empty `<i>` and taken out of the map (`readStyle`), its plain words — "column: choice option value", columns apart with ";" — made the kit's row (`parseStyle`) and refused in the deck's words (a column, a choice, an option it has not, naming the ones there are); handed to the map steps as the spec's `style`. A look is a column of its own, `look: line-art` (0.40.0: footprint-story's `ISO_LOOKS`, no options; a column beside it replaces that part). WHY plain words: every map attribute is written by hand or by a model, and JSON in an attribute is the first thing either gets wrong |
| `isoSpec.js` | the adapter between the deck and footprint-story's map steps (`buildIsoMap`, `ISO_MAP_POLICIES.deck`): a map's pieces as `iso.js` read them handed over as the steps' spec (each under a name of its own, `specNames`; the deck's words for a piece as its `who`, so a refusal needs no rewording; a wire handed only where the steps can use it — laid along the floor, or the first between two blocks the build places; the usual grid in numbers), and the built map read back in the deck's names (`builtMap`: where each stands, the grid, the names, the labels, the paint order, each wire's way as `cable.js · cablesOn` reads it). `layRoutes` lays wires between pieces that already stand by the same steps, for a caller that hands no ways (`cable.js · cables`). WHY its own file: what a tool's adapter must do is the kit's list (its src/isometric/README.md), and one file holds it |
| `isoRules.js` | the deck's own rules for a map, said in its words before the map is built: who places the blocks (all or none; never beside a footprint or floor kept clear; one first name each), what a floor needs (a size, or blocks to be fitted round), where a fitted picture goes (deck.json `area`), and each piece as the grid reads it. WHY apart from the steps: these refusals are written in the deck's attributes and pinned by its tests, so they are asked first and the steps never meet a map the deck would refuse |
| `motion.js` · `motionRead.js` · `motionPlan.js` · `motionDraw.js` | blocks that move by intent (`<step data-move="box fall; crate slide to 4 4.5">`): read, planned by footprint-story's intent decider, written as CSS keyframes of its own samples. The number rules a move is placed and checked by (where a block lands, what it passes through, what is off the slide, which name a resting block hides, the paint order at a moment) are footprint-story's (`footprint-story/isometric`), the one copy StoryReel reads too; the deck keeps the drawing, the `deck:` prefix on its critics and its own words |
| `footprint.js` | a piece placed by its own style that stands on the floor (`data-footprint="col row wide deep [high]"`): read and checked (`readFootprints`), handed to footprint-story's map steps with the blocks as an obstacle (`isoSpec.js`) so cables go round it and plug into its ports, and painted in the floor's order (`paintFootprints`: only its style's `z-index`). WHY: the deck's picture is the device; the floor it takes is all the cables need. WHY the floor must be in numbers: the piece stands where its style puts it, so a fitted floor (or blocks the build places) would move under it |
| `groups.js` | blocks that belong together (`data-iso-group`): read (`groupWritten`); placed group by group when the build places them — by footprint-story's map steps (`buildIsoMap` · place: `arrangeByGroup`, `arrange` inside each group, then over the groups as things as big as their blocks and floor), and each group's floor fitted round its own blocks, `GROUP_MARGIN` clear (`fitFloors`). WHY arrange twice: a group is a thing to the arrangement, so the rule that places blocks places groups |
| `portsWritten.js` | a piece's ports as its tag writes them (`data-ports`), checked by the kit's `readPorts`: one reading for a block and a footprint, one set of words for what is wrong |
| `keepClear.js` | floor a cable keeps off, under words placed by their own style (`data-keep-clear`): read (`readKeepClear`), and the floor under a box on the slide at a height (`keptFloor`: `footprint-story/isometric` · `floorUnder` — each half-tile square whose drawn diamond meets the box, exactly; counted before it is scanned — with the kit's reasons for none said in the deck's words, and the map's budget of stretches spent), handed to footprint-story's map steps as `keep` (`isoSpec.js`; their `route` step hands it to `routes`): a cost, never a wall. Whether a cable runs under the words is the kit's `crossesBox`, asked by `transforms.js`. WHY the floor under the box: a cable lies on the floor, so words cover it where the floor under them is |
| `callouts.js` | words pinned to a piece (`data-callout`): a bubble beside it with a tail, read back for `review` and `check`, with the CSS the page adds only when a deck has one |
| `loops.js` | what loops on each click (`data-loop`), checked, and the named loops (footprint-story/motion's endless moves) drawn as CSS — only those a deck shows |
| `source.js` | the folder read from disk (Node) — only its own files, never through a link that leaves it |
| `transitions.js` | how a part arrives (`data-enter`): footprint-story/motion's changes of picture, read and sampled into keyframes for both slides, and the page's runtime that plays them on a forward step |
| `explore.js` | where each piece leads when a viewer explores (deck.json "explore": the click about it), and the page's runtime that follows it |
| `differs.js` | a part that differs from the real thing says so (`data-differs-*`): its declaration read and refused in the deck's words by footprint-story's rules (`differsProblem`, `timeProblem`, `differsLines`), its labels drawn with their CSS, its phrases looked for in the notes |
| `pace.js` | how a part's pieces arrive and leave (`data-arrive`, its times): read and checked, carried on its slides, with the CSS the page adds only when a part asks |
| `compile.js` | clicks planned (each map's focus state carried from click to click) and drawn as `<deck-stage>` slides |
| `lenses.js` | one page to read, scroll or click through (deck.json "lenses"): its words as plain HTML, its slides copied in at rest, with the CSS and runtime the page adds only when a deck asks |
| `page.js` | the one page: slides, notes, every stylesheet and runtime inlined; the theme toggle. `deckStyles` is the one place a deck's stylesheets are put in order, for the page and for deck-data.json |
| `assets.js` | what the library ships that the page carries (the runtime, focus.css, narration.css, deck.css, and each ready-made look, `look-<name>.css`, which only a deck that asks gets) |
| `build.js` | read + compile + page, and the page written (never through a link, never outside the deck) |
| `review.js` · `check.js` | the deck as text: an outline, one click reviewed, what to fix |
| `layout.js` | the check only a browser can make (text that spills), through the video's driver |
| `dev.js` · `devClient.js` | the editing server and the client the page gets in development only |
| `edit.js` | the two edits the dev page sends, written back as text: a piece moved (its map), a note left (feedback.md) |
| `noteKey.js` | which notes are the person's: the key the dev server signs them with, kept with the person, not the deck |
| `notes.js` | the open notes that are the person's own, kept apart from the lines that came with the deck |
| `run/` | one run of a deck: `check` and `build` as one flowchart with a browser adapter, the one reply it answers, and the runs kept with the person for `storydeck log` — its own [README](run/README.md) |
| `tools.js` | the read-first tools as text — one core for `cli.js` and `mcp.js` |
| `init.js` | the starter deck |

## Laws

- **A deck is files, never a program — in Node.** No deck code runs: the dev server rebuilds in its own process from
  the deck's files, and Playwright, for the layout check, is loaded only from beside StoryDeck (`layout.js ·
  findChromium`) — never from the deck folder or the folder you run in. The layout check measures the page offline. A
  deck's HTML does run in the browser, as any page does.
- **A deck reads only its own files** (`paths.js · realInside`). Every file is read by its real path; one outside the
  folder, or a hidden one inside it, reached through a link, is refused — so a deck someone sent you cannot pull a file
  from elsewhere (or its own .env) into its page, its review or its server.
- **A build writes only what it says, where it says** (`paths.js · writeInside`). A new file renamed into place, so never
  through a link (a dangling or a hard link included); a file deck.json names never lands outside the deck folder —
  checked before any folder is made.
- **The dev server is for one person on one machine.** Loopback only (any other host refused); a request not addressed
  to localhost is refused (DNS rebinding); it reads with GET and HEAD, nothing hidden or outside the folder; no CORS,
  and every answer same-origin only; a request it cannot read is answered 400, never a crash. It writes two things
  only, both from its own page: a note (POST `/__storydeck/feedback`, appended to feedback.md) and a piece moved (POST
  `/__storydeck/move`, written into that map's file). Each is checked before its body is read: the page's own origin,
  the per-session token only the served page carries (compared in constant time), JSON, at most 16 KB. Both are
  written by `paths.js · writeInside`, so never through a link; a note never rebuilds, a move rebuilds at once. Every
  answer refuses to be framed by another origin and carries a policy that runs only scripts with this server's nonce —
  StoryDeck's own, which `page.js` marks (`dev.nonce`). So no script a deck carries, in its page or in any file of its
  folder opened on its own, runs in development, and none can read the page's token to send these edits; the dev bar
  says "deck scripts off in dev" when one is held back. A deck's own scripts run in the page `storydeck build` writes.
  The deck's dependencies (`node_modules`) are never served, by any spelling or link (judged by the real path).
- **A real path is the disk's own spelling** (`paths.js · realPath`: links followed, each name as the disk spells it).
  On a disk that ignores case, "Deck" and "deck" are one folder; every rule that compares paths — inside the deck or
  not, the folder a note is signed for — compares them through it.
- **A note is known for the person's by its signature, never by where it is** (`noteKey.js`). A deck someone sent you
  can carry a feedback.md; its lines must never pass for your requests. The dev server signs each note it writes with a
  key kept with you (`~/.storydeck/key`, or STORYDECK_HOME — a relative one from your home folder; made once, readable
  by you only, read from the file it opened and never through a link nor with a second name, refused inside the deck
  folder, which the dev server serves), for this deck's folder, and `feedback`, `check` and the MCP tool list only the notes that key signed
  for that folder (a note copied into another deck is not that deck's). Any other open line is counted, never listed: text that came
  with the deck (or was edited by hand), not a request. A signature vouches for the person's words only — the click,
  the text, the time — never the click's label, which is the deck's text: it stays in the line for a reader of the
  file, and is never listed. Everything the tools print passes `tools.js · printable`, so a deck's labels and notes
  reach a terminal or a model as text, never as what a reader cannot see (html.js · UNSEEN, an allow-list: visible
  letters, marks, numbers, punctuation, symbols and spaces; a joiner or presentation selector only where an emoji
  needs it, a non-joiner only inside a word of a script it shapes — so controls, bidi marks, fillers, Unicode tag
  characters and private code points are out).
- **A move names the piece the build drew, and edits only what a browser and the build both read.** In the dev page
  only, each piece carries the number the build gave it (`compile.js · numberForDev`, `data-sd-at`); an element the
  build did not read as a piece has none and cannot be dragged, and a deck may not write those numbers itself (the
  build refuses any `data-sd-…` attribute in a map or a slide). The map is the slide's own (`[data-deck-active] >
  .map`), never a box a deck drew. `pieceRules.js` (at the package root) owns which tags are pieces and where a
  left/top is written, for `focusHtml.js` and `edit.js` alike; `edit.js · sourcePieces` is the build's own scan of the
  text without comments, placed back in the source, and `transforms.js · wireTags` owns which pieces are wires (found
  as the build finds them: without comments, after icons). A move is refused while the build fails, when the map's
  file changed since the build, when the build's pieces are not the file's in order (an icon holding pieces), when any
  tag of the map holds a quote never closed before its `>` (`edit.js · mapAmbiguity`), when a comment sits inside the
  piece's tag, when a browser reads the piece's tag differently (`pieceRules.js · readAttributes`), when its style
  could set its place twice (a comment, an escape, a character reference, an inset, a second left or top in any case),
  and when a wire carries a style of its own (drawn first, it would place the wire instead of its arrow). Every other
  byte of the file is kept; a bare `0` moved is written in px.
- **Every scan of a deck's text is one pass.** Comments, pieces, a slide's focus, icons and icon files, wires and
  elements are each found once: a 4 MB file of unfinished tags, unclosed comments or one tag repeating an attribute
  costs no more than its length (pinned by tests, and each rewritten scan proved equal to the regex it replaced on
  thousands of generated inputs).
- **An assistant reaches only what it was given.** The MCP server answers for the folder it was started with and the
  decks inside it; a call naming anything else is refused (a deck's notes reach the model, so they may carry an
  instruction someone planted).
- **One page, in development and in the room.** `dev` serves the page `build` writes, plus the dev client; nothing of the
  dev client ships.
- **Read first, look last.** Every finding is text a reviewer can act on: its click, its label and its fix.

## Example

```js
import { loadDeck, reviewClick, checkDeck, formatProblems } from 'footprint-storydeck/deck';

const { compiled } = loadDeck('my-talk');
reviewClick(compiled, 3);
// click 3 of 6 · "1 · The route · 2" (map "map", step 2 of 3)
// headline: "The request travels to the data" (6 words)
// focus: path · route: client → req1 → server → req2 → db, 0.35 s apart · line "client → server → database"
// lit (5): client, req1, server, req2, db
// …
formatProblems(checkDeck(compiled));   // 'no problems', or one line per problem, worst first
```

Co-editing, end to end: the person leaves a note on click 4 in the dev page and Alt-drags the server box; the agent
reads what is open, edits, and ticks the line.

```text
$ storydeck feedback my-talk
1 open note from your dev page (tick a line in feedback.md when it is done):
- click 4 "1 · The route · 3": The server box should say "API server" (2026-10-21 12:20)

$ git diff my-talk/map.html     # the Alt-drag, already written: left/top of "server", every other byte kept
-<div data-k="server" class="box" style="left:720px;top:420px;width:300px;height:210px">
+<div data-k="server" class="box" style="left:870px;top:495px;width:300px;height:210px">
```
