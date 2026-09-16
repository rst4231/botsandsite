import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const responsivePath = path.join(here, '..', 'patches', 'publication-calendar-responsive.css');
const buildHookPath = path.join(here, '..', 'patches', 'calendar-build.cjs');

test('calendar uses Telegram Mini App responsive grids without horizontal overflow', () => {
  assert.ok(fs.existsSync(responsivePath), 'responsive calendar CSS is missing');
  const css = fs.readFileSync(responsivePath, 'utf8');

  assert.match(css, /@media \(max-width: 1199px\)[\s\S]*?grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(css, /@media \(max-width: 760px\)[\s\S]*?grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(css, /@media \(max-width: 520px\)[\s\S]*?grid-template-columns:\s*1fr/);
  assert.match(css, /safe-area-inset-left/);
  assert.match(css, /safe-area-inset-right/);
  assert.match(css, /safe-area-inset-bottom/);
  assert.match(css, /--tg-content-safe-area-inset-left/);
});

test('calendar build appends responsive overrides to the generated calendar stylesheet', () => {
  const buildHook = fs.readFileSync(buildHookPath, 'utf8');
  assert.match(buildHook, /publication-calendar-responsive\.css/);
  assert.match(buildHook, /fs\.readFileSync\(calendarResponsiveCssSourcePath, 'utf8'\)/);
  assert.match(buildHook, /fs\.writeFileSync\(path\.join\(cwd, 'app', 'publication-calendar\.css'\), calendarCss \+ '\\\\n'\)/);
});
