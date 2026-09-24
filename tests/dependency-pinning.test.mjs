import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const lock = JSON.parse(fs.readFileSync(new URL('../package-lock.json', import.meta.url), 'utf8'));

test('critical production dependencies are pinned exactly in manifest and lockfile', () => {
  const expected = {
    '@vercel/functions': '3.9.3',
    '@vkid/sdk': '2.6.7',
    next: '16.3.6',
    react: '19.2.3',
    'react-dom': '19.2.3',
  };

  for (const [name, version] of Object.entries(expected)) {
    assert.equal(pkg.dependencies[name], version);
    assert.equal(lock.packages[''].dependencies[name], version);
    assert.equal(lock.packages[`node_modules/${name}`].version, version);
  }
  assert.equal(lock.lockfileVersion, 3);
});


test('build preserves canonical dependency files across fresh source extraction', () => {
  const build = fs.readFileSync(new URL('../build.cjs', import.meta.url), 'utf8');
  const saveManifest = build.indexOf('const canonicalPackageJson');
  const saveLock = build.indexOf('const canonicalPackageLock');
  const extract = build.indexOf("execFileSync('tar'");
  const restoreManifest = build.indexOf('if (canonicalPackageJson) fs.writeFileSync');
  const restoreLock = build.indexOf('if (canonicalPackageLock) fs.writeFileSync');
  assert.ok(saveManifest >= 0 && saveManifest < extract);
  assert.ok(saveLock >= 0 && saveLock < extract);
  assert.ok(restoreManifest > extract);
  assert.ok(restoreLock > extract);
});
