import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { formatVkPhotoAttachment } from '../lib/vk-photo-attachment.js';

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

test('VK user auth uses direct OAuth redirect instead of the SDK popup flow', () => {
  const pagePath = path.join(process.cwd(), 'app', 'vk-user-auth', 'page.js');
  assert.equal(fs.existsSync(pagePath), true, 'expected auth page at app/vk-user-auth/page.js');
  const source = fs.readFileSync(pagePath, 'utf8');
  assert.doesNotMatch(source, /@vkid\/sdk/);
  assert.match(source, /https:\/\/id\.vk\.ru\/authorize/);
  assert.match(source, /code_challenge_method/);
  assert.match(source, /response_type/);
  assert.match(source, /client_id/);
  assert.match(source, /app_id/);
  assert.match(source, /scope/);
  assert.match(source, /codeVerifier/);

  const routePath = path.join(process.cwd(), 'app', 'api', 'vk', 'save-user-token-temp', 'route.js');
  const route = fs.readFileSync(routePath, 'utf8');
  assert.match(route, /https:\/\/id\.vk\.ru\/oauth2\/auth/);
  assert.match(route, /authorization_code/);
  assert.match(route, /code_verifier/);
});
