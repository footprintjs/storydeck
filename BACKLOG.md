# Backlog

Ideas agreed with the owner, not started. Each gets built only after a go.

## 1. Touch: pieces that answer the pointer like real objects (2026-10-30)

A deck that asks for it lets the viewer touch or point at a piece, and the piece answers the way a real object would,
then springs back to rest. It is for meaning, not decoration: the strongest case shows how a system is connected.

| reaction | what it does | for |
|---|---|---|
| `tilt` | the piece leans toward the pointer, like a card under a fingertip | cards, screens, product shots |
| `push` | it moves away from the pointer and settles back | a crowded map you can feel your way through |
| `magnet` | it pulls a little toward the pointer | buttons, the next step |
| `drag` | pick it up, let go, and it springs home | trying an arrangement without changing the deck |
| `sway` | it bends as the pointer passes, then rights itself (grass, cables, labels) | only where the bending means something |
| `ripple` | touch a piece and the pieces WIRED to it answer in turn, a little later and a little less at each hop | feeling the dependencies: touch the error, and the chain answers back to its cause |

- **Data, not code.** One attribute per piece (`data-react="push"`), and the deck switches it on (`"touch": true`
  in deck.json, as `explore` is). Built pages stay one file, with no network and no dependencies.
- **One spring table.** Every spring comes from footprint-story's `/motion` (its damping-ratio feels), so a deck
  and a StoryReel film feel the same.
- **Laws:**
  - pieces move by transform only, so the layout never shifts;
  - every reaction returns to rest;
  - reduced motion, or `motion off`, means no reactions;
  - the keyboard gives the same nudge as the pointer on the focused piece;
  - touch screens get the same reactions from a tap;
  - `check` refuses a reaction on a piece that has no reason to move (decoration), and names the fix.
- **In films too.** StoryReel can play a scripted pointer path as data (a pure function of time) through the same
  reactions, so a product demo shows the touch exactly, every render.
- **Look first.** One sample slide in which touching a wired piece makes its neighbours answer. The owner tries it in
  a browser before anything is built.

The idea came up while reading an X article by @anstapnever, "Opus 5.5 Loop Lab: 3D motion loops made from code"
(https://x.com/anstapnever/status/2110392373377380473). Its motion rules (one hero per shot, springs by damping
ratio, nothing that only decorates) shape how these reactions should feel. The article states no licence for its
code: borrow the ideas, write the code here.

## 2. A seamless-loop check for `data-loop` (2026-10-30)

Borrowed from the same article. A loop's last frame must flow into its first, keeping its SPEED through the seam,
not only its position. `check` can measure each named loop's start and end states, and `review` can report a loop
that jumps at its seam.

## 3. A figure drawn by its model, with one input to move (2026-11-02)

A slide can hold a figure that its own model draws (a spiral from its growth rate, a pattern from its rule, a
flowchart from a real run), and expose ONE of the model's inputs as a control. Moving it redraws a quick preview;
letting go regrows the whole figure at the new value, and the figure's label says it is no longer the real value.
It is for explaining, not decorating: the viewer sees that the real thing is one setting of its rule.

- **A trial row.** Under the figure, three to five small copies at other values, drawn by the same code, each with
  its value lettered under it and the real one ticked. With no viewer at all, the slide still makes its point.
- **Scrub the build.** The figure draws itself (the construction first, then the thing growing out of it), and the
  viewer can scrub that build in time, as a film can.
- **Data, not code.** The figure names its model module, the input, its range and its real value in deck.json. Built
  pages stay one file: heavy work runs in a Web Worker made from the page's own code, with no network.
- **Laws:**
  - the figure is a pure function of its input and time, with seeded randomness only;
  - the real value is always one step away (a "back to real" control), and the label shows when it is not;
  - reduced motion shows the finished figure, never the build;
  - `check` refuses a trial row drawn by different code from the figure, and a figure whose sources call
    `Math.random`.
- **Look first.** One sample slide: a spiral with its growth rate on a slider and a trial row of three. The owner
  tries it in a browser before anything is built.

Source: Math-Animals by r3al1tym (https://github.com/r3al1tym/math-animals), MIT (Copyright (c) 2026 r3al1tym). On its
site, each plate runs its model in its own Web Worker, the viewer scrubs its time, and one of the model's inputs
regrows the animal at a new value. Its code may be adapted if that notice is kept in the file it lands in.

## 4. A 3D stage: fly from one view to another (2026-11-03)

Pieces placed in x, y, z (each a card: a panel, a picture, a word) and named viewpoints; a click flies the camera
from one view to the next with the browser's own CSS 3D (`perspective`, `translate3d`, `rotate3d`), so built pages stay
one file with no library.

- **One model with StoryReel.** The views, the flight and its choices (which way round, how far to arc, how long) are
  one module shared with StoryReel's 3D stage (its backlog), so a deck and a film fly the same way.
- **Data, not code:** `"stage": {"cards": …, "views": …}` in deck.json; a click names its view.
- **Laws:** pieces move by transform only; reduced motion and `motion off` cut instead of flying; a card is never
  seen from behind unless it has a back; `check` refuses a view that sees no card, or a card edge-on to every view.
- **Look first:** one sample: three cards and two views, a click flies between them.

## 5. A lesson spread: predict, lift the flap, a figure that says how it differs (2026-11-03)

Two pages of an open book on a desk. The left page explains: a title, the one formula, the key words, working in the
margin, a question to predict, and a flap. The right page holds a live figure, its numbered key, and one line telling the
viewer what to do. It is a layout in deck.json, not a 3D engine, and built pages stay one file.

- **Predict, then lift the flap.** The answer stays under a flap until the viewer has picked; their pick stays beside it.
  A presenter's click opens it too. Nothing is stored or sent. Reduced motion opens it with no animation.
- **A figure that says how it differs from the real thing.** The figure declares its time factor and what it draws out of
  scale, the words are drawn on it, and a control switches between slowed and real (item 3's "back to real"). `check`
  refuses a declared rate other than 1 with no words on the slide; it cannot see a speed-up nobody declared.
- **A numbered key.** Numbers on the figure, the key under it; hover, tap or a click lights the part. `check`: every
  number in the key is on a part, and every number on a part or in the action line is in the key.
- **A cutaway.** A partner to `apart` (the exploded view): a window opens in a part's cover to show what is inside, the cut
  faces hatched.
- **A flow along a wire.** Dots along a named path, their speed from the model's value, each place a pure function of
  time. Item 1's `ripple` passes a touch along wired pieces; this one runs on its own. Reduced motion shows fixed dots and an arrow.
- **Ink, with colour only for what the lesson is about.** A hatched line drawing where only what moves has colour.
- **It stands off the page.** With item 4's CSS 3D the figure rises from the page and turns a little under the pointer.
- **One model with StoryReel.** The key, the `differs` words and the flow are the same data in a deck and a film (its
  backlog section of the same date), so one figure can be shown in both.
- **Look first:** one spread, a torch cut away with its current flowing, opened in a browser before anything is built.

Source: a 3D interactive electricity book by @techartist_, being built with Opus 5.5, shown by @0xKapri
(https://x.com/0xKapri/status/2117304745228394951). It is not published and states no licence, so the ideas are borrowed
and the code is written here. Read from three frames of the post's video.

## 6. A cast acts out a system, then turns into it (2026-11-05)

From the owner's own field test of a deck built on 0.10.0. Viewers who weren't engineers followed it, and the same system
told only in boxes lost them by the seventh click. Only the method comes here, written fresh, with no content or drawings.

**The method:** one picture that never moves, told twice.

1. A cast of people and everyday things acts the system out.
2. A bridge: one group at a time, each stand-in fades out, the real piece fades in where it stood, and a callout says
   both names and what it does.
3. The same clicks again, with the real pieces and real calls.
4. Where everything lives, and what to remember.

**General pieces, each useful without the method:**

- **One piece, two looks.** Today a deck draws every piece twice, and each click must name the right copy. A piece holds
  its looks and a part picks one, so clicks name one key in every part.
- **A part replayed in another look, with its own words.** Written once, so the two tellings cannot drift. `check`
  refuses a replayed click with no words for its look.
- **The turn, one item at a time.** Waiting items stay as they are, and an item's callouts come after its pieces.
  Crossfading worked; flipping boxes over was too much motion. A jump, a step back and reduced motion land at once.
- **Callouts pinned to a piece, with a tail.** A bubble beside each piece was easy to tie to it, where one card listing
  every mapping was not. `check --layout`: callouts in a click overlapping, a tail missing its target.
- **Layout checks found by eye:** a headline wrapping into the map, a wire's label crossing a piece, two wires drawn on
  the same points.

Already built: the analogy label, how a part's pieces arrive and leave, a ready-made look (`"look": "base"`) for the looks
here to build on, and callouts.

**Templates: a story shape plus its checks.** `init --template <shape>`, as data on the general pieces, so the library stays
generic and the words stay the deck's. The checks are what a template adds over a starter: "told twice" checks that every
real click matches a story click; "explain, then quantify" checks that no measured number appears before the explanation
ends. Same shape names as StoryReel's recipe kinds, so a deck and a film can share a story.

**A page for agents, from the same source.** A fourth lens beside Read, Scroll and Watch: a glossary from story word to
real thing, each flow step by step, facts not to get wrong, and where to look in the code.

**Look first:** one sample of two looks and the turn, opened in a browser before anything else is built.

