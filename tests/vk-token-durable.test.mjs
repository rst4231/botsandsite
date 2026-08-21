import test from 'node:test';
import assert from 'node:assert/strict';
import { createCipheriv, createHash, randomBytes } from 'node:crypto';
import { decryptDurableVkToken, parseDurableVkConfig, loadDurableVkToken } from '../patches/vk-token-durable.mjs';

function fixture(secret, token='vk-test-token') {
  const iv = randomBytes(12);
  const key = createHash('sha256').update(`traffic-news-vk-config-v1:${secret}`).digest();
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const plaintext = Buffer.from(JSON.stringify({ token, groupId: '160851478' }), 'utf8');
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  const cfg = { v: 1, alg: 'aes-256-gcm', iv: iv.toString('base64url'), ciphertext: ciphertext.toString('base64url'), tag: tag.toString('base64url') };
  return `<!-- traffic-news-vk-config-v1 -->\n\`\`\`json\n${JSON.stringify(cfg)}\n\`\`\``;
}

test('parses encrypted VK config from issue body', () => {
  const body = fixture('telegram-secret');
  const cfg = parseDurableVkConfig(body);
  assert.equal(cfg.v, 1);
  assert.equal(cfg.alg, 'aes-256-gcm');
});

test('decrypts durable VK token with the persistent Telegram secret', () => {
  const body = fixture('telegram-secret', 'vk-secret');
  assert.equal(decryptDurableVkToken(body, 'telegram-secret'), 'vk-secret');
  assert.throws(() => decryptDurableVkToken(body, 'wrong-secret'));
});

test('loads token from configured GitHub issue without exposing token in response metadata', async () => {
  const body = fixture('telegram-secret', 'vk-secret');
  const fetchImpl = async () => ({ ok: true, json: async () => ({ body }) });
  assert.equal(await loadDurableVkToken('telegram-secret', fetchImpl), 'vk-secret');
});
