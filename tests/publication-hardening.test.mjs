import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const hardening = fs.readFileSync(new URL('../patches/publication-hardening.cjs', import.meta.url), 'utf8');
const setup = fs.readFileSync(new URL('../patches/vk-setup-route.js', import.meta.url), 'utf8');
const vercel = JSON.parse(fs.readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));

test('build applies publication hardening before compiling Next.js', () => {
  assert.match(pkg.scripts.build, /publication-hardening\.cjs/);
  assert.match(pkg.scripts.build, /publication-hardening\.test\.mjs/);
});

test('hardening replaces VK setup and removes obsolete publication endpoints', () => {
  assert.match(hardening, /vk-setup-route\.js/);
  for (const path of ['cache-sync-20260819', 'channel-info-temp', 'repost-exact-20260816', 'repost-from-updates-20260816', 'repost-planned', 'replace-post-images-story']) {
    assert.match(hardening, new RegExp(path));
  }
});

test('VK setup uses shared authorization and persists the token to both runtime namespaces', () => {
  assert.match(setup, /authorizedContentRequest/);
  assert.doesNotMatch(setup, /const KEY\s*=/);
  assert.match(setup, /traffic-news-v4/);
  assert.match(setup, /traffic-news-vk-v1/);
  assert.match(setup, /vk-access-token-v1/);
  assert.match(setup, /access-token/);
  assert.match(setup, /stories\.get/);
});

test('publication cron has two idempotent recovery attempts after 18:40 MSK', () => {
  const schedules = vercel.crons.filter((entry) => entry.path === '/api/cron/publish').map((entry) => entry.schedule);
  assert.deepEqual(schedules, ['40 15 * * *', '50 15 * * *', '0 16 * * *']);
});
