/**
 * storydeck · video (video.js) — a narrated deck as a video: every click on screen while its clip plays. Node + ffmpeg 5.0+.
 */
import type { Clip } from 'footprint-narration/voice';
import type { Chapters } from 'footprint-narration';

/** A cached clip as the video uses it (`words` is not read: a clip from before footprint-narration has none). */
export type VideoClip = Omit<Clip, 'words'> & { words?: Clip['words'] };
/** A click to render: its label, its words as written and as spoken, and its clip (or null). */
export interface VideoStep { label?: string; written?: string; spoken?: string; clip?: VideoClip | null }
/** A click on the timeline (s). */
export interface PlannedClick { n: number; label?: string; written: string; spoken: string; clip: VideoClip | null; lead: number; length: number; start: number }
/** The browser port: makes click n current (forward), pauses its animations, steps them, takes a frame. */
export interface VideoDriver {
  open(url: string): Promise<void>;
  step(n: number): Promise<void>;
  freeze(): Promise<number>;
  seek(ms: number): Promise<void>;
  shot(file: string): Promise<unknown>;
  close(): Promise<unknown> | unknown;
}
type Run = (cmd: string, args: string[], options?: object) => { status: number | null };

/** The timeline: each click's lead and length, from its clip (plus `gap`), or `noclip` s. */
export function planVideo(steps: readonly VideoStep[], options?: { gap?: number; lead?: number; noclip?: number; only?: [number, number] | null }): PlannedClick[];
/** The picture as an ffconcat list (entrance frames, then the held frame); updates the plan's lengths and starts. */
export function framesConcat(plan: PlannedClick[], shots: readonly string[][], options?: { fps?: number }): string;
/** ffmpeg's major version from `ffmpeg -version` (null when it does not say); throws when ffmpeg cannot run. */
export function ffmpegMajor(run?: Run): number | null;
/** ffmpeg's arguments for one click's sound. */
export function audioArgs(click: PlannedClick, file: string): string[];
/** ffmpeg's arguments for the video (fades in and out, H.264 + AAC, trimmed to `length`). */
export function encodeArgs(options: { frames: string; narration: string; out: string; length: number; fps?: number; crf?: number }): string[];
/** Renders the video into `out` with captions, chapters, a thumbnail and the timeline beside it (paths may be relative). */
export function renderVideo(options: {
  url: string; steps: readonly VideoStep[]; out: string; name?: string; driver: VideoDriver; run?: Run;
  fps?: number; gap?: number; lead?: number; noclip?: number; only?: [number, number] | null; maxEntrance?: number;
  chapters?: (click: PlannedClick) => string | null; intro?: string; thumbnail?: (click: PlannedClick) => boolean;
  /** where frames and sounds are made (its frames/ and audio/ are replaced); by default a temporary folder, removed afterwards */
  work?: string; log?: (line: string) => void;
}): Promise<{ video: string; length: number; cues: number; chapters: Chapters; plan: PlannedClick[] }>;
/** The driver for storydeck's <deck-stage> pages, with Playwright's `chromium`. */
export function deckStageDriver(options: { chromium: unknown; executablePath?: string; viewport?: { width: number; height: number }; hide?: string[] }): VideoDriver;
