// init — `storydeck init <dir>`: a starter deck that builds, checks clean and shows every part of the format once
// (a plain slide, a map told click by click, a path, a zoom, wires with packets, icons, notes, light and dark).
import {existsSync, mkdirSync, readdirSync, writeFileSync} from 'node:fs';
import path from 'node:path';

const DECK_JSON = `{
  "title": "A request, end to end",
  "description": "A starter deck: one picture, built click by click.",
  "footer": "A request, end to end · a StoryDeck starter",
  "look": "base"
}
`;

const MAP = `<!--
  The map: one picture the story is told on, in slide pixels (1920 × 1080).
  Every element with data-k="name" and an inline left/top/width/height is a piece a click can bring in, light,
  grey or move. Pieces never nest. <i data-arrow="client to server"> becomes a wire from one piece's edge to the
  other's (it follows them when they move; "x1 y1 x2 y2" in slide px places it by hand; a bend may follow either),
  class "pkt": a packet runs along it on a path click. A wire may carry data-label="its name", class "halo", and
  data-packets="2" data-speed="5" (packets that keep running along it). In a click, "server+" is the server, its wires
  and what they reach. <i class="ic" data-icon="name"> is icons/name.svg. data-loop="pulse" (float, marquee)
  keeps a piece moving while its slide is shown; data-loop alone runs its own --loop from theme.css.
  Ready-made pieces, from "look": "base" in deck.json: class box, chip, area, group or card, with a <b> and a <small>
  inside; add ok, warn or bad to colour one. An area goes before the pieces that stand in it.
  data-callout="server above" pins words to a piece, with a tail (or below, left, right). It sizes itself and comes in
  like any piece; "server+" in a click takes in its callouts. Change its colours in theme.css: --callout-bg, --callout-fg.
-->
<div data-k="client" class="box" style="left:160px;top:420px;width:300px;height:210px"><i class="ic" data-icon="client"></i><b>Client</b><small>a browser</small></div>
<i data-k="req1" class="wire req pkt" data-arrow="client to server"></i>
<div data-k="server" class="box" style="left:720px;top:420px;width:300px;height:210px"><i class="ic" data-icon="server"></i><b>Server</b><small>an API</small></div>
<i data-k="req2" class="wire req pkt" data-arrow="server to db"></i>
<div data-k="db" class="box" style="left:1280px;top:420px;width:300px;height:210px"><i class="ic" data-icon="database"></i><b>Database</b><small>where the data lives</small></div>
<i data-k="ret2" class="wire ret pkt" data-arrow="db to server"></i>
<i data-k="ret1" class="wire ret pkt" data-arrow="server to client"></i>
<div data-k="time" class="chip" style="left:760px;top:670px;width:220px;height:70px"><b>120 ms</b><small>illustration</small></div>
<div data-k="why" data-callout="server above">Most of the wait is here</div>
`;

const CLICKS = `<!--
  The deck, click by click.
  <section data-label="…" data-kicker="…">          one part of the story; without data-map it is one plain slide
  <section … data-theme="ledger">                   optional: its slides carry data-theme, so theme.css can dress that part
  <section … data-enter="push" data-enter-from="right">   optional: how the part arrives (cut fade dip wipe split iris push slide whip zoom)
  <section … data-map="map">                        a part told on map.html: every <step> inside is ONE click
    <step data-in="…" data-out="…" data-on="…" data-focus="…">
      data-in    pieces that come in (they stay)     data-out   pieces that leave
      data-on    what the click is about (the rest shown is greyed); data-quiet brings data-in pieces in greyed
      data-focus how: zoom · path (lit piece after piece, in data-on's order) · left/right/up/down · blur · apart · place
      <h2>       the click's headline (about 12 words at most)
      <aside class="notes">  what the presenter says: N shows it, P opens the presenter window, L reads the deck aloud
-->

<section data-label="Title" data-kicker="A StoryDeck starter">
  <div class="title-block">
    <h1>A request, end to end</h1>
    <p class="sub">One picture, built click by click</p>
  </div>
  <aside class="notes">This starter tells one story on one picture: a request going from a client to its data and back. Change the words, the map and the clicks; the dev page reloads on the click you are on.</aside>
</section>

<section data-label="1 · The route" data-kicker="1 · The route" data-map="map">
  <step data-in="client">
    <h2>A client needs data</h2>
    <aside class="notes">Someone opens a page. The browser needs data it does not have yet.</aside>
  </step>
  <step data-in="req1 server req2 db" data-on="client req1 server req2 db" data-focus="path" data-focus-line="client → server → database">
    <h2>The request travels to the data</h2>
    <aside class="notes">The request goes to the server, and the server asks the database. A path click lights the route in the order it is written.</aside>
  </step>
  <step data-in="ret2 ret1" data-on="db ret2 server ret1 client" data-focus="path">
    <h2>The answer comes back</h2>
    <aside class="notes">The answer comes back the same way, hop by hop.</aside>
  </step>
</section>

<section data-label="2 · Close in" data-kicker="2 · Close in" data-map="map">
  <step data-in="time why" data-on="server time why" data-focus="zoom">
    <h2>Where the time is spent</h2>
    <aside class="notes">Zoom in on the server: most of the wait is spent here. The number is an illustration.</aside>
  </step>
</section>

<section data-label="Summary" data-kicker="Summary">
  <ul class="points">
    <li>One picture, built click by click</li>
    <li>Each click is about one thing</li>
    <li>The rest stays in view, greyed</li>
  </ul>
  <aside class="notes">That is the whole idea: one picture, and every click says what it is about.</aside>
</section>
`;

const THEME = `/* The deck's look. "look": "base" in deck.json brings a ready-made one, light and dark: its tokens, and the pieces a
   picture is made of (box, chip, area, group, card, title-block, points). Change a token here and everything that reads
   it follows; any rule you write here wins over the base. A token on :root reaches light and dark (T switches, the
   choice is kept); :root.dark gives dark its own. Also yours to set: --bg --bg-elev --fg --fg-muted --line --sd-accent
   --sd-dim-opacity --sd-ok --sd-warn --sd-bad --sans --mono. */
:root {
  --accent-ink: #0b6e99; --sd-glow: #e8a33d;
  --sd-radius: 18px;
}
:root.dark {
  --accent-ink: #5cc8f0; --sd-glow: #f2b65a;
}
`;

const ICONS = {
  client: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect x="8" y="12" width="48" height="34" rx="4"/><path d="M24 54h16M32 46v8"/></svg>\n',
  server: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect x="10" y="10" width="44" height="18" rx="3"/><rect x="10" y="36" width="44" height="18" rx="3"/><path d="M18 19h.01M18 45h.01"/></svg>\n',
  database: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><ellipse cx="32" cy="14" rx="20" ry="7"/><path d="M12 14v36c0 3.9 9 7 20 7s20-3.1 20-7V14M12 32c0 3.9 9 7 20 7s20-3.1 20-7"/></svg>\n',
};

/** The starter's README, naming its own folder in the commands. */
const readme = (name) => `# A StoryDeck deck

One picture, built click by click. Edit these files; the dev page reloads on the click you are on.

| File | What it holds |
|---|---|
| \`deck.json\` | title, description, footer, the ready-made look (and \`area\`, \`canvas\`, \`checks\` when you need them) |
| \`clicks.html\` | the parts and their clicks: \`<section>\` per part, \`<step>\` per click on a map |
| \`map.html\` | the picture: every \`data-k\` element with an inline left/top/width/height is a piece |
| \`theme.css\` | a few tokens to make it yours (light, \`:root.dark\`); any rule you write wins over the base look |
| \`icons/*.svg\` | drawn identities, used as \`<i class="ic" data-icon="name"></i>\` |

Run these from your project — the folder that holds this deck — naming the deck (\`npx\` would otherwise prefer a
copy of StoryDeck that a deck someone sent you carries inside it):

\`\`\`bash
npx footprint-storydeck dev ${name}                # live preview: a save reloads on the same click and plays it again
npx footprint-storydeck outline ${name}            # the whole deck, one line per click
npx footprint-storydeck review ${name} --click 3   # one click as text: what it lights, greys, moves and says
npx footprint-storydeck check ${name}              # what to fix (add --layout to let a browser find text that spills)
npx footprint-storydeck build ${name}              # index.html: one self-contained page, nothing loaded from the network
\`\`\`

In the page: ← → or Space step · T light/dark · N notes · P presenter window · L read aloud.
`;

/** The starter deck's files for a deck folder called `name`: {relative path: content}. */
export function starterFiles(name = 'my-talk') {
  return {
    'deck.json': DECK_JSON,
    'clicks.html': CLICKS,
    'map.html': MAP,
    'theme.css': THEME,
    'README.md': readme(name),
    ...Object.fromEntries(Object.entries(ICONS).map(([k, v]) => [`icons/${k}.svg`, v])),
  };
}

/** The starter deck's files, for a deck folder called my-talk. */
export const STARTER = Object.freeze(starterFiles());

/** Write the starter into `dir` (made when missing). A folder that already holds files is refused, so nothing is overwritten. */
export function initDeck(dir) {
  const root = path.resolve(dir);
  if (existsSync(root) && readdirSync(root).filter((f) => !f.startsWith('.')).length) {
    throw new Error(`${dir} already holds files — init writes a new deck into an empty or new folder, so nothing is overwritten`);
  }
  const files = starterFiles(path.basename(root));
  for (const [file, content] of Object.entries(files)) {
    const full = path.join(root, file);
    mkdirSync(path.dirname(full), {recursive: true});
    writeFileSync(full, content);
  }
  return {dir: root, files: Object.keys(files)};
}
