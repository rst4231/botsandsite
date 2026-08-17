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

const nextBin = path.join(cwd, 'node_modules', '.bin', 'next');
const result = spawnSync(nextBin, ['build'], { cwd, stdio: 'inherit', env: process.env });
process.exit(result.status ?? 1);
