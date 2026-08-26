const fs = require('fs');
const path = require('path');
const { transformPreparedContent } = require('./publication-idempotency-transform.cjs');
const { transformPublicationRunGuard } = require('./publication-run-guard-transform.cjs');

const cwd = process.cwd();
const buildPath = path.join(cwd, 'build.cjs');
if (!fs.existsSync(buildPath)) throw new Error('build.cjs is missing');
let source = fs.readFileSync(buildPath, 'utf8');

const publishCopy = "copyPatch('prepared-publish-route.js', 'app/api/cron/publish/route.js');";
const stateCopy = "copyPatch('publication-state.mjs', 'lib/publication-state.mjs');";
if (!source.includes(stateCopy)) {
  if (!source.includes(publishCopy)) throw new Error('Could not locate publication state copy marker');
  source = source.replace(publishCopy, `${publishCopy}\n${stateCopy}`);
}

const obsoletePreview = "  'app/api/admin/send-prepared-preview',";
if (!source.includes(obsoletePreview)) {
  const cleanupMarker = 'for (const relativePath of [\n';
  if (!source.includes(cleanupMarker)) throw new Error('Could not locate build cleanup list');
  source = source.replace(cleanupMarker, `${cleanupMarker}${obsoletePreview}\n`);
}

const extractMarker = "execFileSync('tar', ['-xzf', archivePath, '-C', cwd], { stdio: 'inherit' });";
const cronMarker = "vercelConfig.crons = [{ path: '/api/cron/publish', schedule: '40 15 * * *' }];";
if (!source.includes(cronMarker)) {
  if (!source.includes(extractMarker)) throw new Error('Could not locate source archive extraction marker');
  const cronNormalization = [
    extractMarker,
    '',
    "const vercelConfigPath = path.join(cwd, 'vercel.json');",
    'let vercelConfig = {};',
    'try {',
    "  if (fs.existsSync(vercelConfigPath)) vercelConfig = JSON.parse(fs.readFileSync(vercelConfigPath, 'utf8'));",
    '} catch (error) {',
    "  throw new Error(`Could not parse vercel.json after source extraction: ${error instanceof Error ? error.message : String(error)}`);",
    '}',
    "vercelConfig.$schema = vercelConfig.$schema || 'https://openapi.vercel.sh/vercel.json';",
    cronMarker,
    "fs.writeFileSync(vercelConfigPath, JSON.stringify(vercelConfig, null, 2) + '\\n');",
  ].join('\n');
  source = source.replace(extractMarker, cronNormalization);
}

const writeMarker = 'fs.writeFileSync(preparedContentPath, preparedContent);';
if (!source.includes(writeMarker)) throw new Error('Could not locate prepared-content write marker');
const invocation = "preparedContent = require(path.join(cwd, 'patches', 'publication-idempotency-transform.cjs')).transformPreparedContent(preparedContent);";
const runGuardInvocation = "preparedContent = require(path.join(cwd, 'patches', 'publication-run-guard-transform.cjs')).transformPublicationRunGuard(preparedContent);";
if (!source.includes(invocation)) {
  source = source.replace(writeMarker, `${invocation}\n${runGuardInvocation}\n${writeMarker}`);
} else if (!source.includes(runGuardInvocation)) {
  source = source.replace(invocation, `${invocation}\n${runGuardInvocation}`);
}

if (typeof transformPreparedContent !== 'function') throw new Error('Publication transformer is unavailable');
if (typeof transformPublicationRunGuard !== 'function') throw new Error('Publication run guard transformer is unavailable');
fs.writeFileSync(buildPath, source);
