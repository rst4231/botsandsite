const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync, spawnSync } = require('child_process');

const cwd = process.cwd();
const chunks = fs.readdirSync(cwd).filter((name) => /^source\.b64\.\d+$/.test(name)).sort();
if (!chunks.length) throw new Error('Source archive chunks are missing');

const encoded = chunks.map((name) => fs.readFileSync(path.join(cwd, name), 'utf8').trim()).join('');
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'traffic-news-'));
const archive = path.join(tempDir, 'source.tgz');
fs.writeFileSync(archive, Buffer.from(encoded, 'base64'));
execFileSync('tar', ['-xzf', archive, '-C', tempDir], { stdio: 'inherit' });

function findPackageRoot(dir) {
  const queue = [dir];
  while (queue.length) {
    const current = queue.shift();
    if (current !== dir && fs.existsSync(path.join(current, 'package.json'))) return current;
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (entry.isDirectory() && entry.name !== 'node_modules') queue.push(path.join(current, entry.name));
    }
  }
  throw new Error('Restored package.json was not found');
}

const sourceRoot = findPackageRoot(tempDir);
for (const entry of fs.readdirSync(sourceRoot)) {
  const from = path.join(sourceRoot, entry);
  const to = path.join(cwd, entry);
  fs.cpSync(from, to, { recursive: true, force: true });
}

const botPath = path.join(cwd, 'lib', 'content-bot.js');
let bot = fs.readFileSync(botPath, 'utf8');

const constantsNeedle = "const PUBLIC_CHANNEL_FEED_URL = 'https://t.me/s/teamcpalh';\n";
const constantsInsert = `${constantsNeedle}const VK_API_VERSION = '5.199';\nconst VK_GROUP_ID = process.env.VK_GROUP_ID || '160851478';\nconst VK_TOKEN_CACHE_KEY = 'vk-access-token-v1';\nconst VK_FOOTER = '\\n\\nРекомендуем изучить:\\n[Теория](https://vk.ru/app5898182_-160851478#page=67e5217dfe30f032b45b7c82)\\n[Практика](https://vk.ru/away.php?to=https%3A%2F%2Fvk.com%2Fapp5898182_-160851478%23s%3D3112330%26force%3D1&utf=1)';\n`;
if (!bot.includes(constantsNeedle)) throw new Error('Could not patch VK constants');
bot = bot.replace(constantsNeedle, constantsInsert);

const helperNeedle = `function withStandardFooter(text = '') {\n  const footerIndex = text.lastIndexOf(FOOTER_START);\n  const body = footerIndex >= 0 ? text.slice(0, footerIndex) : text;\n  return \`\${body.trimEnd()}\${FOOTER}\`;\n}\n`;
const helperInsert = `${helperNeedle}\nfunction decodeHtmlEntities(value = '') {\n  return value\n    .replace(/&nbsp;/gi, ' ')\n    .replace(/&quot;/gi, '\"')\n    .replace(/&#039;|&apos;/gi, \"'\")\n    .replace(/&lt;/gi, '<')\n    .replace(/&gt;/gi, '>')\n    .replace(/&amp;/gi, '&');\n}\n\nfunction telegramHtmlToVkText(value = '') {\n  let plain = decodeHtmlEntities(value)\n    .replace(/<br\\s*\\/?\\s*>/gi, '\\n')\n    .replace(/<\\/p>/gi, '\\n\\n')\n    .replace(/<[^>]+>/g, '')\n    .replace(/\\r/g, '')\n    .replace(/[ \\t]+\\n/g, '\\n')\n    .replace(/\\n{3,}/g, '\\n\\n')\n    .trim();\n  const footerTextIndex = plain.lastIndexOf('• О нас');\n  if (footerTextIndex >= 0) plain = plain.slice(0, footerTextIndex).trimEnd();\n  return \`\${plain}\${VK_FOOTER}\`;\n}\n\nasync function getVkAccessToken() {\n  return process.env.VK_ACCESS_TOKEN || await cache.get(VK_TOKEN_CACHE_KEY) || null;\n}\n\nexport async function configureVkAccess(token) {\n  const clean = String(token || '').trim();\n  if (!clean) throw new Error('VK access token is missing');\n  await cache.set(VK_TOKEN_CACHE_KEY, clean, { ttl: CACHE_TTL, tags: ['vk-configuration'] });\n  return { configured: true, groupId: VK_GROUP_ID };\n}\n\nasync function callVk(method, params, tokenOverride) {\n  const token = tokenOverride || await getVkAccessToken();\n  if (!token) throw new Error('VK access token is not configured');\n  const body = new URLSearchParams({\n    ...Object.fromEntries(Object.entries(params).map(([key, value]) => [key, String(value)])),\n    access_token: token,\n    v: VK_API_VERSION,\n  });\n  const response = await fetch(\`https://api.vk.com/method/\${method}\`, {\n    method: 'POST',\n    headers: { 'content-type': 'application/x-www-form-urlencoded' },\n    body,\n    cache: 'no-store',\n  });\n  const data = await response.json();\n  if (data.error) throw new Error(\`VK \${data.error.error_code}: \${data.error.error_msg}\`);\n  return data.response;\n}\n\nexport async function sendToVk(text, tokenOverride) {\n  const response = await callVk('wall.post', {\n    owner_id: \`-\${VK_GROUP_ID}\`,\n    from_group: 1,\n    message: telegramHtmlToVkText(text),\n  }, tokenOverride);\n  return response?.post_id;\n}\n\nasync function ensureVkPublication(post, kind, dateKey, tokenOverride) {\n  const cacheKey = \`vk-published:\${kind}:\${dateKey}\`;\n  const existing = await cache.get(cacheKey);\n  if (existing?.postId) return { ok: true, skipped: 'Already published to VK', postId: existing.postId };\n  const token = tokenOverride || await getVkAccessToken();\n  if (!token) return { ok: false, skipped: 'VK is not configured' };\n  try {\n    const postId = await sendToVk(post.text, token);\n    await cache.set(cacheKey, { postId, id: post.id }, { ttl: CACHE_TTL, tags: ['vk-publications'] });\n    return { ok: true, postId };\n  } catch (error) {\n    console.error('VK publishing failed:', error);\n    return { ok: false, error: error instanceof Error ? error.message : 'VK publishing failed' };\n  }\n}\n\nfunction publicTelegramMessagesFromHtml(page = '') {\n  const starts = [...page.matchAll(/<div[^>]+class=[\"'][^\"']*tgme_widget_message[^\"']*[\"'][^>]+data-post=[\"']([^\"']+)[\"'][^>]*>/gi)];\n  return starts.map((match, index) => {\n    const start = match.index || 0;\n    const end = index + 1 < starts.length ? starts[index + 1].index : page.length;\n    const block = page.slice(start, end);\n    const dateMatch = block.match(/<time[^>]+datetime=[\"']([^\"']+)[\"']/i);\n    const textMatch = block.match(/<div[^>]+class=[\"'][^\"']*tgme_widget_message_text[^\"']*[\"'][^>]*>([\\s\\S]*?)<\\/div>/i);\n    return {\n      postRef: match[1],\n      datetime: dateMatch?.[1] || null,\n      rawText: textMatch?.[1] || '',\n      hasBotFooter: block.includes('https://t.me/c/1394610823/767'),\n    };\n  }).filter((item) => item.datetime && item.rawText);\n}\n\nexport async function repostTelegramPostForDateToVk(dateKey, tokenOverride) {\n  const existing = await cache.get(\`vk-reposted-telegram:\${dateKey}\`);\n  if (existing?.postId) return { ok: true, skipped: 'Already reposted to VK', postId: existing.postId, telegramPost: existing.telegramPost };\n  const response = await fetch(PUBLIC_CHANNEL_FEED_URL, {\n    headers: { 'user-agent': 'Mozilla/5.0 (compatible; LHPostVkReposter/1.0)' },\n    cache: 'no-store',\n  });\n  if (!response.ok) throw new Error(\`Telegram public feed returned \${response.status}\`);\n  const page = await response.text();\n  const candidates = publicTelegramMessagesFromHtml(page)\n    .filter((item) => datePartsInMoscow(new Date(item.datetime)).dateKey === dateKey)\n    .filter((item) => item.hasBotFooter);\n  const message = candidates.at(-1);\n  if (!message) throw new Error(\`Bot post for \${dateKey} was not found in the public Telegram feed\`);\n  const postId = await sendToVk(message.rawText, tokenOverride);\n  await cache.set(\`vk-reposted-telegram:\${dateKey}\`, { postId, telegramPost: message.postRef }, { ttl: CACHE_TTL, tags: ['vk-publications'] });\n  return { ok: true, postId, telegramPost: message.postRef, dateKey };\n}\n\nexport async function getVkConfigurationStatus() {\n  const token = await getVkAccessToken();\n  return { configured: Boolean(token), groupId: VK_GROUP_ID };\n}\n`;
if (!bot.includes(helperNeedle)) throw new Error('Could not patch VK helpers');
bot = bot.replace(helperNeedle, helperInsert);

const publishNeedle = `export async function publishPostToChannel(post, kind, dateKey) {\n  const normalizedPost = { ...post, text: withStandardFooter(post.text) };\n  validatePost(normalizedPost);\n  if (await alreadyPublished(kind, dateKey, normalizedPost)) {\n    return { ok: true, skipped: 'The post was already published or would repeat earlier content', kind };\n  }\n  const messageId = await sendToTelegram(normalizedPost.text);\n  await savePublication(normalizedPost, kind, dateKey, messageId);\n  return { ok: true, kind, messageId, title: normalizedPost.title };\n}\n`;
const publishInsert = `export async function publishPostToChannel(post, kind, dateKey) {\n  const normalizedPost = { ...post, text: withStandardFooter(post.text) };\n  validatePost(normalizedPost);\n  if (await alreadyPublished(kind, dateKey, normalizedPost)) {\n    const vk = await ensureVkPublication(normalizedPost, kind, dateKey);\n    return { ok: true, skipped: 'The post was already published or would repeat earlier content', kind, vk };\n  }\n  const messageId = await sendToTelegram(normalizedPost.text);\n  await savePublication(normalizedPost, kind, dateKey, messageId);\n  const vk = await ensureVkPublication(normalizedPost, kind, dateKey);\n  return { ok: true, kind, messageId, title: normalizedPost.title, vk };\n}\n`;
if (!bot.includes(publishNeedle)) throw new Error('Could not patch publishing flow');
bot = bot.replace(publishNeedle, publishInsert);
fs.writeFileSync(botPath, bot);

const healthPath = path.join(cwd, 'app', 'api', 'health', 'route.js');
let health = fs.readFileSync(healthPath, 'utf8');
health = health.replace(
  "import { cronProtectionConfigured, getTelegramConfig } from '../../../lib/server-config.js';",
  "import { cronProtectionConfigured, getTelegramConfig } from '../../../lib/server-config.js';\\nimport { getVkConfigurationStatus } from '../../../lib/content-bot.js';"
);
health = health.replace('  return Response.json({', '  const vk = await getVkConfigurationStatus();\\n\\n  return Response.json({');
health = health.replace(
  "    publishing: process.env.PUBLISHING_ENABLED !== 'false',",
  "    publishing: process.env.PUBLISHING_ENABLED !== 'false',\\n    vkConfigured: vk.configured,\\n    vkGroupId: vk.groupId,"
);
health = health.replace(/\\n/g, '\n');
fs.writeFileSync(healthPath, health);

const setupPath = path.join(cwd, 'app', 'api', 'vk', 'setup', 'route.js');
fs.mkdirSync(path.dirname(setupPath), { recursive: true });
fs.writeFileSync(setupPath, `export const runtime = 'nodejs';\nexport const maxDuration = 60;\n\nimport { createHash } from 'node:crypto';\nimport { configureVkAccess, repostTelegramPostForDateToVk } from '../../../../lib/content-bot.js';\n\nconst EXPECTED_TOKEN_HASH = '1fb51aeb9972dad5cee9c05e9b391b7808f6ecc7fc810a20cec158a4a852e01c';\n\nexport async function GET(request) {\n  const token = request.nextUrl.searchParams.get('token') || '';\n  const tokenHash = createHash('sha256').update(token).digest('hex');\n  if (tokenHash !== EXPECTED_TOKEN_HASH) return new Response('Unauthorized', { status: 401 });\n  try {\n    const configuration = await configureVkAccess(token);\n    const dateKey = request.nextUrl.searchParams.get('date');\n    const repost = dateKey ? await repostTelegramPostForDateToVk(dateKey, token) : null;\n    return Response.json({ ok: true, configuration, repost });\n  } catch (error) {\n    console.error(error);\n    return Response.json({ ok: false, error: error instanceof Error ? error.message : 'VK setup failed' }, { status: 500 });\n  }\n}\n`);

const result = spawnSync(path.join(cwd, 'node_modules', '.bin', 'next'), ['build'], { cwd, stdio: 'inherit', env: process.env });
process.exit(result.status ?? 1);
