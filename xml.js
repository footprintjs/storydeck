// xml — a small, strict XML reader: enough to vouch that a part is well-formed and to read what a check needs.
//
//   const root = parseXml(text);   // → { name, attrs, ns, children, text } — or a throw naming the line and what is wrong
//
// Well-formed means: one root; every tag closed, in order; attributes quoted, none twice; `&` only as one of the
// five named entities or a character reference; no control characters; no DOCTYPE (Office Open XML has none);
// and every prefix, on an element or an attribute, declared in scope (namespace-well-formed — an undeclared
// prefix is what makes PowerPoint call a file corrupt). Names are ASCII, as every Office part's are.
const NAME = '[A-Za-z_][\\w.-]*(?::[A-Za-z_][\\w.-]*)?';
const START = new RegExp(`<(${NAME})((?:\\s+${NAME}\\s*=\\s*(?:"[^<"]*"|'[^<']*'))*)\\s*(/?)>`, 'y');
const CLOSE = new RegExp(`</(${NAME})\\s*>`, 'y');
const ATTR = new RegExp(`(${NAME})\\s*=\\s*(?:"([^<"]*)"|'([^<']*)')`, 'g');
const NAMED = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/;
const XML_NS = 'http://www.w3.org/XML/1998/namespace';

/** A character XML 1.0 allows (a character reference must name one). */
const allowed = (c) => c === 0x9 || c === 0xa || c === 0xd || (c >= 0x20 && c <= 0xd7ff) || (c >= 0xe000 && c <= 0xfffd) || (c >= 0x10000 && c <= 0x10ffff);

/** Text or an attribute value with its references read; `fail` on a bare `&`, an unknown entity or a bad character. */
function decode(s, fail) {
  if (CONTROL.test(s)) fail('a control character');
  return s.replace(/&([^;&]*)(;?)/g, (all, body, semi) => {
    if (!semi) fail(`a bare & ("${all.slice(0, 12)}")`);
    if (NAMED[body]) return NAMED[body];
    const m = /^#(?:(\d+)|x([0-9a-fA-F]+))$/.exec(body), code = m ? (m[1] ? Number(m[1]) : parseInt(m[2], 16)) : NaN;
    if (!m) fail(`an unknown entity &${body};`);
    if (!allowed(code)) fail(`&${body}; names no XML character`);
    return String.fromCodePoint(code);
  });
}

/** The prefix of a qualified name ('' for none). */
const prefixOf = (name) => (name.includes(':') ? name.slice(0, name.indexOf(':')) : '');

/** An element from its start tag: its attributes read, its namespaces in scope, its prefixes checked. */
function element(name, source, parent, fail) {
  const attrs = {}, ns = Object.create(parent ? parent.ns : { xml: XML_NS });
  for (const [, key, dq, sq] of source.matchAll(ATTR)) {
    if (Object.hasOwn(attrs, key)) fail(`<${name}> has ${key} twice`);
    attrs[key] = decode(dq ?? sq, fail);
    if (key === 'xmlns') ns[''] = attrs[key];
    else if (key.startsWith('xmlns:')) ns[key.slice(6)] = attrs[key];
  }
  const declared = (prefix) => prefix === '' || prefix === 'xmlns' || ns[prefix] !== undefined;
  if (!declared(prefixOf(name))) fail(`<${name}>: the prefix ${prefixOf(name)} is not declared`);
  for (const key of Object.keys(attrs)) if (!declared(prefixOf(key))) fail(`<${name}> ${key}: the prefix ${prefixOf(key)} is not declared`);
  return { name, attrs, ns, children: [], text: '' };
}

/** "line l, column c" of an offset, for a refusal a person can find. */
function where(text, at) {
  const before = text.slice(0, at), line = before.split('\n').length;
  return `line ${line}, column ${at - before.lastIndexOf('\n')}`;
}

/** The markup that is not an element at `i` — a comment, CDATA, a processing instruction — and where it ends; null for a tag. */
function special(text, i, fail) {
  const block = (open, close, what) => {
    if (!text.startsWith(open, i)) return null;
    const end = text.indexOf(close, i + open.length);
    if (end < 0) fail(`${what} that never ends`);
    return { body: text.slice(i + open.length, end), next: end + close.length, cdata: open === '<![CDATA[' };
  };
  const found = block('<!--', '-->', 'a comment') ?? block('<![CDATA[', ']]>', 'a CDATA section') ?? block('<?', '?>', 'a processing instruction');
  if (!found && text.startsWith('<!', i)) fail('a DOCTYPE or other declaration (Office Open XML has none)');
  return found;
}

/**
 * The element tree of an XML document: { name, attrs, ns (prefix → URI in scope), children, text (its own character
 * data) } for the root and each element under it. Throws `not well-formed at line l, column c: what` otherwise.
 */
export function parseXml(text) {
  const stack = [];
  let root = null, i = text.charCodeAt(0) === 0xfeff ? 1 : 0;
  const fail = (what) => { throw new Error(`not well-formed at ${where(text, i)}: ${what}`); };
  const characters = (s) => {
    if (stack.length) stack.at(-1).text += decode(s, fail);
    else if (s.trim()) fail(`text outside the root ("${s.trim().slice(0, 20)}")`);
  };
  while (i < text.length) {
    const lt = text.indexOf('<', i);
    characters(text.slice(i, lt < 0 ? text.length : lt));
    if (lt < 0) break;
    i = lt;
    const other = special(text, i, fail);
    if (other) {
      if (other.cdata) { if (!stack.length) fail('CDATA outside the root'); stack.at(-1).text += other.body; }
      i = other.next;
      continue;
    }
    CLOSE.lastIndex = START.lastIndex = i;
    const close = CLOSE.exec(text);
    if (close) {
      const open = stack.pop();
      if (open?.name !== close[1]) fail(`</${close[1]}> closes ${open ? `<${open.name}>` : 'nothing'}`);
      i += close[0].length;
      continue;
    }
    const tag = START.exec(text);
    if (!tag) fail('a broken tag');
    if (root && !stack.length) fail(`a second root, <${tag[1]}>`);
    const el = element(tag[1], tag[2], stack.at(-1), fail);
    if (root) stack.at(-1).children.push(el); else root = el;
    if (!tag[3]) stack.push(el);
    i += tag[0].length;
  }
  if (!root) fail('no root element');
  if (stack.length) fail(`<${stack.at(-1).name}> is never closed`);
  return root;
}

/** Every element under `el` (itself included) named `name` — or every element, without a name — in document order. */
export function elements(el, name) {
  const found = [], todo = [el];
  while (todo.length) {
    const next = todo.pop();
    if (name === undefined || next.name === name) found.push(next);
    for (let k = next.children.length - 1; k >= 0; k--) todo.push(next.children[k]);
  }
  return found;
}
