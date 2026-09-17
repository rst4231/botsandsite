const fs = require('fs');
const path = require('path');

const BUILD_MARKER = "const testResult = spawnSync(process.execPath, ['--test', path.join(cwd, 'tests', 'vk-photo-attachment.test.mjs')], {";
const INJECTION_MARKER = "const calendarPageSourcePath = path.join(cwd, 'patches', 'calendar-page.jsx');";

const CALENDAR_INJECTION = `const calendarPageSourcePath = path.join(cwd, 'patches', 'calendar-page.jsx');
const calendarClientSourcePath = path.join(cwd, 'patches', 'publication-calendar-client.jsx');
const calendarCssSourcePath = path.join(cwd, 'patches', 'publication-calendar.css');
const calendarResponsiveCssSourcePath = path.join(cwd, 'patches', 'publication-calendar-responsive.css');
const botFunctionsCssSourcePath = path.join(cwd, 'patches', 'bot-functions.css');
const botFunctionCatalogPath = path.join(cwd, 'patches', 'bot-function-catalog.cjs');
const calendarLogicSourcePath = path.join(cwd, 'patches', 'publication-calendar.mjs');
const siteBrandPath = path.join(cwd, 'patches', 'site-brand.cjs');
if (fs.existsSync(pagePath)) {
  const calendarCss = [
    fs.readFileSync(calendarCssSourcePath, 'utf8').trimEnd(),
    fs.readFileSync(calendarResponsiveCssSourcePath, 'utf8').trim(),
    fs.readFileSync(botFunctionsCssSourcePath, 'utf8').trim(),
  ].join('\\n\\n');
  fs.copyFileSync(calendarPageSourcePath, pagePath);
  fs.copyFileSync(calendarClientSourcePath, path.join(cwd, 'app', 'publication-calendar-client.jsx'));
  fs.writeFileSync(path.join(cwd, 'app', 'publication-calendar.css'), calendarCss + '\\n');
  fs.copyFileSync(calendarLogicSourcePath, path.join(cwd, 'lib', 'publication-calendar.mjs'));
  const { writeBotFunctionCatalog } = require(botFunctionCatalogPath);
  writeBotFunctionCatalog(cwd);
}

const { transformLayout, SITE_ICON_SVG } = require(siteBrandPath);
const layoutCandidates = [
  path.join(cwd, 'app', 'layout.jsx'),
  path.join(cwd, 'app', 'layout.js'),
  path.join(cwd, 'app', 'layout.tsx'),
  path.join(cwd, 'app', 'layout.ts'),
];
const layoutPath = layoutCandidates.find((candidate) => fs.existsSync(candidate));
if (layoutPath) {
  const layoutSource = fs.readFileSync(layoutPath, 'utf8');
  fs.writeFileSync(layoutPath, transformLayout(layoutSource));
}
fs.writeFileSync(path.join(cwd, 'app', 'icon.svg'), SITE_ICON_SVG);

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
