import {describe, it, expect} from 'vitest';
import {parseClicks, plainText, wordCount, takeNotes, attrOf} from './parse.js';

describe('parseClicks', () => {
  it('reads plain parts and map parts, each click with its headline and notes', () => {
    const parts = parseClicks(`<!-- a comment is ignored -->
      <section data-label="Title" data-kicker="Hello"><h1>Hi</h1><aside class="notes">Say <b>hello</b>.</aside></section>
      <section data-label="Map" data-kicker="1 · Map" data-map="map">
        <step data-in="a" data-on="a"><h2>First <em>thing</em></h2><aside class="notes">One.</aside><aside class="notes">Two.</aside></step>
        <step data-in="b"></step>
      </section>`);
    expect(parts).toHaveLength(2);
    expect(parts[0]).toMatchObject({label: 'Title', kicker: 'Hello', map: null, notes: ['Say hello.']});
    expect(parts[0].body).toContain('<h1>Hi</h1>');
    expect(parts[0].body).not.toContain('notes');
    expect(parts[1]).toMatchObject({label: 'Map', kicker: '1 · Map', map: 'map'});
    expect(parts[1].steps).toEqual([
      {attrs: ' data-in="a" data-on="a"', headline: 'First <em>thing</em>', notes: ['One.', 'Two.']},
      {attrs: ' data-in="b"', headline: '', notes: []},
    ]);
  });

  it('keeps a plain slide\'s HTML as written, white space included', () => {
    const [part] = parseClicks('<section data-label="P">\n  <p>x</p>\n</section>');
    expect(part.body).toBe('\n  <p>x</p>\n');
  });

  it('defaults a missing kicker to empty and accepts single-quoted attributes', () => {
    const [part] = parseClicks("<section data-label='Only'><p>x</p></section>");
    expect(part).toMatchObject({label: 'Only', kicker: ''});
  });

  it('refuses what it would otherwise drop, naming the fix', () => {
    expect(() => parseClicks('')).toThrow(/no <section>/);
    expect(() => parseClicks('<section><p>x</p></section>')).toThrow(/has no data-label/);
    expect(() => parseClicks('<section data-label="A"></section><section data-label="A"></section>')).toThrow(/two parts are labelled "A"/);
    expect(() => parseClicks('hello <section data-label="A"></section>')).toThrow(/text outside a <section>: "hello"/);
    expect(() => parseClicks('<section data-label="A"></section> trailing')).toThrow(/text outside a <section>: "trailing"/);
    expect(() => parseClicks('<section data-label="A" data-map="map"><h2>x</h2></section>')).toThrow(/no <step>/);
    expect(() => parseClicks('<section data-label="A" data-map=" "><step></step></section>')).toThrow(/data-map is empty/);
    expect(() => parseClicks('<section data-label="A"><step data-in="a"></step></section>')).toThrow(/no data-map/);
    expect(() => parseClicks('<section data-label="A" data-map="m"><p>loose</p><step></step></section>')).toThrow(/"loose" is outside every <step>/);
    expect(() => parseClicks('<section data-label="A" data-map="m"><step><h2>h</h2><p>extra words</p></step></section>'))
      .toThrow(/"A" click 1: .*"extra words" is neither — draw it on the map/);
    expect(() => parseClicks('<section data-label="A" data-map="m"><step><h2>h</h2><img src="x.png"></step></section>'))
      .toThrow(/<img src="x.png">/);
  });
});

describe('plainText and wordCount', () => {
  it('reads entities, drops inline tags without a space and leaves one for blocks', () => {
    expect(plainText('<b>One</b>FS &amp; more&nbsp;text &#65;&#x42; &bogus;')).toBe('OneFS & more text AB &bogus;');
    expect(plainText('<p>a</p><p>b</p>line<br>break')).toBe('a b line break');
    expect(wordCount('<h2>The request travels, 12 ms · to PowerScale</h2>')).toBe(7);
    expect(wordCount('')).toBe(0);
    expect(wordCount('— · →')).toBe(0);
  });

  it('takes notes out of HTML, empty ones dropped', () => {
    expect(takeNotes('<p>x</p><aside class="notes extra">a\n b</aside><aside class="notes"> </aside>')).toEqual({html: '<p>x</p>', notes: ['a b']});
  });

  it('reads an attribute or says it is not there', () => {
    expect(attrOf(' data-a="1" data-b=\'2\'', 'data-b')).toBe('2');
    expect(attrOf(' data-a="1"', 'data-c')).toBeNull();
  });
});
