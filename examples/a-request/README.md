# A request, end to end

An example deck in the isometric look: a system drawn as blocks on a floor, told in five clicks.

```
npx footprint-storydeck dev examples/a-request      # live preview
npx footprint-storydeck review examples/a-request --all
npx footprint-storydeck build examples/a-request    # one page: index.html
```

What it shows:

| In the files | What happens |
|---|---|
| `map.html` · `data-iso="block"`, `cylinder`, `floor` | pieces drawn as seen from a corner, placed by `data-at`, sized by `data-size` |
| `clicks.html` · `data-focus="fit"` | the view frames what is shown: close on one piece, further out as more come in |
| `clicks.html` · `data-focus-route="camera w1:1.2 dns"` | the order inside the click: the view moves, then the wire comes on and its packet rides for 1.2 s, then the DNS lights |
| `clicks.html` · `(w3 db)` | two pieces in one turn: they come together |
| `map.html` · `data-callout="db above"` | words pinned to a block |
| `map.html` · `data-stage="panel"` | a piece on a stage of its own: the legend stays put while the map's view moves |
| `clicks.html` · `data-focus="zoom"`, then `data-focus="pan"` | close in once, then move to the next piece at the same size |

A test (`deck/examples.test.js`) builds this deck and checks it, so it is what the library does today.
