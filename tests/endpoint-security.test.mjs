import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const stage = fs.readFileSync(new URL('../patches/prepared-stage-route.js', import.meta.url), 'utf8');
const status = fs.readFileSync(new URL('../patches/prepared-status-route.js', import.meta.url), 'utf8');
const history = fs.readFileSync(new URL('../patches/prepared-history-route.js', import.meta.url), 'utf8');
const publish = fs.readFileSync(new URL('../patches/prepared-publish-route.js', import.meta.url), 'utf8');
const setup = fs.readFileSync(new URL('../patches/vk-setup-route.js', import.meta.url), 'utf8');

test('staging is POST JSON and contains no payload/query secret transport', () => {
  assert.match(stage, /export async function POST/);
  assert.match(stage, /request\.json\(\)/);
  assert.doesNotMatch(stage, /searchParams/);
  assert.doesNotMatch(stage, /base64url/);
});

test('status and history are read-only public diagnostics', () => {
  assert.doesNotMatch(status, /authorizedContentRequest/);
  assert.doesNotMatch(history, /authorizedContentRequest/);
});

test('publication cron fails closed without CRON_SECRET', () => {
  assert.match(publish, /CRON_SECRET/);
  assert.match(publish, /status: 503/);
  assert.match(publish, /authorization/);
  assert.doesNotMatch(publish, /authorizedContentRequest/);
});

test('VK setup reloads durable config and never accepts a raw token in URL', () => {
  assert.match(setup, /loadDurableVkToken/);
  assert.match(setup, /validateVkToken/);
  assert.match(setup, /export async function POST/);
  assert.doesNotMatch(setup, /searchParams/);
});
