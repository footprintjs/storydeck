/**
 * storydeck · focus, written into slide HTML (focusHtml.js) — for decks built as HTML strings.
 */
import type { FocusClick, FocusLook, FocusPiece } from './focus';

/** Every element carrying `attr` (data-k) becomes a piece: the HTML with each one numbered, and the pieces. */
export function readPieces(html: string, options?: { attr?: string }): { html: string; pieces: FocusPiece[] };
/** A click written as attributes (data-in, data-out, data-on, data-hot, data-quiet, data-focus, data-focus-* → camelCased options). */
export function readStep(attrs: string): FocusClick;
/**
 * That HTML, each piece dressed for this click's look (classes from focus.css, its move as CSS variables). On a path, a
 * piece's moment rides as `--sd-path-delay`: its turn (`sd-path`), or, stepping aside for its lit twin, that twin's
 * (`sd-twin-turn`); focus.css adds .4 s under a new blur. A click without a path is drawn exactly as before. A piece
 * that goes by its group's spring (apart) is marked `sd-apart` (no CSS move: focusRuntime plays the spring) and
 * carries `data-sd-apart="index to was stagger names…"`; a click without apart is drawn exactly as before.
 */
export function drawFocus(html: string, look: FocusLook): string;
/** The pieces inside the stage the view moves (a zoom); unchanged when nothing moves the view. Put it in the map's own box. */
export function wrapStage(inner: string, look: FocusLook): string;
/** Classes for the slide around a click: 'sd-focus-new' while its blur comes in, else ''. */
export function slideClass(look: FocusLook): string;
/** The overlay of a click in slide px — the blur, its frame and label, and a path's line (once its route is done, .4 s later under a new blur) — put outside the map's box; '' when the click has none. */
export function focusOverlay(look: FocusLook, options?: { canvas?: { w: number; h: number }; area?: readonly [number, number, number, number] }): string;
/**
 * Runs in the page; call it once, at any time: only a forward click animates; a jump or a step back lands at once.
 * It plays apart's springs (one per group, staggered, from wherever the last click left a group, mid-way too; each deck
 * on the page its own) as Web Animations, so a group at rest is exactly as drawn; under reduced motion, or without
 * Element.animate, it lands.
 */
export function focusRuntime(): void;
