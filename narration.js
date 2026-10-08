// narration — what a deck says on each click. Pure; browser or Node.
//
//   writtenText(notes)     the speaker notes as written, for captions
//   narrationText(notes)   the speaker notes as a voice should read them
//
// The rules a voice reads by — numbers in words, the acronyms a voice misreads spelled, a lone symbol said, a word
// without a letter a pause — live in footprint-narration (spokenMap, autoRules, SPELL, SAY), with the sentences,
// the caption cues and file, and YouTube's chapter rule. What is the deck's own is `[draft]`: a bridge line written
// for the deck, not the speaker's own words; it is said, and a listen panel shows it apart.
import { spokenMap, autoRules } from 'footprint-narration';

const AUTO = autoRules();

/** The notes as written, for captions: [draft] marks dropped, white space collapsed. */
export const writtenText = (notes) => (Array.isArray(notes) ? notes : [notes ?? '']).join(' ').replace(/\[draft\]\s*/g, '').replace(/\s+/g, ' ').trim();

/**
 * The notes (a string, or one string per note) as the voice should read them: footprint-narration's automatic rules
 * over the written text. `spell` and `say` replace its default lists (SPELL, SAY): a word in another script gets its
 * reading through `spell` (`{ 日本: 'Japan' }`) — the local voice kit's aligner knows Latin letters only.
 */
export function narrationText(notes, { spell, say } = {}) {
  const rules = spell || say ? autoRules({ ...(spell && { spell }), ...(say && { say }) }) : AUTO;
  return spokenMap(writtenText(notes), { rules }).spoken;
}
