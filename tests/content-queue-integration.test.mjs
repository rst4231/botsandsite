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

test('generator uses D1 queue before AI fallback, retries failures and can append the next tail date', () => {
  const source = fs.readFileSync(new URL('../patches/prepared-generator.js', import.meta.url), 'utf8');
  assert.match(source, /getQueuePost\(schedule\.dateKey\)/);
  assert.match(source, /source: 'cloudflare-d1'/);
  assert.match(source, /replenishContentQueue/);
  assert.match(source, /appendNextQueuePost/);
  assert.match(source, /CONTENT_QUEUE_GENERATION_ATTEMPT_FAILED/);
  assert.match(source, /maxAttempts/);
  assert.match(source, /nextScheduledDateAfter/);
  assert.match(source, /putQueuePost\(item\)/);
});

test('publish cron self-heals only when needed and appends one new tail post in the background', () => {
  const source = fs.readFileSync(new URL('../patches/prepared-publish-route.js', import.meta.url), 'utf8');
  const status = source.indexOf('getPreparedStatus()');
  const missingCheck = source.indexOf('before.scheduledKind && !before.prepared');
  const prepare = source.indexOf('prepareContentForToday()');
  const publish = source.indexOf('publishPreparedForToday()');
  assert.ok(status >= 0 && missingCheck > status && prepare > missingCheck && publish > prepare);
  assert.match(source, /waitUntil/);
  assert.match(source, /result\?\.queueDeleted === true/);
  assert.match(source, /appendNextQueuePost\(new Date\(\), 3\)/);
  assert.doesNotMatch(source, /replenishContentQueue/);
});

test('queue row is removed only after all required destinations are complete', () => {
  const source = fs.readFileSync(new URL('../patches/prepared-content.js', import.meta.url), 'utf8');
  assert.match(source, /status\?\.telegram/);
  assert.match(source, /status\?\.vk/);
  assert.match(source, /item\?\.format !== 'slides' \|\| status\?\.vkStory/);
  assert.match(source, /deleteQueuePost\(item\.dateKey\)/);
  assert.match(source, /Number\(result\?\.deleted \|\| 0\) > 0/);
});

test('calendar can preview future prepared posts from D1', () => {
  const source = fs.readFileSync(new URL('../patches/calendar-page.jsx', import.meta.url), 'utf8');
  assert.match(source, /listQueuePosts/);
  assert.match(source, /queuedPrepared/);
});


test('prepare cron reports queue refill failure as HTTP 502', () => {
  const source = fs.readFileSync(new URL('../patches/prepared-generate-route.js', import.meta.url), 'utf8');
  assert.match(source, /queueRefill\?\.ok === false/);
  assert.match(source, /failed \? 502 : 200/);
});
