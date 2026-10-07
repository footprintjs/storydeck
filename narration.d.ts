/**
 * storydeck · narration (narration.js) — what a deck says on each click, as text a voice reads and captions follow.
 */

/** A whole number (0 to 999,999) in words: 42 → "forty-two". */
export function numberWords(n: number): string;
/** Words a voice misreads as a word, and how to say them (UI, API, APIs). Every other acronym stays as written. */
export const SPELL: Readonly<Record<string, string>>;
/** A symbol standing alone, said as the word it means (& and, + plus, = equals, < less than, > more than, × times, % percent, Greek letters). */
export const SAY: Readonly<Record<string, string>>;
/** The notes as the voice should read them: [draft] marks dropped, `spell` words spelled (at Unicode word edges), numbers as words,
 *  a lone `say` symbol said, any other word without a letter a pause (its sentence end kept). */
export function narrationText(notes: string | readonly string[], options?: { spell?: Readonly<Record<string, string>>; say?: Readonly<Record<string, string>> }): string;
/** The notes as written, for captions: [draft] marks dropped, white space collapsed. */
export function writtenText(notes: string | readonly string[]): string;
/** Sentences as a voice script splits them: after . ? or ! and a space. */
export function sentences(text: string): string[];

/** A clip's timing: its length and each sentence's start in it (s). */
export interface ClipTiming { duration: number; sentences: readonly number[] }
/** A click on the video's timeline, for captions. */
export interface CaptionStep { start: number; lead?: number; written?: string; spoken?: string; clip?: ClipTiming | null }
export interface Cue { start: number; end: number; text: string }
/** Subtitles by sentence, timed by each clip's aligned sentence starts (as written when the sentences line up). */
export function captionCues(steps: readonly CaptionStep[]): Cue[];
/** 3661.5 → "01:01:01,500" (SRT) or, with sep '.', WebVTT's "01:01:01.500". */
export function stamp(seconds: number, sep?: string): string;
export function toSrt(cues: readonly Cue[]): string;
export function toVtt(cues: readonly Cue[]): string;
/** 95 → "1:35"; 3725 → "1:02:05". */
export function clock(seconds: number): string;
/** YouTube chapters, and what breaks YouTube's rules (first at 0:00, at least three, each 10 s or more). */
export function chapterList(marks: readonly { at: number; title: string }[], options?: { length?: number }): { text: string; problems: string[] };
