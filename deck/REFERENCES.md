# Whose methods this folder uses

A method taken from someone else is named here, with the file that uses it and for what. What is not listed is our own.

| Method | From | Used in | For |
|---|---|---|---|
| A curve from two end points and two handles (a cubic Bézier curve, after P. Bézier's work at Renault in the 1960s) | as set out in G. Farin, *Curves and Surfaces for Computer Aided Geometric Design*, Academic Press, 1988 | `cable.js` · `cablePoint`; `deck.css` (a cable's packet) | a cable's curve, and where a packet stands on it at each moment of its ride |
| Whether a point is inside an outline, by counting the sides a ray from it crosses | M. Shimrat, *Algorithm 112: Position of point relative to polygon*, Communications of the ACM 5(8), 1962; written in the short form W. R. Franklin's PNPOLY made common | `cable.js` · `inside` | whether a block is drawn over part of a cable, or of its label |
| A label takes the first of a fixed list of places that nothing is in the way of, the least bad when there is none | J. Christensen, J. Marks, S. Shieber, *An Empirical Study of Algorithms for Point-Feature Label Placement*, ACM Transactions on Graphics 14(3), 1995 (the greedy method over fixed candidate places) | `cable.js` · `labelPlace` | where a cable's label stands along it |
| Placing blocks from what is joined to what (layers, ordering in a layer) | see `footprint-story`'s `src/isometric/REFERENCES.md` | `iso.js` (through `footprint-story/isometric` · `arrange`) | a map with no places typed |

Our own: which two feet a cable joins (the pair that face each other across the slide), how cables share a foot (by
how far up the slide the other end stands), a cable's handles (along the floor's two directions, a share of its
run), and the rule that a cable is laid first and kept only if it lies clear of its own two blocks and of its twin.
Whether two cables cross is asked the usual way, by which side of each run the other's ends lie on.
