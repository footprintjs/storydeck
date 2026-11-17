// Data admission only: the shared release inspector owns gzip/tar and manifest policy.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

export const INSPECTOR_HEAD = '1ca5d7de9bde68c205b5d140c94dc475ae3b2520';
export const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');

export function createReceipt({ source, tested, manifestBytes, lockBytes, profileBytes,
  archiveBytes, archiveName, inspector, memberBytes, node = process.version }) {
  for (const identity of [source, tested]) {
    assert.match(identity.head, /^[a-f0-9]{40}$/);
    assert.match(identity.tree, /^[a-f0-9]{40}$/);
  }
  assert.equal(source.tree, tested.tree, 'source/tested trees differ');
  const manifest = inspector.parseManifest(manifestBytes);
  const profile = inspector.parseManifest(profileBytes);
  assert.equal(manifest.name, 'footprint-storydeck');
  assert.match(manifest.version, /^\d+\.\d+\.\d+$/);
  assert.equal(archiveName, `${manifest.name}-${manifest.version}.tgz`);
  const archive = inspector.inspectArchive(archiveBytes, {
    version: manifest.version, sourceManifest: manifest, archive: profile.archive,
  });
  const memberBindings = archive.files.map((file) => {
    assert(file.path.startsWith('package/'));
    const relativePath = file.path.slice('package/'.length);
    const bytes = memberBytes(relativePath);
    assert(Buffer.isBuffer(bytes) && bytes.length === file.size && hash(bytes) === file.sha256,
      'archive member differs from checked source/build bytes');
    return { path: file.path, owner: relativePath.startsWith('dist/') ? 'build' : 'source' };
  });
  return {
    protocol: 'storydeck.source-candidate.v1',
    source: { ...source, manifestSha256: hash(manifestBytes), lockSha256: hash(lockBytes) },
    tested: { ...tested },
    inspector: { repository: 'footprintjs/ci', head: INSPECTOR_HEAD,
      profilePath: '.github/release.json', profileSha256: hash(profileBytes) },
    node, archive: { filename: archiveName, ...archive }, memberBindings,
    qualification: 'Original source-version archive of checked build bytes; not registry publication or downstream acceptance',
  };
}
