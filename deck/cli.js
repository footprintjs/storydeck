// cli — `storydeck <command> [deck folder] [--flags]` (bin.js runs it). One process per command; `dev` and `mcp`
// keep running until stopped.
import {spawn} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {initDeck} from './init.js';
import {serveDeck} from './dev.js';
import {serveMcp} from './mcp.js';
import {outlineTool, reviewTool, checkTool, buildTool} from './tools.js';
import {packageRoot} from './assets.js';

export const USAGE = `storydeck — make a deck: one picture, built click by click

  storydeck init <folder>              a starter deck to edit (refuses a folder that holds files)
  storydeck dev [folder] [--port 4321] [--open]
                                       live preview: a save rebuilds, reloads on the same click and plays it again
  storydeck outline [folder]           the whole deck, one line per click
  storydeck review [folder] --click <n|label> | --all
                                       one click as text: what it says, lights, greys and moves
  storydeck check [folder] [--layout] [--strict]
                                       what to fix, each with its click (--layout: a browser finds text that spills;
                                       --strict: a warning fails too)
  storydeck build [folder] [--out <file>]
                                       one self-contained page (deck.json "out", index.html by default)
  storydeck mcp [folder]               the read-first tools for an AI assistant (MCP over stdio)

The folder defaults to the current one. In the page: ← → Space step · T light/dark · N notes · P presenter · L listen.`;

const BOOLEAN = new Set(['all', 'layout', 'strict', 'open', 'help', 'version']);
const VALUED = new Set(['out', 'port', 'click']);

/** argv → {command, dir, flags}; an unknown flag is refused, naming the ones the command takes. */
export function parseArgs(argv) {
  const [command, ...rest] = argv;
  const flags = {}, positional = [];
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a === '-h') { flags.help = true; continue; }
    if (!a.startsWith('--')) { positional.push(a); continue; }
    const [name, inline] = a.slice(2).split(/=(.*)/s);
    if (BOOLEAN.has(name)) { flags[name] = true; continue; }
    if (!VALUED.has(name)) throw new Error(`unknown flag --${name} (the flags are ${[...VALUED].map((f) => `--${f} <value>`).concat([...BOOLEAN].map((f) => `--${f}`)).join(', ')})`);
    const value = inline ?? rest[++i];
    if (value === undefined || (inline === undefined && value.startsWith('--'))) throw new Error(`--${name} needs a value`);
    flags[name] = value;
  }
  if (positional.length > 1) throw new Error(`one deck folder at a time (got ${positional.join(', ')})`);
  return {command, dir: positional[0] ?? '.', given: positional.length > 0, flags};
}

/** Open a URL in the default browser, quietly; a machine without one just keeps the printed link. */
function openBrowser(url) {
  const [cmd, args] = process.platform === 'darwin' ? ['open', [url]] : process.platform === 'win32' ? ['cmd', ['/c', 'start', '""', url]] : ['xdg-open', [url]];
  try { spawn(cmd, args, {stdio: 'ignore', detached: true}).on('error', () => {}).unref(); } catch { /* no opener: the link is printed */ }
}

/** Keep a long-running command alive until Ctrl-C (or `stop` from a test), then close it. */
function untilStopped(close, onStop) {
  return new Promise((resolve) => {
    const stop = async () => {
      process.off('SIGINT', stop);
      process.off('SIGTERM', stop);
      await close();
      resolve(0);
    };
    process.once('SIGINT', stop);
    process.once('SIGTERM', stop);
    onStop?.(stop);
  });
}

/**
 * Run one command. `io`: {stdout, stderr} (write(text)), `onStart(handle)` (dev: the server, with stop()) for tests.
 * Resolves to the exit code: 0 done, 1 refused or problems found.
 */
export async function runCli(argv, {stdout = process.stdout, stderr = process.stderr, stdin = process.stdin, onStart} = {}) {
  const out = (t) => stdout.write(`${t}\n`), err = (t) => stderr.write(`${t}\n`);
  let parsed;
  try {
    parsed = parseArgs(argv);
  } catch (e) {
    err(e.message);
    return 1;
  }
  const {command, dir, given, flags} = parsed;
  if (flags.version || command === '--version' || command === '-v') { out(JSON.parse(readFileSync(`${packageRoot()}/package.json`, 'utf8')).version); return 0; }
  if (!command || flags.help || command === 'help' || command === '--help') { out(USAGE); return command ? 0 : 1; }
  try {
    switch (command) {
      case 'init': {
        if (!given) { err('storydeck init <folder>: name the new deck\'s folder'); return 1; }
        const r = initDeck(dir);
        out(`✓ a starter deck in ${dir} (${r.files.length} files)\n  next: storydeck dev ${dir}`);
        return 0;
      }
      case 'build':
        out(buildTool(dir, {out: flags.out}));
        return 0;
      case 'outline':
        out(outlineTool(dir));
        return 0;
      case 'review':
        out(reviewTool(dir, {click: flags.click, all: flags.all}));
        return 0;
      case 'check': {
        const r = await checkTool(dir, {layout: flags.layout});
        out(r.text);
        return r.errors || (flags.strict && r.warnings) ? 1 : 0;
      }
      case 'dev': {
        const port = flags.port === undefined ? 4321 : Number(flags.port);
        if (!Number.isInteger(port) || port < 0 || port > 65535) { err(`--port is a port number, not ${flags.port}`); return 1; }
        const server = await serveDeck(dir, {port, log: (line) => out(`  ${line}`)});
        out(`storydeck dev · ${server.url}  (Ctrl-C stops)`);
        if (flags.open) openBrowser(server.url);
        return untilStopped(server.close, (stop) => onStart?.({...server, stop}));
      }
      case 'mcp':
        await serveMcp({dir, input: stdin, output: stdout});
        return 0;
      default:
        err(`unknown command "${command}"\n\n${USAGE}`);
        return 1;
    }
  } catch (e) {
    err(e.message);
    return 1;
  }
}
