const fs = require('fs');
const path = require('path');

const cwd = process.cwd();
const buildPath = path.join(cwd, 'build.cjs');
if (!fs.existsSync(buildPath)) throw new Error('build.cjs is missing');
let source = fs.readFileSync(buildPath, 'utf8');

const setupCopy = "copyPatch('vk-setup-route.js', 'app/api/vk/setup/route.js');";
if (!source.includes(setupCopy)) {
  const marker = "copyPatch('prepared-publish-route.js', 'app/api/cron/publish/route.js');";
  if (!source.includes(marker)) throw new Error('Could not locate prepared publish route copy marker');
  source = source.replace(marker, `${marker}\n${setupCopy}`);
}

const obsoleteVkRoutes = [
  'app/api/vk/cache-sync-20260819',
  'app/api/vk/channel-info-temp',
  'app/api/vk/repost-exact-20260816',
  'app/api/vk/repost-from-updates-20260816',
  'app/api/vk/repost-planned',
  'app/api/vk/replace-post-images-story',
];
if (!source.includes(obsoleteVkRoutes[0])) {
  const cleanupMarker = 'for (const relativePath of [\n';
  if (!source.includes(cleanupMarker)) throw new Error('Could not locate build cleanup list');
  const entries = obsoleteVkRoutes.map((route) => `  '${route}',`).join('\n');
  source = source.replace(cleanupMarker, `${cleanupMarker}${entries}\n`);
}

fs.writeFileSync(buildPath, source);
