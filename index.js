// storydeck — internal dual-view engine (one source → Read + Watch lenses).
// Kept as an internal folder for now; extract to its own package when it's matured.
// Consumers provide content (posts) + brand; storydeck renders both views.
export { default as PostView } from './PostView';
export { default as BlogView } from './BlogView';
export { default as ScrollyView } from './ScrollyView';
export { default as SlideDeck } from './SlideDeck';
export { default as SlideFigure } from './SlideFigure';
export { default as ThemeToggle } from './ThemeToggle';
export { scopeDeckCss } from './scopeDeckCss';
export { buildSections, parseGroup, finalStep, allSteps } from './sections';
export { slugify } from './slug';
export { StoryDeckProvider, useBasePath } from './context';
export { useTheme } from './useTheme';
export { assemblePost } from './content/loadPost';
export { renderMarkdown, splitBodyByMarkers } from './content/markdown';
