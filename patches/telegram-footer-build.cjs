const fs = require('fs');
const path = require('path');

const TELEGRAM_FOOTER_LINE = "const TELEGRAM_FOOTER = '\\n\\n• <a href=\"https://t.me/rstshelp_bot?start=6ad09f4c0c2a24a3e40abe6c\">Руководства</a>\\n• <a href=\"https://t.me/rstshelp_bot?start=6671465ac84ab24b4702fa27\">Научиться лить</a>\\n• <a href=\"https://t.me/rstshelp_bot?start=6671465ac84ab24b4702fa27\">Войти в команду</a>';";

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
