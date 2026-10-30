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
