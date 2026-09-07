const fs = require('fs');
const path = require('path');

const TELEGRAM_FOOTER_LINE = 'const TELEGRAM_FOOTER = \'\\n\\n• <a href="https://t.me/c/1394610823/767">О нас</a> | <a href="https://t.me/c/1394610823/779">Кейсы</a> | <a href="https://app.lava.top/products/1a995492-be5d-4957-8dfb-29bb21d7f387">Руководство</a>\';';

function replaceTelegramFooter(source) {
  const pattern = /const TELEGRAM_FOOTER = '[^']*';/;
  if (!pattern.test(source)) throw new Error('Telegram footer marker was not found');
  return source.replace(pattern, TELEGRAM_FOOTER_LINE);
}

function applyTelegramFooter(filePath = path.join(process.cwd(), 'patches', 'prepared-content.js')) {
  const source = fs.readFileSync(filePath, 'utf8');
  const updated = replaceTelegramFooter(source);
  fs.writeFileSync(filePath, updated);
}

if (require.main === module) applyTelegramFooter();

module.exports = { replaceTelegramFooter, applyTelegramFooter, TELEGRAM_FOOTER_LINE };
