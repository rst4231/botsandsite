import { createDecipheriv, createHash } from 'node:crypto';

const MARKER = '<!-- traffic-news-vk-config-v1 -->';
const ISSUE_URL = 'https://api.github.com/repos/rst4231/botsandsite/issues/8';

function deriveKey(secret) {
  if (!secret) throw new Error('Durable VK token decryption secret is unavailable');
  return createHash('sha256').update(`traffic-news-vk-config-v1:${secret}`).digest();
}

export function parseDurableVkConfig(body = '') {
  const text = String(body || '');
  if (!text.includes(MARKER)) throw new Error('Durable VK config marker is missing');
  const match = text.match(/```json\s*([\s\S]*?)```/i);
  if (!match) throw new Error('Durable VK config JSON is missing');
  const config = JSON.parse(match[1]);
  if (config?.v !== 1 || config?.alg !== 'aes-256-gcm') throw new Error('Durable VK config version is unsupported');
  if (!config.iv || !config.ciphertext || !config.tag) throw new Error('Durable VK config is incomplete');
  return config;
}

export function decryptDurableVkToken(body, secret) {
  const config = parseDurableVkConfig(body);
  const decipher = createDecipheriv('aes-256-gcm', deriveKey(secret), Buffer.from(config.iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(config.tag, 'base64url'));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(config.ciphertext, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
  const payload = JSON.parse(plaintext);
  const token = String(payload?.token || '').trim();
  if (!token) throw new Error('Durable VK token payload is empty');
  return token;
}

export async function loadDurableVkToken(secret, fetchImpl = fetch) {
  const response = await fetchImpl(ISSUE_URL, {
    headers: { accept: 'application/vnd.github+json', 'user-agent': 'traffic-news-telegram-bot' },
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`Durable VK config fetch failed: HTTP ${response.status}`);
  const issue = await response.json();
  return decryptDurableVkToken(issue?.body || '', secret);
}
