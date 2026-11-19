# Whose methods this folder uses

A method taken from someone else is named here, with the file that uses it and for what. What is not listed is our own.

| Method | From | Used in | For |
|---|---|---|---|
| A curve from two end points and two handles (a cubic Bézier curve) | P. Bézier, *Définition numérique des courbes et surfaces I*, Automatisme XI, 1966 | `cable.js` · `cablePoint`; `deck.css` (a cable's packet) | a cable's curve, and where a packet stands on it at each moment of its ride |
| Whether a point is inside an outline, by counting the sides a ray from it crosses | M. Shimrat, *Algorithm 112: Position of point relative to polygon*, Communications of the ACM 5(8), 1962 | `cable.js` · `inside` | whether a block is drawn over part of a cable's label |
| A label takes the first of a fixed list of places that nothing is in the way of, the least bad when there is none | J. Christensen, J. Marks, S. Shieber, *An Empirical Study of Algorithms for Point-Feature Label Placement*, ACM Transactions on Graphics 14(3), 1995 (the greedy method over fixed candidate places) | `cable.js` · `labelPlace` | where a cable's label stands along it |
| Placing blocks from what is joined to what (layers, ordering in a layer) | see `footprint-story`'s `src/isometric/REFERENCES.md` | `iso.js` (through `footprint-story/isometric` · `arrange`) | a map with no places typed |

Our own: which two feet a cable joins (the pair that face each other across the slide), how cables share a foot (by
how far up the slide the other end stands), and a cable's handles (along the floor's two directions, a share of its
run).
