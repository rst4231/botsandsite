import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { discoverBotFunctions } from '../patches/bot-function-catalog.cjs';

function writeRoute(root, route) {
  const dir = path.join(root, 'app', ...route.split('/').filter(Boolean));
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'route.js'), 'export async function GET(){}\n');
}

test('catalog follows real API routes when functions are added or removed', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bot-functions-'));
  writeRoute(root, 'api/cron/publish');
  writeRoute(root, 'api/sendpulse/business-sync');
  writeRoute(root, 'api/custom/new-helper');
  fs.mkdirSync(path.join(root, 'app'), { recursive: true });
  fs.writeFileSync(path.join(root, 'app', 'publication-calendar-client.jsx'), 'export default function Calendar(){}\n');

  let functions = discoverBotFunctions(root);
  assert.ok(functions.some((item) => item.id === 'calendar'));
  assert.ok(functions.some((item) => item.id === 'api/cron/publish'));
  assert.ok(functions.some((item) => item.id === 'api/sendpulse/business-sync'));
  assert.ok(functions.some((item) => item.id === 'api/custom/new-helper'));
  assert.match(functions.find((item) => item.id === 'api/custom/new-helper').title, /New Helper/i);

  fs.rmSync(path.join(root, 'app', 'api', 'sendpulse'), { recursive: true, force: true });
  functions = discoverBotFunctions(root);
  assert.equal(functions.some((item) => item.id === 'api/sendpulse/business-sync'), false);
});

test('catalog includes VK Stories only while the story build feature is enabled', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bot-functions-story-'));
  fs.mkdirSync(path.join(root, 'app'), { recursive: true });
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ scripts: { build: 'node patches/story-link-build.cjs && next build' } }));
  let functions = discoverBotFunctions(root);
  assert.ok(functions.some((item) => item.id === 'vk-stories'));

  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ scripts: { build: 'next build' } }));
  functions = discoverBotFunctions(root);
  assert.equal(functions.some((item) => item.id === 'vk-stories'), false);
});

test('calendar surface wires the generated catalog into a top functions disclosure', () => {
  const page = fs.readFileSync(path.join(process.cwd(), 'patches', 'calendar-page.jsx'), 'utf8');
  const build = fs.readFileSync(path.join(process.cwd(), 'patches', 'calendar-build.cjs'), 'utf8');
  const css = fs.readFileSync(path.join(process.cwd(), 'patches', 'bot-functions.css'), 'utf8');
  assert.match(page, /BOT_FUNCTIONS/);
  assert.match(page, /<details className="bot-functions">/);
  assert.match(page, /Все функции бота/);
  assert.match(build, /writeBotFunctionCatalog/);
  assert.match(build, /bot-functions\.css/);
  assert.match(css, /\.bot-functions__toggle/);
});
