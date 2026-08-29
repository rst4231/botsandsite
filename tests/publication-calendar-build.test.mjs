import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { transformBuild } = require('../patches/calendar-build.cjs');

const marker = "const testResult = spawnSync(process.execPath, ['--test', path.join(cwd, 'tests', 'vk-photo-attachment.test.mjs')], {";

test('calendar build hook wraps the generated home page before Next build', () => {
  const transformed = transformBuild(`before\n${marker}\nafter`);
  assert.match(transformed, /legacy-page\.jsx/);
  assert.match(transformed, /calendar-page\.jsx/);
  assert.match(transformed, /publication-calendar\.css/);
  assert.match(transformed, /publication-calendar\.mjs/);
  assert.ok(transformed.indexOf('calendar-page.jsx') < transformed.indexOf(marker));
});

test('calendar build hook is idempotent', () => {
  const once = transformBuild(`before\n${marker}\nafter`);
  assert.equal(transformBuild(once), once);
});
