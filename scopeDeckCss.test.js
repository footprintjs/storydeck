import { describe, it, expect } from 'vitest';
import { scopeDeckCss } from './scopeDeckCss';

describe('scopeDeckCss', () => {
  it('scopes :root to .deck-scope', () => {
    expect(scopeDeckCss(':root{--bg:#000}')).toBe('.deck-scope{--bg:#000}');
  });
  it('scopes html,body (any spacing) to .deck-scope', () => {
    expect(scopeDeckCss('html, body{margin:0}')).toBe('.deck-scope{margin:0}');
    expect(scopeDeckCss('html,body{margin:0}')).toBe('.deck-scope{margin:0}');
  });
  it('leaves other selectors + keyframes untouched', () => {
    const css = '.fp-enter{opacity:0}@keyframes x{from{opacity:0}}';
    expect(scopeDeckCss(css)).toBe(css);
  });
});
