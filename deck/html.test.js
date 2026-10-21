import {describe, it, expect} from 'vitest';
import {commentRanges, elements, esc, stripComments, scriptSafe, styleSafe} from './html.js';
import {generated} from './test/helpers.js';

describe('elements', () => {
  it('finds each element of a tag in order, with its attributes, inside and place', () => {
    const html = 'a<step data-in="x">one</step> b <STEP>two</Step>c';
    const found = elements(html, 'step');
    expect(found.map(({attrs, inner}) => ({attrs, inner}))).toEqual([{attrs: ' data-in="x"', inner: 'one'}, {attrs: '', inner: 'two'}]);
    expect(found.map(({start, end}) => html.slice(start, end))).toEqual(['<step data-in="x">one</step>', '<STEP>two</Step>']);
    expect(elements('<steps>no</steps><stepper>', 'step')).toEqual([]);
  });

  it('refuses an element left open, opened inside another, or a tag never finished — naming it', () => {
    expect(() => elements('<section data-label="A"><p>x</p>', 'section')).toThrow(/<section data-label="A"> is never closed — end it with <\/section>/);
    expect(() => elements('<section data-label="A"><section data-label="B"></section></section>', 'section')).toThrow(/<section data-label="A"> is not closed before the next <section>/);
    expect(() => elements('<section data-label="A"', 'section')).toThrow(/a <section> tag is never finished/);
  });

  it('scans once: a file of unclosed tags is refused at once, not searched again and again', () => {
    const html = '<section data-label="x">'.repeat(160000);   // ~4 MB
    const t0 = performance.now();
    expect(() => elements(html, 'section')).toThrow(/<section data-label="x"> is never closed/);
    expect(() => elements(`${html}</section>`, 'section')).toThrow(/is not closed before the next <section>/);
    expect(performance.now() - t0).toBeLessThan(500);
  });
});

describe('the string rules', () => {
  it('escapes, strips comments, and keeps inlined code and styles from closing their tag', () => {
    expect(esc('<a href="x">&</a>')).toBe('&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;');
    expect(stripComments('a<!-- b\n -->c<!--d-->')).toBe('ac');
    expect(scriptSafe('x</ScRiPt>y')).toBe('x<\\/ScRiPt>y');
    expect(styleSafe('x</STYLE>y')).toBe('x<\\/STYLE>y');
  });
});

describe('comments', () => {
  it('finds each comment once, in order; one never closed ends the search', () => {
    const html = 'a<!-- b -->c<!---->d<!--> e -->f<!-- open';
    expect(commentRanges(html).map(([a, b]) => html.slice(a, b))).toEqual(['<!-- b -->', '<!---->', '<!--> e -->']);
    expect(stripComments(html)).toBe('acdf<!-- open');
  });

  it('strips exactly what the one regex stripped, on 4,000 generated texts', () => {
    for (const html of generated(['<!--', '-->', '<!-->', '-', '>', '<', '!', 'a', '\n'], {count: 4000, length: 30})) {
      expect(stripComments(html), html).toBe(html.replace(/<!--[\s\S]*?-->/g, ''));
    }
  });

  it('stays linear on a file of unclosed comments (the one regex took minutes on 4 MB)', () => {
    const t0 = performance.now();
    expect(stripComments('<!--'.repeat(1_000_000)).length).toBe(4_000_000);
    expect(stripComments('<!-- -->'.repeat(500_000))).toBe('');
    expect(performance.now() - t0).toBeLessThan(1500);
  });
});
