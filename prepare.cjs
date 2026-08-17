const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = process.cwd();
const recoveryDir = path.join(root, '.recovered');
const archivePath = path.join(root, '.source.tgz');

function findPackageDir(dir) {
  const candidate = path.join(dir, 'package.json');
  if (fs.existsSync(candidate)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(candidate, 'utf8'));
      if (pkg.name === 'traffic-news-telegram-bot') return dir;
    } catch {}
  }
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const found = findPackageDir(path.join(dir, entry.name));
    if (found) return found;
  }
  return null;
}

function copyTree(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    if (entry.name === '.DS_Store' || entry.name === 'node_modules' || entry.name === '.next') continue;
    const src = path.join(from, entry.name);
    const dst = path.join(to, entry.name);
    if (entry.isDirectory()) copyTree(src, dst);
    else fs.copyFileSync(src, dst);
  }
}

const chunks = fs.readdirSync(root).filter((name) => /^source\.b64\.\d+$/.test(name)).sort();
if (!chunks.length) throw new Error('Source archive chunks were not found');
const encoded = chunks.map((name) => fs.readFileSync(path.join(root, name), 'utf8')).join('').replace(/\s+/g, '');
fs.writeFileSync(archivePath, Buffer.from(encoded, 'base64'));
fs.rmSync(recoveryDir, { recursive: true, force: true });
fs.mkdirSync(recoveryDir, { recursive: true });
execFileSync('tar', ['-xzf', archivePath, '-C', recoveryDir], { stdio: 'inherit' });

const sourceDir = findPackageDir(recoveryDir);
if (!sourceDir) throw new Error('traffic-news-telegram-bot package was not found in the recovered archive');
copyTree(sourceDir, root);

const contentBotPath = path.join(root, 'lib', 'content-bot.js');
let contentBot = fs.readFileSync(contentBotPath, 'utf8');
if (!contentBot.includes("import { publishTelegramTextToVk } from './vk.js';")) {
  const importNeedle = "import { getTelegramConfig } from './server-config.js';";
  if (!contentBot.includes(importNeedle)) throw new Error('Telegram config import was not found');
  contentBot = contentBot.replace(importNeedle, `${importNeedle}\nimport { publishTelegramTextToVk } from './vk.js';`);
}

if (!contentBot.includes("console.error('VK duplicate failed:', error);")) {
  const oldBlock = `  const messageId = await sendToTelegram(normalizedPost.text);\n  await savePublication(normalizedPost, kind, dateKey, messageId);\n  return { ok: true, kind, messageId, title: normalizedPost.title };`;
  const newBlock = `  const messageId = await sendToTelegram(normalizedPost.text);\n  await savePublication(normalizedPost, kind, dateKey, messageId);\n\n  let vk = null;\n  try {\n    vk = await publishTelegramTextToVk(normalizedPost.text, messageId);\n  } catch (error) {\n    console.error('VK duplicate failed:', error);\n    vk = { ok: false, error: error instanceof Error ? error.message : 'Unknown VK error' };\n  }\n\n  return { ok: true, kind, messageId, title: normalizedPost.title, vk };`;
  if (!contentBot.includes(oldBlock)) throw new Error('Telegram publish block was not found');
  contentBot = contentBot.replace(oldBlock, newBlock);
}
fs.writeFileSync(contentBotPath, contentBot);

fs.mkdirSync(path.join(root, 'lib'), { recursive: true });
fs.copyFileSync(path.join(root, 'patches', 'vk.js'), path.join(root, 'lib', 'vk.js'));

const bootstrapDir = path.join(root, 'app', 'api', 'admin', 'vk-bootstrap-a7f9c31b');
const syncDir = path.join(root, 'app', 'api', 'admin', 'vk-sync-a7f9c31b');
fs.mkdirSync(bootstrapDir, { recursive: true });
fs.mkdirSync(syncDir, { recursive: true });
fs.copyFileSync(path.join(root, 'patches', 'vk-bootstrap-route.js'), path.join(bootstrapDir, 'route.js'));
fs.copyFileSync(path.join(root, 'patches', 'vk-sync-route.js'), path.join(syncDir, 'route.js'));

console.log('Recovered source and applied Telegram → VK patch.');
