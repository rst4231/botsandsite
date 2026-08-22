const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const cwd = process.cwd();
const testResult = spawnSync(process.execPath, ['--test', path.join(cwd, 'tests', 'vk-token-durable.test.mjs')], {
  cwd,
  stdio: 'inherit',
  env: process.env,
});
if ((testResult.status ?? 1) !== 0) process.exit(testResult.status ?? 1);

const buildPath = path.join(cwd, 'build.cjs');
if (!fs.existsSync(buildPath)) throw new Error('build.cjs is missing');
let source = fs.readFileSync(buildPath, 'utf8');

const copyMarker = "copyPatch('prepared-publish-route.js', 'app/api/cron/publish/route.js');";
const durableCopy = "copyPatch('vk-token-durable.mjs', 'lib/vk-token-durable.mjs');";
if (!source.includes(durableCopy)) {
  if (!source.includes(copyMarker)) throw new Error('Could not locate durable VK copy marker');
  source = source.replace(copyMarker, `${copyMarker}\n${durableCopy}`);
}

source = source.replace(
  "import { getVkConfigurationStatus } from '../../../lib/content-bot.js';",
  "import { getPreparedVkConfigurationStatus } from '../../../lib/prepared-content.js';",
);
source = source.replace(
  '  const vk = await getVkConfigurationStatus();',
  '  const vk = await getPreparedVkConfigurationStatus();',
);
source = source.replace(
  '    vkConfigured: vk.configured,\n    vkGroupId: vk.groupId,',
  "    vkConfigured: vk.configured,\n    vkHealthy: Boolean(vk.healthy),\n    vkError: vk.error || null,\n    vkGroupId: vk.groupId,",
);
if (!source.includes("import { getPreparedVkConfigurationStatus } from '../../../lib/prepared-content.js';")) {
  throw new Error('Could not patch health route to durable VK status');
}
if (!source.includes('vkHealthy: Boolean(vk.healthy)')) throw new Error('Could not patch VK health output');

const writeMarker = 'fs.writeFileSync(preparedContentPath, preparedContent);';
if (!source.includes(writeMarker)) throw new Error('Could not locate prepared-content write marker');

const transform = [
  "const vkDurableImportMarker = \"import { getTelegramConfig } from './server-config.js';\";",
  "if (!preparedContent.includes(\"from './vk-token-durable.mjs'\")) {",
  "  if (!preparedContent.includes(vkDurableImportMarker)) throw new Error('Could not locate Telegram config import for VK durable fallback');",
  "  preparedContent = preparedContent.replace(vkDurableImportMarker, vkDurableImportMarker + \"\\nimport { loadDurableVkToken, validateVkToken } from './vk-token-durable.mjs';\");",
  "}",
  "",
  "const vkTokenPattern = /async function getVkAccessToken\\(\\) \\{[\\s\\S]*?\\n\\}/;",
  "if (!vkTokenPattern.test(preparedContent)) throw new Error('Could not locate VK token loader');",
  "preparedContent = preparedContent.replace(vkTokenPattern, [",
  "  \"async function getVkAccessToken() {\",",
  "  \"  const envToken = String(process.env.VK_ACCESS_TOKEN || '').trim();\",",
  "  \"  if (envToken) return envToken;\",",
  "  \"  const cachedToken = await cache.get(VK_TOKEN_CACHE_KEY);\",",
  "  \"  if (cachedToken) return cachedToken;\",",
  "  \"  try {\",",
  "  \"    const telegram = getTelegramConfig();\",",
  "  \"    const durableToken = await loadDurableVkToken(telegram?.token);\",",
  "  \"    if (durableToken) {\",",
  "  \"      await cache.set(VK_TOKEN_CACHE_KEY, durableToken, { ttl: CACHE_TTL, tags: ['vk-config'] });\",",
  "  \"      return durableToken;\",",
  "  \"    }\",",
  "  \"  } catch (error) {\",",
  "  \"    console.error('VK_DURABLE_TOKEN_FALLBACK_ERROR', error instanceof Error ? error.message : String(error));\",",
  "  \"  }\",",
  "  \"  return null;\",",
  "  \"}\",",
  "  \"\",",
  "  \"export async function getPreparedVkConfigurationStatus() {\",",
  "  \"  return { configured: Boolean(await getVkAccessToken()), healthy: false, groupId: VK_GROUP_ID, error: null };\",",
  "  \"}\",",
  "].join('\\n'));",
  "if (!preparedContent.includes('getPreparedVkConfigurationStatus')) throw new Error('Durable VK status export was not injected');",
].join('\n');

source = source.replace(writeMarker, transform + '\n' + writeMarker);
fs.writeFileSync(buildPath, source);
