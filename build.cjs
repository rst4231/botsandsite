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

// Monday news rules: lowercase hashtag, max age 7 days, skip already used source URLs.
contentBot = contentBot.replace(/#Новости/g, '#новости');
contentBot = contentBot.replace(
  "const cutoff = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);\n  for (const candidate of candidates) {",
  "const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);\n  const usedNewsIds = new Set((await history()).filter((item) => item?.kind === 'fb-killa').map((item) => item.id));\n  for (const candidate of candidates) {\n    if (usedNewsIds.has(`fb-killa:${candidate.url}`)) continue;"
);

// Search only the FB-Killa News section instead of the mixed homepage.
contentBot = contentBot.replace(
  "const response = await fetch('https://fb-killa.pro/', {",
  "const response = await fetch('https://fb-killa.pro/forums/novosti.338/', {"
);

// Preserve the raw title so relevance can be checked before platform names are sanitized for publication.
contentBot = contentBot.replace(
  ".map((match) => ({ url: new URL(match[1], 'https://fb-killa.pro').toString(), title: sanitizePlatformNames(htmlToText(match[2])) }))",
  ".map((match) => { const rawTitle = htmlToText(match[2]); return { url: new URL(match[1], 'https://fb-killa.pro').toString(), rawTitle, title: sanitizePlatformNames(rawTitle) }; })"
);

// FB-only advertising/news filter. Check title + description only, never the common site header/footer.
// Require both an FB/Meta product signal and an advertising/account-management signal.
// Reject scam, crypto, gambling, legal/crime and other unrelated industry noise.
contentBot = contentBot.replace(
  "    const description = articleHtml.match(/<meta[^>]+name=[\\\"']description[\\\"'][^>]+content=[\\\"']([^\\\"']+)[\\\"']/i)?.[1]\n      ?? articleHtml.match(/<meta[^>]+content=[\\\"']([^\\\"']+)[\\\"'][^>]+name=[\\\"']description[\\\"']/i)?.[1]\n      ?? '';\n    return { ...candidate, description: sanitizePlatformNames(description), articleHtml, publishedAt };",
  "    const description = articleHtml.match(/<meta[^>]+name=[\\\"']description[\\\"'][^>]+content=[\\\"']([^\\\"']+)[\\\"']/i)?.[1]\n      ?? articleHtml.match(/<meta[^>]+content=[\\\"']([^\\\"']+)[\\\"'][^>]+name=[\\\"']description[\\\"']/i)?.[1]\n      ?? '';\n    const rawRelevanceText = `${candidate.rawTitle || ''} ${htmlToText(description)}`;\n    const hasFbSignal = /(?:\\bfacebook\\b|\\bmeta\\b|\\bfb\\b|фейсбук|\\bмета\\b|ads\\s*manager|business\\s*suite|business\\s*manager|advantage\\+?|fanpage|фанпейдж)/i.test(rawRelevanceText);\n    const hasAdsSignal = /(?:\\bads?\\b|advertis|реклам|кабинет|аккаунт|account|campaign|кампан|ads\\s*manager|business\\s*suite|business\\s*manager|advantage\\+?|pixel|пиксел|conversion|конверс|capi|модерац|\\bban\\b|бан|блок|fanpage|фанпейдж|payment|billing|оплат|creative|креатив|target|таргет|lead|лид|placement|плейсмент|audience|аудитор|tracking|трекинг)/i.test(rawRelevanceText);\n    const isNoise = /(?:мошенн|скам|scam|fraud|фишинг|phishing|крипт|crypto|казино|casino|слот|букмек|ставк|betting|зарплат|salary|задержан|арест|санкц|угрозы суда|судебн|полиц|уголов|выигрыш|лотере)/i.test(candidate.rawTitle || '');\n    if (!hasFbSignal || !hasAdsSignal || isNoise) continue;\n    return { ...candidate, description: sanitizePlatformNames(description), articleHtml, publishedAt };"
);

if (!contentBot.includes('export async function publishedTopicPostForDate')) {
  const marker = '\nfunction regularKindForWeekday(weekday) {';
  const helper = `\nexport async function publishedTopicPostForDate(kind, dateKey) {\n  const published = await cache.get(\`published:\${kind}:\${dateKey}\`);\n  if (!published?.id || !TOPICS[kind]) return null;\n  const date = new Date(\`\${dateKey}T12:00:00Z\`);\n  const capacity = TOPICS[kind].length * ANGLES.length * LENSES.length;\n  for (let index = 0; index < capacity; index += 1) {\n    const candidate = topicPost(kind, date, index);\n    if (candidate.id === published.id) return { ...candidate, messageId: published.messageId };\n  }\n  return null;\n}\n`;
  if (!contentBot.includes(marker)) throw new Error('Could not add published post reconstruction helper');
  contentBot = contentBot.replace(marker, `${helper}${marker}`);
}

fs.writeFileSync(contentBotPath, contentBot);

const nextBin = path.join(cwd, 'node_modules', '.bin', 'next');
const result = spawnSync(nextBin, ['build'], { cwd, stdio: 'inherit', env: process.env });
process.exit(result.status ?? 1);
