import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { replaceTelegramFooter, TELEGRAM_FOOTER_LINE } = require('../patches/telegram-footer-build.cjs');

test('replaces Telegram footer with the two requested links', () => {
  const source = `const TELEGRAM_FOOTER = '\\n\\n• <a href="https://t.me/c/1394610823/767">О нас</a> | <a href="https://t.me/c/1394610823/779">Кейсы</a> | <a href="https://app.lava.top/products/1a995492-be5d-4957-8dfb-29bb21d7f387">Руководство</a> | <a href="https://t.me/+B7YJykmJSkEzMmJi">Канал</a>';`;

  const updated = replaceTelegramFooter(source);

  assert.equal(updated, TELEGRAM_FOOTER_LINE);
  assert.doesNotMatch(updated, /Канал/);
});

test('fails loudly if Telegram footer marker is missing', () => {
  assert.throws(() => replaceTelegramFooter('const X = 1;'), /Telegram footer marker/);
});


test('new Telegram footer has two labels leading to the same bot link', () => {
  const target = 'https://t.me/rstshelp_bot?start=6671465ac84ab24b4702fa27';
  const links = [...TELEGRAM_FOOTER_LINE.matchAll(/href="([^"]+)">([^<]+)<\/a>/g)];
  assert.deepEqual(links.map((link) => [link[1], link[2]]), [[target, 'Научиться лить'], [target, 'Войти в команду']]);
  assert.match(TELEGRAM_FOOTER_LINE, /• <a href=/);
  assert.match(TELEGRAM_FOOTER_LINE, /<\/a>\\n• <a href=/);
  assert.doesNotMatch(TELEGRAM_FOOTER_LINE, /<\/a> \| <a href=/);
  assert.doesNotMatch(TELEGRAM_FOOTER_LINE, /О нас|Кейсы|Руководства|app\.lava\.top/);
});
