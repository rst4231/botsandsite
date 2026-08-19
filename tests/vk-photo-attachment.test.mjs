import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { formatVkPhotoAttachment } from '../lib/vk-photo-attachment.js';

const require = createRequire(import.meta.url);

test('includes access_key when attaching a private VK message photo to a wall post', () => {
  assert.equal(
    formatVkPhotoAttachment({ owner_id: -160851478, id: 457249058, access_key: 'abc123' }),
    'photo-160851478_457249058_abc123',
  );
});

test('formats a public VK photo without access_key', () => {
  assert.equal(
    formatVkPhotoAttachment({ owner_id: -160851478, id: 457249058 }),
    'photo-160851478_457249058',
  );
});

test('VK user auth bundles the official SDK instead of relying on an external CDN', () => {
  const pagePath = path.join(process.cwd(), 'app', 'vk-user-auth', 'page.js');
  assert.equal(fs.existsSync(pagePath), true, 'expected a bundled client page at app/vk-user-auth/page.js');
  const source = fs.readFileSync(pagePath, 'utf8');
  assert.match(source, /from ['"]@vkid\/sdk['"]/);
  assert.doesNotMatch(source, /unpkg\.com/);
  assert.match(source, /codeVerifier\s*:\s*verifier/);
  assert.match(source, /Auth\.exchangeCode\(code,\s*deviceId\)/);
  assert.doesNotThrow(() => require.resolve('@vkid/sdk'));
});
