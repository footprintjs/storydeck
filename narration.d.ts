/**
 * storydeck · narration (narration.js) — what a deck says on each click. The rules a voice reads by, the sentences,
 * the captions and the chapters are footprint-narration's: import them from 'footprint-narration'.
 */

/** The notes as written, for captions: [draft] marks dropped, white space collapsed. */
export function writtenText(notes: string | readonly string[] | null | undefined): string;
/** The notes as the voice should read them: footprint-narration's automatic rules over the written text (`spell`, `say` replace its default lists). */
export function narrationText(notes: string | readonly string[] | null | undefined, options?: { spell?: Readonly<Record<string, string>>; say?: Readonly<Record<string, string>> }): string;
