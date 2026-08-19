const fs = require('fs');
const path = require('path');

const cwd = process.cwd();
const buildPath = path.join(cwd, 'build.cjs');
if (!fs.existsSync(buildPath)) throw new Error('build.cjs is missing');
let source = fs.readFileSync(buildPath, 'utf8');

const oldImport = "import { buildVkPreparedText } from './vk-prepared-manual.mjs';";
const newImport = "import { buildVkPreparedText, uploadVkStory, buildVkPostUrl } from './vk-prepared-manual.mjs';";
if (!source.includes(oldImport) && !source.includes(newImport)) {
  throw new Error('Could not locate shared VK prepared import');
}
source = source.replace(oldImport, newImport);

const marker = 'const vkPublisherPattern =';
if (!source.includes(marker)) throw new Error('Could not locate VK publisher build marker');

const patch = String.raw`
const scheduledStoryHelpers = fs.readFileSync(path.join(cwd, 'patches', 'vk-story-scheduled-helper.txt'), 'utf8');
const vkStoryMarker = 'async function uploadVkImages(images, token) {';
if (!preparedContent.includes('async function sendVkStory(item, postId)')) {
  if (!preparedContent.includes(vkStoryMarker)) throw new Error('Could not locate scheduled VK story insertion point');
  preparedContent = preparedContent.replace(vkStoryMarker, scheduledStoryHelpers + '\n\n' + vkStoryMarker);
}
preparedContent = preparedContent.replace(
  'if (status.telegram && status.vk) {',
  "if (status.telegram && status.vk && (item.format !== 'slides' || status.vkStory)) {",
);
const scheduledVkBlock = [
  "  if (!status.vk) {",
  "    try {",
  "      status.vk = await sendVk(item, images);",
  "      await cache.set(statusKey, status, { ttl: CACHE_TTL, tags: ['prepared-publications'] });",
  "    } catch (error) {",
  "      errors.vk = error instanceof Error ? error.message : 'VK publishing failed';",
  "    }",
  "  }",
].join('\n');
const scheduledStoryBlock = [
  "  if (item.format === 'slides' && status.vk && !status.vkStory) {",
  "    try {",
  "      status.vkStory = await sendVkStory(item, status.vk);",
  "      await cache.set(statusKey, status, { ttl: CACHE_TTL, tags: ['prepared-publications'] });",
  "    } catch (error) {",
  "      errors.vkStory = error instanceof Error ? error.message : 'VK story publishing failed';",
  "    }",
  "  }",
].join('\n');
if (!preparedContent.includes(scheduledVkBlock)) throw new Error('Could not locate scheduled VK publication block');
preparedContent = preparedContent.replace(scheduledVkBlock, scheduledVkBlock + '\n\n' + scheduledStoryBlock);
preparedContent = preparedContent.replace(
  '    vkPublished: Boolean(status?.vk),',
  "    vkPublished: Boolean(status?.vk),\n    vkStoryPublished: Boolean(status?.vkStory),",
);
preparedContent = preparedContent.replaceAll(
  '    vkPostId: status.vk || null,',
  "    vkPostId: status.vk || null,\n    vkStory: status.vkStory || null,",
);

`;

if (!source.includes("status.vkStory = await sendVkStory(item, status.vk)")) {
  source = source.replace(marker, patch + marker);
}
fs.writeFileSync(buildPath, source);
