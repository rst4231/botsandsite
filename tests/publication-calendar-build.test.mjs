import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { transformBuild } = require('../patches/calendar-build.cjs');

const marker = "const testResult = spawnSync(process.execPath, ['--test', path.join(cwd, 'tests', 'vk-photo-attachment.test.mjs')], {";

test('calendar build hook installs the calendar preview and site branding before Next build', () => {
  const transformed = transformBuild(`before\n${marker}\nafter`);
  assert.doesNotMatch(transformed, /legacy-page\.jsx/);
  assert.match(transformed, /calendar-page\.jsx/);
  assert.match(transformed, /publication-calendar-client\.jsx/);
  assert.match(transformed, /publication-calendar\.css/);
  assert.match(transformed, /publication-calendar\.mjs/);
  assert.match(transformed, /site-brand\.cjs/);
  assert.match(transformed, /icon\.svg/);
  assert.match(transformed, /layout\.jsx/);
  assert.match(transformed, /layout\.js/);
  assert.ok(transformed.indexOf('calendar-page.jsx') < transformed.indexOf(marker));
});

test('calendar build hook is idempotent', () => {
  const once = transformBuild(`before\n${marker}\nafter`);
  assert.equal(transformBuild(once), once);
});
