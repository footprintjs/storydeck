import MarkdownIt from 'markdown-it';

// Prose renderer for section bodies. html:false = no raw HTML in Markdown → safe by construction
// (no script injection possible from the .md), so no separate sanitizer is needed for the current
// first-party posts. linkify + typographer give the Medium/Substack polish.
const md = new MarkdownIt({ html: false, linkify: true, typographer: true, breaks: false });

export function renderMarkdown(src) {
  return md.render(String(src || '').trim());
}

// A single body.md holds every section's prose, separated by `<!--section:key-->` markers.
// Returns { [key]: markdownForThatSection }.
export function splitBodyByMarkers(bodyMd) {
  const out = {};
  const re = /<!--\s*section:\s*([\w-]+)\s*-->/g;
  const parts = [];
  let m, last = null, lastIdx = 0;
  while ((m = re.exec(bodyMd)) !== null) {
    if (last !== null) parts.push([last, bodyMd.slice(lastIdx, m.index)]);
    last = m[1];
    lastIdx = re.lastIndex;
  }
  if (last !== null) parts.push([last, bodyMd.slice(lastIdx)]);
  for (const [key, text] of parts) out[key] = text.trim();
  return out;
}
