// @vitest-environment node
import {afterEach, describe, it, expect} from 'vitest';
import {existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, symlinkSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {runCli} from './cli.js';
import {callTool} from './mcp.js';
import {narrateTool} from './tools.js';
import {tempDeck, tempDir, cleanDecks, sink} from './test/helpers.js';
import {fakeKit} from './test/fakeKit.js';

afterEach(cleanDecks);

async function cli(...argv) {
  const stdout = sink(), stderr = sink();
  const code = await runCli(argv, {stdout, stderr});
  return {code, out: stdout.text(), err: stderr.text()};
}

const deckWithNotes = () => {
  const dir = tempDeck();
  writeFileSync(path.join(dir, 'clicks.html'), `<section data-label="One"><h1>One</h1><aside class="notes">The first thing to say.</aside></section>
<section data-label="Two"><h1>Two</h1></section>
<section data-label="Three"><h1>Three</h1><aside class="notes">The third thing to say.</aside></section>`);
  return dir;
};
const page = (dir) => readFileSync(path.join(dir, 'index.html'), 'utf8');
/** A page's copy of each clip, so a test of what the page carries needs no ffmpeg. */
const givePageCopies = (dir) => {
  const cache = path.join(dir, 'voice', 'cache');
  for (const f of readdirSync(cache)) if (f.endsWith('.wav')) writeFileSync(path.join(cache, f.replace('.wav', '.m4a')), 'the page copy');
};
const textOf = (r) => r.content[0].text;

describe('storydeck narrate', () => {
  it('with no voice only reads: what is left, and how to voice it', async () => {
    const dir = deckWithNotes(), r = await cli('narrate', dir);
    expect(r.code).toBe(0);
    expect(r.out).toContain('0 of 2 clicks voiced · 2 to voice · 1 silent');
    expect(r.out).toContain('1  One: The first thing to say.');
    expect(r.out).toContain('next: storydeck narrate --kit');
    expect(existsSync(path.join(dir, 'voice')), 'asking writes nothing').toBe(false);
  });

  it('a kit voices what is missing, once, and the answer stays the answer', async () => {
    const dir = deckWithNotes(), {kit, said} = fakeKit(tempDir());
    const first = await cli('narrate', dir, '--kit', kit, '--only', '1');
    expect(first.code).toBe(0);
    expect(said()).toEqual(['The first thing to say.']);
    expect(first.out).toContain('1 of 2 clicks voiced · 1 to voice · 1 silent');
    expect(first.out, 'a kit\'s own output is not the answer').not.toContain('a line a kit prints');
    const second = await cli('narrate', dir, '--kit', kit);
    expect(said()).toEqual(['The first thing to say.', 'The third thing to say.']);
    expect(second.out).toContain('2 of 2 clicks voiced · 0 to voice');
    expect(second.out).toContain('next: storydeck build --voice');
    await cli('narrate', dir, '--kit', kit);
    expect(said()).toHaveLength(2);
    expect((await cli('narrate', dir)).out, 'asked later with no voice named, the clips are found').toContain('2 of 2 clicks voiced');
  });

  it('refuses what it cannot do, naming the fix', async () => {
    const dir = deckWithNotes(), {kit, said} = fakeKit(tempDir());
    expect((await cli('narrate', dir, '--only', '1')).err).toContain('name the voice too');
    expect((await cli('narrate', dir, '--kit', kit, '--only', '')).err).toContain('--only is empty');
    expect((await cli('narrate', dir, '--takes', 'x')).err).toContain('recordings need the voice kit too');
    expect((await cli('narrate', dir, '--kit', kit, '--only', 'first')).err).toContain('is not a step');
    expect((await cli('narrate', dir, '--kit', tempDir())).err).toContain('no voice settings');
    expect(said()).toEqual([]);
  });
});

describe('storydeck build --voice', () => {
  it('carries the clips only when asked, and the plain page is the same byte for byte', async () => {
    const dir = deckWithNotes(), {kit} = fakeKit(tempDir());
    await cli('build', dir);
    const before = page(dir);
    await cli('narrate', dir, '--kit', kit);
    givePageCopies(dir);
    await cli('build', dir);
    expect(page(dir)).toBe(before);
    expect(before).not.toContain('id="deck-voice"');
    const voiced = await cli('build', dir, '--voice');
    expect(voiced.out).toContain('your voice on 2 clicks');
    const data = JSON.parse(/id="deck-voice">(.*?)<\/script>/s.exec(page(dir))[1]);
    expect(data.steps.map(Boolean)).toEqual([true, false, true]);
    expect(page(dir)).toContain(`id="vc-${data.steps[0]}"`);
    expect(page(dir).split('id="deck-voice"')[1], 'the clips sit before the runtimes that read them').toContain('deck-stage');
  });

  it('says so when only some clicks are voiced', async () => {
    const dir = deckWithNotes(), {kit} = fakeKit(tempDir());
    expect((await cli('build', dir, '--voice')).out).toContain('your voice on 0 of 2 clicks');
    await cli('narrate', dir, '--kit', kit, '--only', '1');
    givePageCopies(dir);
    expect((await cli('build', dir, '--voice')).out).toContain('your voice on 1 of 2 clicks');
  });
});

describe('a deck someone sent you', () => {
  it('never names a voice', async () => {
    const dir = tempDeck();
    writeFileSync(path.join(dir, 'deck.json'), JSON.stringify({title: 'T', kit: '/evil'}));
    const r = await cli('narrate', dir);
    expect(r.code).toBe(1);
    expect(r.err).toContain('kit');
  });

  it('cannot lead its clips out of the folder through a link', async () => {
    const dir = deckWithNotes(), outside = tempDir(), {kit, said} = fakeKit(tempDir());
    mkdirSync(path.join(dir, 'voice'));
    symlinkSync(outside, path.join(dir, 'voice', 'cache'));
    for (const argv of [['narrate', dir], ['narrate', dir, '--kit', kit], ['build', dir, '--voice']]) {
      const r = await cli(...argv);
      expect(r.code).toBe(1);
      expect(r.err).toContain('out of the deck folder');
    }
    expect(said()).toEqual([]);
    expect(readdirSync(outside)).toEqual([]);
  });

  it('cannot pull a file into the page through a link at a clip\'s name', async () => {
    const dir = deckWithNotes(), secret = path.join(tempDir(), 'secret'), {kit} = fakeKit(tempDir());
    writeFileSync(secret, 'a secret');
    await cli('narrate', dir, '--kit', kit);
    const cache = path.join(dir, 'voice', 'cache'), wav = readdirSync(cache).find((f) => f.endsWith('.wav'));
    const m4a = path.join(cache, wav.replace('.wav', '.m4a'));
    symlinkSync(secret, m4a);
    await cli('build', dir, '--voice');
    expect(lstatSync(m4a, {throwIfNoEntry: false})?.isSymbolicLink() ?? false, 'the link is gone, whether or not ffmpeg is here').toBe(false);
    expect(page(dir)).not.toContain(Buffer.from('a secret').toString('base64'));
    expect(readFileSync(secret, 'utf8')).toBe('a secret');
  });
});

describe('narrate over MCP', () => {
  it('reads by default, even on a server with a voice', async () => {
    const dir = deckWithNotes(), {kit, said} = fakeKit(tempDir());
    const r = await callTool('narrate', {}, {dir, kit});
    expect(textOf(r)).toContain('0 of 2 clicks voiced');
    expect(textOf(r)).toContain('call narrate with say: "all"');
    expect(said()).toEqual([]);
  });

  it('with no voice at the start, say is refused, and a call cannot name one', async () => {
    const dir = deckWithNotes(), {kit, said} = fakeKit(tempDir());
    expect(textOf(await callTool('narrate', {}, {dir}))).toContain('restart the server with a voice');
    const r = await callTool('narrate', {say: 'all', kit}, {dir});
    expect(r.isError).toBe(true);
    expect(textOf(r)).toContain('started with no voice');
    expect(said()).toEqual([]);
  });

  it('with a voice at the start, say voices in a process of its own and comes back as the answer', async () => {
    const dir = deckWithNotes(), {kit, said} = fakeKit(tempDir());
    const r = await callTool('narrate', {say: '1'}, {dir, kit});
    expect(r.isError).toBeUndefined();
    expect(said()).toEqual(['The first thing to say.']);
    expect(textOf(r)).toContain('1 of 2 clicks voiced');
    expect(textOf(r)).not.toContain('a line a kit prints');
    expect(textOf(await callTool('narrate', {say: 'all'}, {dir, kit}))).toContain('2 of 2 clicks voiced');
  }, 30000);

  it('refuses a say it cannot read before anything starts, and says why a voice stopped', async () => {
    const dir = deckWithNotes(), {kit, said} = fakeKit(tempDir());
    for (const say of ['--kit /evil', '', 7]) expect((await callTool('narrate', {say}, {dir, kit})).isError).toBe(true);
    expect(said()).toEqual([]);
    const broken = await callTool('narrate', {say: 'all'}, {dir, kit: tempDir()});
    expect(broken.isError).toBe(true);
    expect(textOf(broken)).toContain('no voice settings');
  }, 30000);

  it('voices one call at a time: a second say is refused, not started beside the first', async () => {
    const dir = deckWithNotes(), {kit, said} = fakeKit(tempDir());
    const [first, second] = await Promise.all([callTool('narrate', {say: 'all'}, {dir, kit}), callTool('narrate', {say: 'all'}, {dir, kit})]);
    expect(first.isError).toBeUndefined();
    expect(second.isError).toBe(true);
    expect(textOf(second)).toContain('being voiced already');
    expect(said()).toHaveLength(2);
    expect((await callTool('narrate', {say: 'all'}, {dir, kit})).isError, 'and free again once it is done').toBeUndefined();
  }, 30000);

  it('never builds a page that carries a voice', async () => {
    const dir = deckWithNotes(), {kit} = fakeKit(tempDir());
    await narrateTool(dir, {kit});
    givePageCopies(dir);
    await callTool('build', {voice: true}, {dir, kit});
    expect(page(dir)).not.toContain('id="deck-voice"');
  });
});
