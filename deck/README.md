# deck/ — a deck folder made into one page

`footprint-storydeck/deck` and the `storydeck` command. A deck is a folder of files (deck.json, clicks.html, maps,
theme.css, icons/); this folder turns it into one self-contained page, serves it for editing, and reads it back as
text. Each module does one job, and they compose in one direction:

| Module | Its one job |
|---|---|
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

- **A deck is files, never a program.** Nothing in a deck folder runs. The dev server rebuilds in its own process from
  the deck's files; the browser for the layout check comes from the project you run in, never the deck folder.
- **A deck reads only its own files.** Every file is read by its real path, and one outside the folder (through a link)
  is refused — so a deck someone sent you cannot pull a file from elsewhere into its page, its review or its server.
- **A build writes only what it says, where it says.** Never through a link (a dangling one included), and for a file
  deck.json names, never outside the deck folder — checked before any folder is made.
- **The dev server is for one person on one machine.** Loopback only; a request not addressed to localhost is refused
  (DNS rebinding); GET and HEAD only; no hidden file, nothing outside the folder; no CORS header.
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
