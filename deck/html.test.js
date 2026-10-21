import {describe, it, expect} from 'vitest';
import {elements, esc, stripComments, scriptSafe, styleSafe} from './html.js';

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
