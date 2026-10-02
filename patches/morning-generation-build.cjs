const fs = require('fs');
const path = require('path');

const cwd = process.cwd();
const buildPath = path.join(cwd, 'build.cjs');
if (!fs.existsSync(buildPath)) throw new Error('build.cjs is missing');
let source = fs.readFileSync(buildPath, 'utf8');

const publishCopy = "copyPatch('prepared-publish-route.js', 'app/api/cron/publish/route.js');";
const generatorCopy = "copyPatch('prepared-generator.js', 'lib/prepared-generator.js');";
const prepareCopy = "copyPatch('prepared-generate-route.js', 'app/api/cron/prepare/route.js');";
const recoveryCopy = "copyPatch('prepared-generate-route.js', 'app/api/cron/prepare-recovery/route.js');";

if (!source.includes(generatorCopy)) {
  if (!source.includes(publishCopy)) throw new Error('Could not locate prepared publish route copy marker');
  source = source.replace(publishCopy, [publishCopy, generatorCopy, prepareCopy, recoveryCopy].join('\n'));
}

const publishOnlyCron = "vercelConfig.crons = [{ path: '/api/cron/publish', schedule: '40 15 * * *' }];";
const protectedCrons = "vercelConfig.crons = [\n  { path: '/api/cron/prepare', schedule: '0 6 * * *' },\n  { path: '/api/cron/prepare-recovery', schedule: '20 15 * * *' },\n  { path: '/api/cron/publish', schedule: '40 15 * * *' },\n];";

if (source.includes(publishOnlyCron)) {
  source = source.replace(publishOnlyCron, protectedCrons);
} else if (!source.includes("{ path: '/api/cron/prepare', schedule: '0 6 * * *' }")) {
  throw new Error('Could not locate normalized Vercel cron configuration');
}

fs.writeFileSync(buildPath, source);
