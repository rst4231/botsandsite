import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('scheduled VK stories render and publish every slide with resumable progress', () => {
  const helper = fs.readFileSync(new URL('../patches/vk-story-scheduled-helper.txt', import.meta.url), 'utf8');
  const build = fs.readFileSync(new URL('../patches/story-link-build.cjs', import.meta.url), 'utf8');
  assert.match(helper, /renderVkStoryPng\(item, slideIndex\)/);
  assert.match(helper, /publishVkStorySequence/);
  assert.doesNotMatch(helper, /item\.slides\?\.\[0\]/);
  assert.match(build, /status\.vkStories = await sendVkStories/);
  assert.match(build, /summarizeVkStories\(status\.vkStories\)/);
});

test('manual VK publisher uses the same multi-story sequence and clears progress on repost', () => {
  const route = fs.readFileSync(new URL('../app/api/vk/publish-prepared-now/route.js', import.meta.url), 'utf8');
  const prebuild = fs.readFileSync(new URL('../patches/prebuild-fixes.cjs', import.meta.url), 'utf8');
  assert.match(route, /publishVkStorySequence/);
  assert.match(route, /renderStoryPng\(item, slideIndex\)/);
  assert.match(route, /vkStories: nextStatus\.vkStories/);
  assert.match(route, /delete currentStatus\.vkStories/);
  assert.match(prebuild, /delete currentStatus\.vkStories/);
});
