import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const buildPatch = fs.readFileSync(new URL('../patches/publication-idempotency-build.cjs', import.meta.url), 'utf8');

test('production build patch injects publication transform into generated source', () => {
  assert.match(buildPatch, /publication-idempotency-transform\.cjs/);
  assert.match(buildPatch, /transformPreparedContent/);
  assert.match(buildPatch, /fs\.writeFileSync\(buildPath, source\)/);
});
