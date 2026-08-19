import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const prepared = fs.readFileSync('lib/prepared-content.js', 'utf8');
const cronRoute = fs.readFileSync('app/api/cron/publish/route.js', 'utf8');

test('prepared publisher falls back to durable GitHub issue content and status', () => {
  assert.match(prepared, /loadRuntimeContentIssue/);
  assert.match(prepared, /durablePreparedFallback/);
  assert.match(prepared, /cachedItem \|\| durableFallback\?\.item/);
  assert.match(prepared, /durableFallback\?\.status/);
});

test('content status endpoint also sees durable fallback content', () => {
  assert.match(prepared, /cachedContent \|\| durableFallback\?\.item/);
});

test('cron route allows protected manual recovery with the content key', () => {
  assert.match(cronRoute, /authorizedContentRequest/);
  assert.match(cronRoute, /Bearer \$\{secret\}/);
});
