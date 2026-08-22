import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const hardening = fs.readFileSync(new URL('../patches/publication-hardening.cjs', import.meta.url), 'utf8');
const setup = fs.readFileSync(new URL('../patches/vk-setup-route.js', import.meta.url), 'utf8');
const idempotency = fs.readFileSync(new URL('../patches/publication-idempotency-build.cjs', import.meta.url), 'utf8');

test('build patches contain hardening and idempotency transforms', () => {
  assert.match(hardening, /vk-setup-route\.js/);
  assert.match(idempotency, /publication-idempotency-transform\.cjs/);
  assert.match(idempotency, /transformPreparedContent/);
});

test('legacy VK publication endpoints remain in cleanup list', () => {
  for (const path of ['cache-sync-20260819', 'channel-info-temp', 'repost-exact-20260816', 'repost-from-updates-20260816', 'repost-planned', 'replace-post-images-story']) assert.match(hardening, new RegExp(path));
  assert.match(idempotency, /send-prepared-preview/);
});

test('VK setup reloads durable token and warms both runtime namespaces', () => {
  assert.match(setup, /authorizedContentRequest/);
  assert.match(setup, /loadDurableVkToken/);
  assert.match(setup, /validateVkToken/);
  assert.match(setup, /traffic-news-v4/);
  assert.match(setup, /traffic-news-vk-v1/);
  assert.doesNotMatch(setup, /searchParams/);
});
