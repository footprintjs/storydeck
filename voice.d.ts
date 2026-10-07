/**
 * storydeck · voice (voice.js) — a deck's narration in a voice: one clip per click, cached by what it says. Node.
 */

/** The voice profile's settings that shape a clip (any extra fields are ignored). */
export interface VoiceProfile { id: string; exaggeration?: number; cfgWeight?: number; seed?: number; sentenceGapSeconds?: number; takes?: Record<string, unknown> }
/** A cached clip: its key, its audio file (.wav, else .m4a), its length and each sentence's start (s). */
export interface Clip { key: string; audio: string; duration: number; sentences: number[] }
/** The voice port: synthesize scenes into audio files with their aligned words. */
export interface VoiceEngine {
  name: string;
  synthesize(scenes: { id: string; text: string }[], options: { work: string }):
    Promise<{ id: string; audio: string; duration: number; words?: { start: number }[] }[]> | { id: string; audio: string; duration: number; words?: { start: number }[] }[];
}
type Run = (cmd: string, args: string[], options?: object) => { status: number | null };

/** The cache key of a clip: a hash of the profile's settings and the exact text. */
export function clipKey(text: string, profile: VoiceProfile): string;
/** The cached clip for a text, or null. */
export function clipFor(text: string, options: { cache: string; profile: VoiceProfile }): Clip | null;
/** Where each sentence starts: its first word's aligned start. */
export function sentenceStarts(text: string, words: readonly { start: number }[]): number[];
/** "1-3,7" → Set {1, 2, 3, 7} (1-based clicks); null for all. */
export function pickSteps(spec?: string | null): Set<number> | null;
/** Voices every click whose clip is not cached, in batches, each cached as soon as it is done. */
export function voiceClips(texts: readonly string[], options: {
  cache: string; profile: VoiceProfile; engine: VoiceEngine; only?: Set<number> | null; batch?: number; work?: string; log?: (line: string) => void;
}): Promise<{ wanted: number; todo: number; voiced: number }>;
/** The adapter for a local voice kit (Chatterbox, aligned with MMS_FA; nothing is uploaded). */
export function chatterboxKit(options: { kit: string; python?: string; script?: string; profile?: string; device?: string; env?: Record<string, string | undefined>; run?: Run }): VoiceEngine;
/** The clips for a single-file page: base64 <script> tags and the click → clip map listenRuntime reads. */
export function embedClips(texts: readonly string[], options: { cache: string; profile: VoiceProfile; run?: Run }): { tags: string; have: number; wanted: number };
