# deck/ — a deck folder made into one page

`footprint-storydeck/deck` and the `storydeck` command. A deck is a folder of files (deck.json, clicks.html, maps,
theme.css, icons/); this folder turns it into one self-contained page, serves it for editing, and reads it back as
text. Each module does one job, and they compose in one direction:

| Module | Its one job |
|---|---|
| `paths.js` | where a deck may read and write — the one owner of every path rule |
| `html.js` | the shared HTML string rules: escaping, comments, closing-tag safety, the one-pass element scan |
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
  to localhost is refused (DNS rebinding); GET and HEAD only; nothing hidden or outside the folder; no CORS, and every
  answer same-origin only; a request it cannot read is answered 400, never a crash.
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
