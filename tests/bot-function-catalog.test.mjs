import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import catalog from '../patches/bot-function-catalog.cjs';

const { discoverBotFunctions, groupBotFunctions } = catalog;

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

test('VK Stories remains discoverable after the extracted package is replaced', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bot-functions-story-patch-'));
  fs.mkdirSync(path.join(root, 'patches'), { recursive: true });
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ scripts: { build: 'next build' } }));
  fs.writeFileSync(path.join(root, 'patches', 'story-link-build.cjs'), '// enabled\n');
  let functions = discoverBotFunctions(root);
  assert.ok(functions.some((item) => item.id === 'vk-stories'));

  fs.rmSync(path.join(root, 'patches', 'story-link-build.cjs'));
  functions = discoverBotFunctions(root);
  assert.equal(functions.some((item) => item.id === 'vk-stories'), false);
});

test('catalog groups related functions and keeps unknown routes visible', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bot-function-groups-'));
  fs.mkdirSync(path.join(root, 'app'), { recursive: true });
  fs.writeFileSync(path.join(root, 'app', 'publication-calendar-client.jsx'), 'export default function Calendar(){}\n');
  for (const route of ['api/content/history','api/content/stage','api/cron/publish','api/health','api/sendpulse/business-sync','api/vk/setup','api/custom/new-helper']) writeRoute(root, route);
  const groups = groupBotFunctions(discoverBotFunctions(root));
  assert.deepEqual(groups.map((group) => group.id), ['content', 'publishing', 'sendpulse', 'system', 'other']);
  assert.ok(groups.find((group) => group.id === 'content').items.some((item) => item.id === 'calendar'));
  assert.ok(groups.find((group) => group.id === 'publishing').items.some((item) => item.id === 'api/vk/setup'));
  assert.ok(groups.find((group) => group.id === 'other').items.some((item) => item.id === 'api/custom/new-helper'));
});

test('SendPulse catalog explains Business Sync and Irina to Maxim profile transfer', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bot-function-sendpulse-'));
  writeRoute(root, 'api/sendpulse/business-sync');
  const item = discoverBotFunctions(root).find((entry) => entry.id === 'api/sendpulse/business-sync');
  assert.equal(item.group, 'sendpulse');
  assert.ok(Array.isArray(item.details) && item.details.length >= 4);
  const text = [item.title, item.description, ...item.details].join(' ');
  assert.match(text, /Ирина/);
  assert.match(text, /Максим/);
  assert.match(text, /Telegram ID/i);
  assert.match(text, /NAME/);
  assert.match(text, /Возраст/);
  assert.match(text, /INFO/);
  assert.match(text, /замет/i);
  assert.match(text, /Написал в лс/);
  assert.match(text, /тег/i);
});

test('calendar surface renders grouped function blocks and rich details', () => {
  const page = fs.readFileSync(path.join(process.cwd(), 'patches', 'calendar-page.jsx'), 'utf8');
  const build = fs.readFileSync(path.join(process.cwd(), 'patches', 'calendar-build.cjs'), 'utf8');
  const css = fs.readFileSync(path.join(process.cwd(), 'patches', 'bot-functions.css'), 'utf8');
  assert.match(page, /BOT_FUNCTIONS/);
  assert.match(page, /BOT_FUNCTION_GROUPS/);
  assert.match(page, /<details className="bot-functions">/);
  assert.match(page, /Все функции бота/);
  assert.match(page, /bot-functions__group/);
  assert.match(page, /bot-functions__details/);
  assert.match(page, /group\.items\.map/);
  assert.match(build, /writeBotFunctionCatalog/);
  assert.match(build, /bot-functions\.css/);
  assert.match(css, /\.bot-functions__toggle/);
  assert.match(css, /\.bot-functions__group/);
  assert.match(css, /\.bot-functions__details/);
});
