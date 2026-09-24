import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const prepared = fs.readFileSync(new URL('../patches/prepared-content.js', import.meta.url), 'utf8');
const preview = fs.readFileSync(new URL('../lib/private-preview.mjs', import.meta.url), 'utf8');
const prebuild = fs.readFileSync(new URL('../patches/prebuild-fixes.cjs', import.meta.url), 'utf8');
const manual = fs.readFileSync(new URL('../patches/prepared-publish-now-route.js', import.meta.url), 'utf8');
const build = fs.readFileSync(new URL('../build.cjs', import.meta.url), 'utf8');

test('Telegram footer is canonical in source and preview', () => {
  assert.doesNotMatch(prepared.match(/const TELEGRAM_FOOTER = [^\n]+/)?.[0] || '', />Канал</);
  assert.doesNotMatch(preview.match(/const TELEGRAM_FOOTER = [^\n]+/)?.[0] || '', />Канал</);
  assert.match(prepared, />Руководство<\/a>/);
});

test('production Telegram slides fail closed unless exactly five images are rendered and returned', () => {
  assert.match(prepared, /assertTelegramSlideMedia\(item, images\)/);
  assert.match(prepared, /images\.length !== 5/);
  assert.match(prepared, /messageIds\.length !== 5/);
  assert.match(prepared, /Prepared slide publication requires exactly five slides/);
});

test('prebuild normalizes stale 01:00 labels to the real 09:00 generation time', () => {
  assert.match(prebuild, /No prepared content from the 01:00 ChatGPT generation'[\s\S]*No prepared content from the 09:00 ChatGPT generation/);
  assert.match(prebuild, /generation: 'ChatGPT — 01:00 МСК в день публикации'[\s\S]*generation: 'ChatGPT — 09:00 МСК в день публикации'/);
});

test('manual publication uses the same publisher as cron and is restored by build', () => {
  assert.match(manual, /publishPreparedForToday/);
  assert.match(manual, /authorizedContentRequest/);
  assert.match(build, /prepared-publish-now-route\.js/);
  assert.match(build, /app\/api\/content\/publish-now\/route\.js/);
});
