import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const source = fs.readFileSync(new URL('../patches/prepared-publish-route.js', import.meta.url), 'utf8');
test('partial publication failure returns non-2xx so monitoring can detect it', () => {
  assert.match(source, /result\?\.ok === false \? 502 : 200/);
});
