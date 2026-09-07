import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { replaceTelegramFooter, TELEGRAM_FOOTER_LINE } = require('../patches/telegram-footer-build.cjs');

test('replaces Telegram footer with exactly three requested links', () => {
  const source = `const TELEGRAM_FOOTER = '\\n\\n• <a href="https://t.me/c/1394610823/767">О нас</a> | <a href="https://t.me/c/1394610823/779">Кейсы</a> | <a href="https://app.lava.top/products/1a995492-be5d-4957-8dfb-29bb21d7f387">Руководство</a> | <a href="https://t.me/+B7YJykmJSkEzMmJi">Канал</a>';`;

  const updated = replaceTelegramFooter(source);

  assert.equal(updated, TELEGRAM_FOOTER_LINE);
  assert.doesNotMatch(updated, /Канал/);
});

test('fails loudly if Telegram footer marker is missing', () => {
  assert.throws(() => replaceTelegramFooter('const X = 1;'), /Telegram footer marker/);
});
