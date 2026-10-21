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
| `transforms.js` | the built-in drawing helpers: `data-arrow` wires (with packets), `data-icon` icons |
| `source.js` | the folder read from disk (Node) — only its own files, never through a link that leaves it |
| `compile.js` | clicks planned (each map's focus state carried from click to click) and drawn as `<deck-stage>` slides |
| `page.js` | the one page: slides, notes, every stylesheet and runtime inlined; the theme toggle |
| `assets.js` | what the library ships that the page carries (the runtime, focus.css, narration.css, deck.css) |
| `build.js` | read + compile + page, and the page written (never through a link, never outside the deck) |
| `review.js` · `check.js` | the deck as text: an outline, one click reviewed, what to fix |
| `layout.js` | the check only a browser can make (text that spills), through the video's driver |
| `dev.js` · `devClient.js` | the editing server and the client the page gets in development only |
| `edit.js` | the two edits the dev page sends, written back as text: a piece moved (its map), a note left (feedback.md) |
| `noteKey.js` | which notes are the person's: the key the dev server signs them with, kept with the person, not the deck |
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
