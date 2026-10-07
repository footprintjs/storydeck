/**
 * storydeck's shape, written down.
 *
 * The library is plain JSX with no build step, so there is nothing to generate
 * these from — they are hand-kept, and they live HERE rather than in a
 * consumer's shim on purpose: a consumer that declares another package's shape
 * has written that package's contract in the wrong repository, where the next
 * change to the JSX cannot see it.
 *
 * They describe exactly what `index.js` exports and nothing more. A helper that
 * is not on the barrel (`compositeSlides`, `isAdditiveSlide`) is not here
 * either — the barrel is the surface.
 */
import type { ReactElement, ReactNode } from 'react';

/**
 * One beat of the scroll lens: a single step of a section, flattened into the
 * one sequence the reader scrolls through. It is what a live `figure` is handed
 * — `sectionKey` + `step` say which beat it is being asked to draw.
 */
export interface ScrollyBeat {
  /** Unique per beat (`<slugified section key>-<step index>`). */
  readonly key: string;
  /** Position in the flattened sequence, 0-based — the `data-beat` the flow marks each beat with. */
  readonly index: number;
  /** This step's slide HTML. */
  readonly html: string;
  /** The section's eyebrow. */
  readonly label: string;
  /** The section's heading. */
  readonly heading: string;
  /** The section's rendered prose (HTML), shown on its first beat only. */
  readonly body: string;
  /** The `key` of the section this beat belongs to. */
  readonly sectionKey: string;
  /** Which of that section's steps this is, 0-based. */
  readonly step: number;
  readonly firstOfSection: boolean;
  /** The section's live figure, or null when it carries none. */
  readonly figure: ((beat: ScrollyBeat) => ReactNode) | null;
}

/** One section: 1..N slide steps plus authored prose. The unit of the whole model. */
export interface Section {
  readonly key: string;
  /** The eyebrow above the heading. */
  readonly label: string;
  readonly heading: string;
  /** The slide HTML of each step, in order. */
  readonly steps: readonly string[];
  /** The section's prose, already rendered to HTML. */
  readonly body: string;
  /**
   * A LIVE figure for the Scroll lens: rendered in the pinned stage instead of
   * the slide canvas, and outside its transform (see `ScrollyView`'s header).
   * It cannot come from JSON, so `assemblePost` never sets it — the consumer
   * attaches it to the assembled sections. Read and Watch ignore it and go on
   * showing the slide HTML.
   */
  readonly figure?: (beat: ScrollyBeat) => ReactNode;
}

/** A normalized post: the author's metadata, the sections, and the full deck. */
export interface Post {
  readonly title: string;
  readonly description?: string;
  /** `YYYY-MM-DD` — `PostView` parses and prints it. */
  readonly date?: string;
  readonly author?: string;
  readonly slug?: string;
  readonly sections: readonly Section[];
  /** Every deck slide's HTML, in order — the Watch lens. */
  readonly deckSteps: readonly string[];
  readonly [meta: string]: unknown;
}

/** One deck slide as the authoring inputs carry it. */
export interface Slide {
  /** The join key between a section's `slides` list and the deck. */
  readonly label: string;
  readonly html: string;
  /** An explicit group, when the slide's own HTML does not carry `data-group`. */
  readonly group?: string;
}

/** The lens controller: the Read · Scroll · Watch toggle over one post. */
export function PostView(props: { post: Post }): ReactElement;
/** The Read lens: one figure (each section's final step) plus its prose. */
export function BlogView(props: { sections: readonly Section[] }): ReactElement;
/** The Scroll lens: a pinned stage that advances as the narrative scrolls. */
export function ScrollyView(props: { sections: readonly Section[] }): ReactElement;
/** The Watch lens: the deck slides mounted into the `<deck-stage>` runtime. */
export function SlideDeck(props: { steps: readonly string[] }): ReactElement;
/** One slide as a static figure: a fixed 1920×1080 canvas scaled to the column. */
export function SlideFigure(props: { html: string }): ReactElement;
/** The default light/dark control, built on {@link useTheme}. */
export function ThemeToggle(): ReactElement;

/** Injects deploy config (the asset base path) for the lenses that need it. */
export function StoryDeckProvider(props: { basePath?: string; children?: ReactNode }): ReactElement;
export function useBasePath(): string;
export function useTheme(): { theme: 'light' | 'dark'; setTheme: (next: 'light' | 'dark') => void; toggle: () => void };

/**
 * Build a normalized {@link Post} from the authoring inputs (JSON structure +
 * Markdown prose + the deck). The metadata is spread onto the post as-is, so
 * the answer carries the caller's own meta type beside the post's own fields.
 */
export function assemblePost<M extends object>(input: {
  meta: M;
  sections: readonly { key: string; label?: string; heading?: string; slides?: readonly string[] }[];
  bodyMd: string;
  deckSlides: readonly Slide[];
}): Post & M;

export function renderMarkdown(src: string): string;
/** Split one body.md into `{ [sectionKey]: markdown }` on its `<!--section:key-->` markers. */
export function splitBodyByMarkers(bodyMd: string): Record<string, string>;

/** Fold consecutive slides sharing a `data-group` into one section with N steps. */
export function buildSections(
  slides: readonly Slide[],
  options?: { headings?: Record<string, string>; bodies?: Record<string, string> },
): Section[];
/** A slide's `data-group`, or null. */
export function parseGroup(html: string): string | null;
/** The one figure the Read lens shows for a section: its final built step. */
export function finalStep(section: Section): string;
/** Every step of every section, in order — the Watch deck. */
export function allSteps(sections: readonly Section[]): string[];

export function slugify(s: string): string;
/** Scope a deck's CSS to `.deck-scope` so its `:root`/`html,body` rules never reach the host page. */
export function scopeDeckCss(css: string): string;

// Focus — per click, what the click is about and what happens to the rest (focus.d.ts), written into slide HTML (focusHtml.d.ts).
export * from './focus';
export * from './focusHtml';
// Narration — what a deck says on each click (narration.d.ts), in the page: notes, presenter, listen mode (narrationHtml.d.ts).
// storydeck/voice and storydeck/video (Node-only) carry their own types.
export * from './narration';
export * from './narrationHtml';
