const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const cwd = process.cwd();
const unitTest = spawnSync(process.execPath, ['--test', path.join(cwd, 'tests', 'runtime-content-fallback.test.mjs')], {
  cwd,
  stdio: 'inherit',
  env: process.env,
});
if ((unitTest.status ?? 1) !== 0) process.exit(unitTest.status ?? 1);

const buildPath = path.join(cwd, 'build.cjs');
let source = fs.readFileSync(buildPath, 'utf8');
const writeMarker = 'fs.writeFileSync(preparedContentPath, preparedContent);';
if (!source.includes(writeMarker)) throw new Error('Could not locate prepared-content build write marker');

const transform = [
  "const runtimeImport = \"import { getTelegramConfig } from './server-config.js';\";",
  "if (!preparedContent.includes(\"loadRuntimeContentIssue\")) {",
  "  if (!preparedContent.includes(runtimeImport)) throw new Error('Could not locate prepared-content import marker');",
  "  preparedContent = preparedContent.replace(",
  "    runtimeImport,",
  "    runtimeImport + \"\\nimport { loadRuntimeContentIssue } from './runtime-content-issue.mjs';\",",
  "  );",
  "}",
  "",
  "const escapeMarker = \"function escapeHtml(value = '') {\";",
  "if (!preparedContent.includes('async function durablePreparedFallback(dateKey)')) {",
  "  if (!preparedContent.includes(escapeMarker)) throw new Error('Could not locate prepared-content helper marker');",
  "  preparedContent = preparedContent.replace(escapeMarker, [",
  "    \"async function durablePreparedFallback(dateKey) {\",",
  "    \"  try {\",",
  "    \"    return await loadRuntimeContentIssue(dateKey);\",",
  "    \"  } catch (error) {\",",
  "    \"    console.error('RUNTIME_CONTENT_FALLBACK_ERROR', error);\",",
  "    \"    return null;\",",
  "    \"  }\",",
  "    \"}\",",
  "    \"\",",
  "    escapeMarker,",
  "  ].join('\\n'));",
  "}",
  "",
  "const statusRead = [",
  "  \"  const [content, status] = await Promise.all([\",",
  "  \"    cache.get(`prepared-content:${dateKey}`),\",",
  "  \"    cache.get(`prepared-status:${dateKey}`),\",",
  "  \"  ]);\",",
  "].join('\\n');",
  "const statusFallback = [",
  "  \"  const [cachedContent, cachedStatus] = await Promise.all([\",",
  "  \"    cache.get(`prepared-content:${dateKey}`),\",",
  "  \"    cache.get(`prepared-status:${dateKey}`),\",",
  "  \"  ]);\",",
  "  \"  const durableFallback = cachedContent ? null : await durablePreparedFallback(dateKey);\",",
  "  \"  const content = cachedContent || durableFallback?.item || null;\",",
  "  \"  const status = { ...(durableFallback?.status || {}), ...(cachedStatus || {}) };\",",
  "].join('\\n');",
  "if (preparedContent.includes(statusRead)) preparedContent = preparedContent.replace(statusRead, statusFallback);",
  "if (!preparedContent.includes('const content = cachedContent || durableFallback?.item || null;')) {",
  "  throw new Error('Could not patch durable fallback into getPreparedStatus');",
  "}",
  "",
  "const publishItem = \"  const item = await cache.get(`prepared-content:${schedule.dateKey}`);\";",
  "const publishFallback = [",
  "  \"  const cachedItem = await cache.get(`prepared-content:${schedule.dateKey}`);\",",
  "  \"  const durableFallback = cachedItem ? null : await durablePreparedFallback(schedule.dateKey);\",",
  "  \"  const item = cachedItem || durableFallback?.item || null;\",",
  "].join('\\n');",
  "if (preparedContent.includes(publishItem)) preparedContent = preparedContent.replace(publishItem, publishFallback);",
  "if (!preparedContent.includes('const item = cachedItem || durableFallback?.item || null;')) {",
  "  throw new Error('Could not patch durable fallback into publisher');",
  "}",
  "",
  "const publishStatus = \"  const status = (await cache.get(statusKey)) || {};\";",
  "const publishStatusFallback = [",
  "  \"  const cachedStatus = (await cache.get(statusKey)) || {};\",",
  "  \"  const status = { ...(durableFallback?.status || {}), ...cachedStatus };\",",
  "].join('\\n');",
  "if (preparedContent.includes(publishStatus)) preparedContent = preparedContent.replace(publishStatus, publishStatusFallback);",
  "if (!preparedContent.includes('const status = { ...(durableFallback?.status || {}), ...cachedStatus };')) {",
  "  throw new Error('Could not patch durable status into publisher');",
  "}",
  "",
].join('\n');

source = source.replace(writeMarker, transform + '\n' + writeMarker);
fs.writeFileSync(buildPath, source);
