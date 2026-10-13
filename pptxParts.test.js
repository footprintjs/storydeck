import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pptxParts, pngSize, solidPng, plainText, isSound, TYPES } from './pptxParts.js';
import { checkPptx } from './pptxCheck.js';
import { zip, unzip } from './zip.js';
import { parseXml } from './xml.js';

/** A real 0.1 s WAV (8 kHz mono); `variant` changes one sample, so the bytes differ and it is still a WAV. */
const TONE = readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'tone-0.1s.wav'));
const wav = (variant = 0) => { const bytes = Buffer.from(TONE); bytes[100] ^= variant; return bytes; };
const sound = (variant = 0, duration = 2.5) => ({ data: wav(variant), ext: 'wav', duration });
const MP3 = Buffer.concat([Buffer.from('ID3'), Buffer.alloc(13)]), M4A = Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from('ftypM4A '), Buffer.alloc(8)]);
const SLIDES = [
  { title: 'Intro', notes: 'Hello & welcome.\nSecond line: <b> "quoted"', picture: solidPng(16, 9, [200, 0, 0]), audio: sound(), advance: 3.1 },
  { title: '', notes: '', picture: solidPng(32, 18), advance: 2.5 },
  { title: 'Again', notes: 'Same words.', picture: solidPng(16, 9), audio: sound(), advance: 3.1 },
];
const SILENT = SLIDES.map(({ audio, ...s }) => s);
const partsOf = (slides = SLIDES, options = {}) => new Map(pptxParts({ slides, ...options }).map((p) => [p.name, p.data]));
const text = (parts, name) => String(parts.get(name));
/** The package with one change made to its parts (name → data), zipped. */
function tampered(edit, slides = SLIDES) {
  const parts = partsOf(slides);
  edit(parts);
  return zip([...parts].map(([name, data]) => ({ name, data })));
}
const problemsOf = (edit) => checkPptx(tampered(edit)).problems;
const swap = (parts, name, from, to) => { expect(text(parts, name)).toContain(from); parts.set(name, text(parts, name).replace(from, to)); };

describe('pptx parts · a minimal PresentationML part set', () => {
  it('writes content types first, then the package, presentation, master, layout, themes, slides with notes, docProps and media', () => {
    const names = pptxParts({ slides: SLIDES }).map((p) => p.name);
    expect(names[0]).toBe('[Content_Types].xml');
    expect(names).toEqual(expect.arrayContaining(['_rels/.rels', 'ppt/presentation.xml', 'ppt/_rels/presentation.xml.rels', 'ppt/presProps.xml',
      'ppt/slideMasters/slideMaster1.xml', 'ppt/slideLayouts/slideLayout1.xml', 'ppt/notesMasters/notesMaster1.xml', 'ppt/theme/theme1.xml', 'ppt/theme/theme2.xml',
      'ppt/slides/slide3.xml', 'ppt/notesSlides/notesSlide3.xml', 'ppt/notesSlides/_rels/notesSlide3.xml.rels', 'docProps/core.xml', 'docProps/app.xml',
      'ppt/media/image1.png', 'ppt/media/icon.png', 'ppt/media/media1.wav']));
    expect(names.filter((n) => n.startsWith('ppt/media/media'))).toEqual(['ppt/media/media1.wav']);   // one sound, said twice, is one part
    expect(names).toHaveLength(32);   // 13 shared parts, 4 per slide, 2 docProps, 5 media: 3 pictures, the sound, its icon
    for (const name of names.filter((n) => /\.(xml|rels)$/.test(n))) expect(() => parseXml(text(partsOf(), name)), name).not.toThrow();
  });

  it('writes the sound\'s icon only when a slide has sound', () => {
    const names = pptxParts({ slides: SILENT }).map((p) => p.name);
    expect(names.filter((n) => n.startsWith('ppt/media/'))).toEqual(['ppt/media/image1.png', 'ppt/media/image2.png', 'ppt/media/image3.png']);
    expect(names).toHaveLength(30);
    expect(checkPptx(zip(pptxParts({ slides: SILENT }))).problems).toEqual([]);
  });

  it('gives each paragraph of the notes its own paragraph on the notes page', () => {
    const notes = text(partsOf(), 'ppt/notesSlides/notesSlide1.xml');
    expect(notes.match(/<a:p>/g)).toHaveLength(2);
    expect(notes).toContain('<a:t>Hello &amp; welcome.</a:t></a:r></a:p><a:p><a:r><a:rPr lang="en-US" dirty="0"/><a:t>Second line: &lt;b&gt; &quot;quoted&quot;</a:t>');
    expect(text(pptxPartsAt({ notes: 'One\r\n\nThree' }), 'ppt/notesSlides/notesSlide1.xml').match(/<a:p>/g)).toHaveLength(3);   // an empty line stays a paragraph
  });

  it('reads back whole: every part typed and found, a slide per entry with its title, notes, picture, sound and time', () => {
    const { slides, problems } = checkPptx(zip(pptxParts({ slides: SLIDES, title: 'Talk' })));
    expect(problems).toEqual([]);
    expect(slides.map((s) => [s.title, s.notes, s.pictures[0], s.audio, s.advance])).toEqual([
      ['Intro', 'Hello & welcome.\nSecond line: <b> "quoted"', 'ppt/media/image1.png', ['ppt/media/media1.wav'], 3.1],
      ['Slide 2', '', 'ppt/media/image2.png', [], 2.5],
      ['Again', 'Same words.', 'ppt/media/image3.png', ['ppt/media/media1.wav'], 3.1],
    ]);
  });

  it('puts the title just above the page, the picture full-bleed, a fade; the clip plays as the slide starts', () => {
    const parts = partsOf(), first = text(parts, 'ppt/slides/slide1.xml'), second = text(parts, 'ppt/slides/slide2.xml');
    expect(first).toContain('<p:ph type="title"/></p:nvPr></p:nvSpPr><p:spPr><a:xfrm><a:off x="0" y="-1143000"/><a:ext cx="12192000" cy="1143000"/>');
    expect(first).toContain('<a:blip r:embed="rId3"/><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="12192000" cy="6858000"/>');
    expect(first).toContain('descr="Hello &amp; welcome. Second line: &lt;b&gt; &quot;quoted&quot;"');   // the notes are the picture's words
    expect(first).toContain('<p:transition spd="med" advTm="3100"><p:fade/></p:transition>');
    expect(first).toContain('<a:audioFile r:link="rId4"/>');
    expect(first).toContain('<p:cmd type="call" cmd="playFrom(0.0)"><p:cBhvr><p:cTn id="6" dur="2500" fill="hold"/>');
    expect(second).not.toContain('<p:timing>');
    expect(second).not.toContain('Narration');
    expect(text(pptxPartsAt({ advance: null }), 'ppt/slides/slide1.xml')).toContain('<p:transition spd="med"><p:fade/></p:transition>');   // the speaker clicks
    expect(text(parts, 'ppt/slides/_rels/slide1.xml.rels')).toContain('Type="http://schemas.microsoft.com/office/2007/relationships/media" Target="../media/media1.wav"');
  });

  it('types each kind of part, and only the sound it carries', () => {
    const types = text(partsOf(), '[Content_Types].xml');
    expect(types).toContain('<Default Extension="wav" ContentType="audio/wav"/>');
    expect(types).not.toContain('Extension="mp3"');
    expect(types).toContain(`<Override PartName="/ppt/slides/slide2.xml" ContentType="${TYPES.slide}"/>`);
    expect(types).toContain(`<Override PartName="/ppt/notesSlides/notesSlide2.xml" ContentType="${TYPES.notes}"/>`);
    const mixed = text(partsOf([{ ...SLIDES[0], audio: { data: MP3, ext: 'mp3', duration: 1 } }, { ...SLIDES[0], audio: { data: M4A, ext: 'm4a', duration: 1 } }]), '[Content_Types].xml');
    expect(mixed).toContain('<Default Extension="mp3" ContentType="audio/mpeg"/><Default Extension="m4a" ContentType="audio/mp4"/>');
    expect(types).not.toContain('Extension="wav" ContentType="audio/wav"/><Default Extension="wav"');
  });

  it('keys each sound by its bytes, never by a name: two sounds under one name stay two, one sound under two names stays one', () => {
    const named = (variant, key) => ({ ...SLIDES[0], audio: { ...sound(variant), key } });
    const two = partsOf([named(0, 'same'), named(1, 'same')]);
    expect([...two.keys()].filter((n) => n.startsWith('ppt/media/media'))).toEqual(['ppt/media/media1.wav', 'ppt/media/media2.wav']);
    expect(text(two, 'ppt/slides/_rels/slide2.xml.rels')).toContain('Target="../media/media2.wav"');
    expect(Buffer.compare(two.get('ppt/media/media2.wav'), wav(1))).toBe(0);   // each slide plays its own sound
    const one = partsOf([named(0, 'a'), named(0, 'b')]);
    expect([...one.keys()].filter((n) => n.startsWith('ppt/media/media'))).toEqual(['ppt/media/media1.wav']);
    const kinds = partsOf([{ ...SLIDES[0], audio: { data: MP3, ext: 'mp3', duration: 1 } }, { ...SLIDES[0], audio: { data: Buffer.concat([MP3, Buffer.from('x')]), ext: 'mp3', duration: 1 } }]);
    expect([...kinds.keys()].filter((n) => n.startsWith('ppt/media/media'))).toEqual(['ppt/media/media1.mp3', 'ppt/media/media2.mp3']);
  });

  it('names the file and its counts in docProps, and tags the text with its language', () => {
    const parts = partsOf([{ ...SLIDES[0], audio: sound(0) }, { ...SLIDES[2], audio: sound(1) }], { title: 'Q&A' });
    expect(text(parts, 'docProps/core.xml')).toContain('<dc:title>Q&amp;A</dc:title>');
    expect(text(parts, 'docProps/app.xml')).toContain('<Slides>2</Slides><Notes>2</Notes><MMClips>2</MMClips>');
    expect(text(partsOf(), 'docProps/core.xml')).not.toContain('dc:title');
    expect(text(partsOf(SLIDES, { lang: 'de-DE' }), 'ppt/notesSlides/notesSlide1.xml')).toContain('<a:rPr lang="de-DE" dirty="0"/><a:t>Hello &amp; welcome.</a:t>');
  });

  it('leaves out what XML cannot hold — a control character, a lone surrogate — and keeps the rest, emoji included', () => {
    expect(plainText('a\u0001b\u0000c\uD800d😀\uDC00e')).toBe('abcd😀e');
    expect(plainText(null)).toBe('');
    const { slides } = checkPptx(zip(pptxParts({ slides: [{ title: 'T\u0007itle', notes: 'n\u000Bote 😀', picture: solidPng(16, 9) }] })));
    expect(slides[0]).toMatchObject({ title: 'Title', notes: 'note 😀', advance: null, audio: [] });
  });

  it('refuses a slide it cannot write, naming the fix', () => {
    const one = (patch) => () => pptxParts({ slides: [{ ...SLIDES[0], ...patch }] });
    expect(() => pptxParts({ slides: [] })).toThrow('pptxParts: no slides — give one { title, notes, picture } per click');
    expect(() => pptxParts({})).toThrow('pptxParts: no slides');
    expect(one({ picture: Buffer.from('JFIF not a png at all, really') })).toThrow('pptxParts: slide 1: its picture is not a PNG — give the PNG\'s bytes');
    expect(one({ picture: undefined })).toThrow('its picture is not a PNG');
    expect(one({ audio: { ...sound(), ext: 'ogg' } })).toThrow('pptxParts: slide 1: its sound is .ogg — give .wav, .m4a or .mp3');
    expect(one({ audio: sound(0, 0) })).toThrow('pptxParts: slide 1: its sound has no length (duration 0) — give its duration in seconds');
    expect(one({ audio: sound(0, Infinity) })).toThrow('its sound has no length (duration Infinity)');
    expect(one({ audio: { ...sound(), data: Buffer.alloc(0) } })).toThrow('pptxParts: slide 1: its sound has no bytes');
    expect(one({ audio: { ...sound(), data: Buffer.from('not a wave file, only words') } })).toThrow('pptxParts: slide 1: its sound\'s bytes are not a .wav file (no RIFF…WAVE) — give the file\'s own bytes');
    expect(one({ audio: { data: TONE, ext: 'mp3', duration: 1 } })).toThrow('its sound\'s bytes are not a .mp3 file (no ID3, or an MP3 frame sync)');
    expect(() => pptxParts({ slides: SLIDES, lang: 'en_US' })).toThrow('pptxParts: lang "en_US" is not a language tag — give one like en-US, de or zh-Hant-TW');
    expect(() => pptxParts({ slides: SLIDES, lang: '' })).toThrow('pptxParts: lang "" is not a language tag');
    expect(() => pptxParts({ slides: SLIDES, lang: 'en-US" onload="x' })).toThrow('is not a language tag');
    expect(one({ advance: -1 })).toThrow('pptxParts: slide 1: advance -1 is not a time — give seconds (0 or more), or null to wait for a click');
    expect(one({ advance: NaN })).toThrow('advance NaN is not a time');
  });
});

/** The parts of a one-slide deck with the first slide changed. */
function pptxPartsAt(patch) {
  return partsOf([{ ...SLIDES[0], ...patch }]);
}

describe('pptx parts · what a sound file begins with', () => {
  it('knows a WAV, an MP3 (ID3 or a frame sync) and an M4A (ftyp) by their first bytes', () => {
    expect(isSound(TONE, 'wav')).toBe(true);
    expect(isSound(MP3, 'mp3')).toBe(true);
    expect(isSound(Buffer.from([0xff, 0xfb, 0x90, 0x00]), 'mp3')).toBe(true);
    expect(isSound(M4A, 'm4a')).toBe(true);
    expect(isSound(new Uint8Array(TONE.subarray(0, 12)), 'wav')).toBe(true);
    for (const [bytes, ext] of [[TONE, 'mp3'], [MP3, 'wav'], [M4A, 'wav'], [Buffer.alloc(0), 'wav'], [null, 'wav'], [TONE, 'ogg'], [Buffer.from('RIFF....AVI '), 'wav']]) {
      expect(isSound(bytes, ext), `${ext}`).toBe(false);
    }
  });
});

describe('pptx parts · PNG', () => {
  it('reads a PNG\'s size, and nothing from bytes that are not one', () => {
    expect(pngSize(solidPng(1920, 1080, [1, 2, 3]))).toEqual({ width: 1920, height: 1080 });
    expect(pngSize(new Uint8Array(solidPng(4, 3)))).toEqual({ width: 4, height: 3 });
    expect(pngSize(Buffer.from('GIF89a................................'))).toBe(null);
    expect(pngSize(solidPng(4, 3).subarray(0, 20))).toBe(null);
    const fake = solidPng(4, 3);
    fake.write('IHDX', 12, 'latin1');
    expect(pngSize(fake)).toBe(null);
    expect(pngSize(null)).toBe(null);
  });
});

describe('pptx check · what would make PowerPoint refuse or repair a file', () => {
  it('finds nothing wrong in what pptxParts writes, a relationship given with an absolute target or to the outside included', () => {
    const data = tampered((parts) => {
      swap(parts, 'ppt/slides/_rels/slide1.xml.rels', 'Target="../media/image1.png"', 'Target="/ppt/media/image1.png"');
      swap(parts, 'ppt/slides/_rels/slide1.xml.rels', '</Relationships>', '<Relationship Id="rId9" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="https://example.com" TargetMode="External"/></Relationships>');
    });
    expect(checkPptx(data).problems).toEqual([]);
  });

  it('refuses what is not a ZIP, or a package without its content types or its document', () => {
    expect(checkPptx(Buffer.from('nope'))).toEqual({ slides: [], problems: ['unzip: no end of central directory — not a ZIP, or cut short'] });
    expect(problemsOf((parts) => parts.delete('[Content_Types].xml'))).toContain('[Content_Types].xml: missing — every package names its parts\' types there');
    const lost = checkPptx(tampered((parts) => swap(parts, '_rels/.rels', '/officeDocument"', '/somethingElse"')));
    expect(lost.problems).toContain('_rels/.rels: no officeDocument relationship — PowerPoint finds the presentation through it');
    expect(lost.slides).toEqual([]);
    const broken = checkPptx(tampered((parts) => parts.set('ppt/presentation.xml', '<p:presentation')));
    expect(broken.slides).toEqual([]);
    expect(broken.problems[0]).toMatch(/^ppt\/presentation\.xml: not well-formed at line 1/);
  });

  it('finds a part that is gone, one with no type, an override for nothing, and a part that is not well-formed', () => {
    const gone = problemsOf((parts) => parts.delete('ppt/slides/slide2.xml'));
    expect(gone).toEqual(expect.arrayContaining([
      '[Content_Types].xml: an override for /ppt/slides/slide2.xml, which is not in the package',
      'ppt/_rels/presentation.xml.rels: rId6 points at ppt/slides/slide2.xml, which is not in the package',
      'ppt/slides/_rels/slide2.xml.rels: speaks for ppt/slides/slide2.xml, which is not in the package',
    ]));
    expect(problemsOf((parts) => parts.set('ppt/media/extra.gif', 'GIF'))).toEqual(['ppt/media/extra.gif: no content type — add a Default for its extension or an Override for it']);
    expect(problemsOf((parts) => swap(parts, 'ppt/notesSlides/notesSlide1.xml', '</p:notes>', ''))[0]).toMatch(/^ppt\/notesSlides\/notesSlide1\.xml: not well-formed at .*<p:notes> is never closed/);
  });

  it('finds a relationship that is broken, repeated, out of place, or to a part of the wrong type', () => {
    expect(problemsOf((parts) => swap(parts, 'ppt/slides/_rels/slide1.xml.rels', 'Id="rId2"', 'Id="rId1"'))).toEqual(['ppt/slides/_rels/slide1.xml.rels: rId1 is given twice']);
    expect(problemsOf((parts) => swap(parts, 'ppt/slides/_rels/slide1.xml.rels', 'Target="../media/image1.png"', ''))).toContain('ppt/slides/_rels/slide1.xml.rels: a relationship without an Id, a Type or a Target');
    expect(problemsOf((parts) => parts.set('ppt/stray.rels', '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>'))).toEqual(['ppt/stray.rels: a relationships part outside a _rels folder']);
    expect(problemsOf((parts) => swap(parts, '[Content_Types].xml', `PartName="/ppt/slides/slide1.xml" ContentType="${TYPES.slide}"`, 'PartName="/ppt/slides/slide1.xml" ContentType="image/png"')))
      .toEqual([`ppt/slides/slide1.xml: its content type is image/png, and a slide relationship needs ${TYPES.slide}`]);
  });

  it('finds an r:id that names nothing, two shapes with one id, and slide, master or layout ids PowerPoint would repair', () => {
    expect(problemsOf((parts) => swap(parts, 'ppt/slides/slide1.xml', '<a:blip r:embed="rId3"/>', '<a:blip r:embed="rId9"/>')))
      .toEqual(['ppt/slides/slide1.xml: <a:blip> r:embed="rId9" names none of the part\'s relationships']);
    expect(problemsOf((parts) => swap(parts, 'ppt/slides/slide1.xml', 'id="3" name="Click 1"', 'id="2" name="Click 1"'))).toEqual(['ppt/slides/slide1.xml: two shapes have id 2']);
    expect(problemsOf((parts) => swap(parts, 'ppt/presentation.xml', '<p:sldId id="256"', '<p:sldId id="12"'))).toEqual(['ppt/presentation.xml: slide id 12 is outside 256–2147483647']);
    expect(problemsOf((parts) => swap(parts, 'ppt/presentation.xml', '<p:sldId id="256"', '<p:sldId id="x"'))).toEqual(['ppt/presentation.xml: slide id x is outside 256–2147483647']);
    expect(problemsOf((parts) => swap(parts, 'ppt/presentation.xml', '<p:sldId id="257"', '<p:sldId id="256"'))).toEqual(['the id 256 is given twice']);
    expect(problemsOf((parts) => swap(parts, 'ppt/presentation.xml', 'sldMasterId id="2147483648"', 'sldMasterId id="5"'))).toEqual(['a master or layout id 5 is under 2147483648']);
    expect(problemsOf((parts) => swap(parts, 'ppt/slideMasters/slideMaster1.xml', 'sldLayoutId id="2147483649"', 'sldLayoutId id="2147483648"'))).toEqual(['the id 2147483648 is given twice']);
  });

  it('lists a slide its presentation names but cannot find as one without a part', () => {
    const { slides, problems } = checkPptx(tampered((parts) => swap(parts, 'ppt/presentation.xml', 'r:id="rId6"', 'r:id="rId99"')));
    expect(problems).toEqual(['ppt/presentation.xml: <p:sldId> r:id="rId99" names none of the part\'s relationships']);
    expect(slides[1]).toEqual({ part: null, title: null, notes: null, pictures: [], audio: [], advance: null });
  });
});

// The schemas are not in the repo (ECMA's to distribute): point STORYDECK_OOXML_SCHEMAS at a folder holding
// ISO-IEC29500-4_2016/ (pml.xsd, dml-main.xsd, …) and ecma/fouth-edition/ (opc-*.xsd) to validate every part.
const SCHEMAS = process.env.STORYDECK_OOXML_SCHEMAS;
const hasXmllint = spawnSync('xmllint', ['--version']).status === 0;
describe.skipIf(!SCHEMAS || !hasXmllint)('pptx parts · against the ECMA-376 schemas (STORYDECK_OOXML_SCHEMAS)', () => {
  let dir;
  beforeEach(() => { dir = mkdtempSync(path.join(tmpdir(), 'sd-xsd-')); });
  afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

  const schemaOf = (name) => (name.endsWith('.rels') ? 'ecma/fouth-edition/opc-relationships.xsd'
    : name === '[Content_Types].xml' ? 'ecma/fouth-edition/opc-contentTypes.xsd'
      : name === 'docProps/app.xml' ? 'ISO-IEC29500-4_2016/shared-documentPropertiesExtended.xsd'
        : name.startsWith('ppt/theme/') ? 'ISO-IEC29500-4_2016/dml-main.xsd'
          : name.startsWith('ppt/') ? 'ISO-IEC29500-4_2016/pml.xsd' : null);   // core.xml's schema imports Dublin Core from the web

  it('validates every part it can name a schema for', () => {
    const checked = [];
    for (const { name, data } of unzip(zip(pptxParts({ slides: SLIDES, title: 'Talk' })))) {
      const xsd = schemaOf(name);
      if (!/\.(xml|rels)$/.test(name) || !xsd) continue;
      const file = path.join(dir, name);
      mkdirSync(path.dirname(file), { recursive: true });
      writeFileSync(file, data);
      expect(existsSync(path.join(SCHEMAS, xsd)), xsd).toBe(true);
      const done = spawnSync('xmllint', ['--noout', '--schema', path.join(SCHEMAS, xsd), file], { encoding: 'utf8' });
      expect(done.stderr.trim(), name).toBe(`${file} validates`);
      checked.push(name);
    }
    expect(checked).toHaveLength(26);   // every XML part but core.xml
  });
});
