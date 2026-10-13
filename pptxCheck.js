// pptxCheck — read a .pptx back: what it holds, and anything known to make PowerPoint refuse or repair it. Node.
//
//   const { slides, problems } = checkPptx(readFileSync('talk.pptx'));
//   // slides: [{ part, title, notes, pictures, audio, advance }] in the presentation's order; problems: [] when sound
//
// What it vouches for, from the bytes alone: the ZIP reads (every entry matches its CRC-32); every XML part is
// well-formed and namespace-well-formed; every part has a content type and every override names a part; every
// relationship's target is in the package, with the content type its relationship needs; every r:id a part uses
// is one of its relationships; shape ids are unique on a slide; slide, master and layout ids are in PowerPoint's
// ranges and unique. It does not validate against the ECMA-376 schemas: a part can pass and still hold an element
// PowerPoint does not know.
import path from 'node:path';
import { unzip } from './zip.js';
import { parseXml, elements } from './xml.js';
import { RELS, TYPES } from './pptxParts.js';

const REL_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
/** The content type a relationship's target must carry, by the relationship's type. */
const TARGET_TYPE = {
  [RELS.document]: TYPES.presentation, [RELS.master]: TYPES.master, [RELS.layout]: TYPES.layout, [RELS.slide]: TYPES.slide, [RELS.notesMaster]: TYPES.notesMaster,
  [RELS.notes]: TYPES.notes, [RELS.theme]: TYPES.theme, [RELS.props]: TYPES.props, [RELS.core]: TYPES.core, [RELS.app]: TYPES.app,
};
const MASTER_IDS = 2147483648, LAST_SLIDE_ID = 2147483647, FIRST_SLIDE_ID = 256;

/** The part a relationships part speaks for ('ppt/slides/_rels/slide1.xml.rels' → 'ppt/slides/slide1.xml', the package's → ''); null outside a _rels folder. */
const sourceOf = (name) => {
  const m = /^(.*?)_rels\/([^/]*)\.rels$/.exec(name);
  return m ? m[1] + m[2] : null;
};
/** A relationship's target as a part name: from the package root, or from the folder of the part it belongs to. */
const resolve = (source, target) => (target.startsWith('/') ? target.slice(1) : path.posix.normalize(path.posix.join(path.posix.dirname(source || '.'), target)));
/** A part's extension as OPC reads it: after the last dot of its last segment, lower-cased ('_rels/.rels' → 'rels', which Node's extname calls none). */
const extensionOf = (name) => {
  const last = name.slice(name.lastIndexOf('/') + 1);
  return last.includes('.') ? last.slice(last.lastIndexOf('.') + 1).toLowerCase() : '';
};
/** The value of the attribute in the relationships namespace named `local` (r:id, r:embed, r:link), whatever its prefix. */
const relAttr = (el, local) => Object.entries(el.attrs).find(([key]) => key.endsWith(`:${local}`) && el.ns[key.slice(0, key.indexOf(':'))] === REL_NS)?.[1];

/** Every part's XML tree; a part that is not well-formed is a problem, and has no tree. */
function readTrees(parts, problems) {
  const trees = new Map();
  for (const [name, bytes] of parts) {
    if (!/\.(xml|rels)$/i.test(name)) continue;
    try { trees.set(name, parseXml(bytes.toString('utf8'))); } catch (e) { problems.push(`${name}: ${e.message}`); }
  }
  return trees;
}

/** The content type of each part, from [Content_Types].xml (overrides by name, defaults by extension); every part must have one. */
function contentTypes(parts, trees, problems) {
  const root = trees.get('[Content_Types].xml');
  if (!root) {
    if (!parts.has('[Content_Types].xml')) problems.push('[Content_Types].xml: missing — every package names its parts\' types there');
    return () => undefined;
  }
  const defaults = new Map(elements(root, 'Default').map((d) => [String(d.attrs.Extension).toLowerCase(), d.attrs.ContentType]));
  const overrides = new Map(elements(root, 'Override').map((o) => [o.attrs.PartName, o.attrs.ContentType]));
  for (const name of overrides.keys()) if (!parts.has(String(name).slice(1))) problems.push(`[Content_Types].xml: an override for ${name}, which is not in the package`);
  const typeOf = (name) => overrides.get(`/${name}`) ?? defaults.get(extensionOf(name));
  for (const name of parts.keys()) if (name !== '[Content_Types].xml' && !typeOf(name)) problems.push(`${name}: no content type — add a Default for its extension or an Override for it`);
  return typeOf;
}

/** One relationships part read: each relationship's id, type and target part, checked against the package. */
function relationshipsOf(name, root, parts, typeOf, problems) {
  const source = sourceOf(name), seen = new Set(), list = [];
  if (source && !parts.has(source)) problems.push(`${name}: speaks for ${source}, which is not in the package`);
  for (const r of elements(root, 'Relationship')) {
    const { Id: id, Type: type, Target: target, TargetMode: mode } = r.attrs;
    if (!id || !type || !target) { problems.push(`${name}: a relationship without an Id, a Type or a Target`); continue; }
    if (seen.has(id)) problems.push(`${name}: ${id} is given twice`);
    seen.add(id);
    if (mode === 'External') { list.push({ id, type, target, external: true }); continue; }
    const part = resolve(source, target);
    if (!parts.has(part)) problems.push(`${name}: ${id} points at ${part}, which is not in the package`);
    else if (TARGET_TYPE[type] && typeOf(part) !== TARGET_TYPE[type]) problems.push(`${part}: its content type is ${typeOf(part)}, and a ${type.split('/').pop()} relationship needs ${TARGET_TYPE[type]}`);
    list.push({ id, type, target: part });
  }
  return { source, list };
}

/** Every part's relationships (by the part they speak for; the package's under ''). */
function relationships(parts, trees, typeOf, problems) {
  const links = new Map();
  for (const [name, root] of trees) {
    if (!name.endsWith('.rels')) continue;
    if (sourceOf(name) === null) { problems.push(`${name}: a relationships part outside a _rels folder`); continue; }
    const { source, list } = relationshipsOf(name, root, parts, typeOf, problems);
    links.set(source, list);
  }
  return links;
}

/** In each part: every r:id / r:embed / r:link names one of its relationships, and no two shapes share an id. */
function references(trees, links, problems) {
  for (const [name, root] of trees) {
    if (name.endsWith('.rels') || name === '[Content_Types].xml') continue;
    const known = new Set((links.get(name) ?? []).map((r) => r.id)), shapes = new Set();
    for (const el of elements(root)) {
      for (const [key, value] of Object.entries(el.attrs)) {
        const prefix = key.includes(':') ? key.slice(0, key.indexOf(':')) : '';
        if (prefix && prefix !== 'xmlns' && el.ns[prefix] === REL_NS && value && !known.has(value)) problems.push(`${name}: <${el.name}> ${key}="${value}" names none of the part's relationships`);
      }
      if (el.name !== 'p:cNvPr') continue;
      if (shapes.has(el.attrs.id)) problems.push(`${name}: two shapes have id ${el.attrs.id}`);
      shapes.add(el.attrs.id);
    }
  }
}

/** Slide ids in [256, 2147483647], master and layout ids from 2147483648, each unique — PowerPoint repairs a file otherwise. */
function ids(trees, presentation, problems) {
  const slideIds = elements(presentation, 'p:sldId').map((s) => s.attrs.id);
  const masterIds = [...trees.values()].flatMap((root) => [...elements(root, 'p:sldMasterId'), ...elements(root, 'p:sldLayoutId')]).map((s) => s.attrs.id);
  const repeated = (list) => list.filter((id, k) => list.indexOf(id) !== k);
  const whole = (id) => /^\d+$/.test(id ?? '') ? Number(id) : NaN;
  for (const id of slideIds) if (!(whole(id) >= FIRST_SLIDE_ID && whole(id) <= LAST_SLIDE_ID)) problems.push(`ppt/presentation.xml: slide id ${id} is outside ${FIRST_SLIDE_ID}–${LAST_SLIDE_ID}`);
  for (const id of masterIds) if (!(whole(id) >= MASTER_IDS)) problems.push(`a master or layout id ${id} is under ${MASTER_IDS}`);
  for (const id of new Set([...repeated(slideIds), ...repeated(masterIds)])) problems.push(`the id ${id} is given twice`);
}

/** The text of the placeholder of one of `types` in a part: its paragraphs, one per line ('' when it has none; null without the part). */
function placeholderText(root, types) {
  if (!root) return null;
  const shape = elements(root, 'p:sp').find((sp) => elements(sp, 'p:ph').some((ph) => types.includes(ph.attrs.type ?? 'obj')));
  return shape ? elements(shape, 'a:p').map((p) => elements(p, 'a:t').map((t) => t.text).join('')).join('\n') : '';
}

/** What one slide holds: its title, its notes, its pictures and sound, and its own time (s, or null). */
function slideFacts(part, trees, links) {
  const root = trees.get(part), own = links.get(part) ?? [], advTm = root && elements(root, 'p:transition')[0]?.attrs.advTm;
  return {
    part: part ?? null,
    title: placeholderText(root, ['title', 'ctrTitle']),
    notes: placeholderText(trees.get(own.find((r) => r.type === RELS.notes)?.target), ['body']),
    pictures: own.filter((r) => r.type === RELS.image).map((r) => r.target),
    audio: own.filter((r) => r.type === RELS.audio).map((r) => r.target),
    advance: advTm === undefined || advTm === null ? null : Number(advTm) / 1000,
  };
}

/** The slides in the presentation's order, found through the package's officeDocument relationship. */
function slideList(trees, links, problems) {
  const doc = (links.get('') ?? []).find((r) => r.type === RELS.document);
  if (!doc) { problems.push('_rels/.rels: no officeDocument relationship — PowerPoint finds the presentation through it'); return []; }
  const presentation = trees.get(doc.target);
  if (!presentation) return [];   // missing or not well-formed: a problem already
  ids(trees, presentation, problems);
  const byId = new Map((links.get(doc.target) ?? []).map((r) => [r.id, r.target]));
  return elements(presentation, 'p:sldId').map((s) => slideFacts(byId.get(relAttr(s, 'id')), trees, links));
}

/**
 * A .pptx read back: { slides, problems }. `slides` lists each slide in the presentation's order — { part, title,
 * notes (its paragraphs, one per line), pictures and audio (media part names), advance (s, or null) }; `problems`
 * names everything that would make PowerPoint refuse or repair the file ([] when there is none).
 */
export function checkPptx(data) {
  let entries;
  try { entries = unzip(data); } catch (e) { return { slides: [], problems: [e.message] }; }
  const problems = [], parts = new Map(entries.filter((e) => !e.name.endsWith('/')).map((e) => [e.name, e.data]));
  const trees = readTrees(parts, problems), typeOf = contentTypes(parts, trees, problems), links = relationships(parts, trees, typeOf, problems);
  references(trees, links, problems);
  const slides = slideList(trees, links, problems);
  return { slides, problems: [...new Set(problems)] };   // a part two relationships point at is named once
}
