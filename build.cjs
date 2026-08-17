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
if (!contentBot.includes('export async function publishedTopicPostForDate')) {
  const marker = '\nfunction regularKindForWeekday(weekday) {';
  const helper = `\nexport async function publishedTopicPostForDate(kind, dateKey) {\n  const published = await cache.get(\`published:\${kind}:\${dateKey}\`);\n  if (!published?.id || !TOPICS[kind]) return null;\n  const date = new Date(\`\${dateKey}T12:00:00Z\`);\n  const capacity = TOPICS[kind].length * ANGLES.length * LENSES.length;\n  for (let index = 0; index < capacity; index += 1) {\n    const candidate = topicPost(kind, date, index);\n    if (candidate.id === published.id) return { ...candidate, messageId: published.messageId };\n  }\n  return null;\n}\n`;
  if (!contentBot.includes(marker)) throw new Error('Could not add published post reconstruction helper');
  contentBot = contentBot.replace(marker, `${helper}${marker}`);
  fs.writeFileSync(contentBotPath, contentBot);
}

const routeDir = path.join(cwd, 'app', 'api', 'vk', 'repost-history-a19c7e52');
fs.mkdirSync(routeDir, { recursive: true });
fs.writeFileSync(path.join(routeDir, 'route.js'), `export const runtime = 'nodejs';\nexport const maxDuration = 60;\n\nimport { publishedTopicPostForDate } from '../../../../lib/content-bot.js';\nimport { publishTelegramTextToVk } from '../../../../lib/vk.js';\n\nexport async function GET(request) {\n  const date = request.nextUrl.searchParams.get('date') || '2026-08-16';\n  const kind = request.nextUrl.searchParams.get('kind') || 'beginner';\n  const post = await publishedTopicPostForDate(kind, date);\n  if (!post) return Response.json({ ok: false, error: 'Stored publication was not found', kind, date }, { status: 404 });\n  const vk = await publishTelegramTextToVk(post.text, post.messageId);\n  return Response.json({ ok: true, kind, date, telegramMessageId: post.messageId, title: post.title, vk });\n}\n`);

const nextBin = path.join(cwd, 'node_modules', '.bin', 'next');
const result = spawnSync(nextBin, ['build'], { cwd, stdio: 'inherit', env: process.env });
process.exit(result.status ?? 1);
