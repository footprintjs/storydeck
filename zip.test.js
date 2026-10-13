import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { zip, unzip, crc32 } from './zip.js';

const ENTRIES = [
  { name: '[Content_Types].xml', data: '<Types/>'.repeat(50) },
  { name: 'ppt/media/noise.bin', data: randomBytes(2000) },
  { name: 'ppt/slides/slide1.xml', data: new Uint8Array(Buffer.from('<p:sld/>')) },
  { name: 'docs/naïve.txt', data: 'é' },
];
/** The offset of each local header, read from the central directory (46-byte records after the entries). */
const centralAt = (data) => data.readUInt32LE(data.length - 22 + 16);

let dir;
beforeEach(() => { dir = mkdtempSync(path.join(tmpdir(), 'sd-zip-')); });
afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

describe('zip · writing and reading back', () => {
  it('gives back every entry as written, in order, its name intact', () => {
    const back = unzip(zip(ENTRIES));
    expect(back.map((e) => e.name)).toEqual(ENTRIES.map((e) => e.name));
    expect(back[0].data.toString()).toBe(ENTRIES[0].data);
    expect(back[1].data.equals(ENTRIES[1].data)).toBe(true);
    expect(back[2].data.toString()).toBe('<p:sld/>');
    expect(back[3].data.toString()).toBe('é');
  });

  it('deflates what shrinks, stores what does not, flags a UTF-8 name, and dates every entry 1980-01-01', () => {
    const data = zip(ENTRIES), methods = [], flags = [];
    let p = centralAt(data);
    for (let k = 0; k < ENTRIES.length; k++) {
      methods.push(data.readUInt16LE(p + 10)); flags.push(data.readUInt16LE(p + 8));
      expect(data.readUInt16LE(p + 14)).toBe(0x21);                                   // 1980-01-01
      p += 46 + data.readUInt16LE(p + 28);
    }
    expect(methods).toEqual([8, 0, 0, 0]);   // repeated text deflates; noise and tiny entries are stored
    expect(flags).toEqual([0, 0, 0, 0x800]);
  });

  it('makes the same bytes from the same entries', () => {
    expect(zip(ENTRIES).equals(zip(ENTRIES))).toBe(true);
    expect(unzip(zip([]))).toEqual([]);
  });

  it('computes the standard CRC-32', () => {
    expect(crc32(Buffer.from('123456789'))).toBe(0xcbf43926);
    expect(crc32(Buffer.alloc(0))).toBe(0);
  });

  it('refuses a name a reader could take for a folder, a way out, or another entry — naming the fix', () => {
    for (const name of ['', '/abs.xml', 'a\\b.xml', 'a/../b.xml', 'a/./b.xml', 'a//b.xml', 'folder/', 7]) {
      expect(() => zip([{ name, data: 'x' }])).toThrow(/is not an entry name — write it relative, with forward slashes/);
    }
    expect(() => zip([{ name: 'a.xml', data: '1' }, { name: 'a.xml', data: '2' }])).toThrow('zip: "a.xml" is given twice');
    expect(() => zip(new Array(65536))).toThrow('zip: 65536 entries is over 65535 — ZIP64 is not written');
  });
});

describe('zip · what unzip will not vouch for', () => {
  const one = () => zip([{ name: 'a.xml', data: '<a>'.repeat(40) }]);   // deflated: 30-byte header, 5-byte name, body
  const nameStart = (data) => centralAt(data) + 46;

  it('refuses what is not a ZIP, or is cut short', () => {
    expect(() => unzip(Buffer.from('not a zip at all, not even close'))).toThrow('unzip: no end of central directory — not a ZIP, or cut short');
    expect(() => unzip(Buffer.alloc(3))).toThrow('no end of central directory');
    const cut = one();
    cut.writeUInt32LE(cut.length, centralAt(cut) + 20);                      // the directory promises more bytes than there are
    expect(() => unzip(cut)).toThrow('unzip: a.xml: cut short');
  });

  it('refuses a body that does not inflate, and bytes that do not match their CRC-32', () => {
    const data = one();
    data[35] = 0x07;                                                         // the first deflate block: final, of the reserved type
    expect(() => unzip(data)).toThrow(/^unzip: a\.xml: its deflated bytes do not inflate \(.+\)$/);
    const stored = zip([{ name: 'b.bin', data: randomBytes(64) }]);
    stored[35 + 10] ^= 0xff;
    expect(() => unzip(stored)).toThrow('unzip: b.bin: its bytes do not match their size and CRC-32');
  });

  it('refuses a broken directory, a missing local header, encryption, ZIP64, an unknown method and a repeated name', () => {
    const broken = one();
    broken.writeUInt32LE(0, centralAt(broken));
    expect(() => unzip(broken)).toThrow('unzip: entry 1: a broken central directory');
    const moved = one();
    moved.writeUInt32LE(0, 0);
    expect(() => unzip(moved)).toThrow('unzip: a.xml: no local header where the directory says');
    const locked = one();
    locked.writeUInt16LE(1, centralAt(locked) + 8);
    expect(() => unzip(locked)).toThrow('unzip: a.xml: encrypted');
    const big = one();
    big.writeUInt32LE(0xffffffff, centralAt(big) + 24);
    expect(() => unzip(big)).toThrow('unzip: a.xml: ZIP64 is not read');
    const bzip = one();
    bzip.writeUInt16LE(12, centralAt(bzip) + 10);
    expect(() => unzip(bzip)).toThrow('unzip: a.xml: method 12 — only stored and deflated entries are read');
    const twice = zip([{ name: 'a.xml', data: '1' }, { name: 'b.xml', data: '2' }]);
    const second = nameStart(twice) + 5 + 46;                                // the second record's name
    twice.write('a', second, 'latin1');
    expect(() => unzip(twice)).toThrow('unzip: a.xml: in the archive twice');
  });
});

// on a machine with Info-ZIP's unzip (macOS, most Linux), the archive is read by a reader we did not write
const hasUnzip = spawnSync('unzip', ['-v']).status === 0;
describe.skipIf(!hasUnzip)('zip · read by Info-ZIP', () => {
  it('passes `unzip -t`', () => {
    const file = path.join(dir, 'a.zip');
    writeFileSync(file, zip(ENTRIES));
    const done = spawnSync('unzip', ['-t', file], { encoding: 'utf8' });
    expect(done.status).toBe(0);
    expect(done.stdout).toContain('No errors detected');
  });
});
