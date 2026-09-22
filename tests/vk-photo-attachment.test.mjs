import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const preparedPath = path.join(process.cwd(), 'lib', 'prepared-content.js');
const preparedSource = fs.readFileSync(preparedPath, 'utf8');

test('VK slide posts use the shared full-text formatter', () => {
  const vkTextMatch = preparedSource.match(/function vkText\(item\) \{[\s\S]*?\n\}/);
  assert.ok(vkTextMatch, 'expected vkText helper');
  const vkTextSource = vkTextMatch[0];
  assert.match(preparedSource, /import \{[^}]*buildVkPreparedText[^}]*uploadVkStory[^}]*buildVkPostUrl[^}]*publishVkStorySequence[^}]*summarizeVkStories[^}]*\} from '\.\/vk-prepared-manual\.mjs';/);
  assert.match(vkTextSource, /buildVkPreparedText\(item, VK_FOOTER\)/);
});

test('VK publishing never uploads or attaches images to the wall post', () => {
  assert.doesNotMatch(preparedSource, /async function uploadVkImages/);
  const sendVkMatch = preparedSource.match(/async function sendVk\(item\) \{[\s\S]*?\n\}/);
  assert.ok(sendVkMatch, 'expected text-only sendVk(item)');
  const sendVkSource = sendVkMatch[0];
  assert.doesNotMatch(sendVkSource, /attachments/);
  assert.doesNotMatch(sendVkSource, /uploadVkImages/);
  assert.match(sendVkSource, /message:\s*vkText\(item\)/);
});

test('slide images are rendered only when Telegram still needs them', () => {
  assert.match(preparedSource, /item\.format === 'slides' && !status\.telegram/);
  assert.match(preparedSource, /status\.vk = await sendVk\(item\)/);
});

test('scheduled VK stories publish every slide in order with the wall-post link and resumable progress', () => {
  assert.match(preparedSource, /async function sendVkStories\(item, postId, existingStories/);
  assert.match(preparedSource, /publishVkStorySequence/);
  assert.match(preparedSource, /slides:\s*item\.slides/);
  assert.match(preparedSource, /const linkUrl = buildVkPostUrl\(VK_GROUP_ID, postId\)/);
  assert.match(preparedSource, /linkUrl,\s*\n\s*linkText:\s*'more'/);
  assert.match(preparedSource, /item\.format === 'slides' && status\.vk && !status\.vkStory/);
  assert.match(preparedSource, /status\.vkStories = await sendVkStories\(item, status\.vk, status\.vkStories/);
  assert.match(preparedSource, /status\.vkStory = summarizeVkStories\(status\.vkStories\)/);
});
