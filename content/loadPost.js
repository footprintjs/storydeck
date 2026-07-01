import { renderMarkdown, splitBodyByMarkers } from './markdown';

// Assemble a normalized Post from the authoring inputs:
//   meta        — post.json minus `sections` (slug, title, description, date, author, tags)
//   sections    — post.json `sections`: [{ key, label, heading, slides: [deckLabel, …] }]
//   bodyMd      — one Markdown file, sections split by <!--section:key--> markers
//   deckSlides  — [{ label, html }] from the imported deck (deck-data.json)
//
// Read view = the curated `sections` (each figure = the LAST of its `slides`; prose from Markdown).
// Watch view = `deckSteps` (every deck slide in order — includes bookends like Title/Close that the
// article may omit). This is the "JSON structure + Markdown prose" model.
export function assemblePost({ meta, sections, bodyMd, deckSlides }) {
  const byLabel = new Map(deckSlides.map((s) => [s.label, s.html]));
  const bodies = splitBodyByMarkers(bodyMd || '');

  const builtSections = sections.map((s) => {
    const steps = (s.slides || []).map((label) => byLabel.get(label)).filter(Boolean);
    return {
      key: s.key,
      label: s.label || s.key,
      heading: s.heading || s.label || s.key,
      steps,
      body: bodies[s.key] ? renderMarkdown(bodies[s.key]) : '',
    };
  });

  return {
    ...meta,
    sections: builtSections,
    deckSteps: deckSlides.map((s) => s.html), // full deck, in order, for Watch
  };
}
