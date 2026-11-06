// narrate — a deck's narration (Node): what each click says, and its clips. footprint-story/voice owns the voicing and the
// clip cache; what is the deck's own is its lines and where they are kept. A deck folder is content someone may have sent
// you, so its clips stay inside it and it never names a voice: a voice kit runs Python on this machine, so its folder comes
// from the person's command or a server's start only.
import {narrationVoice} from 'footprint-story/voice';
import {narrationText} from '../narration.js';
import {embedClips} from '../voice.js';
import {folderInside} from './paths.js';

const CACHE = 'voice/cache';

/** What each click says, as a voice reads it: one line per click, '' where it says nothing. */
export const clickLines = (compiled) => compiled.clicks.map((c) => ({id: c.label, text: narrationText(c.notes)}));

/** Where a deck keeps its clips, refused when a link there leads out of the deck. */
export const voiceCache = (root) => folderInside(root, CACHE);

/** The clips as the page carries them, by the settings they were last voiced with: {tags, have, wanted}. */
export function clipTags(root, compiled) {
  const cache = voiceCache(root), {profile} = narrationVoice({cache});
  return embedClips(clickLines(compiled).map((l) => l.text), {cache, profile});
}
