// Stable, readable anchor id from a heading/label (e.g. "The Whiteboard" -> "the-whiteboard").
export function slugify(s) {
  return String(s)
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}
