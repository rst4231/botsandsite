import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { transformPreparedContent } = require('../patches/publication-idempotency-transform.cjs');

function fixture() {
  return `import { getTelegramConfig } from './server-config.js';
import { loadDurableVkToken, validateVkToken } from './vk-token-durable.mjs';
async function preparedHistory() { return []; }
async function recentTelegramHistory() { return []; }
function normalize(v='') { return String(v).toLowerCase(); }
async function stagePreparedContent(input) {
  const item = input;
  const history = await preparedHistory();
  const itemFingerprint = fingerprint({});
  if (history.some((entry) => entry.fingerprint === itemFingerprint)) { throw new Error('This material exactly repeats an earlier publication'); }
  if (history.some((entry) => normalize(entry.title) === normalize(item.title))) {
    throw new Error('This title has already been published');
  }
}
async function getVkAccessToken() {
  return process.env.VK_ACCESS_TOKEN || null;
}

export async function getPreparedVkConfigurationStatus() {
  return { configured: Boolean(await getVkAccessToken()), healthy: false, groupId: VK_GROUP_ID, error: null };
}
async function callVk() { return {}; }
async function sendVk(item) {
  const token = await getVkAccessToken();
  const post = await callVk('wall.post', {
    owner_id: \`-\${VK_GROUP_ID}\` ,
    from_group: 1,
    message: vkText(item),
  }, token);
  return post?.post_id;
}
async function publishPreparedForToday() {
  const statusKey = 'x';
  const status = { ...(durableFallback?.status || {}), ...cachedStatus };
  let images = [];
  const errors = {};
  if (!status.telegram) {
    try {
      status.telegram = item.format === 'slides'
        ? await sendTelegramSlides(item, images)
        : await sendTelegramText(telegramText(item));
      await cache.set(statusKey, status, { ttl: CACHE_TTL, tags: ['prepared-publications'] });
    } catch (error) {
      errors.telegram = error instanceof Error ? error.message : 'Telegram publishing failed';
    }
  }
}`;
}

test('transform adds durable-first VK, recovery, guid and Telegram claim', () => {
  const source = transformPreparedContent(fixture());
  assert.match(source, /loadDurableVkToken[\s\S]*cachedToken[\s\S]*VK_ACCESS_TOKEN/);
  assert.match(source, /validateVkToken/);
  assert.match(source, /recoverTelegramPublication/);
  assert.match(source, /recoverVkPost/);
  assert.match(source, /guid: deterministicVkGuid\(item\)/);
  assert.match(source, /claimPublication\(status, 'telegram'\)/);
  assert.match(source, /public Telegram history/);
});
