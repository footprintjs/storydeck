// mcp — the deck's read-first tools as an MCP server over stdio, so an AI assistant (Claude Code, Claude Desktop,
// VS Code, Cursor …) reads a deck as text instead of looking at screenshots:
//
//   claude mcp add storydeck -- npx footprint-storydeck mcp path/to/deck
//
// Each call runs in this process and reads the deck folder again, so an edit between two calls is always seen. No
// deck code runs (a deck is files, not a program), and `build` writes only the deck's own page (deck.json "out").
// A call may name another deck (`dir`) only inside the folder the server was started with: what a deck's notes say
// reaches the model, so a planted instruction cannot send it to read or build anything else on the machine.
import {realpathSync} from 'node:fs';
import path from 'node:path';
import {createInterface} from 'node:readline';
import {outlineTool, reviewTool, checkTool, buildTool, feedbackTool} from './tools.js';
import {packageVersion} from './assets.js';
import {deckRoot, isInside} from './paths.js';

const DIR = {type: 'string', description: 'a deck folder inside the one the server was started with (default: that folder)'};

export const MCP_TOOLS = Object.freeze([
  {name: 'outline', description: 'The whole deck, one line per click: number, label, headline, what it lights, its focus strategies.',
    inputSchema: {type: 'object', properties: {dir: DIR}}},
  {name: 'review', description: 'One click as text: where it is, its headline (and word count), what it lights, greys, brings in, moves and says (notes). Give click (a number or a label), or all: true.',
    inputSchema: {type: 'object', properties: {dir: DIR, click: {type: 'string', description: 'a click number (1-based) or label'}, all: {type: 'boolean', description: 'every click'}}}},
  {name: 'feedback', description: 'The notes a person left on clicks in the dev page (feedback.md), the open ones: what to change, click by click. Tick a line (- [x]) in feedback.md when it is done.',
    inputSchema: {type: 'object', properties: {dir: DIR}}},
  {name: 'check', description: 'What to fix, worst first, each with its click and its fix (headline words, pieces lit by coming in, clicks that change nothing, pieces never shown, missing notes). layout: true also opens the page in a browser to find text that spills.',
    inputSchema: {type: 'object', properties: {dir: DIR, layout: {type: 'boolean', description: 'measure the built page in a browser (needs playwright-core)'}}}},
  {name: 'build', description: 'Write the deck\'s self-contained page (deck.json "out", index.html by default) and say what was written.',
    inputSchema: {type: 'object', properties: {dir: DIR}}},
]);

/** The deck a call names: the server's folder, or a folder inside it (by its real path); anything else is refused. */
function deckFor(args, dir) {
  const root = deckRoot(dir);
  if (typeof args.dir !== 'string' || !args.dir) return root;
  const asked = path.resolve(root, args.dir);
  let real;
  try { real = realpathSync(asked); } catch { throw new Error(`no folder ${args.dir} inside ${dir}`); }
  if (!isInside(root, real)) throw new Error(`${args.dir} is outside the folder this server was started with (${dir}) — start it with a folder that holds that deck`);
  return real;
}

/** One tool call: its text, or the reason it stopped, as MCP content. */
export async function callTool(name, args = {}, {dir = '.'} = {}) {
  try {
    const deck = deckFor(args ?? {}, dir);
    args ??= {};
    switch (name) {
      case 'outline': return {content: [{type: 'text', text: outlineTool(deck)}]};
      case 'feedback': return {content: [{type: 'text', text: feedbackTool(deck)}]};
      case 'review': return {content: [{type: 'text', text: reviewTool(deck, {click: args.click === undefined ? undefined : String(args.click), all: args.all === true})}]};
      case 'check': {
        const r = await checkTool(deck, {layout: args.layout === true});
        return {content: [{type: 'text', text: r.text}]};
      }
      case 'build': return {content: [{type: 'text', text: buildTool(deck)}]};
      default: return {isError: true, content: [{type: 'text', text: `no tool called "${name}" (the tools are ${MCP_TOOLS.map((t) => t.name).join(', ')})`}]};
    }
  } catch (e) {
    return {isError: true, content: [{type: 'text', text: e.message}]};
  }
}

/** Serve MCP over stdio: one JSON-RPC message per line in, one per line out. Resolves when the input closes. */
export function serveMcp({dir = '.', input = process.stdin, output = process.stdout} = {}) {
  const version = packageVersion();
  const send = (message) => output.write(`${JSON.stringify({jsonrpc: '2.0', ...message})}\n`);
  const lines = createInterface({input});
  const pending = new Set();
  const answer = async (line) => {
    if (!line.trim()) return undefined;
    let msg;
    try { msg = JSON.parse(line); } catch { return send({id: null, error: {code: -32700, message: 'Parse error'}}); }
    if (!msg || typeof msg !== 'object' || Array.isArray(msg)) return send({id: null, error: {code: -32600, message: 'Invalid Request'}});
    const {id, method} = msg;
    const params = msg.params && typeof msg.params === 'object' ? msg.params : {};
    if (id === undefined) return undefined;   // a notification (initialized, cancelled): nothing to answer
    if (method === 'initialize') {
      return send({id, result: {protocolVersion: params.protocolVersion ?? '2025-06-18', capabilities: {tools: {}}, serverInfo: {name: 'storydeck', version},
        instructions: 'Read first, look last: outline (the whole deck) → feedback (what the person asked for) → review a click (what it shows, as text) → edit the deck files → check (what to fix) → build. A person previews with `storydeck dev`, where they leave notes and move pieces.'}});
    }
    if (method === 'ping') return send({id, result: {}});
    if (method === 'tools/list') return send({id, result: {tools: MCP_TOOLS}});
    if (method === 'tools/call') return send({id, result: await callTool(params.name, params.arguments ?? {}, {dir})});
    return send({id, error: {code: -32601, message: `Method not found: ${method}`}});
  };
  // nothing a line sends may stop the server: an answer that fails is an error answer
  const safely = (line) => answer(line).catch(() => send({id: null, error: {code: -32603, message: 'Internal error'}}));
  lines.on('line', (line) => { const p = safely(line); pending.add(p); p.finally(() => pending.delete(p)); });
  // When the client closes the pipe, the calls still running are answered first.
  return new Promise((resolve) => lines.on('close', () => Promise.allSettled([...pending]).then(() => resolve())));
}
