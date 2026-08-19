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

  assert.match(preparedSource, /import \{ buildVkPreparedText \} from '\.\/vk-prepared-manual\.mjs';/);
  assert.match(vkTextSource, /buildVkPreparedText\(item, VK_FOOTER\)/);
});

test('VK publishing never uploads or attaches images', () => {
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
