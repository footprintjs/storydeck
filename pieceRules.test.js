import {describe, it, expect} from 'vitest';
import {attrValue, pieceTags, readAttributes, styleLength, tagsWith} from './pieceRules.js';
import {readPieces, drawFocus} from './focusHtml.js';
import {generated} from './deck/test/helpers.js';

/** readPieces as it was before pieceRules.js (one regex over the text): the oracle the one-pass reading must equal. */
function readPiecesBefore(html, {attr = 'data-k'} = {}) {
  const PIECE = new RegExp(`<([a-zA-Z][\\w-]*)\\b([^>]*?)\\s${attr}=(["'])(.*?)\\3([^>]*)>`, 'g');
  const attrOf = (at, name) => new RegExp(`\\s${name}=(["'])(.*?)\\1`).exec(at)?.[2] ?? null;
  const px = (style, prop) => {
    const m = new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*(-?[\\d.]+)(px)?\\s*(?:;|$)`).exec(style);
    return m && (m[2] || Number(m[1]) === 0) ? Number(m[1]) : null;
  };
  const pieces = [];
  const out = html.replace(PIECE, (_, tag, a, q, k, b) => {
    const at = a + b, style = attrOf(at, 'style') ?? '';
    const attrPx = (name) => { const v = attrOf(at, name); return v !== null && /^[\d.]+$/.test(v) ? Number(v) : null; };
    const x = px(style, 'left'), y = px(style, 'top'), w = px(style, 'width') ?? attrPx('width'), h = px(style, 'height') ?? attrPx('height');
    const twin = attrOf(at, 'data-twin')?.trim().split(/\s+/);
    pieces.push({keys: k.trim().split(/\s+/), box: x === null || y === null ? null : {x, y, w: w ?? 0, h: h ?? 0}, ...(twin ? {twin} : {})});
    return `<${tag}${a} ${attr}=${q}${k}${q} data-sd-i="${pieces.length - 1}"${b}>`;
  });
  return {html: out, pieces};
}

const TOKENS = ['<div', '<i', '<svg', '<a-b', '<my-el', ' data-k="a b"', " data-k='c'", ' data-k=', ' data-k="', ' style="left:1px;top:2px"',
  ' style="top: 3.5px; left:0; width:4px"', ' style="left:1.2.3px;top:1px"', ' width="10"', ' height="7"', ' data-twin="a"', ' title="x>y"',
  '>', '/>', '</div>', '<!--', '-->', '"', "'", ' ', 'x', '\n', '<', ';', '='];

describe('pieceTags', () => {
  it('finds every opening tag that carries data-k, with what is before and after it', () => {
    const html = '<p>x</p><div class="a" data-k="one two" style="left:1px">A</div><i data-k=\'w\'></i><span>no</span>';
    const div = '<div class="a" data-k="one two" style="left:1px">', i = "<i data-k='w'>";
    expect(pieceTags(html)).toEqual([
      {start: html.indexOf(div), end: html.indexOf(div) + div.length, tag: 'div', before: ' class="a"', quote: '"', value: 'one two', after: ' style="left:1px"'},
      {start: html.indexOf(i), end: html.indexOf(i) + i.length, tag: 'i', before: '', quote: "'", value: 'w', after: ''},
    ]);
    expect(pieceTags(html, 'class').map((t) => t.value)).toEqual(['a']);
  });

  it('reads exactly what the one regex read, on 4,000 generated maps (a name holding ">" aside)', () => {
    let compared = 0;
    for (const html of generated(TOKENS, {count: 4000})) {
      const before = readPiecesBefore(html);
      // the one difference, by design: a tag ends at its first ">", so a name holding ">" is not read as one
      if (before.pieces.some((p) => p.keys.some((k) => k.includes('>')))) continue;
      expect(readPieces(html), html).toEqual(before);
      compared += 1;
    }
    expect(compared).toBeGreaterThan(3500);
  });

  it('stays linear on a map of unfinished tags (the one regex took minutes on 4 MB)', () => {
    const t0 = performance.now();
    for (const hostile of ['<a '.repeat(1_400_000), '<div data-k="x" '.repeat(250_000), '<a<a<a '.repeat(500_000)]) {
      expect(readPieces(hostile)).toEqual({html: hostile, pieces: []});
    }
    expect(performance.now() - t0).toBeLessThan(1500);
  });
});

describe('where a value is written', () => {
  it('finds an attribute value and a px length with their places', () => {
    const at = ' class="a" style="top: 3px; left:12.5px"';
    const style = attrValue(at, 'style');
    expect(style).toMatchObject({value: 'top: 3px; left:12.5px', length: 21});
    expect(at.slice(style.at, style.at + style.length)).toBe(style.value);
    const left = styleLength(style.value, 'left'), top = styleLength(style.value, 'top');
    expect([left.value, style.value.slice(left.at, left.at + left.length)]).toEqual([12.5, '12.5']);
    expect([top.value, style.value.slice(top.at, top.at + top.length)]).toEqual([3, '3']);
    expect(styleLength('left:0', 'left')).toEqual({value: 0, at: 5, length: 1, unit: ''});
    expect(styleLength('left:3px', 'left').unit).toBe('px');
    expect(styleLength('left:5em', 'left')).toBeNull();
    expect(styleLength('margin-left:5px', 'left')).toBeNull();
    expect(attrValue(at, 'id')).toBeNull();
  });
});

/** drawFocus as it was before (one regex over the text): the oracle the one-pass drawing must equal. */
function drawFocusBefore(html, draw) {
  return html.replace(/<([a-zA-Z][\w-]*)\b([^>]*?)\sdata-sd-i="(\d+)"([^>]*)>/g, (_, tag, a, i, b) => draw(tag, a + b, i));
}

describe('tagsWith', () => {
  it('finds each tag holding a rule once, with what is around the match', () => {
    const html = '<p data-x="1">a</p><b>no</b><i title="t" data-x="2" lang="en">';
    expect(tagsWith(html, /\sdata-x="(\d)"/).map(({start, end, tag, before, m, after}) => [html.slice(start, end), tag, before, m[1], after]))
      .toEqual([['<p data-x="1">', 'p', '', '1', ''], ['<i title="t" data-x="2" lang="en">', 'i', ' title="t"', '2', ' lang="en"']]);
  });

  it('lets drawFocus draw exactly what its regex drew, on 4,000 generated slides, and stay linear', () => {
    const tokens = ['<div', '<i', '<a-b', ' data-sd-i="0"', ' data-sd-i="1"', " data-sd-i='0'", ' data-sd-i="x"', ' class="c"', ' style="left:1px"', '>', '</div>', '"', ' ', 'x', '\n', '<'];
    // drawFocus draws each tag it finds with that piece's look, so which tags it finds is the whole difference
    for (const html of generated(tokens, {count: 4000, length: 30})) {
      const marks = [];
      drawFocusBefore(html, (tag, at, i) => { marks.push([tag, at, i]); return ''; });
      const found = tagsWith(html, /\sdata-sd-i="(\d+)"/).map(({tag, before, m, after}) => [tag, before + after, m[1]]);
      expect(found, html).toEqual(marks);
    }
    const t0 = performance.now();
    const hostile = `<div data-k="a" style="left:1px;top:1px">${'<a '.repeat(1_400_000)}`;
    const {html, pieces} = readPieces(hostile);
    expect(drawFocus(html, {pieces: pieces.map(() => ({}))})).toContain('<a <a ');
    expect(performance.now() - t0).toBeLessThan(1500);
  });
});

describe('readAttributes', () => {
  it('reads a tag\'s attributes as a browser does: names lower-cased, every kind of value, where each starts', () => {
    const text = ' data-k="a b" STYLE=\'left:1px\' hidden x=y/z  =odd title = "t" ';
    expect(readAttributes(text).map(({name, value, valueAt}) => [name, value, valueAt < 0 ? -1 : text.slice(valueAt, valueAt + value.length)]))
      .toEqual([['data-k', 'a b', 'a b'], ['style', 'left:1px', 'left:1px'], ['hidden', '', -1], ['x', 'y/z', 'y/z'], ['=odd', '', -1], ['title', 't', 't']]);
  });

  it('says it cannot when a quoted value never closes — a ">" inside it ends a scan early', () => {
    expect(readAttributes(' data-k="a" title="x')).toBeNull();
    expect(readAttributes('')).toEqual([]);
    expect(readAttributes(' a="1"b="2"').map((a) => a.name)).toEqual(['a', 'b']);
  });
});
