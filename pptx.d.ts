/**
 * storydeck · pptx (pptx.js) — a deck as a PowerPoint file: one slide per click, its settled picture, its notes,
 * its clip. Node. The export is a footprintjs flowchart: every run leaves a record that explains it.
 */
import type { VoiceProfile } from 'footprint-narration/voice';
import type { VideoClip, VideoDriver, VideoStep } from './video';

/** A click to export: as renderVideo takes it, plus the slide's headline (the title, before the label). */
export interface PptxStep extends VideoStep { headline?: string }
/** A click of a deck: its label (and headline), and its notes — narration-html's notesData entry ({ now }), a string, or a list of strings. */
export interface DeckClick { label?: string; headline?: string; notes?: string | readonly string[] | { now: readonly string[] } | null }
/** Where a deck's clips are: footprint-narration/voice's cache and profile, and the reading rules the clips were voiced with. */
export interface PptxVoice { cache: string; profile: VoiceProfile; spell?: Readonly<Record<string, string>>; say?: Readonly<Record<string, string>> }
/** A click as exported: its number, title, notes as written, words as spoken, clip, and the seconds it stays (null: the speaker clicks). */
export interface PlannedSlide {
  n: number; title: string; notes: string; spoken: string;
  clip: { key: string | null; audio: string; duration: number } | null;
  advance: number | null;
}

/**
 * Exports the deck at `url` as a .pptx (`out` itself when it ends in .pptx, else `<name>.pptx` in the folder `out`).
 * Give `steps` (as renderVideo takes them) or `deck` (the clicks with their notes); `voice` finds a click's clip when
 * its step gives none. A clip, a picture or a package that is not usable is refused, naming the fix, and nothing is
 * written to `out`; the refusal's error carries the run's `narrative`.
 */
export function exportPptx(options: {
  url: string; out: string; driver: VideoDriver;
  steps?: readonly PptxStep[]; deck?: readonly DeckClick[]; voice?: PptxVoice;
  /** the file's name in the folder `out` (default 'deck') */
  name?: string;
  /** the document's title (docProps; default: the file's name) */
  title?: string;
  /** the language the notes and titles are tagged with (default 'en-US') */
  lang?: string;
  /** s after a clip before the slide moves on (0.6); s a click without a clip stays, before that gap (2.5) */
  gap?: number; noclip?: number;
  /** the longest clip one click may carry, s (300): a longer one is refused */
  maxClip?: number;
  /** the longest entrance waited for, ms (4000) */
  maxEntrance?: number;
  /** [first, last] (1-based): export a strip of clicks */
  only?: [number, number] | null;
  /** where the pictures and the package are made (its pictures/ is replaced); by default a temporary folder, removed afterwards */
  work?: string;
  log?: (line: string) => void;
}): Promise<{ file: string; slides: number; voiced: number; runtime: number | null; bytes: number; clicks: PlannedSlide[]; narrative: string[] }>;

/** A slide for pptxParts: its title, notes, picture (PNG bytes), sound and the seconds it stays (null or absent: the speaker clicks). */
export interface PptxSlide {
  title?: string; notes?: string; picture: Uint8Array;
  audio?: { data: Uint8Array; ext: 'wav' | 'm4a' | 'mp3'; duration: number; key?: string } | null;
  advance?: number | null;
}
/** A part of a package: its name and its bytes (a string is UTF-8). */
export interface ZipEntry { name: string; data: string | Uint8Array }

/** The parts of a .pptx, [Content_Types].xml first — a minimal PresentationML set, each part schema-valid. Hand them to `zip`. */
export function pptxParts(options: { slides: readonly PptxSlide[]; title?: string; lang?: string }): ZipEntry[];
/** A ZIP archive of the entries, in order (deflated where that helps; no ZIP64). */
export function zip(entries: readonly ZipEntry[]): Buffer;
/** A ZIP archive's entries, each checked against its CRC-32; throws, saying what is wrong, on anything it cannot vouch for. */
export function unzip(data: Uint8Array): { name: string; data: Buffer }[];

/** One slide as read back. */
export interface CheckedSlide { part: string | null; title: string | null; notes: string | null; pictures: string[]; audio: string[]; advance: number | null }
/** A .pptx read back: its slides in order, and whatever would make PowerPoint refuse or repair it ([] when sound). */
export function checkPptx(data: Uint8Array): { slides: CheckedSlide[]; problems: string[] };

export type { VideoClip, VideoDriver };
