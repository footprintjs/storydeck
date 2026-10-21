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
export const DEFAULTS: Readonly<Record<string, unknown>>;
/** deck.json (text or parsed) with its defaults; throws, naming the fix, on an unknown key or a value it cannot use. */
export function readConfig(json: string | object): DeckConfig;

/** One click on a map, as written: its attributes (focus-html · readStep reads them), headline (HTML) and notes. */
export interface DeckStepSource { readonly attrs: string; readonly headline: string; readonly notes: readonly string[] }
/** A part of the deck: a plain slide (map null) or clicks told on a map. */
export type DeckPart =
  | { readonly label: string; readonly kicker: string; readonly map: null; readonly body: string; readonly notes: readonly string[] }
  | { readonly label: string; readonly kicker: string; readonly map: string; readonly steps: readonly DeckStepSource[] };
/** The clicks file read into parts; a step holds only its <h2> and notes (anything else is refused, naming where it goes). */
export function parseClicks(html: string): DeckPart[];
/** HTML as the words it shows. */
export function plainText(html: string): string;
/** The words a reader reads in some HTML. */
export function wordCount(html: string): number;

/** Every <i data-arrow="x1 y1 x2 y2 [bend]"></i> as an SVG wire (class "pkt": a packet the deck's CSS runs along it). */
export function wires(html: string): string;
export interface DeckIcon { readonly viewBox: string; readonly body: string }
/** An icon file (one <svg viewBox>…</svg>) read. */
export function readIcon(name: string, svg: string): DeckIcon;
/** Every <i data-icon="name"></i> as that icon's SVG. */
export function icons(html: string, set?: Readonly<Record<string, DeckIcon>>): string;
/** The built-in helpers: icons, then wires. */
export function applyTransforms(html: string, options?: { icons?: Readonly<Record<string, DeckIcon>> }): string;

/** A deck folder as plain data. */
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
export function compileDeck(source: Pick<DeckSource, 'config' | 'parts' | 'maps'> & Partial<DeckSource>): CompiledDeck;

/** What the library ships that a page carries: the <deck-stage> runtime, focus.css, narration.css, deck.css, the version. */
export interface PageAssets { readonly stageJs: string; readonly css: readonly string[]; readonly version: string }
export function pageAssets(): PageAssets;
/** The dev client (deck/devClient.js) and the build number it compares with. */
export interface DevPage { readonly client: () => void; readonly version: number }
/** One self-contained page: slides, notes, every stylesheet and runtime inlined; `dev` adds the dev client. */
export function deckPage(compiled: CompiledDeck, assets: PageAssets, options?: { dev?: DevPage | null }): string;
/** Runs in the page: the theme toggle (its button, or T); the choice is kept. */
export function themeRuntime(): void;
/** Runs in the page `storydeck dev` serves: reload on the same click, replay it, show why a build stopped. */
export function devClient(): void;

export function loadDeck(dir: string): { source: DeckSource; compiled: CompiledDeck };
export function deckHtml(dir: string, options?: { dev?: DevPage | null }): { compiled: CompiledDeck; html: string };
/** Write the page (deck.json "out", or `out`) and deck-data.json when deck.json names one. */
export function buildDeck(dir: string, options?: { out?: string }): { file: string; bytes: number; slides: number; clicks: number; data: string | null; ms: number };

/** The whole deck, one line per click. */
export function outline(compiled: CompiledDeck): string;
export function findClick(compiled: CompiledDeck, which: number | string): DeckClick;
/** One click as text: headline (and its words), focus, route, lit, greyed, what changes, motion, notes. */
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
export function formatProblems(problems: readonly DeckProblem[]): string;

/** The browser port the layout check drives (video's deckStageDriver, with measure). */
export interface LayoutDriver {
  open(url: string): Promise<void>;
  measure(n: number): Promise<readonly { kind: 'spills' | 'outside'; piece: string | null; text: string; dx: number; dy: number }[]>;
  close(): Promise<void> | void;
}
/** Text that spills and lit pieces off the slide, measured click by click in a browser. */
export function layoutCheck(url: string, options: { clicks: readonly DeckClick[]; driver?: LayoutDriver; chromium?: unknown }): Promise<DeckProblem[]>;
export function layoutProblems(found: readonly { n: number; kind: 'spills' | 'outside'; piece: string | null; text: string; dx: number; dy: number }[], clicks: readonly DeckClick[]): DeckProblem[];
/** Playwright's chromium from the deck folder (then here), or null when playwright-core is not installed. */
export function findChromium(fromDir?: string): Promise<unknown | null>;

export interface DeckServer {
  readonly url: string;
  readonly port: number;
  rebuild(): void;
  state(): { version: number; problem: string | null };
  close(): Promise<void>;
}
/** Serve a deck folder for editing on the loopback address: a save rebuilds, and the page reloads on the same click. */
export function serveDeck(dir: string, options?: { port?: number; host?: string; watch?: boolean; log?: (line: string) => void; tries?: number }): Promise<DeckServer>;

/** The starter deck's files, by path. */
export const STARTER: Readonly<Record<string, string>>;
/** Write the starter into a new or empty folder. */
export function initDeck(dir: string): { dir: string; files: string[] };

export function outlineTool(dir: string): string;
export function reviewTool(dir: string, options?: { click?: number | string; all?: boolean }): string;
export function checkTool(dir: string, options?: { layout?: boolean; chromium?: unknown }): Promise<{ text: string; errors: number; warnings: number }>;
export function buildTool(dir: string, options?: { out?: string }): string;

export const MCP_TOOLS: readonly { name: string; description: string; inputSchema: object }[];
export function callTool(name: string, args?: Record<string, unknown>, options?: { dir?: string }): Promise<{ content: { type: 'text'; text: string }[]; isError?: boolean }>;
/** The read-first tools over MCP (stdio, a JSON-RPC message per line); resolves when the input closes. */
export function serveMcp(options?: { dir?: string; input?: NodeJS.ReadableStream; output?: NodeJS.WritableStream }): Promise<void>;

export const USAGE: string;
export function parseArgs(argv: readonly string[]): { command: string | undefined; dir: string; given: boolean; flags: Record<string, string | true> };
/** One `storydeck` command; resolves to its exit code. */
export function runCli(argv: readonly string[], io?: { stdout?: { write(t: string): unknown }; stderr?: { write(t: string): unknown }; stdin?: NodeJS.ReadableStream; onStart?: (server: DeckServer & { stop(): Promise<void> }) => void }): Promise<number>;
