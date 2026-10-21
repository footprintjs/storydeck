// @vitest-environment node
import {describe, it, expect} from 'vitest';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {packageRoot, pageAssets} from './assets.js';

describe('pageAssets', () => {
  it('finds the package from here and reads what a page carries, once', () => {
    const root = packageRoot();
    expect(JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')).name).toBe('footprint-storydeck');
    const a = pageAssets();
    expect(a.stageJs).toContain('<deck-stage>');
    expect(a.css).toHaveLength(3);
    expect(a.css[2]).toContain('sdPkt');
    expect(a.version).toMatch(/^\d+\.\d+\.\d+/);
    expect(pageAssets()).toBe(a);
  });

  it('says so when it cannot find the package', () => {
    expect(() => packageRoot(path.parse(process.cwd()).root)).toThrow(/cannot find the footprint-storydeck package/);
  });
});
