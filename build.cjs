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

const contentBotPath = path.join(cwd, 'lib', 'content-bot.js');
let contentBot = fs.readFileSync(contentBotPath, 'utf8');

// VK footer: use VK-native [url|label] links exactly as requested.
contentBot = contentBot.replace(
  /const VK_FOOTER = '[^']*';/,
  "const VK_FOOTER = '\\n\\nРекомендуем изучить:\\n[https://vk.ru/app5898182_-160851478#page=67e5217dfe30f032b45b7c8|Теория]\\n[https://vk.com/app5898182_-160851478#s=3112330&force=1&utf=1|Практика]';"
);

// Every VK post must have comments disabled.
contentBot = contentBot.replace(
  "  const response = await callVk('wall.post', {\n    owner_id: `-${VK_GROUP_ID}`,\n    from_group: 1,\n    message: telegramHtmlToVkText(text),\n  }, tokenOverride);\n  return response?.post_id;",
  "  const response = await callVk('wall.post', {\n    owner_id: `-${VK_GROUP_ID}`,\n    from_group: 1,\n    message: telegramHtmlToVkText(text),\n  }, tokenOverride);\n  const postId = response?.post_id;\n  if (postId) {\n    await callVk('wall.closeComments', { owner_id: `-${VK_GROUP_ID}`, post_id: postId }, tokenOverride);\n  }\n  return postId;"
);

// Remove Monday FB-Killa parsing and publishing completely.
contentBot = contentBot.replace(
  "  if (parts.weekday === 1) return { ...parts, kind: 'fb-killa' };\n",
  ''
);

contentBot = contentBot.replace(
  /\nfunction sanitizePlatformNames\(value = ''\) \{[\s\S]*?\nfunction parseMonth\(value\) \{/,
  '\nfunction parseMonth(value) {'
);

contentBot = contentBot.replace(
  "export async function createPost(kind, date = new Date()) {\n  if (kind === 'fb-killa') {\n    const article = await getLatestFbKillaArticle();\n    return article ? newsPost(article) : null;\n  }\n  if (kind === 'events') return eventsPost(await getUpcomingEvents(date), date);\n  return plannedTopicPost(kind, date);\n}",
  "export async function createPost(kind, date = new Date()) {\n  if (kind === 'events') return eventsPost(await getUpcomingEvents(date), date);\n  return plannedTopicPost(kind, date);\n}"
);

if (!contentBot.includes('export async function publishedTopicPostForDate')) {
  const marker = '\nfunction regularKindForWeekday(weekday) {';
  const helper = `\nexport async function publishedTopicPostForDate(kind, dateKey) {\n  const published = await cache.get(\`published:\${kind}:\${dateKey}\`);\n  if (!published?.id || !TOPICS[kind]) return null;\n  const date = new Date(\`\${dateKey}T12:00:00Z\`);\n  const capacity = TOPICS[kind].length * ANGLES.length * LENSES.length;\n  for (let index = 0; index < capacity; index += 1) {\n    const candidate = topicPost(kind, date, index);\n    if (candidate.id === published.id) return { ...candidate, messageId: published.messageId };\n  }\n  return null;\n}\n`;
  if (!contentBot.includes(marker)) throw new Error('Could not add published post reconstruction helper');
  contentBot = contentBot.replace(marker, `${helper}${marker}`);
}

fs.writeFileSync(contentBotPath, contentBot);

// Remove Monday from public health/status text.
const healthPath = path.join(cwd, 'app', 'api', 'health', 'route.js');
if (fs.existsSync(healthPath)) {
  let health = fs.readFileSync(healthPath, 'utf8');
  health = health.replace(/^\s*monday:\s*['"`][^'"`]*['"`],?\s*$/m, '');
  fs.writeFileSync(healthPath, health);
}

const pagePath = path.join(cwd, 'app', 'page.jsx');
if (fs.existsSync(pagePath)) {
  let page = fs.readFileSync(pagePath, 'utf8');
  page = page.replace(
    'по понедельникам, средам, пятницам и воскресеньям',
    'по средам, пятницам и воскресеньям'
  );
  fs.writeFileSync(pagePath, page);
}

// Remove temporary Monday-news endpoints from the built app as well.
for (const relativePath of [
  'app/api/admin/inspect-news-candidate-temp',
  'app/api/admin/publish-monday-fbkilla-now',
]) {
  fs.rmSync(path.join(cwd, relativePath), { recursive: true, force: true });
}

const nextBin = path.join(cwd, 'node_modules', '.bin', 'next');
const result = spawnSync(nextBin, ['build'], { cwd, stdio: 'inherit', env: process.env });
process.exit(result.status ?? 1);
