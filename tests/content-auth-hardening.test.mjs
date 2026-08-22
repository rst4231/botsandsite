import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../patches/content-auth.js', import.meta.url), 'utf8');

test('internal content auth reads x-content-key and never query key', () => {
  assert.match(source, /headers\?\.get\?\.\('x-content-key'\)/);
  assert.doesNotMatch(source, /searchParams/);
});
