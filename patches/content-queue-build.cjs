const fs = require('fs');
const path = require('path');

function transformBuild(source) {
  const copyLine = "copyPatch('content-queue-client.mjs', 'lib/content-queue-client.mjs');";
  if (source.includes(copyLine)) return source;
  const marker = "copyPatch('prepared-content.js', 'lib/prepared-content.js');";
  if (!source.includes(marker)) throw new Error('Could not locate prepared-content copy marker');
  return source.replace(marker, `${marker}\n${copyLine}`);
}

function main() {
  const buildPath = path.join(process.cwd(), 'build.cjs');
  const source = fs.readFileSync(buildPath, 'utf8');
  fs.writeFileSync(buildPath, transformBuild(source));
}

if (require.main === module) main();

module.exports = { transformBuild };
