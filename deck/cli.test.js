// @vitest-environment node
import {afterEach, describe, it, expect} from 'vitest';
import {existsSync, readFileSync, writeFileSync} from 'node:fs';
import {PassThrough} from 'node:stream';
import path from 'node:path';
import {runCli, parseArgs, USAGE} from './cli.js';
import {STARTER} from './init.js';
import {tempDeck, tempDir, cleanDecks, sink} from './test/helpers.js';

afterEach(cleanDecks);

/** Run a command: {code, out, err}. */
async function run(argv, extra = {}) {
  const stdout = sink(), stderr = sink();
  const code = await runCli(argv, {stdout, stderr, ...extra});
  return {code, out: stdout.text(), err: stderr.text()};
}

describe('parseArgs', () => {
  it('reads the command, the deck folder and the flags', () => {
    expect(parseArgs(['review', 'talk', '--click', '3', '--all'])).toEqual({command: 'review', dir: 'talk', given: true, flags: {click: '3', all: true}});
    expect(parseArgs(['build', '--out=site/x.html'])).toEqual({command: 'build', dir: '.', given: false, flags: {out: 'site/x.html'}});
    expect(parseArgs(['check', '-h']).flags.help).toBe(true);
  });

  it('refuses an unknown flag, a missing value and two folders', () => {
    expect(() => parseArgs(['build', '--outt', 'x'])).toThrow(/unknown flag --outt \(the flags are --out <value>/);
    expect(() => parseArgs(['review', '--click'])).toThrow(/--click needs a value/);
    expect(() => parseArgs(['review', '--click', '--all'])).toThrow(/--click needs a value/);
    expect(() => parseArgs(['build', 'a', 'b'])).toThrow(/one deck folder at a time/);
  });
});

describe('runCli', () => {
  it('init makes a starter deck, and refuses a folder that holds files', async () => {
    const dir = path.join(tempDir(), 'talk');
    const r = await run(['init', dir]);
    expect(r).toMatchObject({code: 0, err: ''});
    expect(r.out).toContain(`✓ a starter deck in ${dir} (8 files)`);
    expect(existsSync(path.join(dir, 'deck.json'))).toBe(true);
    expect(await run(['init', dir])).toMatchObject({code: 1, err: expect.stringMatching(/already holds files/)});
    expect(await run(['init'])).toMatchObject({code: 1, err: expect.stringMatching(/name the new deck's folder/)});
  });

  it('build, outline and review read the deck folder and say what they did', async () => {
    const dir = tempDeck();
    const built = await run(['build', dir]);
    expect(built.code).toBe(0);
    expect(built.out).toMatch(/^✓ .*index\.html · 6 clicks · \d+ KB · \d+ ms\n$/);
    const out = path.join(tempDir(), 'x.html');
    expect((await run(['build', dir, '--out', out])).code).toBe(0);
    expect(readFileSync(out, 'utf8')).toMatch(/^<!doctype html>/);
    const outline = await run(['outline', dir]);
    expect(outline.out.split('\n')[0]).toBe('A request, end to end · 6 clicks');
    expect((await run(['review', dir, '--click', '3'])).out).toContain('click 3 of 6 · "1 · The route · 2"');
    expect((await run(['review', dir, '--click', 'Summary'])).out).toContain('(plain slide)');
    expect((await run(['review', dir, '--all'])).out.match(/^click \d+ of 6/gm)).toHaveLength(6);
    expect(await run(['review', dir])).toMatchObject({code: 1, err: expect.stringMatching(/name a click: --click <1–6 or a label>/)});
  });

  it('check reports problems, failing on an error — and on a warning with --strict', async () => {
    expect(await run(['check', tempDeck()])).toMatchObject({code: 0, out: 'no problems\n'});
    const warned = tempDeck({...STARTER, 'deck.json': '{"title":"T","checks":{"maxWords":2}}'});
    const w = await run(['check', warned]);
    expect(w.code).toBe(0);
    expect(w.out).toContain('· words:');
    expect((await run(['check', warned, '--strict'])).code).toBe(1);
    const broken = tempDeck({...STARTER, 'deck.json': '{"title":"T","oops":1}'});
    expect(await run(['check', broken])).toMatchObject({code: 1, out: expect.stringMatching(/^error deck · compile: deck.json has "oops"/)});
  });

  it('check --layout says how to get the browser when it is not installed, and runs the other checks', async () => {
    const r = await run(['check', tempDeck(), '--layout']);
    expect(r.code).toBe(0);
    expect(r.out).toContain('no problems\nlayout not checked: it needs Playwright — npm i -D playwright-core');
  });

  it('a build that cannot be made stops with the reason', async () => {
    const dir = tempDeck({...STARTER, 'map.html': '<p>no pieces</p>'});
    expect(await run(['build', dir])).toMatchObject({code: 1, err: 'map "map" has no pieces — a piece is an element with data-k="name" and an inline left/top (width/height)\n'});
  });

  it('dev serves until stopped', async () => {
    let server;
    const stdout = sink(), stderr = sink();
    const done = runCli(['dev', tempDeck(), '--port', '0'], {stdout, stderr, onStart: (s) => { server = s; }});
    await new Promise((r) => { const t = setInterval(() => { if (server) { clearInterval(t); r(); } }, 10); });
    expect(stdout.text()).toMatch(/storydeck dev · http:\/\/127\.0\.0\.1:\d+\/ {2}\(Ctrl-C stops\)/);
    expect(stdout.text()).toMatch(/built 6 clicks in \d+ ms/);
    await server.stop();
    expect(await done).toBe(0);
    expect(await run(['dev', tempDeck(), '--port', 'abc'])).toMatchObject({code: 1, err: expect.stringMatching(/--port is a port number/)});
  });

  it('mcp answers on the streams it is given until they close', async () => {
    const input = new PassThrough(), stdout = sink();
    const done = runCli(['mcp', tempDeck()], {stdout, stderr: sink(), stdin: input});
    input.end(`${JSON.stringify({jsonrpc: '2.0', id: 1, method: 'tools/call', params: {name: 'outline'}})}\n`);
    expect(await done).toBe(0);
    expect(JSON.parse(stdout.text()).result.content[0].text).toContain('6 clicks');
  });

  it('prints its usage and version, and refuses an unknown command', async () => {
    expect(await run([])).toMatchObject({code: 1, out: `${USAGE}\n`});
    expect(await run(['help'])).toMatchObject({code: 0, out: `${USAGE}\n`});
    expect(await run(['build', '--help'])).toMatchObject({code: 0});
    expect((await run(['--version'])).out).toMatch(/^\d+\.\d+\.\d+\n$/);
    expect((await run(['build', '--version'])).out).toMatch(/^\d+\.\d+\.\d+\n$/);
    expect(await run(['explode'])).toMatchObject({code: 1, err: expect.stringMatching(/^unknown command "explode"/)});
    expect(await run(['build', '--nope'])).toMatchObject({code: 1, err: expect.stringMatching(/unknown flag --nope/)});
  });

  it('writes nothing outside the deck when its out file is a link', async () => {
    const dir = tempDeck();
    const victim = path.join(tempDir(), 'victim');
    writeFileSync(victim, 'keep');
    const {symlinkSync} = await import('node:fs');
    symlinkSync(victim, path.join(dir, 'index.html'));
    expect((await run(['build', dir])).code).toBe(1);
    expect(readFileSync(victim, 'utf8')).toBe('keep');
  });
});
