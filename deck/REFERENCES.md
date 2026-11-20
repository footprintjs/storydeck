# Whose methods this folder uses

A method taken from someone else is named here, with the file that uses it and for what. What is not listed is our own.

| Method | From | Used in | For |
|---|---|---|---|
| A wire's way along the floor, round what stands on it; a way with rounded corners and the place along it | see `footprint-story`'s `src/isometric/REFERENCES.md` (Lee 1961; Hart, Nilsson, Raphael 1968) | `cable.js` (through `footprint-story/isometric` · `routes`, `rounded`) | where a wire between two blocks runs, and where a packet stands on it |
| Whether a point is inside an outline, by counting the sides a ray from it crosses | M. Shimrat, *Algorithm 112: Position of point relative to polygon*, Communications of the ACM 5(8), 1962; written in the short form W. R. Franklin's PNPOLY made common | `cable.js` · `inside` | whether a block is drawn over part of a cable, or of its label |
| A label takes the first of a fixed list of places that nothing is in the way of, the least bad when there is none | J. Christensen, J. Marks, S. Shieber, *An Empirical Study of Algorithms for Point-Feature Label Placement*, ACM Transactions on Graphics 14(3), 1995 (the greedy method over fixed candidate places) | `cable.js` · `labelPlace` | where a cable's label stands along it |
| Placing blocks from what is joined to what (layers, ordering in a layer) | see `footprint-story`'s `src/isometric/REFERENCES.md` | `iso.js` (through `footprint-story/isometric` · `arrange`) | a map with no places typed |

Our own: keeping what the build knows of a wire's way beside the page so `check` can say it with its fix;
the label's plate; a packet resting beside the plate; the count of looks a map's labels share.
