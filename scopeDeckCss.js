// Scope a Claude Design deck's CSS so its :root vars + html/body rules only apply inside the
// slide surfaces (.deck-scope), never globally — so the host page keeps its own theme. The deck
// is themed via .deck-scope token overrides (see the consumer's globals.css light override).
export function scopeDeckCss(css) {
  return css
    .replace(/:root/g, '.deck-scope')
    .replace(/html\s*,\s*body/g, '.deck-scope');
}
