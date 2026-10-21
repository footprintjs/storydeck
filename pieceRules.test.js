import {describe, it, expect} from 'vitest';
import {attrValue, pieceTags, styleLength} from './pieceRules.js';
import {readPieces} from './focusHtml.js';
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
    expect(styleLength('left:0', 'left')).toEqual({value: 0, at: 5, length: 1});
    expect(styleLength('left:5em', 'left')).toBeNull();
    expect(styleLength('margin-left:5px', 'left')).toBeNull();
    expect(attrValue(at, 'id')).toBeNull();
  });
});
