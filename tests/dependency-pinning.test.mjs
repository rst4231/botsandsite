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


test('build rewrites archived dependency ranges after fresh source extraction', () => {
  const build = fs.readFileSync(new URL('../build.cjs', import.meta.url), 'utf8');
  assert.match(build, /execFileSync\('tar'/);
  assert.match(build, /'@vercel\/functions': '3\.9\.3'/);
  assert.match(build, /'@vkid\/sdk': '2\.6\.7'/);
  assert.match(build, /next: '16\.3\.6'/);
  assert.match(build, /react: '19\.2\.3'/);
  assert.match(build, /'react-dom': '19\.2\.3'/);
});
