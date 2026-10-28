/**
 * storydeck · voice (voice.js) — a deck's clips inside one page. Node. The clip cache, the voice port and the kit
 * adapter are footprint-story's: import them from 'footprint-story/voice'.
 */
import type { VoiceProfile } from 'footprint-story/voice';

type Run = (cmd: string, args: string[], options?: object) => { status: number | null };

/** The clips for a single-file page: base64 <script> tags and the click → clip map listenRuntime reads. */
export function embedClips(texts: readonly string[], options: { cache: string; profile: VoiceProfile; run?: Run }): { tags: string; have: number; wanted: number };
