const fs = require('fs');
const path = require('path');

const GROUPS = [
  { id: 'content', title: 'Контент и календарь', description: 'Планирование, подготовка и контроль публикаций.' },
  { id: 'publishing', title: 'Публикации Telegram и VK', description: 'Автоматическая и ручная публикация, подключение VK и Stories.' },
  { id: 'sendpulse', title: 'Синхронизация SendPulse', description: 'Передача данных контактов и анкеты между ботами.' },
  { id: 'system', title: 'Состояние системы', description: 'Диагностика и проверка готовности бота.' },
  { id: 'other', title: 'Другие функции', description: 'Новые функции, которые ещё не отнесены к основной группе.' },
];

const KNOWN = {
  'api/admin/send-prepared-preview': {
    group: 'content', title: 'Предпросмотр подготовленного поста',
    description: 'Отправляет подготовленный пост для внутренней проверки перед публикацией.',
  },
  'api/content/history': {
    group: 'content', title: 'История подготовленных постов',
    description: 'Показывает историю подготовленного контента и прошлых публикаций.',
  },
  'api/content/stage': {
    group: 'content', title: 'Подготовка контента',
    description: 'Сохраняет подготовленный пост перед публикацией.',
  },
  'api/content/status': {
    group: 'content', title: 'Статус контента',
    description: 'Показывает состояние подготовленного поста на нужную дату.',
  },
  'api/cron/publish': {
    group: 'publishing', title: 'Автопубликация в Telegram и VK',
    description: 'Публикует подготовленный пост по расписанию в Telegram и VK.',
  },
  'api/cron/special-events': {
    group: 'content', title: 'Отраслевые события',
    description: 'Готовит и публикует специальную рубрику с отраслевыми событиями.',
  },
  'api/health': {
    group: 'system', title: 'Проверка состояния бота',
    description: 'Проверяет основные настройки и готовность публикаций.',
  },
  'api/sendpulse/business-sync': {
    group: 'sendpulse', title: 'Ирина → Максим и Business Sync',
    description: 'Синхронизирует профиль и рабочие данные контакта между ботами SendPulse по Telegram ID.',
    details: [
      'При сообщении Максиму находит соответствующий контакт Ирины по Telegram ID.',
      'NAME и Возраст переносит из Ирины только если соответствующее поле у Максима пустое.',
      'Данные анкеты добавляет в INFO и в заметки контакта Максима; уже добавленные блоки и заметки не дублируются.',
      'Старая Business Sync Ирины отдельно ставит «Написал в лс = Да», переносит изменившиеся пользовательские переменные и недостающие теги.',
    ],
  },
  'api/vk/publish-prepared-now': {
    group: 'publishing', title: 'Ручная публикация в VK',
    description: 'Позволяет отправить подготовленный пост в VK вручную.',
  },
  'api/vk/setup': {
    group: 'publishing', title: 'Подключение VK',
    description: 'Проверяет и подготавливает подключение VK для публикаций.',
  },
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
  if (KNOWN[id]) return KNOWN[id];
  const raw = id.replace(/^api\//, '').split('/').slice(-2).join(' ');
  const title = titleCase(raw);
  return { group: 'other', title, description: `Функция бота: ${title}.` };
}

function discoverBotFunctions(root) {
  const items = [];
  if (fs.existsSync(path.join(root, 'app', 'publication-calendar-client.jsx'))) {
    items.push({
      id: 'calendar', group: 'content', title: 'Календарь публикаций',
      description: 'Показывает контент-план на 30 дней и открывает подготовленные посты.',
    });
  }

  const storyPatchEnabled = fs.existsSync(path.join(root, 'patches', 'story-link-build.cjs'));
  let storyBuildEnabled = false;
  const packagePath = path.join(root, 'package.json');
  if (fs.existsSync(packagePath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
      storyBuildEnabled = String(pkg?.scripts?.build || '').includes('story-link-build.cjs');
    } catch {}
  }
  if (storyPatchEnabled || storyBuildEnabled) {
    items.push({
      id: 'vk-stories', group: 'publishing', title: 'VK Stories',
      description: 'Публикует Stories в VK и связывает их с опубликованным постом.',
    });
  }

  const routes = walk(path.join(root, 'app', 'api'))
    .map((file) => routeId(root, file))
    .sort();

  for (const id of routes) items.push({ id, ...describeRoute(id) });
  return items;
}

function groupBotFunctions(items) {
  return GROUPS.map((group) => ({
    ...group,
    items: items.filter((item) => item.group === group.id),
  })).filter((group) => group.items.length > 0);
}

function writeBotFunctionCatalog(root) {
  const items = discoverBotFunctions(root);
  const groups = groupBotFunctions(items);
  const target = path.join(root, 'app', 'bot-functions.generated.js');
  fs.writeFileSync(target, [
    `export const BOT_FUNCTIONS = ${JSON.stringify(items, null, 2)};`,
    `export const BOT_FUNCTION_GROUPS = ${JSON.stringify(groups, null, 2)};`,
    '',
  ].join('\n'));
  return items;
}

module.exports = { discoverBotFunctions, groupBotFunctions, writeBotFunctionCatalog };
