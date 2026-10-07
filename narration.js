// narration — what a deck says on each click, as text a voice reads and captions follow. Pure; browser or Node.
//
//   narrationText(notes)              the speaker notes as a voice should read them
//   sentences(text)                   split as the voice splits them (after . ? or !)
//   captionCues(steps) → toSrt / toVtt   subtitles by sentence, timed by each clip's aligned sentence starts
//   chapterList(marks)                YouTube chapters ("0:00 Intro"), with YouTube's rules checked
//
// What a voice taught us, kept as defaults: an acronym stays as written (a cloned voice says LLM, HCI, MCP as
// quick letters; spaced out, "L L M" came out slow and odd), and only the ones it misreads as a word are spelled
// (SPELL: UI, API). Numbers become words, because a forced aligner only knows letters. `[draft]` marks a bridge
// line written for the deck, not the speaker's own words: it is said, and a listen panel shows it apart.

const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve',
  'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

/** A whole number (0 to 999,999) in words: 42 → "forty-two". */
export function numberWords(n) {
  if (n < 20) return ONES[n];
  if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? '-' + ONES[n % 10] : '');
  if (n < 1000) return ONES[Math.floor(n / 100)] + ' hundred' + (n % 100 ? ' ' + numberWords(n % 100) : '');
  return numberWords(Math.floor(n / 1000)) + ' thousand' + (n % 1000 ? ' ' + numberWords(n % 1000) : '');
}

/** Words a voice misreads as a word, and how to say them: spelled. Every other acronym stays as written. */
export const SPELL = Object.freeze({ UI: 'U I', API: 'A P I', APIs: 'A P Is' });

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * The notes (a string, or one string per note) as the voice should read them: [draft] marks dropped, the
 * `spell` words spelled, numbers as words, a separator (— – · →) as a pause, white space collapsed.
 */
export function narrationText(notes, { spell = SPELL } = {}) {
  let text = (Array.isArray(notes) ? notes : [notes ?? '']).join(' ').replace(/\[draft\]\s*/g, '');
  for (const [word, said] of Object.entries(spell)) text = text.replace(new RegExp(`\\b${escapeRe(word)}\\b`, 'g'), said);
  return text
    .replace(/\bp(\d+)\b/g, (_, d) => `p ${numberWords(Number(d))}`)
    .replace(/\b\d+\b/g, (d) => numberWords(Number(d)))
    .replace(/\s+[—–·→]\s+/g, ', ')
    .replace(/\s+/g, ' ').trim();
}

/** The notes as written, for captions: [draft] marks dropped, white space collapsed. */
export const writtenText = (notes) => (Array.isArray(notes) ? notes : [notes ?? '']).join(' ').replace(/\[draft\]\s*/g, '').replace(/\s+/g, ' ').trim();

/** Sentences as a voice script splits them: after . ? or ! and a space. */
export const sentences = (text) => String(text ?? '').trim().split(/(?<=[.?!])\s+/).filter(Boolean);

/**
 * Subtitles by sentence. Each step: `start` (s, in the whole video), `lead` (s of silence before its clip),
 * `written` and `spoken` text, and its `clip` ({ duration, sentences: each sentence's start in the clip }).
 * A caption shows the text as written when it splits into as many sentences as the clip has; else as spoken.
 */
export function captionCues(steps) {
  const cues = [];
  for (const step of steps) {
    const clip = step.clip;
    if (!clip?.sentences?.length) continue;
    const written = sentences(step.written), said = sentences(step.spoken);
    const text = written.length === clip.sentences.length ? written : said;
    const t0 = step.start + (step.lead ?? 0);
    text.slice(0, clip.sentences.length).forEach((t, j) => {
      const start = t0 + clip.sentences[j], end = t0 + (clip.sentences[j + 1] ?? clip.duration);
      if (end > start) cues.push({ start, end, text: t });
    });
  }
  return cues;
}

const pad = (n, w = 2) => String(n).padStart(w, '0');
/** 3661.5 → "01:01:01,500" (SRT) or "01:01:01.500" (WebVTT). */
export function stamp(seconds, sep = ',') {
  const ms = Math.round(seconds * 1000);
  return `${pad(Math.floor(ms / 3600000))}:${pad(Math.floor(ms / 60000) % 60)}:${pad(Math.floor(ms / 1000) % 60)}${sep}${pad(ms % 1000, 3)}`;
}

/** Cues as an .srt file. */
export const toSrt = (cues) => cues.map((q, i) => `${i + 1}\n${stamp(q.start)} --> ${stamp(q.end)}\n${q.text}\n`).join('\n');

/** Cues as a WebVTT file. */
export const toVtt = (cues) => `WEBVTT\n\n${cues.map((q) => `${stamp(q.start, '.')} --> ${stamp(q.end, '.')}\n${q.text}\n`).join('\n')}`;

/** 95 → "1:35"; 3725 → "1:02:05" — a chapter's time, as YouTube reads it. */
export function clock(seconds) {
  const t = Math.floor(seconds), h = Math.floor(t / 3600), m = Math.floor(t / 60) % 60, s = t % 60;
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/**
 * YouTube chapters from marks ({ at: seconds, title }), in time order: the text to paste into a
 * description, and what breaks YouTube's rules (the first at 0:00, at least three, each 10 s or more) —
 * `length` (the video's) lets the last one be checked too.
 */
export function chapterList(marks, { length } = {}) {
  const list = [...marks].sort((a, b) => a.at - b.at);
  const problems = [];
  if (!list.length || list[0].at > 0) problems.push('the first chapter must start at 0:00');
  if (list.length < 3) problems.push('YouTube shows chapters only when there are at least three');
  list.forEach((m, i) => {
    const end = list[i + 1]?.at ?? length;
    if (end !== undefined && end - m.at < 10) problems.push(`"${m.title}" is shorter than 10 s`);
  });
  return { text: list.map((m) => `${clock(m.at)} ${m.title}`).join('\n'), problems };
}
