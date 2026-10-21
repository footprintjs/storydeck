// @vitest-environment node
import {afterEach, describe, it, expect} from 'vitest';
import {existsSync} from 'node:fs';
import {PassThrough} from 'node:stream';
import path from 'node:path';
import {serveMcp, callTool, MCP_TOOLS} from './mcp.js';
import {STARTER} from './init.js';
import {tempDeck, cleanDecks, sink} from './test/helpers.js';

afterEach(cleanDecks);

/** Send JSON-RPC lines to a server over streams; the answers, by id. */
async function session(dir, messages) {
  const input = new PassThrough(), output = sink();
  const done = serveMcp({dir, input, output});
  input.end(messages.map((m) => (typeof m === 'string' ? m : JSON.stringify({jsonrpc: '2.0', ...m}))).join('\n') + '\n');
  await done;
  return output.text().trim().split('\n').map((l) => JSON.parse(l));
}

describe('serveMcp', () => {
  it('introduces itself, lists its tools, and answers a call', async () => {
    const dir = tempDeck();
    const out = await session(dir, [
      {id: 1, method: 'initialize', params: {protocolVersion: '2025-03-26'}},
      {method: 'notifications/initialized'},
      {id: 2, method: 'tools/list'},
      {id: 3, method: 'tools/call', params: {name: 'review', arguments: {click: 2}}},
      {id: 4, method: 'ping'},
    ]);
    expect(out).toHaveLength(4);
    const byId = Object.fromEntries(out.map((m) => [m.id, m]));
    expect(byId[1].result).toMatchObject({protocolVersion: '2025-03-26', capabilities: {tools: {}}, serverInfo: {name: 'storydeck'}});
    expect(byId[1].result.instructions).toMatch(/^Read first, look last/);
    expect(byId[2].result.tools.map((t) => t.name)).toEqual(['outline', 'review', 'feedback', 'check', 'build']);
    expect(byId[3].result.content[0].text).toContain('click 2 of 6');
    expect(byId[4].result).toEqual({});
  });

  it('answers a broken line, an unknown method and an unknown tool with errors, and skips blank lines', async () => {
    const out = await session(tempDeck(), ['{not json', '', 'null', '[1]', {id: 8, method: 'tools/call', params: null}, {id: 5, method: 'resources/list'}, {id: 6, method: 'tools/call', params: {name: 'paint'}}, {id: 7, method: 'initialize'}]);
    expect(out[0]).toEqual({jsonrpc: '2.0', id: null, error: {code: -32700, message: 'Parse error'}});
    expect(out.filter((m) => m.error?.code === -32600)).toHaveLength(2);   // null and an array are not requests
    expect(out.find((m) => m.id === 8).result).toMatchObject({isError: true, content: [{text: expect.stringMatching(/^no tool called "undefined"/)}]});
    expect(out.find((m) => m.id === 5).error).toEqual({code: -32601, message: 'Method not found: resources/list'});
    expect(out.find((m) => m.id === 6).result).toMatchObject({isError: true, content: [{text: 'no tool called "paint" (the tools are outline, review, feedback, check, build)'}]});
    expect(out.find((m) => m.id === 7).result.protocolVersion).toBe('2025-06-18');
  });
});

describe('callTool', () => {
  it('runs each tool on the deck the server was started with, or one a call names inside it', async () => {
    const dir = tempDeck({...STARTER, ...Object.fromEntries(Object.entries(STARTER).map(([k, v]) => [`other/${k}`, k === 'deck.json' ? '{"title":"Other"}' : v]))});
    expect((await callTool('outline', {}, {dir})).content[0].text).toMatch(/^A request, end to end · 6 clicks/);
    expect((await callTool('outline', {dir: 'other'}, {dir})).content[0].text).toMatch(/^Other · 6 clicks/);
    expect((await callTool('outline', {dir: path.join(dir, 'other')}, {dir})).content[0].text).toMatch(/^Other · 6 clicks/);
    expect((await callTool('review', {all: true}, {dir})).content[0].text.match(/^click /gm)).toHaveLength(6);
    expect((await callTool('check', {}, {dir})).content[0].text).toBe('no problems');
    expect((await callTool('feedback', {}, {dir})).content[0].text).toBe('no open notes');
    expect((await callTool('check', {layout: true}, {dir})).content[0].text).toContain('layout not checked');
    expect((await callTool('build', {}, {dir})).content[0].text).toMatch(/^✓ .*index\.html · 6 clicks/);
    expect(existsSync(path.join(dir, 'index.html'))).toBe(true);
  });

  it('refuses a deck outside the folder it was started with — by path, by "..", or through a link', async () => {
    const dir = tempDeck(), elsewhere = tempDeck();
    const {symlinkSync} = await import('node:fs');
    symlinkSync(elsewhere, path.join(dir, 'door'));
    for (const asked of [elsewhere, '..', 'door', '../../']) {
      const r = await callTool('outline', {dir: asked}, {dir});
      expect(r.isError).toBe(true);
      expect(r.content[0].text).toMatch(/is outside the folder this server was started with/);
    }
    expect((await callTool('build', {dir: elsewhere}, {dir})).isError).toBe(true);
    expect(existsSync(path.join(elsewhere, 'index.html'))).toBe(false);
    expect((await callTool('outline', {dir: 'missing'}, {dir})).content[0].text).toMatch(/^no folder missing inside/);
  });

  it('turns a refusal into an error result with the reason', async () => {
    const r = await callTool('review', {click: 99}, {dir: tempDeck()});
    expect(r).toEqual({isError: true, content: [{type: 'text', text: 'no click "99" — the deck has clicks 1 to 6 (or name one by its label)'}]});
  });

  it('describes every tool with a schema an assistant can fill', () => {
    for (const t of MCP_TOOLS) {
      expect(t.description.length).toBeGreaterThan(40);
      expect(t.inputSchema.type).toBe('object');
      expect(t.inputSchema.properties.dir.type).toBe('string');
    }
  });
});
