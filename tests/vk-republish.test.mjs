import test from 'node:test';
import assert from 'node:assert/strict';
import { makeWallPostUrl, makePostClickableStickers, makeStoryUploadParams, isGroupPhotoAuthError } from '../lib/vk-republish.js';

test('builds VK wall post URL for a community post', () => {
  assert.equal(makeWallPostUrl(160851478, 5439), 'https://vk.com/wall-160851478_5439');
});

test('builds a post clickable sticker for a 1080x1920 community story', () => {
  const stickers = JSON.parse(makePostClickableStickers(160851478, 5439));
  assert.equal(stickers.original_width, 1080);
  assert.equal(stickers.original_height, 1920);
  assert.equal(stickers.clickable_stickers[0].type, 'post');
  assert.equal(stickers.clickable_stickers[0].post_owner_id, -160851478);
  assert.equal(stickers.clickable_stickers[0].post_id, 5439);
  assert.equal(stickers.clickable_stickers[0].clickable_area.length, 4);
});

test('builds story upload params with a post sticker and internal fallback link', () => {
  const params = makeStoryUploadParams(160851478, 5439);
  assert.equal(params.group_id, 160851478);
  assert.equal(params.add_to_news, 1);
  assert.equal(params.link_text, 'view');
  assert.equal(params.link_url, 'https://vk.com/wall-160851478_5439');
  assert.ok(params.clickable_stickers.includes('"type":"post"'));
});

test('detects VK group-auth restriction on wall photo upload', () => {
  assert.equal(isGroupPhotoAuthError(new Error('VK 27: Group authorization failed: method is unavailable with group auth.')), true);
  assert.equal(isGroupPhotoAuthError(new Error('VK 5: User authorization failed')), false);
});
