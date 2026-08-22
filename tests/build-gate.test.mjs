import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
test('production build runs publication transform and the complete test suite', () => {
  assert.match(pkg.scripts.build, /publication-idempotency-build\.cjs/);
  assert.match(pkg.scripts.build, /node build\.cjs && npm test/);
});
