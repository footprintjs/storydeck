/**
 * storydeck · narration in the page (narrationHtml.js) — notes, a presenter window and listen mode, on <deck-stage>.
 */

/** One click's notes, as the runtimes read them. */
export interface ClickNotes { slide?: string; step?: number; steps?: number; now?: string[]; earlier?: string[] }
/** Each click's notes as a JSON <script id="deck-notes">, safe inside HTML. */
export function notesData(notes: readonly ClickNotes[]): string;
/** Runs in the page: N shows this click's notes (practice); P opens a presenter window that stays in step. */
export function notesRuntime(): void;
/** Runs in the page: L plays the deck in the speaker's voice (embedded clips) or the browser's, with captions. */
export function listenRuntime(): void;
