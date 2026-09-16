import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const clientPath = path.join(here, '..', 'patches', 'publication-calendar-client.jsx');
const responsivePath = path.join(here, '..', 'patches', 'publication-calendar-responsive.css');

test('calendar initializes Telegram Mini App and disables container swipes', () => {
  const client = fs.readFileSync(clientPath, 'utf8');
  assert.match(client, /window\.Telegram\?\.WebApp/);
  assert.match(client, /webApp\.ready\(\)/);
  assert.match(client, /webApp\.expand\(\)/);
  assert.match(client, /disableVerticalSwipes/);
});

test('calendar prevents horizontal drift in Telegram WebView', () => {
  const css = fs.readFileSync(responsivePath, 'utf8');
  assert.match(css, /overflow-x:\s*(?:clip|hidden)/);
  assert.match(css, /box-sizing:\s*border-box/);
  assert.match(css, /touch-action:\s*pan-y/);
});
