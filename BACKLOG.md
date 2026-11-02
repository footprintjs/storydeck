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
