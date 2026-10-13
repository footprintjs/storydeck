// pptxParts — a deck's pictures, notes and sound as the parts of a PowerPoint file (PresentationML, ECMA-376). Node.
//
//   const parts = pptxParts({ slides: [{ title, notes, picture, audio, advance }], title: 'My talk' });
//   writeFileSync('talk.pptx', zip(parts));   // zip: footprint-storydeck/pptx
//
// One slide per entry: its picture full-bleed (a PNG, 16:9), its notes as the speaker notes, its title in the
// title placeholder just above the slide — off the page, so the outline, the slide list and a screen reader read
// it and nobody sees it (Microsoft's own advice for a slide whose title is in the picture) — and a fade. A slide
// with `audio` carries it (a .wav, .m4a or .mp3) playing as the slide starts, its icon off the page too; one with
// `advance` (s) moves on by itself. The part set is a minimal one, each part valid against the ECMA-376 schemas:
// content types, package and part relationships, the presentation and its properties, one slide master, one layout
// (title only), a theme for each master, the slides, a notes master and a notes slide per slide, the media, docProps.
import { Buffer } from 'node:buffer';
import { deflateSync } from 'node:zlib';
import { crc32 } from './zip.js';

const NS = 'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"';
const HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const CT = 'application/vnd.openxmlformats-officedocument.presentationml';
/** The relationship types the parts use (the media one is PowerPoint 2010's, beside the standard audio link). */
export const RELS = {
  document: `${REL}/officeDocument`, core: 'http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties', app: `${REL}/extended-properties`,
  master: `${REL}/slideMaster`, layout: `${REL}/slideLayout`, slide: `${REL}/slide`, notesMaster: `${REL}/notesMaster`, notes: `${REL}/notesSlide`,
  theme: `${REL}/theme`, props: `${REL}/presProps`, image: `${REL}/image`, audio: `${REL}/audio`, media: 'http://schemas.microsoft.com/office/2007/relationships/media',
};
/** The content type each kind of part must carry. */
export const TYPES = {
  presentation: `${CT}.presentation.main+xml`, master: `${CT}.slideMaster+xml`, layout: `${CT}.slideLayout+xml`, slide: `${CT}.slide+xml`,
  notesMaster: `${CT}.notesMaster+xml`, notes: `${CT}.notesSlide+xml`, props: `${CT}.presProps+xml`, theme: 'application/vnd.openxmlformats-officedocument.theme+xml',
  core: 'application/vnd.openxmlformats-package.core-properties+xml', app: 'application/vnd.openxmlformats-officedocument.extended-properties+xml',
  rels: 'application/vnd.openxmlformats-package.relationships+xml',
};
/** The sound a slide can carry, by extension: what PowerPoint plays on Windows and on a Mac. */
export const AUDIO = { wav: 'audio/wav', m4a: 'audio/mp4', mp3: 'audio/mpeg' };

/** The slide (16:9, 13.333 × 7.5 in) and the notes page, in EMU. */
const W = 12192000, H = 6858000, ICON = 457200;
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const NOT_XML = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;
const ESCAPE = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' };

/** Text an XML part can hold: the characters XML 1.0 forbids (controls, a lone surrogate) left out. */
export const plainText = (s) => String(s ?? '').replace(NOT_XML, '');
/** Text escaped for XML content or an attribute value. */
const esc = (s) => plainText(s).replace(/[&<>"']/g, (c) => ESCAPE[c]);

/** A PNG's width and height, or null when the bytes are not a PNG. */
export function pngSize(bytes) {
  if (!bytes || bytes.length < 24 || !PNG.equals(Buffer.from(bytes.subarray(0, 8))) || Buffer.from(bytes.subarray(12, 16)).toString('latin1') !== 'IHDR') return null;
  const view = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: view.readUInt32BE(16), height: view.readUInt32BE(20) };
}

/** A PNG of one colour (8-bit RGB): the audio icon, and a test's stand-in picture. */
export function solidPng(width, height, [r, g, b] = [0, 0, 0]) {
  const row = Buffer.alloc(1 + width * 3);
  for (let x = 0; x < width; x++) row.set([r, g, b], 1 + x * 3);
  const chunk = (type, data) => {
    const head = Buffer.alloc(4), body = Buffer.concat([Buffer.from(type, 'latin1'), data]), crc = Buffer.alloc(4);
    head.writeUInt32BE(data.length); crc.writeUInt32BE(crc32(body));
    return Buffer.concat([head, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr.set([8, 2, 0, 0, 0], 8);
  return Buffer.concat([PNG, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(Buffer.concat(Array.from({ length: height }, () => row)))), chunk('IEND', Buffer.alloc(0))]);
}

/** A relationships part: [id, type, target] each. */
const rels = (list) => `${HEAD}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${list.map(([id, type, target]) => `<Relationship Id="${id}" Type="${type}" Target="${esc(target)}"/>`).join('')}</Relationships>`;
/** The empty group every shape tree starts with. */
const GROUP = '<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>';
const CLR_MAP = '<p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>';
const xfrm = (x, y, cx, cy) => `<a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm>`;
const RECT = '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>';
/** Paragraphs of text, one per line; an empty text is one empty paragraph. */
const paragraphs = (text, lang) => plainText(text).split(/\r?\n/).map((line) => (line ? `<a:p><a:r><a:rPr lang="${lang}" dirty="0"/><a:t>${esc(line)}</a:t></a:r></a:p>` : `<a:p><a:endParaRPr lang="${lang}"/></a:p>`)).join('');
/** A placeholder shape: its id, name, placeholder tag, shape properties and (optionally) text. */
const placeholder = (id, name, ph, spPr, body = '') => `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${name}"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr>${ph}</p:nvPr></p:nvSpPr><p:spPr>${spPr}</p:spPr>${body && `<p:txBody><a:bodyPr/><a:lstStyle/>${body}</p:txBody>`}</p:sp>`;

const color = (name, rgb) => `<a:${name}><a:srgbClr val="${rgb}"/></a:${name}>`;
const three = (s) => s + s + s;
/** A plain theme: the twelve colours, one typeface, and the three-of-each style lists the schema asks for. */
const THEME = `${HEAD}<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="StoryDeck"><a:themeElements>`
  + `<a:clrScheme name="StoryDeck">${color('dk1', '000000')}${color('lt1', 'FFFFFF')}${color('dk2', '1F2937')}${color('lt2', 'E5E7EB')}`
  + `${color('accent1', '2563EB')}${color('accent2', 'D97706')}${color('accent3', '059669')}${color('accent4', 'DC2626')}${color('accent5', '7C3AED')}${color('accent6', '0891B2')}`
  + `${color('hlink', '2563EB')}${color('folHlink', '7C3AED')}</a:clrScheme>`
  + `<a:fontScheme name="StoryDeck">${['majorFont', 'minorFont'].map((f) => `<a:${f}><a:latin typeface="Calibri"/><a:ea typeface=""/><a:cs typeface=""/></a:${f}>`).join('')}</a:fontScheme>`
  + `<a:fmtScheme name="StoryDeck"><a:fillStyleLst>${three('<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>')}</a:fillStyleLst>`
  + `<a:lnStyleLst>${[6350, 12700, 19050].map((w) => `<a:ln w="${w}"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln>`).join('')}</a:lnStyleLst>`
  + `<a:effectStyleLst>${three('<a:effectStyle><a:effectLst/></a:effectStyle>')}</a:effectStyleLst>`
  + `<a:bgFillStyleLst>${three('<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>')}</a:bgFillStyleLst></a:fmtScheme>`
  + '</a:themeElements><a:objectDefaults/><a:extraClrSchemeLst/></a:theme>';

const level = (sz) => `<a:lvl1pPr><a:defRPr sz="${sz}"><a:solidFill><a:schemeClr val="tx1"/></a:solidFill><a:latin typeface="+mn-lt"/></a:defRPr></a:lvl1pPr>`;
/** The slide master: a black page, the title placeholder at the top, its one layout. */
const MASTER = `${HEAD}<p:sldMaster ${NS}><p:cSld><p:bg><p:bgPr><a:solidFill><a:srgbClr val="000000"/></a:solidFill><a:effectLst/></p:bgPr></p:bg><p:spTree>${GROUP}`
  + placeholder(2, 'Title Placeholder 1', '<p:ph type="title"/>', xfrm(838200, 365125, 10515600, 1325563) + RECT, '<a:p><a:endParaRPr lang="en-US"/></a:p>')
  + `</p:spTree></p:cSld>${CLR_MAP}<p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst>`
  + `<p:txStyles><p:titleStyle>${level(4400)}</p:titleStyle><p:bodyStyle>${level(2800)}</p:bodyStyle><p:otherStyle>${level(1800)}</p:otherStyle></p:txStyles></p:sldMaster>`;
/** The one layout: a title, nothing else (the picture is the slide). */
const LAYOUT = `${HEAD}<p:sldLayout ${NS} type="titleOnly" preserve="1"><p:cSld name="Title Only"><p:spTree>${GROUP}`
  + placeholder(2, 'Title 1', '<p:ph type="title"/>', '', '<a:p><a:endParaRPr lang="en-US"/></a:p>')
  + '</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>';

/** The notes master: the slide's image above, the notes below, on a portrait page. */
function notesMaster(lang) {
  return `${HEAD}<p:notesMaster ${NS}><p:cSld><p:bg><p:bgRef idx="1001"><a:schemeClr val="bg1"/></p:bgRef></p:bg><p:spTree>${GROUP}`
    + `<p:sp><p:nvSpPr><p:cNvPr id="2" name="Slide Image Placeholder 1"/><p:cNvSpPr><a:spLocks noGrp="1" noRot="1" noChangeAspect="1"/></p:cNvSpPr><p:nvPr><p:ph type="sldImg"/></p:nvPr></p:nvSpPr>`
    + `<p:spPr>${xfrm(685800, 1143000, 5486400, 3086100)}${RECT}<a:noFill/><a:ln w="12700"><a:solidFill><a:schemeClr val="tx1"/></a:solidFill></a:ln></p:spPr></p:sp>`
    + placeholder(3, 'Notes Placeholder 2', '<p:ph type="body" idx="1"/>', xfrm(685800, 4400550, 5486400, 3600450) + RECT, `<a:p><a:endParaRPr lang="${lang}"/></a:p>`)
    + `</p:spTree></p:cSld>${CLR_MAP}<p:notesStyle>${level(1200)}</p:notesStyle></p:notesMaster>`;
}

/** A slide's notes page: the slide's image and its notes. */
function notesSlide(notes, lang) {
  return `${HEAD}<p:notes ${NS}><p:cSld><p:spTree>${GROUP}`
    + `<p:sp><p:nvSpPr><p:cNvPr id="2" name="Slide Image Placeholder 1"/><p:cNvSpPr><a:spLocks noGrp="1" noRot="1" noChangeAspect="1"/></p:cNvSpPr><p:nvPr><p:ph type="sldImg"/></p:nvPr></p:nvSpPr><p:spPr/></p:sp>`
    + placeholder(3, 'Notes Placeholder 2', '<p:ph type="body" idx="1"/>', '', paragraphs(notes, lang))
    + '</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:notes>';
}

/** The picture, full-bleed; its alternative text is the notes (what the click is about, in words), else the title. */
const picture = (s, n) => `<p:pic><p:nvPicPr><p:cNvPr id="3" name="Click ${n}" descr="${esc((s.notes || s.title).replace(/\s+/g, ' '))}"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr>`
  + `<p:blipFill><a:blip r:embed="rId3"/><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr>${xfrm(0, 0, W, H)}${RECT}</p:spPr></p:pic>`;

/** The sound: an audio object (the standard link and PowerPoint 2010's embed, both to one media part), its icon off the page. */
const sound = () => '<p:pic><p:nvPicPr><p:cNvPr id="4" name="Narration"><a:hlinkClick r:id="" action="ppaction://media"/></p:cNvPr><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr>'
  + '<p:nvPr><a:audioFile r:link="rId4"/><p:extLst><p:ext uri="{DAA4B4D4-6D71-4841-9C94-3DA25DB4D4E1}"><p14:media xmlns:p14="http://schemas.microsoft.com/office/powerpoint/2010/main" r:embed="rId5"/></p:ext></p:extLst></p:nvPr></p:nvPicPr>'
  + `<p:blipFill><a:blip r:embed="rId6"/><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr>${xfrm(-ICON - 152400, 0, ICON, ICON)}${RECT}</p:spPr></p:pic>`;

/** The timing that plays the sound (shape 4) as the slide starts — "Start: Automatically" — for `ms`. */
const playing = (ms) => '<p:timing><p:tnLst><p:par><p:cTn id="1" dur="indefinite" restart="never" nodeType="tmRoot"><p:childTnLst>'
  + '<p:seq concurrent="1" nextAc="seek"><p:cTn id="2" dur="indefinite" nodeType="mainSeq"><p:childTnLst>'
  + '<p:par><p:cTn id="3" fill="hold"><p:stCondLst><p:cond delay="indefinite"/><p:cond evt="onBegin" delay="0"><p:tn val="2"/></p:cond></p:stCondLst><p:childTnLst>'
  + '<p:par><p:cTn id="4" fill="hold"><p:stCondLst><p:cond delay="0"/></p:stCondLst><p:childTnLst>'
  + '<p:par><p:cTn id="5" presetID="1" presetClass="mediacall" presetSubtype="0" fill="hold" nodeType="afterEffect"><p:stCondLst><p:cond delay="0"/></p:stCondLst><p:childTnLst>'
  + `<p:cmd type="call" cmd="playFrom(0.0)"><p:cBhvr><p:cTn id="6" dur="${ms}" fill="hold"/><p:tgtEl><p:spTgt spid="4"/></p:tgtEl></p:cBhvr></p:cmd>`
  + '</p:childTnLst></p:cTn></p:par></p:childTnLst></p:cTn></p:par></p:childTnLst></p:cTn></p:par>'
  + '</p:childTnLst></p:cTn><p:prevCondLst><p:cond evt="onPrev" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:prevCondLst>'
  + '<p:nextCondLst><p:cond evt="onNext" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:nextCondLst></p:seq>'
  + '<p:audio><p:cMediaNode vol="80000"><p:cTn id="7" fill="hold" display="0"><p:stCondLst><p:cond delay="indefinite"/></p:stCondLst></p:cTn><p:tgtEl><p:spTgt spid="4"/></p:tgtEl></p:cMediaNode></p:audio>'
  + '</p:childTnLst></p:cTn></p:par></p:tnLst></p:timing>';

/** One slide: the title just above the page, the picture, the sound; a fade, and its own time when it advances by itself. */
function slide(s, n) {
  const title = placeholder(2, 'Title 1', '<p:ph type="title"/>', xfrm(0, -1143000, W, 1143000), paragraphs(s.title.replace(/\s+/g, ' '), s.lang));
  const advance = s.advance == null ? '' : ` advTm="${Math.round(s.advance * 1000)}"`;
  return `${HEAD}<p:sld ${NS}><p:cSld><p:spTree>${GROUP}${title}${picture(s, n)}${s.audio ? sound() : ''}</p:spTree></p:cSld>`
    + `<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr><p:transition spd="med"${advance}><p:fade/></p:transition>`
    + `${s.audio ? playing(Math.round(s.audio.duration * 1000)) : ''}</p:sld>`;
}

/** The presentation: its master, notes master and slides, a 16:9 page. */
const presentation = (count) => `${HEAD}<p:presentation ${NS}><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst>`
  + '<p:notesMasterIdLst><p:notesMasterId r:id="rId2"/></p:notesMasterIdLst>'
  + `<p:sldIdLst>${Array.from({ length: count }, (_, i) => `<p:sldId id="${256 + i}" r:id="rId${5 + i}"/>`).join('')}</p:sldIdLst>`
  + `<p:sldSz cx="${W}" cy="${H}"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>`;

const core = (title) => `${HEAD}<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">${title ? `<dc:title>${esc(title)}</dc:title>` : ''}</cp:coreProperties>`;
const app = (count, clips) => `${HEAD}<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">`
  + `<Application>footprint-storydeck</Application><PresentationFormat>Widescreen</PresentationFormat><Slides>${count}</Slides><Notes>${count}</Notes><MMClips>${clips}</MMClips></Properties>`;

/** Every part's content type: by extension for the media and relationships, by name for each XML part. */
function contentTypes(parts, audioTypes) {
  const kinds = [[/^ppt\/presentation\.xml$/, TYPES.presentation], [/^ppt\/slideMasters\//, TYPES.master], [/^ppt\/slideLayouts\//, TYPES.layout], [/^ppt\/slides\//, TYPES.slide],
    [/^ppt\/notesMasters\//, TYPES.notesMaster], [/^ppt\/notesSlides\//, TYPES.notes], [/^ppt\/theme\//, TYPES.theme], [/^ppt\/presProps\.xml$/, TYPES.props],
    [/^docProps\/core\.xml$/, TYPES.core], [/^docProps\/app\.xml$/, TYPES.app]];
  const overrides = parts.filter((p) => p.name.endsWith('.xml')).map((p) => `<Override PartName="/${p.name}" ContentType="${kinds.find(([re]) => re.test(p.name))[1]}"/>`);
  const defaults = [['rels', TYPES.rels], ['xml', 'application/xml'], ['png', 'image/png'], ...audioTypes].map(([ext, type]) => `<Default Extension="${ext}" ContentType="${type}"/>`);
  return `${HEAD}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">${defaults.join('')}${overrides.join('')}</Types>`;
}

/** A slide as given, checked: a PNG picture, sound PowerPoint plays with its length, an advance that is a time. */
function checked(s, n, lang) {
  const where = `pptxParts: slide ${n}`;
  if (!pngSize(s.picture)) throw new TypeError(`${where}: its picture is not a PNG — give the PNG's bytes (a screenshot saved as .png)`);
  if (s.audio) {
    if (!AUDIO[s.audio.ext]) throw new TypeError(`${where}: its sound is .${s.audio.ext} — give .wav, .m4a or .mp3 (convert it with ffmpeg)`);
    if (!(s.audio.duration > 0) || !Number.isFinite(s.audio.duration)) throw new TypeError(`${where}: its sound has no length (duration ${s.audio.duration}) — give its duration in seconds`);
    if (!s.audio.data?.length) throw new TypeError(`${where}: its sound has no bytes — give the audio file's bytes as data`);
  }
  if (s.advance != null && !(s.advance >= 0 && Number.isFinite(s.advance))) throw new TypeError(`${where}: advance ${s.advance} is not a time — give seconds (0 or more), or null to wait for a click`);
  return { ...s, title: plainText(s.title).trim() || `Slide ${n}`, notes: plainText(s.notes), lang };
}

/**
 * The parts of a .pptx, [{ name, data }] with [Content_Types].xml first — hand them to `zip`. `slides`: { title,
 * notes, picture (PNG bytes), audio?: { data, ext: 'wav' | 'm4a' | 'mp3', duration (s), key? }, advance? (s) } each;
 * slides whose audio has the same `key` share one media part. `title` names the file (docProps); `lang` tags the text.
 */
export function pptxParts({ slides, title = '', lang = 'en-US' }) {
  if (!slides?.length) throw new TypeError('pptxParts: no slides — give one { title, notes, picture } per click');
  const list = slides.map((s, i) => checked(s, i + 1, lang)), media = new Map(), parts = [], slideRels = [];
  const add = (name, data) => parts.push({ name, data });
  add('ppt/media/icon.png', solidPng(48, 48, [37, 99, 235]));
  list.forEach((s, i) => {
    const n = i + 1, image = `image${n}.png`;
    add(`ppt/media/${image}`, s.picture);
    const own = [['rId1', RELS.layout, '../slideLayouts/slideLayout1.xml'], ['rId2', RELS.notes, `../notesSlides/notesSlide${n}.xml`], ['rId3', RELS.image, `../media/${image}`]];
    if (s.audio) {
      const key = s.audio.key ?? `slide ${n}`;
      if (!media.has(key)) { media.set(key, `media${media.size + 1}.${s.audio.ext}`); add(`ppt/media/${media.get(key)}`, s.audio.data); }
      own.push(['rId4', RELS.audio, `../media/${media.get(key)}`], ['rId5', RELS.media, `../media/${media.get(key)}`], ['rId6', RELS.image, '../media/icon.png']);
    }
    slideRels.push(own);
  });
  const xml = [
    ['ppt/presentation.xml', presentation(list.length)],
    ['ppt/_rels/presentation.xml.rels', rels([['rId1', RELS.master, 'slideMasters/slideMaster1.xml'], ['rId2', RELS.notesMaster, 'notesMasters/notesMaster1.xml'],
      ['rId3', RELS.theme, 'theme/theme1.xml'], ['rId4', RELS.props, 'presProps.xml'], ...list.map((_, i) => [`rId${5 + i}`, RELS.slide, `slides/slide${i + 1}.xml`])])],
    ['ppt/presProps.xml', `${HEAD}<p:presentationPr ${NS}/>`],
    ['ppt/slideMasters/slideMaster1.xml', MASTER],
    ['ppt/slideMasters/_rels/slideMaster1.xml.rels', rels([['rId1', RELS.layout, '../slideLayouts/slideLayout1.xml'], ['rId2', RELS.theme, '../theme/theme1.xml']])],
    ['ppt/slideLayouts/slideLayout1.xml', LAYOUT],
    ['ppt/slideLayouts/_rels/slideLayout1.xml.rels', rels([['rId1', RELS.master, '../slideMasters/slideMaster1.xml']])],
    ['ppt/notesMasters/notesMaster1.xml', notesMaster(lang)],
    ['ppt/notesMasters/_rels/notesMaster1.xml.rels', rels([['rId1', RELS.theme, '../theme/theme2.xml']])],
    ['ppt/theme/theme1.xml', THEME],
    ['ppt/theme/theme2.xml', THEME],
    ...list.flatMap((s, i) => [
      [`ppt/slides/slide${i + 1}.xml`, slide(s, i + 1)],
      [`ppt/slides/_rels/slide${i + 1}.xml.rels`, rels(slideRels[i])],
      [`ppt/notesSlides/notesSlide${i + 1}.xml`, notesSlide(s.notes, lang)],
      [`ppt/notesSlides/_rels/notesSlide${i + 1}.xml.rels`, rels([['rId1', RELS.notesMaster, '../notesMasters/notesMaster1.xml'], ['rId2', RELS.slide, `../slides/slide${i + 1}.xml`]])],
    ]),
    ['docProps/core.xml', core(title)],
    ['docProps/app.xml', app(list.length, list.filter((s) => s.audio).length)],
  ].map(([name, data]) => ({ name, data }));
  const audioTypes = [...new Set(list.filter((s) => s.audio).map((s) => s.audio.ext))].map((ext) => [ext, AUDIO[ext]]);
  const packageRels = rels([['rId1', RELS.document, 'ppt/presentation.xml'], ['rId2', RELS.core, 'docProps/core.xml'], ['rId3', RELS.app, 'docProps/app.xml']]);
  const all = [{ name: '_rels/.rels', data: packageRels }, ...xml, ...parts];
  return [{ name: '[Content_Types].xml', data: contentTypes(all, audioTypes) }, ...all];
}
