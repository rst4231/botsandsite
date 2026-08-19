import test from 'node:test';
import assert from 'node:assert/strict';
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
