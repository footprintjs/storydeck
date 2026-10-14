// The Scroll lens's framework-neutral seam: a figure it can mount, move and take down without knowing
// how that figure draws (index.d.ts · StoryFigure is the contract). A section's `figure` is either a
// React render function or one of these; this is the one check that tells them apart.
export function isStoryFigure(value) {
  return (
    value !== null &&
    (typeof value === 'object' || typeof value === 'function') &&
    typeof value.mount === 'function' &&
    typeof value.seek === 'function' &&
    typeof value.dispose === 'function'
  );
}
