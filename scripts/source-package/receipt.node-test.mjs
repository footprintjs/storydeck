import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import test from 'node:test';
import { createReceipt, hash } from './receipt.mjs';
import { SOURCE, TESTED, manifest, fixtureFiles, archive, receiptInput } from './fixture.mjs';

assert(process.env.STORYDECK_INSPECTOR_ROOT, 'supply the pinned shared archive inspector');
const inspector = createRequire(import.meta.url)(resolve(process.env.STORYDECK_INSPECTOR_ROOT, 'inspector.cjs'));

test('retains original identity, manifest/lock hashes and source/build bindings without executing bytes', () => {
  const input = receiptInput(inspector);
  const receipt = createReceipt(input);
  assert.equal(receipt.protocol, 'storydeck.source-candidate.v1');
  assert.deepEqual(receipt.tested, TESTED);
  assert.deepEqual(receipt.source, { ...SOURCE, manifestSha256: hash(input.manifestBytes), lockSha256: hash(input.lockBytes) });
  assert.equal(receipt.archive.filename, input.archiveName);
  assert.equal(receipt.archive.sha256, hash(input.archiveBytes));
  assert.equal(receipt.archive.version, manifest.version);
  assert.equal(receipt.archive.files.length, 9);
  assert.equal(receipt.memberBindings.filter((x) => x.owner === 'build').length, 1);
  assert.equal(receipt.memberBindings.find((x) => x.path === 'package/index.d.ts').owner, 'source');
  assert.equal(globalThis.__storydeckPackageExecuted, undefined);
});

test('rejects a different tested tree, original name or version instead of relabeling', () => {
  assert.throws(() => createReceipt(receiptInput(inspector, { tested: { ...TESTED, tree: '4'.repeat(40) } })), /trees differ/);
  assert.throws(() => createReceipt(receiptInput(inspector, { archiveName: 'storydeck-0.13.3.tgz' })));
  const files = fixtureFiles({ 'package/package.json': JSON.stringify({ ...manifest, version: '0.13.4' }) });
  assert.throws(() => createReceipt(receiptInput(inspector, { archiveBytes: archive(Object.entries(files)) })), /archive-version/);
});

test('refuses changed checked dist bytes and changed source-owned declaration bytes', () => {
  const files = fixtureFiles();
  for (const changed of ['dist/index.js', 'index.d.ts']) {
    assert.throws(() => createReceipt(receiptInput(inspector, {
      memberBytes: (path) => path === changed ? Buffer.from('changed') : files['package/' + path],
    })), /differs from checked/);
  }
});

test('shared closed policy refuses traversal, duplicates, links and unlisted members', () => {
  const entries = Object.entries(fixtureFiles());
  for (const hostile of [
    [['package/../escape', Buffer.from('x')]], [entries[0]],
    [['package/dist/link', Buffer.alloc(0), '2']], [['package/unlisted.js', Buffer.from('x')]],
  ]) {
    assert.throws(() => createReceipt(receiptInput(inspector, {
      archiveBytes: archive([...entries, ...hostile]),
    })));
  }
});

test('shared strict manifest reader rejects duplicate keys and unrelated manifest changes', () => {
  assert.throws(() => createReceipt(receiptInput(inspector, {
    manifestBytes: Buffer.from('{"name":"footprint-storydeck","version":"0.13.3","version":"0.13.4"}'),
  })), /manifest-json/);
  const files = fixtureFiles({ 'package/package.json': JSON.stringify({ ...manifest, scripts: {} }) });
  assert.throws(() => createReceipt(receiptInput(inspector, { archiveBytes: archive(Object.entries(files)) })), /manifest-source/);
});
