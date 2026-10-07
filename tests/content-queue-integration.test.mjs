import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { transformBuild } = require('../patches/content-queue-build.cjs');

test('content queue build hook copies the Cloudflare queue client into lib', () => {
  const source = "copyPatch('prepared-content.js', 'lib/prepared-content.js');";
  const transformed = transformBuild(source);
  assert.match(transformed, /content-queue-client\.mjs/);
  assert.equal(transformBuild(transformed), transformed);
});

test('generator uses D1 queue before AI fallback and maintains a rolling horizon', () => {
  const source = fs.readFileSync(new URL('../patches/prepared-generator.js', import.meta.url), 'utf8');
  assert.match(source, /getQueuePost\(schedule\.dateKey\)/);
  assert.match(source, /source: 'cloudflare-d1'/);
  assert.match(source, /replenishContentQueue/);
  assert.match(source, /putQueuePost\(item\)/);
});

test('publish cron self-heals before publishing', () => {
  const source = fs.readFileSync(new URL('../patches/prepared-publish-route.js', import.meta.url), 'utf8');
  const prepare = source.indexOf('prepareContentForToday()');
  const publish = source.indexOf('publishPreparedForToday()');
  assert.ok(prepare >= 0 && publish > prepare);
});

test('queue row is removed only after all required destinations are complete', () => {
  const source = fs.readFileSync(new URL('../patches/prepared-content.js', import.meta.url), 'utf8');
  assert.match(source, /status\?\.telegram/);
  assert.match(source, /status\?\.vk/);
  assert.match(source, /item\?\.format !== 'slides' \|\| status\?\.vkStory/);
  assert.match(source, /deleteQueuePost\(item\.dateKey\)/);
});

test('calendar can preview future prepared posts from D1', () => {
  const source = fs.readFileSync(new URL('../patches/calendar-page.jsx', import.meta.url), 'utf8');
  assert.match(source, /listQueuePosts/);
  assert.match(source, /queuedPrepared/);
});
