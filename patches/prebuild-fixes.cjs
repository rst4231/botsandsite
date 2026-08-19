const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const cwd = process.cwd();
const lhMark = /,\s*React\.createElement\('div', \{ style: \{ marginLeft: '8px' \} \}, 'LH'\),?/g;

for (const relativePath of [
  'patches/prepared-content.js',
  'app/api/admin/send-prepared-preview/route.js',
]) {
  const filePath = path.join(cwd, relativePath);
  if (!fs.existsSync(filePath)) continue;
  const source = fs.readFileSync(filePath, 'utf8');
  fs.writeFileSync(filePath, source.replace(lhMark, ''));
}

const preparedPath = path.join(cwd, 'patches', 'prepared-content.js');
if (fs.existsSync(preparedPath)) {
  const source = fs.readFileSync(preparedPath, 'utf8');
  fs.writeFileSync(preparedPath, source.replace(
    'No prepared content from the 09:00 ChatGPT generation',
    'No prepared content from the 01:00 ChatGPT generation',
  ));
}

const buildPath = path.join(cwd, 'build.cjs');
if (fs.existsSync(buildPath)) {
  const source = fs.readFileSync(buildPath, 'utf8');
  fs.writeFileSync(buildPath, source.replace(
    "generation: 'ChatGPT — 09:00 МСК в день публикации'",
    "generation: 'ChatGPT — 01:00 МСК в день публикации'",
  ));
}

const testPath = path.join(cwd, 'tests', 'vk-prepared-manual.test.mjs');
if (fs.existsSync(testPath)) {
  const result = spawnSync(process.execPath, ['--test', testPath], { cwd, stdio: 'inherit', env: process.env });
  if ((result.status ?? 1) !== 0) process.exit(result.status ?? 1);
}
