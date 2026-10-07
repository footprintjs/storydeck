/**
 * storydeck · focus — what a click is about, and what happens to everything else on the slide.
 * See focus.js (the strategies); writing a plan into slide HTML is focusHtml.d.ts.
 */

/** A box on the map, in px. A piece with no size has w = h = 0. */
export interface FocusBox { readonly x: number; readonly y: number; readonly w: number; readonly h: number }

/** A named thing on a slide: its names (a click refers to any of them) and its box, when it has a place. */
export interface FocusPiece {
  readonly keys: readonly string[];
  readonly box: FocusBox | null;
  /** Names of its twin: while a twin is lit, this piece steps aside (a dashed wire under a solid one). */
  readonly twin?: readonly string[];
}

/** A focus as written on a click: a strategy name ('left'), several ('left blur'), or {strategy, …options}. */
export type FocusSpec = string | { readonly strategy: string; readonly [option: string]: unknown } | readonly (string | { readonly strategy: string; readonly [option: string]: unknown })[];

/** One click. */
export interface FocusClick {
  /** Names brought in (they stay). '*' is every piece. */
  readonly in?: readonly string[];
  /** Names taken away. */
  readonly out?: readonly string[];
  /** Names this click is about (lit). Without it, everything shown is lit. What comes in is lit too, unless `quiet`. */
  readonly on?: readonly string[] | null;
  /** Names that get the ring. */
  readonly hot?: readonly string[];
  readonly quiet?: boolean;
  /** How the click shows its subject and its context. Default: the context greyed in place. */
  readonly focus?: FocusSpec;
  /** Options every strategy of the click gets (e.g. from data-focus-* attributes). */
  readonly options?: Readonly<Record<string, unknown>>;
  /** The map arrives on this click: what is already there fades in instead of carrying over. */
  readonly fresh?: boolean;
}

/** A group move: a point p goes to o + s·(p − o) + t (map px). */
export interface FocusGroup { readonly o: readonly [number, number]; readonly s: number; readonly t: readonly [number, number] }

export interface FocusContext {
  /** The lit pieces' box, and the greyed pieces' box (map px); null when there are none. */
  readonly subject: FocusBox | null;
  readonly context: FocusBox | null;
  /** The area moved things may use, in map px. */
  readonly area: FocusBox;
  /** How the map sits on the slide (slide px = s · map px + [x, y]). */
  readonly view: { readonly s: number; readonly x: number; readonly y: number };
  readonly canvas: { readonly w: number; readonly h: number };
  readonly options: Readonly<Record<string, unknown>>;
}

/** A focus strategy: a look (how the context looks), a mover (where things go) or an overlay (what lies over the slide). */
export type FocusStrategy =
  | { readonly name?: string; readonly kind: 'look'; readonly look: 'grey' | 'hide' | 'keep' }
  | { readonly name?: string; readonly kind: 'mover'; place(ctx: FocusContext): { stage?: FocusGroup; subject?: FocusGroup; context?: FocusGroup } }
  | { readonly name?: string; readonly kind: 'overlay'; cover(ctx: { subjectOnSlide: FocusBox | null; canvas: { w: number; h: number }; options: Readonly<Record<string, unknown>> }): { rects: number[][]; label?: string; out?: number[][] } | null };

export interface FocusDeck {
  readonly pieces: readonly FocusPiece[];
  /** Your own strategies, by name, beside the built-in ones. */
  readonly strategies?: Readonly<Record<string, FocusStrategy>>;
  /** Where moved things may go, on the slide: [x0, y0, x1, y1] px. Default: the whole canvas. */
  readonly area?: readonly [number, number, number, number];
  /** How the map sits on the slide: p' = s·p + [x, y]. Default: as it is. */
  readonly view?: { readonly s: number; readonly x: number; readonly y: number };
  readonly canvas?: { readonly w: number; readonly h: number };
}

/** Where a piece is moved: its reference point (centre, or top-left when it has no size) by [dx, dy], scaled by s around it. */
export interface FocusMove { readonly dx: number; readonly dy: number; readonly s: number; readonly origin?: 'center' | 'top-left' }

export interface FocusPieceLook {
  readonly state: 'on' | 'dim' | 'gone';
  readonly was: 'on' | 'dim' | 'gone';
  /** What changed since the last click (only that animates). */
  readonly change: 'enter' | 'arrive' | 'light' | 'fade' | 'leave' | 'relook' | null;
  /** How a greyed piece looks (a leaving one: how it looked); null when it is not greyed. */
  readonly look: 'grey' | 'hide' | 'keep' | null;
  /** A greyed piece whose look changed: the look it had. */
  readonly fromLook: 'grey' | 'hide' | 'keep' | null;
  readonly hot: boolean;
  readonly hotIn: boolean;
  readonly move: FocusMove | null;
  /** Where it moved from, when it moved since the last click. (A leaving piece's `move` is where it stood.) */
  readonly from: FocusMove | null;
  /** It stepped aside for its lit twin. */
  readonly twinOff: boolean;
}

export interface FocusLook {
  readonly pieces: readonly FocusPieceLook[];
  /** The view's move (a zoom), and where it came from. */
  readonly stage: { readonly move: { s: number; x: number; y: number } | null; readonly from: { s: number; x: number; y: number } | null } | null;
  /** The blur: 'in-new' when the last click had none, 'in' while it stays, 'out' as it melts away; frameNew when its frame moved or appeared. */
  readonly overlay: { readonly rects: readonly (readonly number[])[]; readonly label: string; readonly phase: 'in-new' | 'in' | 'out'; readonly frameNew: boolean } | null;
  readonly strategies: readonly string[];
  /** The subject where it ends up, on the slide. */
  readonly subject: FocusBox | null;
}

/** The state a click leaves, to start the next from. Opaque. */
export type FocusState = { readonly __focusState: true } & Record<string, unknown>;

export const FOCUS: Readonly<Record<'grey' | 'hide' | 'keep' | 'zoom' | 'left' | 'right' | 'up' | 'down' | 'blur', FocusStrategy>>;
export function readFocus(spec: FocusSpec | undefined | null, shared?: Readonly<Record<string, unknown>>): { strategy: string; options: Record<string, unknown> }[];
export function focusStep(prev: FocusState | null, click: FocusClick, deck: FocusDeck): { state: FocusState; look: FocusLook };
/** `end` is null only when there are no clicks and no `start`. */
export function planFocus(clicks: readonly FocusClick[], deck: FocusDeck, start?: FocusState | null): { looks: FocusLook[]; end: FocusState | null };
