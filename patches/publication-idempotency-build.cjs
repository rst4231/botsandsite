const fs = require('fs');
const path = require('path');
const { transformPreparedContent } = require('./publication-idempotency-transform.cjs');

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

const writeMarker = 'fs.writeFileSync(preparedContentPath, preparedContent);';
if (!source.includes(writeMarker)) throw new Error('Could not locate prepared-content write marker');
const invocation = "preparedContent = require(path.join(cwd, 'patches', 'publication-idempotency-transform.cjs')).transformPreparedContent(preparedContent);";
if (!source.includes(invocation)) source = source.replace(writeMarker, `${invocation}\n${writeMarker}`);

if (typeof transformPreparedContent !== 'function') throw new Error('Publication transformer is unavailable');
fs.writeFileSync(buildPath, source);
