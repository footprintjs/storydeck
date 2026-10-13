// zip — the smallest ZIP a .pptx needs: written and read back with node:zlib's raw deflate and a CRC-32. Node.
//
//   const data = zip([{ name: '[Content_Types].xml', data: xml }, { name: 'ppt/media/image1.png', data: png }]);
//   unzip(data)   // → [{ name, data }] in the archive's order, each checked against its CRC-32
//
// No ZIP64, no encryption, no folders: an entry is a name and its bytes. Every entry carries the same date
// (1980-01-01, ZIP's first), so the same parts make the same bytes. An entry is deflated when that makes it
// smaller and stored when it does not (a PNG, an .m4a). A name with a letter outside ASCII is flagged UTF-8.
import { Buffer } from 'node:buffer';
import { deflateRawSync, inflateRawSync } from 'node:zlib';

const LOCAL = 0x04034b50, CENTRAL = 0x02014b50, END = 0x06054b50;
const STORE = 0, DEFLATE = 8, UTF8 = 0x800, VERSION = 20, DOS_DATE = (0 << 9) | (1 << 5) | 1;
const LIMIT = 0xffffffff, MAX_ENTRIES = 0xffff;

const TABLE = Uint32Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

/** The CRC-32 of some bytes (ZIP's and PNG's: polynomial 0xEDB88320). */
export function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** Bytes as a Buffer: a string is UTF-8; a Buffer or any other view keeps its bytes (never copied). */
const bytesOf = (data) => (typeof data === 'string' ? Buffer.from(data, 'utf8') : Buffer.isBuffer(data) ? data : Buffer.from(data.buffer, data.byteOffset, data.byteLength));

/** Refuses a name a ZIP reader could take for a folder, a path out of the archive, or another entry. */
function checkName(name, seen) {
  if (typeof name !== 'string' || !name || name.startsWith('/') || name.endsWith('/') || name.includes('\\') || name.split('/').some((s) => s === '..' || s === '.' || !s)) {
    throw new TypeError(`zip: "${name}" is not an entry name — write it relative, with forward slashes, like ppt/slides/slide1.xml`);
  }
  if (seen.has(name)) throw new TypeError(`zip: "${name}" is given twice — an archive holds each name once`);
  seen.add(name);
}

/** One entry, compressed when that helps: its body, method and the facts both headers repeat. */
function packed(name, data) {
  const raw = bytesOf(data), deflated = deflateRawSync(raw), deflate = deflated.length < raw.length;
  const body = deflate ? deflated : raw;
  if (raw.length >= LIMIT) throw new RangeError(`zip: "${name}" is 4 GB or more — ZIP64 is not written; export fewer clicks (\`only\`)`);
  return { name: Buffer.from(name, 'utf8'), body, method: deflate ? DEFLATE : STORE, crc: crc32(raw), size: raw.length, flags: /[^\x00-\x7f]/.test(name) ? UTF8 : 0 };
}

/** The header fields both the local and the central header carry, from `version needed` on. */
function shared(buf, at, e) {
  buf.writeUInt16LE(VERSION, at); buf.writeUInt16LE(e.flags, at + 2); buf.writeUInt16LE(e.method, at + 4);
  buf.writeUInt16LE(0, at + 6); buf.writeUInt16LE(DOS_DATE, at + 8);
  buf.writeUInt32LE(e.crc, at + 10); buf.writeUInt32LE(e.body.length, at + 14); buf.writeUInt32LE(e.size, at + 18);
  buf.writeUInt16LE(e.name.length, at + 22);
}

function localHeader(e) {
  const buf = Buffer.alloc(30);
  buf.writeUInt32LE(LOCAL, 0); shared(buf, 4, e);
  return buf;
}

function centralHeader(e, offset) {
  const buf = Buffer.alloc(46);
  buf.writeUInt32LE(CENTRAL, 0); buf.writeUInt16LE(VERSION, 4); shared(buf, 6, e);
  buf.writeUInt32LE(offset, 42);
  return buf;
}

function endRecord(count, size, offset) {
  const buf = Buffer.alloc(22);
  buf.writeUInt32LE(END, 0); buf.writeUInt16LE(count, 8); buf.writeUInt16LE(count, 10);
  buf.writeUInt32LE(size, 12); buf.writeUInt32LE(offset, 16);
  return buf;
}

/**
 * A ZIP archive of `entries` ({ name, data }: data a string, written as UTF-8, or bytes), in the order given.
 * Refuses a bad or repeated name, and an archive ZIP64 would be needed for (4 GB, or 65,535 entries).
 */
export function zip(entries) {
  if (entries.length > MAX_ENTRIES) throw new RangeError(`zip: ${entries.length} entries is over ${MAX_ENTRIES} — ZIP64 is not written; export fewer clicks (\`only\`)`);
  const seen = new Set(), body = [], central = [];
  let offset = 0;
  for (const { name, data } of entries) {
    checkName(name, seen);
    const e = packed(name, data);
    if (offset + 30 + e.name.length + e.body.length >= LIMIT) throw new RangeError('zip: the archive reaches 4 GB — ZIP64 is not written; export fewer clicks (`only`)');
    central.push(centralHeader(e, offset), e.name);
    body.push(localHeader(e), e.name, e.body);
    offset += 30 + e.name.length + e.body.length;
  }
  const directory = Buffer.concat(central);
  return Buffer.concat([...body, directory, endRecord(entries.length, directory.length, offset)]);
}

/** Where the end-of-central-directory record starts, or -1 (it is in the last 22 bytes, plus a comment of up to 64 KB). */
function findEnd(buf) {
  for (let at = buf.length - 22; at >= Math.max(0, buf.length - 22 - 0xffff); at--) if (buf.readUInt32LE(at) === END) return at;
  return -1;
}

/** One entry's bytes, from its local header on, checked against its size and CRC-32. */
function entryBytes(buf, c) {
  if (c.at + 30 > buf.length || buf.readUInt32LE(c.at) !== LOCAL) throw new Error(`unzip: ${c.name}: no local header where the directory says`);
  const start = c.at + 30 + buf.readUInt16LE(c.at + 26) + buf.readUInt16LE(c.at + 28), body = buf.subarray(start, start + c.packedSize);
  if (body.length !== c.packedSize) throw new Error(`unzip: ${c.name}: cut short`);
  if (c.method !== STORE && c.method !== DEFLATE) throw new Error(`unzip: ${c.name}: method ${c.method} — only stored and deflated entries are read`);
  const raw = c.method === STORE ? Buffer.from(body) : inflated(body, c.name);
  if (raw.length !== c.size || crc32(raw) !== c.crc) throw new Error(`unzip: ${c.name}: its bytes do not match their size and CRC-32`);
  return raw;
}

/** A deflated body inflated — or a refusal naming the entry (zlib's own message names none). */
function inflated(body, name) {
  try {
    return inflateRawSync(body);
  } catch (e) {
    throw new Error(`unzip: ${name}: its deflated bytes do not inflate (${e.message})`);
  }
}

/** The central directory's record at `p`: the facts the entry is read by, and where the next record starts. */
function centralRecord(buf, p, k) {
  if (p + 46 > buf.length || buf.readUInt32LE(p) !== CENTRAL) throw new Error(`unzip: entry ${k + 1}: a broken central directory`);
  const flags = buf.readUInt16LE(p + 8), length = buf.readUInt16LE(p + 28);
  const c = {
    name: buf.toString(flags & UTF8 ? 'utf8' : 'latin1', p + 46, p + 46 + length), method: buf.readUInt16LE(p + 10), crc: buf.readUInt32LE(p + 16),
    packedSize: buf.readUInt32LE(p + 20), size: buf.readUInt32LE(p + 24), at: buf.readUInt32LE(p + 42),
    next: p + 46 + length + buf.readUInt16LE(p + 30) + buf.readUInt16LE(p + 32),
  };
  if (flags & 1) throw new Error(`unzip: ${c.name}: encrypted`);
  if (c.packedSize === LIMIT || c.size === LIMIT || c.at === LIMIT) throw new Error(`unzip: ${c.name}: ZIP64 is not read`);
  return c;
}

/**
 * The entries of a ZIP archive, [{ name, data }] in its directory's order. Throws, saying what is wrong, on
 * anything it cannot vouch for: no end record, a broken header, a repeated name, bytes that do not match their
 * CRC-32, ZIP64, encryption, or a method other than store and deflate.
 */
export function unzip(data) {
  const buf = bytesOf(data), end = findEnd(buf);
  if (end < 0) throw new Error('unzip: no end of central directory — not a ZIP, or cut short');
  const count = buf.readUInt16LE(end + 10), names = new Set(), out = [];
  let p = buf.readUInt32LE(end + 16);
  for (let k = 0; k < count; k++) {
    const c = centralRecord(buf, p, k);
    if (names.has(c.name)) throw new Error(`unzip: ${c.name}: in the archive twice`);
    names.add(c.name);
    out.push({ name: c.name, data: entryBytes(buf, c) });
    p = c.next;
  }
  return out;
}
