const fs = require('fs');
const path = require('path');

const KNOWN = {
  'api/admin/send-prepared-preview': ['Предпросмотр подготовленного поста', 'Отправляет подготовленный пост для внутренней проверки перед публикацией.'],
  'api/content/history': ['История подготовленных постов', 'Показывает историю подготовленного контента и прошлых публикаций.'],
  'api/content/stage': ['Подготовка контента', 'Сохраняет подготовленный пост перед публикацией.'],
  'api/content/status': ['Статус контента', 'Показывает состояние подготовленного поста на нужную дату.'],
  'api/cron/publish': ['Автопубликация в Telegram и VK', 'Публикует подготовленный пост по расписанию в Telegram и VK.'],
  'api/cron/special-events': ['Отраслевые события', 'Готовит и публикует специальную рубрику с отраслевыми событиями.'],
  'api/health': ['Проверка состояния бота', 'Проверяет основные настройки и готовность публикаций.'],
  'api/sendpulse/business-sync': ['SendPulse Business Sync', 'Синхронизирует нужные данные контактов между ботами SendPulse.'],
  'api/vk/publish-prepared-now': ['Ручная публикация в VK', 'Позволяет отправить подготовленный пост в VK вручную.'],
  'api/vk/setup': ['Подключение VK', 'Проверяет и подготавливает подключение VK для публикаций.'],
};

function titleCase(value) {
  return value
    .split(/[\/_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function walk(dir, found = []) {
  if (!fs.existsSync(dir)) return found;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, found);
    else if (entry.isFile() && /^route\.(?:js|jsx|ts|tsx)$/.test(entry.name)) found.push(full);
  }
  return found;
}

function routeId(root, file) {
  const rel = path.relative(path.join(root, 'app'), path.dirname(file));
  return rel.split(path.sep).join('/');
}

function describeRoute(id) {
  if (KNOWN[id]) return { title: KNOWN[id][0], description: KNOWN[id][1] };
  const raw = id.replace(/^api\//, '').split('/').slice(-2).join(' ');
  const title = titleCase(raw);
  return { title, description: `Функция бота: ${title}.` };
}

function discoverBotFunctions(root) {
  const items = [];
  if (fs.existsSync(path.join(root, 'app', 'publication-calendar-client.jsx'))) {
    items.push({
      id: 'calendar',
      title: 'Календарь публикаций',
      description: 'Показывает контент-план на 30 дней и открывает подготовленные посты.',
    });
  }

  const packagePath = path.join(root, 'package.json');
  if (fs.existsSync(packagePath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
      const buildScript = String(pkg?.scripts?.build || '');
      if (buildScript.includes('story-link-build.cjs')) {
        items.push({
          id: 'vk-stories',
          title: 'VK Stories',
          description: 'Публикует Stories в VK и связывает их с опубликованным постом.',
        });
      }
    } catch {}
  }

  const routes = walk(path.join(root, 'app', 'api'))
    .map((file) => routeId(root, file))
    .sort();

  for (const id of routes) {
    const meta = describeRoute(id);
    items.push({ id, ...meta });
  }
  return items;
}

function writeBotFunctionCatalog(root) {
  const items = discoverBotFunctions(root);
  const target = path.join(root, 'app', 'bot-functions.generated.js');
  fs.writeFileSync(target, `export const BOT_FUNCTIONS = ${JSON.stringify(items, null, 2)};\n`);
  return items;
}

module.exports = { discoverBotFunctions, writeBotFunctionCatalog };
