const fs = require('fs');
const path = require('path');

const BUILD_MARKER = "const testResult = spawnSync(process.execPath, ['--test', path.join(cwd, 'tests', 'vk-photo-attachment.test.mjs')], {";
const INJECTION_MARKER = "const calendarPageSourcePath = path.join(cwd, 'patches', 'calendar-page.jsx');";

const CALENDAR_INJECTION = `const calendarPageSourcePath = path.join(cwd, 'patches', 'calendar-page.jsx');
const calendarCssSourcePath = path.join(cwd, 'patches', 'publication-calendar.css');
const calendarLogicSourcePath = path.join(cwd, 'patches', 'publication-calendar.mjs');
if (fs.existsSync(pagePath)) {
  const legacyPagePath = path.join(cwd, 'app', 'legacy-page.jsx');
  fs.copyFileSync(pagePath, legacyPagePath);
  fs.copyFileSync(calendarPageSourcePath, pagePath);
  fs.copyFileSync(calendarCssSourcePath, path.join(cwd, 'app', 'publication-calendar.css'));
  fs.copyFileSync(calendarLogicSourcePath, path.join(cwd, 'lib', 'publication-calendar.mjs'));
}

`;

function transformBuild(source) {
  if (source.includes(INJECTION_MARKER)) return source;
  if (!source.includes(BUILD_MARKER)) {
    throw new Error('Could not locate Next build pre-test marker for publication calendar');
  }
  return source.replace(BUILD_MARKER, CALENDAR_INJECTION + BUILD_MARKER);
}

function main() {
  const cwd = process.cwd();
  const buildPath = path.join(cwd, 'build.cjs');
  const source = fs.readFileSync(buildPath, 'utf8');
  fs.writeFileSync(buildPath, transformBuild(source));
}

if (require.main === module) main();

module.exports = { transformBuild };
