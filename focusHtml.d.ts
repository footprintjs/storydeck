/**
 * storydeck · focus, written into slide HTML (focusHtml.js) — for decks built as HTML strings.
 */
import type { FocusClick, FocusLook, FocusPiece } from './focus';

/** Every element carrying `attr` (data-k) becomes a piece: the HTML with each one numbered, and the pieces. */
export function readPieces(html: string, options?: { attr?: string }): { html: string; pieces: FocusPiece[] };
/** A click written as attributes (data-in, data-out, data-on, data-hot, data-quiet, data-focus, data-focus-* → camelCased options). */
export function readStep(attrs: string): FocusClick;
/** That HTML, each piece dressed for this click's look (classes from focus.css, its move as CSS variables). */
export function drawFocus(html: string, look: FocusLook): string;
/** The pieces inside the stage the view moves (a zoom); unchanged when nothing moves the view. Put it in the map's own box. */
export function wrapStage(inner: string, look: FocusLook): string;
/** Classes for the slide around a click: 'sd-focus-new' while its blur comes in, else ''. */
export function slideClass(look: FocusLook): string;
/** The click's blur, holes and labelled frame, in slide px — outside the map's box (empty when it has none). */
export function focusOverlay(look: FocusLook, options?: { canvas?: { w: number; h: number }; area?: readonly [number, number, number, number] }): string;
/** Runs in the page; call it once, at any time: only a forward click animates; a jump or a step back lands at once. */
export function focusRuntime(): void;
