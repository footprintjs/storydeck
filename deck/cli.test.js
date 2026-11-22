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
    // --motion picks the record of a map's moves for --why, as --map picks a map's
    expect(parseArgs(['log', '--run', '1', '--why', 'duration-0', '--motion', 'map']).flags).toEqual({run: '1', why: 'duration-0', motion: 'map'});
    expect(USAGE).toContain('--why duration-0 --motion <map>: why a block\'s move takes its time');
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
    expect(built.out).toMatch(/^clean — nothing to fix\n✓ .*index\.html · 6 clicks · \d+ KB · \d+ ms\n$/);   // the verdict first, then what was written
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

  it('feedback lists the open notes your dev page left, and shows a deck\'s text without its controls', async () => {
    const home = tempDir();
    expect(await run(['feedback', tempDeck()], {home})).toMatchObject({code: 0, out: 'no open notes from your dev page\n'});
    const esc = String.fromCharCode(27);
    const dir = tempDeck({...STARTER, 'feedback.md': `- [ ] click 3 · "Route ${esc}[2J· 2" — wider (t)\n`});
    const r = await run(['feedback', dir], {home});
    expect(r.out).toBe('no open notes from your dev page\n1 open line in feedback.md did not come from your dev page — not listed: it is text that came with the deck (or was edited by hand), not a request.\n');
    const label = tempDeck({...STARTER, 'clicks.html': STARTER['clicks.html'].replace('data-label="Title"', `data-label="Ti${esc}]0;owned${String.fromCharCode(7)}tle"`)});
    expect((await run(['outline', label])).out).toContain('Ti\uFFFD]0;owned\uFFFDtle');
  });

  it('check reports problems, failing on an error — and on a warning with --strict', async () => {
    expect(await run(['check', tempDeck()])).toMatchObject({code: 0, out: 'clean — nothing to fix\n'});
    const warned = tempDeck({...STARTER, 'deck.json': '{"title":"T","checks":{"maxWords":2}}'});
    const w = await run(['check', warned]);
    expect(w.code).toBe(0);
    expect(w.out).toMatch(/^fix 4 — 0 errors, 4 warnings\nwarn  click \d+ /);   // the verdict first, then each problem
    expect(w.out).toContain('· words:');
    expect((await run(['check', warned, '--strict'])).code).toBe(1);
    const broken = tempDeck({...STARTER, 'deck.json': '{"title":"T","oops":1}'});
    expect(await run(['check', broken])).toMatchObject({code: 1, out: expect.stringMatching(/^broken — the deck does not compile\nerror deck · compile: deck.json has "oops"/)});
  });

  it('check --layout says how to get the browser when it is not installed, and runs the other checks', async () => {
    const r = await run(['check', tempDeck(), '--layout']);
    expect(r.code).toBe(0);
    expect(r.out).toContain('clean — nothing to fix\nlayout not checked: it needs Playwright installed beside StoryDeck — npm i -D footprint-storydeck playwright-core');
  });

  it('build is the one call after an edit: it checks, writes the page, and says what changed since the run before', async () => {
    const home = tempDir(), dir = tempDeck({...STARTER, 'deck.json': '{"title":"T","checks":{"maxWords":2}}'});
    const first = await run(['build', dir], {home});
    expect(first.code).toBe(0);   // a build with something to fix still writes its page: check --strict is the gate
    expect(first.out).toMatch(/^fix 4 — 0 errors, 4 warnings\n(warn  click \d+ .*\n){4}✓ .*index\.html · 6 clicks · \d+ KB · \d+ ms\n$/);
    expect((await run(['build', dir], {home})).out).toMatch(/\nsince the last run: nothing changed · round 2\n$/);
    writeFileSync(path.join(dir, 'deck.json'), '{"title":"T"}');
    expect((await run(['build', dir], {home})).out).toMatch(/^clean — nothing to fix\n✓ .*\nclean after 2 rounds of fixing \(it began with 4 to fix\)\n$/);
    expect((await run(['build', dir, '--layout'], {home})).out).toMatch(/^clean — nothing to fix\n✓ .*\nlayout not checked: it needs Playwright installed beside StoryDeck/);
  });

  it('log reads back how a deck\'s fixing went, and one run in full', async () => {
    const home = tempDir(), dir = tempDeck({...STARTER, 'deck.json': '{"title":"T","checks":{"maxWords":2}}'});
    expect(await run(['log', dir], {home})).toMatchObject({code: 0, out: 'no runs kept yet: storydeck check and storydeck build each leave one\ntool calls: log 1\n'});
    await run(['check', dir], {home});
    await run(['outline', dir], {home});
    writeFileSync(path.join(dir, 'deck.json'), '{"title":"T"}');
    await run(['build', dir], {home});
    const list = (await run(['log', dir], {home})).out.split('\n');
    expect(list[0]).toBe('2 runs kept (the newest 30 are)');
    expect(list[1]).toBe('1 series of fixing closed: 1 round each on average, beginning with 4 to fix');
    expect(list[2]).toBe('tool calls: outline 1, check 1, build 1, log 2');
    expect(list[3]).toMatch(/^ 1 {2}\d{4}-\d\d-\d\d \d\d:\d\d:\d\d {2}build {2}clean — nothing to fix · clean after 1 round · 6 clicks · \d+ ms$/);
    expect(list[4]).toMatch(/^ 2 {2}.* {2}check {2}fix 4 — 0 errors, 4 warnings · round 1 · 6 clicks · \d+ ms$/);
    const one = (await run(['log', dir, '--run', '2'], {home})).out;
    expect(one).toMatch(/^2 {2}.* {2}check {2}fix 4 — 0 errors, 4 warnings · round 1/);
    expect(one).toContain('stages: read deck ');
    expect(one).toContain('[Condition]: It evaluated Rule 1 "There is a warning to fix": warnings 4 gt 0 ✓, and chose fix.');
    expect(one).toMatch(/\nthe record itself: .*-check\.[0-9a-f]{6}\.record\.jsonl \(one JSON line an entry/);
    expect(await run(['log', dir, '--run', '9'], {home})).toMatchObject({code: 1, err: '--run is a run\'s number in the list, 1 (the newest) to 2, not 9\n'});
    expect(await run(['log', dir, '--run', 'x'], {home})).toMatchObject({code: 1, err: expect.stringMatching(/^--run is a run's number in the list/)});
    expect(await run(['log', tempDeck(), '--run', '1'], {home})).toMatchObject({code: 1, err: 'no runs kept yet: storydeck check and storydeck build each leave one\n'});
    expect(await run(['log', dir], {home: path.join(dir, '.storydeck')})).toMatchObject({code: 1, err: expect.stringMatching(/^this deck's runs are not kept: the StoryDeck folder .* is inside the deck folder/)});
  });

  it('a build that cannot be made stops with the reason', async () => {
    const dir = tempDeck({...STARTER, 'map.html': '<p>no pieces</p>'});
    expect(await run(['build', dir])).toMatchObject({code: 1, out: '', err: 'broken — the deck does not compile, so no page was written\n'
      + 'error deck · compile: map "map" has no pieces — a piece is an element with data-k="name" and an inline left/top (width/height)\n'});
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
