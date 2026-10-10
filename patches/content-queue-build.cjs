const fs = require('fs');
const path = require('path');

function transformBuild(source) {
  const marker = "copyPatch('prepared-content.js', 'lib/prepared-content.js');";
  if (!source.includes(marker)) throw new Error('Could not locate prepared-content copy marker');

  const copyLines = [
    "copyPatch('content-queue-client.mjs', 'lib/content-queue-client.mjs');",
    "copyPatch('content-duplicate-guard.mjs', 'lib/content-duplicate-guard.mjs');",
  ];

  let next = source;
  for (const copyLine of copyLines) {
    if (!next.includes(copyLine)) next = next.replace(marker, `${marker}\n${copyLine}`);
  }
  return next;
}

function main() {
  const buildPath = path.join(process.cwd(), 'build.cjs');
  const source = fs.readFileSync(buildPath, 'utf8');
  fs.writeFileSync(buildPath, transformBuild(source));
}

if (require.main === module) main();

module.exports = { transformBuild };
