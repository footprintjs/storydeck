/**
 * storydeck · tour — a deck or a figure that shows its point by itself while nobody is using it (tour.js).
 */

/** A stop as written: a click as the deck counts them (3), a figure's own name ('lid'), either with a hold ('9:6s'), or an object. */
export type TourStopSpec = number | string | { readonly to: number | string; readonly hold?: number | string; readonly say?: string };

/** A time: ms (1400), or text — '1400', '1400ms', '1.4s' — up to ten minutes. */
export type TourTime = number | string;

export interface TourOptions {
  /** The stops, in order: '3 4 5 9:6s' (as data-tour has them) or a list. */
  readonly stops: string | readonly TourStopSpec[];
  /** How long a stop without its own hold is held. Default 3000. */
  readonly hold?: TourTime;
  /** How long nobody must have touched it before it tours. Default 1400 (data-tour-idle). */
  readonly idleMs?: TourTime;
  /** How long after the last touch it picks up again. Default 3600 (data-tour-resume). */
  readonly resumeMs?: TourTime;
  /** Round again after the last stop (the default), or stop there. */
  readonly loop?: boolean;
  /**
   * The function a person's click calls, for a figure: it gets each stop's `to` as written. Left out, the stage is a
   * deck and a stop is a click as it counts them: `to` 3 is `stage.goTo(2)`.
   */
  readonly go?: (to: number | string) => void;
}

/** One stop of a plan: where it goes, how long it is held (ms), and what it shows, when that was said. */
export interface TourStop { readonly to: number | string; readonly hold: number; readonly say?: string }

/** A tour's plan — plain data a person or an LLM can read, and a deck's notes can say (tourText). */
export interface TourPlan { readonly stops: readonly TourStop[]; readonly idleMs: number; readonly resumeMs: number; readonly loop: boolean }

/**
 * A running tour. `state`, also on the stage as data-tour-state: 'waiting' (for idleMs), 'touring', 'paused'
 * (someone is using it), 'hidden' (out of sight, or the page hidden), 'still' (reduced motion: no tour), 'done' (a
 * tour that does not loop, past its last stop) or 'off' (stopped).
 */
export interface Tour {
  readonly plan: TourPlan;
  readonly state: 'waiting' | 'touring' | 'paused' | 'hidden' | 'still' | 'done' | 'off';
  /** Lets go of everything: timers, listeners, the observer, and data-tour-state. */
  stop(): void;
}

/**
 * Tours a deck (an element with goTo(index), as <deck-stage> has; one not yet defined is driven once it is) or, given
 * `go`, a figure. Left alone for idleMs it goes to each stop as a person would and holds it; a hover (held while the
 * pointer is over it), focus, key or press — or a move it did not make — pauses it, and it picks up resumeMs after the
 * last, at the next stop (a deck left on one of its stops goes on from that one). It waits while out of sight
 * (IntersectionObserver, the newest entry) or while the page is hidden, yields to listen mode, and under reduced motion
 * does not tour. Refuses, naming the fix, what it cannot read.
 */
export function idleTour(stage: Element, options: TourOptions): Tour;
/** Every element carrying data-tour (data-tour-hold, data-tour-idle, data-tour-resume) tours: inline `(${idleTour})()` once in a built page. */
export function idleTour(): Tour[];
/** null: the plan only, nothing runs (as tourPlan). */
export function idleTour(stage: null, options: TourOptions): { readonly plan: TourPlan; readonly state: 'off'; stop(): void };
/** A tour's plan, read and checked as idleTour reads it, with no page. A plan reads as itself. */
export function tourPlan(options: TourOptions | TourPlan): TourPlan;
/** A tour in one line, for the deck's notes: "Left alone for 1.4 s, it tours itself: slide 3 for 3 s, then …". */
export function tourText(options: TourOptions | TourPlan): string;
