const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const cwd = process.cwd();
const lhMark = /,\s*React\.createElement\('div', \{ style: \{ marginLeft: '8px' \} \}, 'LH'\),?/g;
const oldTheoryUrl = 'https://vk.ru/app5898182_-160851478#page=67e5217dfe30f032b45b7c8';
const newTheoryUrl = 'https://vk.ru/app5898182_-160851478#s=3761005';

for (const relativePath of [
  'patches/prepared-content.js',
  'app/api/admin/send-prepared-preview/route.js',
]) {
  const filePath = path.join(cwd, relativePath);
  if (!fs.existsSync(filePath)) continue;
  const source = fs.readFileSync(filePath, 'utf8');
  fs.writeFileSync(filePath, source.replace(lhMark, ''));
}

const preparedPath = path.join(cwd, 'patches', 'prepared-content.js');
if (fs.existsSync(preparedPath)) {
  let source = fs.readFileSync(preparedPath, 'utf8');
  source = source
    .replace(
      'No prepared content from the 09:00 ChatGPT generation',
      'No prepared content from the 01:00 ChatGPT generation',
    )
    .replaceAll(oldTheoryUrl, newTheoryUrl);
  fs.writeFileSync(preparedPath, source);
}

const manualRoutePath = path.join(cwd, 'app', 'api', 'vk', 'publish-prepared-now', 'route.js');
if (fs.existsSync(manualRoutePath)) {
  let source = fs.readFileSync(manualRoutePath, 'utf8');
  source = source.replaceAll(oldTheoryUrl, newTheoryUrl);
  const oldStatus = "  const currentStatus = (await cache.get(statusKey)) || {};\n  const apiCall = (method, params) => callVk(method, params, token);";
  const newStatus = [
    "  const storedStatus = (await cache.get(statusKey)) || {};",
    "  const currentStatus = { ...storedStatus };",
    "  if (new URL(request.url).searchParams.get('repost') === '1') {",
    "    delete currentStatus.vk;",
    "    delete currentStatus.vkStory;",
    "  }",
    "  const apiCall = (method, params) => callVk(method, params, token);",
  ].join('\n');
  if (source.includes(oldStatus)) source = source.replace(oldStatus, newStatus);
  fs.writeFileSync(manualRoutePath, source);
}

const buildPath = path.join(cwd, 'build.cjs');
if (fs.existsSync(buildPath)) {
  let source = fs.readFileSync(buildPath, 'utf8');
  source = source
    .replace(
      "generation: 'ChatGPT — 09:00 МСК в день публикации'",
      "generation: 'ChatGPT — 01:00 МСК в день публикации'",
    )
    .replaceAll(oldTheoryUrl, newTheoryUrl);

  const marker = 'const vkPublisherPattern =';
  const sharedFormatterPatch = [
    "preparedContent = preparedContent.replace(",
    "  \"import { getTelegramConfig } from './server-config.js';\",",
    "  \"import { getTelegramConfig } from './server-config.js';\\nimport { buildVkPreparedText } from './vk-prepared-manual.mjs';\"",
    ");",
    "preparedContent = preparedContent.replaceAll(",
    `  '${oldTheoryUrl}',`,
    `  '${newTheoryUrl}',`,
    ");",
    "preparedContent = preparedContent.replace(vkTextPattern, [",
    "  \"function vkText(item) {\",",
    "  \"  return buildVkPreparedText(item, VK_FOOTER);\",",
    "  \"}\",",
    "].join('\\n'));",
    "",
  ].join('\n');

  if (!source.includes("buildVkPreparedText(item, VK_FOOTER)")) {
    if (!source.includes(marker)) throw new Error('Could not locate VK publisher build marker');
    source = source.replace(marker, `${sharedFormatterPatch}${marker}`);
  }
  fs.writeFileSync(buildPath, source);
}

const testPath = path.join(cwd, 'tests', 'vk-prepared-manual.test.mjs');
if (fs.existsSync(testPath)) {
  const result = spawnSync(process.execPath, ['--test', testPath], { cwd, stdio: 'inherit', env: process.env });
  if ((result.status ?? 1) !== 0) process.exit(result.status ?? 1);
}
