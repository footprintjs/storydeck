import { describe, it, expect } from 'vitest';
import { parseXml, elements } from './xml.js';

const NS = 'xmlns:a="urn:a" xmlns:r="urn:r"';

describe('xml · reading a well-formed part', () => {
  it('reads elements, attributes (references decoded), text, CDATA, and skips the declaration, comments and instructions', () => {
    const root = parseXml(`\uFEFF<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<!-- a part -->\n<a:doc ${NS} a:k='single' r:id="rId1">`
      + '<a:t>Fish &amp; chips &lt;3 &#233;&#x1F600;</a:t><?pi data?><a:t><![CDATA[<raw & real>]]></a:t><a:empty/></a:doc>\n');
    expect(root.name).toBe('a:doc');
    expect(root.attrs).toEqual({ 'xmlns:a': 'urn:a', 'xmlns:r': 'urn:r', 'a:k': 'single', 'r:id': 'rId1' });
    expect(root.children.map((c) => c.name)).toEqual(['a:t', 'a:t', 'a:empty']);
    expect(root.children.map((c) => c.text)).toEqual(['Fish & chips <3 é😀', '<raw & real>', '']);
    expect(root.children[2].ns.a).toBe('urn:a');                                 // namespaces are inherited
    expect(root.ns.xml).toBe('http://www.w3.org/XML/1998/namespace');
  });

  it('keeps a default namespace and an attribute value holding > and quotes of the other kind', () => {
    const root = parseXml('<Types xmlns="urn:t"><Default Extension="xml" ContentType=\'say "x" > y\'/></Types>');
    expect(root.ns['']).toBe('urn:t');
    expect(root.children[0].attrs.ContentType).toBe('say "x" > y');
  });

  it('lists elements by name in document order, or all of them', () => {
    const root = parseXml('<a><b i="1"><b i="2"/></b><c><b i="3"/></c></a>');
    expect(elements(root, 'b').map((b) => b.attrs.i)).toEqual(['1', '2', '3']);
    expect(elements(root).map((e) => e.name)).toEqual(['a', 'b', 'b', 'c', 'b']);
  });
});

describe('xml · refusing what is not well-formed, saying where and what', () => {
  const cases = [
    ['<a><b></a>', '</a> closes <b>'],
    ['<a></a></b>', '</b> closes nothing'],
    ['<a/><b/>', 'a second root, <b>'],
    ['<a>', '<a> is never closed'],
    ['', 'no root element'],
    ['text<a/>', 'text outside the root ("text")'],
    ['<a/>tail', 'text outside the root ("tail")'],
    ['<a>fish & chips</a>', 'a bare & ("& chips")'],
    ['<a>&nbsp;</a>', 'an unknown entity &nbsp;'],
    ['<a>&#0;</a>', '&#0; names no XML character'],
    ['<a x="&#xD800;"/>', '&#xD800; names no XML character'],
    ['<a>\u0001</a>', 'a control character'],
    ['<!DOCTYPE a><a/>', 'a DOCTYPE or other declaration (Office Open XML has none)'],
    ['<p:a/>', '<p:a>: the prefix p is not declared'],
    ['<a p:x="1"/>', '<a> p:x: the prefix p is not declared'],
    ['<a x="1" x="2"/>', '<a> has x twice'],
    ['<a x=1/>', 'a broken tag'],
    ['<a><!-- open</a>', 'a comment that never ends'],
    ['<![CDATA[x]]><a/>', 'CDATA outside the root'],
  ];
  it.each(cases)('%j: %s', (text, what) => {
    expect(() => parseXml(text)).toThrow(what);
  });

  it('names the line and column', () => {
    expect(() => parseXml('<a>\n  <b>\n  </c>\n</a>')).toThrow('not well-formed at line 3, column 3: </c> closes <b>');
  });

  it('takes a prefix declared on an ancestor, and the xml prefix without a declaration', () => {
    expect(() => parseXml(`<a:x ${NS}><a:y r:id="1" xml:space="preserve"/></a:x>`)).not.toThrow();
  });
});
