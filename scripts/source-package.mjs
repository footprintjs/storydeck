// CI-only retention entry: no publication, version staging or consumer installation.
import assert from 'node:assert/strict';
import { retain } from './source-package/retain.mjs';

try {
  assert.equal(process.argv.length, 4);
  const receipt = retain({ root: process.cwd(), inspectorRoot: process.argv[2], out: process.argv[3],
    sourceHead: process.env.SOURCE_HEAD, testedHead: process.env.GITHUB_SHA });
  console.log(`Retained ${receipt.archive.filename}: ${receipt.archive.files.length} bound members; no publication`);
} catch {
  console.error('Source package retention refused; no artifact admitted');
  process.exitCode = 1;
}
