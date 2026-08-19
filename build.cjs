const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync, spawnSync } = require('child_process');

const cwd = process.cwd();
const chunks = fs.readdirSync(cwd).filter((name) => /^fresh\.raw\.\d+$/.test(name)).sort();
if (!chunks.length) throw new Error('Fresh source chunks are missing');
const archive = Buffer.concat(chunks.map((name) => fs.readFileSync(path.join(cwd, name))));
const archivePath = path.join(os.tmpdir(), 'traffic-news-source.tgz');
fs.writeFileSync(archivePath, archive);
execFileSync('tar', ['-xzf', archivePath, '-C', cwd], { stdio: 'inherit' });

function copyPatch(source, target) {
  const from = path.join(cwd, 'patches', source);
  const to = path.join(cwd, target);
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
}

const contentBotPath = path.join(cwd, 'lib', 'content-bot.js');
let contentBot = fs.readFileSync(contentBotPath, 'utf8');

contentBot = contentBot.replace(
  /const VK_FOOTER = '[^']*';/,
  "const VK_FOOTER = '\\n\\nРекомендуем изучить:\\n[https://vk.ru/app5898182_-160851478#page=67e5217dfe30f032b45b7c8|Теория]\\n[https://vk.com/app5898182_-160851478#s=3112330&force=1&utf=1|Практика]';"
);
contentBot = contentBot.replace(
  "  const response = await callVk('wall.post', {\n    owner_id: `-${VK_GROUP_ID}`,\n    from_group: 1,\n    message: telegramHtmlToVkText(text),\n  }, tokenOverride);\n  return response?.post_id;",
  "  const response = await callVk('wall.post', {\n    owner_id: `-${VK_GROUP_ID}`,\n    from_group: 1,\n    message: telegramHtmlToVkText(text),\n  }, tokenOverride);\n  const postId = response?.post_id;\n  if (postId) {\n    await callVk('wall.closeComments', { owner_id: `-${VK_GROUP_ID}`, post_id: postId }, tokenOverride);\n  }\n  return postId;"
);

const marker = 'const FORBIDDEN_LABELS =';
const markerIndex = contentBot.indexOf(marker);
if (markerIndex < 0) throw new Error('Could not locate legacy content generator');
const slimSuffix = fs.readFileSync(path.join(cwd, 'patches', 'content-bot-slim-suffix.txt'), 'utf8');
contentBot = `${contentBot.slice(0, markerIndex)}${slimSuffix}`;
fs.writeFileSync(contentBotPath, contentBot);

copyPatch('prepared-content.js', 'lib/prepared-content.js');
copyPatch('content-auth.js', 'lib/content-auth.js');
copyPatch('prepared-stage-route.js', 'app/api/content/stage/route.js');
copyPatch('prepared-history-route.js', 'app/api/content/history/route.js');
copyPatch('prepared-status-route.js', 'app/api/content/status/route.js');
copyPatch('prepared-publish-route.js', 'app/api/cron/publish/route.js');
copyPatch('sendpulse-business-sync/client.mjs', 'lib/sendpulse-business-sync/client.mjs');
copyPatch('sendpulse-business-sync/sync.mjs', 'lib/sendpulse-business-sync/sync.mjs');
copyPatch('sendpulse-business-sync-route.js', 'app/api/sendpulse/business-sync/route.js');

const preparedContentPath = path.join(cwd, 'lib', 'prepared-content.js');
let preparedContent = fs.readFileSync(preparedContentPath, 'utf8');
preparedContent = preparedContent.replace(
  "import { getTelegramConfig } from './server-config.js';",
  "import { getTelegramConfig } from './server-config.js';\nimport { formatVkPhotoAttachment } from './vk-photo-attachment.js';"
);

const vkUploadPattern = /async function uploadVkImages\(images, token\) \{[\s\S]*?\n\}\n\nasync function sendVk/;
if (!vkUploadPattern.test(preparedContent)) throw new Error('Could not locate prepared VK uploader');
preparedContent = preparedContent.replace(vkUploadPattern, `async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function uploadVkImages(images, token) {
  const attachments = [];
  for (let index = 0; index < images.length; index += 1) {
    let photo = null;
    let lastError = null;

    for (let attempt = 1; attempt <= 3 && !photo; attempt += 1) {
      try {
        const uploadServer = await callVk('photos.getMessagesUploadServer', {}, token);
        if (!uploadServer?.upload_url) throw new Error('VK message photo upload server is unavailable');

        const form = new FormData();
        form.append('photo', new Blob([images[index]], { type: 'image/png' }), \`slide\${index + 1}.png\`);
        const uploadResponse = await fetch(uploadServer.upload_url, { method: 'POST', body: form });
        const uploaded = await uploadResponse.json();
        if (!uploadResponse.ok) throw new Error(\`VK image upload failed for slide \${index + 1}\`);
        if (!uploaded?.photo) throw new Error(\`VK upload returned empty photo for slide \${index + 1}\`);

        const saved = await callVk('photos.saveMessagesPhoto', {
          photo: uploaded.photo,
          server: uploaded.server,
          hash: uploaded.hash,
        }, token);
        photo = Array.isArray(saved) ? saved[0] : null;
        if (!photo?.owner_id || !photo?.id || !photo?.access_key) {
          throw new Error(\`VK failed to save slide \${index + 1} with access_key\`);
        }
      } catch (error) {
        lastError = error;
        photo = null;
        if (attempt < 3) await sleep(500 * attempt);
      }
    }

    if (!photo) throw lastError || new Error(\`VK failed to upload slide \${index + 1}\`);
    attachments.push(formatVkPhotoAttachment(photo));
    if (index + 1 < images.length) await sleep(250);
  }
  return attachments;
}

async function sendVk`);
fs.writeFileSync(preparedContentPath, preparedContent);

for (const relativePath of [
  'app/api/admin/inspect-content-bot-temp',
  'app/api/admin/inspect-functions-temp',
  'app/api/admin/inspect-news-candidate-temp',
  'app/api/admin/raw-content-bot-temp',
  'app/api/admin/publish-evening-now',
  'app/api/admin/publish-fallback-now',
  'app/api/admin/publish-monday-fbkilla-now',
  'app/api/admin/publish-scheduled-direct',
  'app/api/admin/run-evening-now',
]) {
  fs.rmSync(path.join(cwd, relativePath), { recursive: true, force: true });
}

const healthPath = path.join(cwd, 'app', 'api', 'health', 'route.js');
fs.mkdirSync(path.dirname(healthPath), { recursive: true });
fs.writeFileSync(healthPath, `export const runtime = 'nodejs';

import { cronProtectionConfigured, getTelegramConfig } from '../../../lib/server-config.js';
import { getVkConfigurationStatus } from '../../../lib/content-bot.js';

export async function GET() {
  const telegram = getTelegramConfig();
  const vk = await getVkConfigurationStatus();
  return Response.json({
    ok: true,
    bot: '@newsparserlh_bot',
    channelConfigured: Boolean(telegram.token && telegram.chatId),
    cronProtected: cronProtectionConfigured(),
    publishing: process.env.PUBLISHING_ENABLED !== 'false',
    vkConfigured: vk.configured,
    vkGroupId: vk.groupId,
    generation: 'ChatGPT — 09:00 МСК в день публикации',
    publication: 'Подготовленный утром комплект — 18:40 МСК',
    schedules: {
      wednesday: 'Прикладной пост — 18:40 МСК',
      friday: 'Работа команды — 18:40 МСК',
      sunday: 'Пост для новичков — 18:40 МСК',
      secondSaturday: 'Отраслевые события, текстовый пост без слайдов — 18:40 МСК'
    }
  });
}
`);

const pagePath = path.join(cwd, 'app', 'page.jsx');
if (fs.existsSync(pagePath)) {
  let page = fs.readFileSync(pagePath, 'utf8');
  page = page
    .replace('по понедельникам, средам, пятницам и воскресеньям', 'по средам, пятницам и воскресеньям')
    .replace('по понедельникам, средам, пятницам и воскресеньям в 18:40 МСК', 'по средам, пятницам и воскресеньям в 18:40 МСК');
  fs.writeFileSync(pagePath, page);
}

const testResult = spawnSync(process.execPath, ['--test', path.join(cwd, 'tests', 'vk-photo-attachment.test.mjs')], {
  cwd,
  stdio: 'inherit',
  env: process.env,
});
if ((testResult.status ?? 1) !== 0) process.exit(testResult.status ?? 1);

const nextBin = path.join(cwd, 'node_modules', '.bin', 'next');
const result = spawnSync(nextBin, ['build'], { cwd, stdio: 'inherit', env: process.env });
process.exit(result.status ?? 1);
