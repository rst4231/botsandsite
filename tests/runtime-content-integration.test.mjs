import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const runtime = fs.readFileSync('patches/runtime-content-build.cjs', 'utf8');
const cronRoute = fs.readFileSync('patches/prepared-publish-route.js', 'utf8');

test('prepared publisher still injects durable GitHub issue fallback', () => {
  assert.match(runtime, /loadRuntimeContentIssue/);
  assert.match(runtime, /durablePreparedFallback/);
  assert.match(runtime, /durableFallback\?\.status/);
});

test('cron route uses only CRON_SECRET and fails closed when missing', () => {
  assert.match(cronRoute, /CRON_SECRET/);
  assert.match(cronRoute, /status: 503/);
  assert.doesNotMatch(cronRoute, /authorizedContentRequest/);
});
