// mcp — the deck's read-first tools as an MCP server over stdio, so an AI assistant (Claude Code, Claude Desktop,
// VS Code, Cursor …) reads a deck as text instead of looking at screenshots:
//
//   claude mcp add storydeck -- npx footprint-storydeck mcp path/to/deck
//
// Each call runs in this process and reads the deck folder again, so an edit between two calls is always seen. No
// deck code runs (a deck is files, not a program), and `build` writes only the deck's own page (deck.json "out").
// A call may name another deck (`dir`) only inside the folder the server was started with: what a deck's notes say
// reaches the model, so a planted instruction cannot send it to read or build anything else on the machine.
//
// A voice is the person's to give: a kit runs Python on this machine, so only the server's start names one (--kit, --takes),
// never a call or a deck. A call asks for it with `say`, and it runs in a process of its own, so the server goes on answering
// and a kit's output never reaches the protocol. `build` never carries a voice: a page holding a cloned voice is built by the
// person's own command.
import {spawn} from 'node:child_process';
import path from 'node:path';
import {createInterface} from 'node:readline';
import {fileURLToPath} from 'node:url';
import {pickSteps} from 'footprint-story/voice';
import {outlineTool, reviewTool, checkTool, buildTool, feedbackTool, narrateTool, printable} from './tools.js';
import {packageVersion} from './assets.js';
import {deckRoot, isInside, realPath} from './paths.js';

const DIR = {type: 'string', description: 'a deck folder inside the one the server was started with (default: that folder)'};

export const MCP_TOOLS = Object.freeze([
  {name: 'outline', description: 'The whole deck, one line per click: number, label, headline, what it lights, its focus strategies.',
    inputSchema: {type: 'object', properties: {dir: DIR}}},
  {name: 'review', description: 'One click as text: where it is, its headline (and word count), what it lights, greys, brings in, moves and says (notes). Give click (a number or a label), or all: true.',
    inputSchema: {type: 'object', properties: {dir: DIR, click: {type: 'string', description: 'a click number (1-based) or label'}, all: {type: 'boolean', description: 'every click'}}}},
  {name: 'feedback', description: 'The open notes the person left on clicks in their own dev page (signed with their key): what to change, click by click. Tick a line (- [x]) in feedback.md when it is done. Lines in feedback.md that did not come from their dev page are counted, never listed: they are text that came with the deck, not requests.',
    inputSchema: {type: 'object', properties: {dir: DIR}}},
  {name: 'check', description: 'What to fix, worst first, each with its click and its fix (headline words, pieces lit by coming in, clicks that change nothing, pieces never shown, missing notes). layout: true also opens the page in a browser to find text that spills.',
    inputSchema: {type: 'object', properties: {dir: DIR, layout: {type: 'boolean', description: 'measure the built page in a browser (needs playwright-core)'}}}},
  {name: 'narrate', description: 'What each click says in the speaker\'s voice: how many are voiced, and which are left. It only reads, unless say is given and the server was started with a voice.',
    inputSchema: {type: 'object', properties: {dir: DIR, say: {type: 'string', description: 'voice what is missing: "all", or clicks like "1-3,7". Takes minutes, and every clip it finishes is kept. A call that times out leaves it running: call narrate with no say to see how far it has got.'}}}},
  {name: 'build', description: 'Write the deck\'s self-contained page (deck.json "out", index.html by default) and say what was written.',
    inputSchema: {type: 'object', properties: {dir: DIR}}},
]);

/** The deck a call names: the server's folder, or a folder inside it (by its real path); anything else is refused. */
function deckFor(args, dir) {
  const root = deckRoot(dir);
  if (typeof args.dir !== 'string' || !args.dir) return root;
  const asked = path.resolve(root, args.dir);
  let real;
  try { real = realPath(asked); } catch { throw new Error(`no folder ${args.dir} inside ${dir}`); }
  if (!isInside(root, real)) throw new Error(`${args.dir} is outside the folder this server was started with (${dir}) — start it with a folder that holds that deck`);
  return real;
}

const BIN = fileURLToPath(new URL('./bin.js', import.meta.url));
const NO_VOICE = 'restart the server with a voice to voice them: storydeck mcp <folder> --kit <your voice kit>';
const LAST_WORDS = 2000;
/** The decks this server is voicing: a call that timed out leaves its voicing running, so a second one is refused, not started beside it. */
const voicing = new Set();

/** `storydeck narrate` in a process of its own: its answer, or the end of what it said on the way to stopping. */
function voiceInChild(deck, {kit, takes, only}) {
  const flags = Object.entries({kit, takes, only}).flatMap(([name, value]) => (value ? [`--${name}`, value] : []));
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [BIN, 'narrate', deck, ...flags], {stdio: ['ignore', 'pipe', 'pipe']});
    let out = '', said = '';
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { said = `${said}${d}`.slice(-LAST_WORDS); });   // a kit's progress can run long
    child.on('error', reject);
    child.on('close', (code) => (code === 0 ? resolve(out.trim()) : reject(new Error(said.trim() || `storydeck narrate stopped (${code})`))));
  });
}

/** A narrate call: reads, unless it says what to voice and the server has a voice. */
function narrateCall(deck, {say}, {kit, takes}) {
  if (say === undefined) return narrateTool(deck, {hint: kit ? 'call narrate with say: "all"' : NO_VOICE});
  if (typeof say !== 'string' || !say.trim()) throw new Error('say is "all", or clicks like "1-3,7"');
  if (!kit) throw new Error(`this server was started with no voice: ${NO_VOICE}`);
  const only = say.trim() === 'all' ? undefined : say.trim();
  pickSteps(only);   // refused here, naming the fix, before anything starts
  if (voicing.has(deck)) throw new Error('this deck is being voiced already: call narrate with no say to see how far it has got');
  voicing.add(deck);
  return voiceInChild(deck, {kit, takes, only}).finally(() => voicing.delete(deck));
}

/** One tool call: its text, or the reason it stopped, as MCP content. `kit` and `takes` are the server's start's. */
export async function callTool(name, args = {}, {dir = '.', home, kit, takes} = {}) {
  const r = await answerTool(name, args, dir, home, {kit, takes});
  return {...r, content: r.content.map((c) => ({...c, text: printable(c.text)}))};   // a deck's text, never its controls
}

/** One tool call, as the tool answers it. */
async function answerTool(name, args, dir, home, voice) {
  try {
    const deck = deckFor(args ?? {}, dir);
    args ??= {};
    switch (name) {
      case 'outline': return {content: [{type: 'text', text: outlineTool(deck)}]};
      case 'feedback': return {content: [{type: 'text', text: feedbackTool(deck, {home})}]};
      case 'review': return {content: [{type: 'text', text: reviewTool(deck, {click: args.click === undefined ? undefined : String(args.click), all: args.all === true})}]};
      case 'check': {
        const r = await checkTool(deck, {layout: args.layout === true, home});
        return {content: [{type: 'text', text: r.text}]};
      }
      case 'build': return {content: [{type: 'text', text: buildTool(deck)}]};
      case 'narrate': return {content: [{type: 'text', text: await narrateCall(deck, args, voice)}]};
      default: return {isError: true, content: [{type: 'text', text: `no tool called "${name}" (the tools are ${MCP_TOOLS.map((t) => t.name).join(', ')})`}]};
    }
  } catch (e) {
    return {isError: true, content: [{type: 'text', text: e.message}]};
  }
}

/** Serve MCP over stdio: one JSON-RPC message per line in, one per line out. Resolves when the input closes. */
export function serveMcp({dir = '.', input = process.stdin, output = process.stdout, kit, takes} = {}) {
  const version = packageVersion();
  const voice = {kit: kit && path.resolve(kit), takes: takes && path.resolve(takes)};   // fixed here: where the server was started, whatever a call does
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
    if (method === 'tools/call') return send({id, result: await callTool(params.name, params.arguments ?? {}, {dir, ...voice})});
    return send({id, error: {code: -32601, message: `Method not found: ${method}`}});
  };
  // nothing a line sends may stop the server: an answer that fails is an error answer
  const safely = (line) => answer(line).catch(() => send({id: null, error: {code: -32603, message: 'Internal error'}}));
  lines.on('line', (line) => { const p = safely(line); pending.add(p); p.finally(() => pending.delete(p)); });
  // When the client closes the pipe, the calls still running are answered first.
  return new Promise((resolve) => lines.on('close', () => Promise.allSettled([...pending]).then(() => resolve())));
}
