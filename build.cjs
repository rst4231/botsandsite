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

const nextBin = path.join(cwd, 'node_modules', '.bin', 'next');
const result = spawnSync(nextBin, ['build'], { cwd, stdio: 'inherit', env: process.env });
process.exit(result.status ?? 1);
