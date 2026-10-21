/**
 * storydeck · footprint-storydeck/deck (Node) — a deck folder made into one self-contained page, served for editing
 * with a reload on the same click, and read back as text for a reviewer (a person, or a model). The `storydeck`
 * command (bin) runs the same parts.
 *
 *   my-deck/deck.json · clicks.html · map.html · theme.css · icons/*.svg
 */
import type { FocusClick, FocusLook, FocusPiece } from './focus';

/** deck.json, read: every default filled in. */
export interface DeckConfig {
  readonly title: string;
  readonly description: string;
  readonly lang: string;
  /** The text in every slide's footer (default: the title). */
  readonly footer: string;
  /** The slide's design size, [width, height] (1920 × 1080). */
  readonly canvas: readonly [number, number];
  /** Where focus may move and blur, [x0, y0, x1, y1] in slide px (below the headline, above the footer). */
  readonly area: readonly [number, number, number, number];
  readonly clicks: string;
  readonly theme: string;
  readonly icons: string;
  /** A map's file, by name (default for a map not listed: <name>.html). */
  readonly maps: Readonly<Record<string, string>>;
  /** The built page, inside the deck folder (index.html). */
  readonly out: string;
  readonly post: string | null;
  readonly deckData: string | null;
  /** What `storydeck check` asks: words in a map click's headline (12), on a plain slide (40). */
  readonly checks: { readonly maxWords: number; readonly maxSlideWords: number };
  /** The keys deck.json wrote (a file it names must be there; a default may be absent). */
  readonly given: readonly string[];
}
/** deck.json (text or parsed) with its defaults; throws, naming the fix, on an unknown key or a value it cannot use. */
export function readConfig(json: string | object): DeckConfig;

/** One click on a map, as written: its attributes (focus-html · readStep reads them), headline (HTML) and notes. */
export interface DeckStepSource { readonly attrs: string; readonly headline: string; readonly notes: readonly string[] }
/** A part of the deck: a plain slide (map null) or clicks told on a map. */
export type DeckPart =
  | { readonly label: string; readonly kicker: string; readonly map: null; readonly body: string; readonly notes: readonly string[] }
  | { readonly label: string; readonly kicker: string; readonly map: string; readonly steps: readonly DeckStepSource[] };
/**
 * The clicks file read into parts, scanned once. A step holds only its <h2> and notes (anything else is refused, naming
 * where it goes); a <section> or <step> left open, or opened inside another, is refused.
 */
export function parseClicks(html: string): DeckPart[];

export interface DeckIcon { readonly viewBox: string; readonly body: string }
/**
 * The built-in drawing helpers, icons then wires: <i data-icon="name"></i> becomes that icon's SVG, and
 * <i data-arrow="x1 y1 x2 y2 [bend]"></i> an SVG wire (class "pkt": a packet that rides it on a path click).
 */
export function applyTransforms(html: string, options?: { icons?: Readonly<Record<string, DeckIcon>> }): string;

/** A deck folder as plain data. Every file is read by its real path, inside the folder, never a hidden one. */
export interface DeckSource {
  readonly dir: string;
  readonly config: DeckConfig;
  readonly clicksHtml: string;
  readonly parts: readonly DeckPart[];
  readonly maps: Readonly<Record<string, string>>;
  readonly themeCss: string;
  readonly icons: Readonly<Record<string, DeckIcon>>;
  readonly post: { sections?: readonly { key?: string; slides?: readonly string[] }[] } | null;
}
export function readDeck(dir: string): DeckSource;

/** A click of the compiled deck, as review and check read it. */
export type DeckClick = {
  readonly n: number;
  readonly label: string;
  readonly part: string;
  readonly kicker: string;
  /** The headline as plain text ('' on a plain slide). */
  readonly headline: string;
  readonly notes: readonly string[];
} & (
  | { readonly kind: 'plain'; readonly map: null; readonly text: string }
  | { readonly kind: 'map'; readonly map: string; readonly step: FocusClick; readonly look: FocusLook; readonly stepIndex: number; readonly steps: number }
);
export interface DeckSlide {
  readonly label: string;
  readonly html: string;
  /** What notesData carries for the slide. */
  readonly notes: { readonly slide: string; readonly step: number; readonly steps: number; readonly now: readonly string[]; readonly earlier: readonly string[] };
}
export interface CompiledDeck {
  readonly config: DeckConfig;
  readonly title: string;
  readonly themeCss: string;
  readonly slides: readonly DeckSlide[];
  readonly clicks: readonly DeckClick[];
  readonly maps: Readonly<Record<string, { readonly pieces: readonly FocusPiece[] }>>;
}
/** The deck's clicks planned (each map's state carried click to click) and drawn as <deck-stage> slides. */
export function compileDeck(source: Pick<DeckSource, 'config' | 'parts' | 'maps'> & Partial<DeckSource>, options?: { dev?: boolean }): CompiledDeck;

/** What the library ships that a page carries: the <deck-stage> runtime, focus.css, narration.css, deck.css, the version. */
export interface PageAssets { readonly stageJs: string; readonly css: readonly string[]; readonly version: string }
export function pageAssets(): PageAssets;
/** One self-contained page: slides, notes, every stylesheet and runtime inlined, the theme toggle. */
export function deckPage(compiled: CompiledDeck, assets: PageAssets): string;

export function loadDeck(dir: string, options?: { dev?: boolean }): { source: DeckSource; compiled: CompiledDeck };
/** The page of a deck folder, as a string (no file written). */
export function deckHtml(dir: string, options?: { dev?: unknown }): { source: DeckSource; compiled: CompiledDeck; html: string };
/**
 * Write the page (deck.json "out", or `out` — a path you choose, anywhere) and deck-data.json when deck.json names
 * one. A new file is renamed into place, never written through a link; a file deck.json names never lands outside
 * the deck folder.
 */
export function buildDeck(dir: string, options?: { out?: string }): { file: string; bytes: number; slides: number; clicks: number; data: string | null; ms: number };

/** The whole deck, one line per click. */
export function outline(compiled: CompiledDeck): string;
/** One click (a number from 1, or a label) as text: headline (and its words), focus, route, lit, greyed, what changes, motion, notes. */
export function reviewClick(compiled: CompiledDeck, which: number | string, options?: { maxWords?: number }): string;

export interface DeckProblem {
  readonly level: 'error' | 'warn' | 'info';
  /** words · lit-on-entry · no-change · never-shown · no-notes · compile · spills · outside */
  readonly rule: string;
  readonly click: number | null;
  readonly label: string | null;
  readonly message: string;
}
export function checkDeck(compiled: CompiledDeck): DeckProblem[];
/** Problems as text, one per line, worst first; 'no problems' when there are none. */
export function formatProblems(problems: readonly DeckProblem[]): string;

/** The browser port the layout check drives (the video's deckStageDriver, with measure). */
export interface LayoutDriver {
  open(url: string): Promise<void>;
  measure(n: number): Promise<readonly { kind: 'spills' | 'outside'; piece: string | null; text: string; dx: number; dy: number }[]>;
  close(): Promise<unknown> | unknown;
}
/** Text that spills out of its box and lit pieces off the slide, measured click by click in a browser. */
export function layoutCheck(url: string, options: { clicks: readonly DeckClick[]; driver?: LayoutDriver; chromium?: unknown }): Promise<DeckProblem[]>;

export interface DeckServer {
  readonly url: string;
  readonly port: number;
  rebuild(): void;
  state(): { version: number; problem: string | null };
  close(): Promise<void>;
}
/**
 * Serve a deck folder for editing: a save rebuilds, and the page reloads on the same click. Loopback only (host
 * 127.0.0.1, ::1 or localhost; anything else is refused), requests addressed to localhost only. It reads, and takes
 * two edits from its own page (its origin and its per-session token, JSON, at most 16 KB): a note on a click, appended
 * to feedback.md and signed with the person's note key (kept in `home`: STORYDECK_HOME or ~/.storydeck), and a piece
 * moved by Alt-drag, written into its map file. `poll` (ms, 0 for none) compares the folder's stamp so a save the
 * watcher missed still rebuilds.
 */
export function serveDeck(dir: string, options?: { port?: number; host?: '127.0.0.1' | '::1' | 'localhost'; watch?: boolean; poll?: number; log?: (line: string) => void; tries?: number; home?: string }): Promise<DeckServer>;

/** Write the starter deck into a new or empty folder. */
export function initDeck(dir: string): { dir: string; files: string[] };

/**
 * The read-first tools (outline, review, check, build) over MCP: stdio, one JSON-RPC message per line. A call may name
 * another deck only inside `dir`. Resolves when the input closes.
 */
export function serveMcp(options?: { dir?: string; input?: NodeJS.ReadableStream; output?: { write(text: string): unknown } }): Promise<void>;

/** One `storydeck` command (argv without node and the script); resolves to its exit code. */
export function runCli(argv: readonly string[], io?: {
  stdout?: { write(text: string): unknown };
  stderr?: { write(text: string): unknown };
  stdin?: NodeJS.ReadableStream;
  /** `dev`: the server once it listens, with stop(). */
  onStart?: (server: DeckServer & { stop(): Promise<number | void> }) => void;
}): Promise<number>;
