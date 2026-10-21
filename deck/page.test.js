import {describe, it, expect, vi} from 'vitest';
import {deckPage, themeRuntime} from './page.js';
import {scriptSafe, styleSafe} from './html.js';
import {compileDeck} from './compile.js';
import {sourceOf} from './test/helpers.js';

const ASSETS = {stageJs: 'window.stage = "</script><b>";', css: ['.focus{}', '.narration{}', '.deck{}'], version: '9.9.9'};
const compiled = compileDeck(sourceOf({
  deck: {title: 'A <b> & "c"', description: 'About "it"', lang: 'de', canvas: [1280, 720]},
  clicks: '<section data-label="P"><p>x</p><aside class="notes">Say </script> it.</aside></section>',
  theme: '.mine{} </style><b>',
}));

describe('deckPage', () => {
  const html = deckPage(compiled, ASSETS);

  it('is one page: slides on <deck-stage> at the canvas size, the notes, every stylesheet and runtime inlined', () => {
    expect(html).toMatch(/^<!doctype html>\n<html lang="de">/);
    expect(html).toContain('<deck-stage width="1280" height="720" no-rail>');
    expect(html).toContain('<section data-label="P" class="slide plain">');
    expect(html).toContain('<script type="application/json" id="deck-notes">');
    expect(html).toContain('.focus{}\n.narration{}\n.deck{}\n.mine{}');
    expect(html).toContain('<meta name="generator" content="footprint-storydeck 9.9.9">');
    for (const runtime of ['__sdFocusRuntime', 'deck-presenter', 'theme-toggle']) expect(html).toContain(runtime);
    expect(html).toContain('<button class="theme-toggle"');
  });

  it('escapes the title and description, and nothing inlined can close its own tag early', () => {
    expect(html).toContain('<title>A &lt;b&gt; &amp; &quot;c&quot;</title>');
    expect(html).toContain('<meta name="description" content="About &quot;it&quot;">');
    expect(html).toContain('window.stage = "<\\/script><b>";');
    expect(html).toContain('.mine{} <\\/style><b>');
    expect(html.match(/<\/script>/g).length).toBe(html.match(/<script\b/g).length);
  });

  it('carries the dev client and its build number only when asked', () => {
    expect(html).not.toContain('storydeck-dev');
    const dev = deckPage(compiled, ASSETS, {dev: {client: function devStub() { return 1; }, version: 7}});
    expect(dev).toContain('<meta name="storydeck-dev" content="7">');
    expect(dev).toMatch(/<script>\(function devStub\(\) \{\s*return 1;\s*\}\)\(\);<\/script>/);
    expect(dev).not.toContain('storydeck-dev-token');
    // the dev server's token, for the two edits the page may send back
    const edits = deckPage(compiled, ASSETS, {dev: {client: function devStub() { return 1; }, version: 7, token: '0a1b"<'}});
    expect(edits).toContain('<meta name="storydeck-dev-token" content="0a1b&quot;&lt;">');
  });

  it('leaves the description out when there is none', () => {
    const plain = compileDeck(sourceOf({clicks: '<section data-label="P"><p>x</p></section>'}));
    expect(deckPage(plain, ASSETS)).not.toContain('name="description"');
  });

  it('escapes a closing tag in any case', () => {
    expect(scriptSafe('a</SCRIPT>b')).toBe('a<\\/SCRIPT>b');
    expect(styleSafe('a</Style>b')).toBe('a<\\/Style>b');
  });
});

describe('themeRuntime', () => {
  it('switches light and dark by the button or T, and keeps the choice', () => {
    document.body.innerHTML = '<button class="theme-toggle"></button>';
    themeRuntime();
    const btn = document.querySelector('.theme-toggle');
    expect(btn.getAttribute('aria-label')).toBe('Switch to dark theme');
    btn.click();
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(localStorage.getItem('theme')).toBe('dark');
    window.dispatchEvent(new KeyboardEvent('keydown', {key: 't'}));
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    window.dispatchEvent(new KeyboardEvent('keydown', {key: 'T', metaKey: true}));
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('still switches when storage is refused', () => {
    document.body.innerHTML = '<button class="theme-toggle"></button>';
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    themeRuntime();
    document.querySelector('.theme-toggle').click();
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    spy.mockRestore();
  });
});
