export const runtime = 'nodejs';
export const maxDuration = 60;

import { publishPostToChannel } from '../../../../lib/content-bot.js';

const KEY = 'publish-fbkilla-now-20260817-61b8c29e';

export async function GET(request) {
  if (request.nextUrl.searchParams.get('key') !== KEY) {
    return new Response('Unauthorized', { status: 401 });
  }

  const dateKey = '2026-08-17';
  const post = {
    id: 'fb-killa-2026-08-17-muse-code',
    title: 'Meta представила Muse Code — своего ИИ-агента для программирования',
    sourceUrl: 'https://fb-killa.pro/threads/meta-predstavila-sobstvennogo-ii-agenta-muse-code.34134/',
    text: `<b>Meta представила Muse Code — своего ИИ-агента для программирования</b>\n\nMeta запустила в beta терминального AI-агента Muse Code на модели Muse Spark 1.2. Он умеет планировать изменения в больших кодовых базах, писать код, проверять результат и параллельно запускать несколько субагентов.\n\nДля арбитража интереснее не сам кодинг, а направление Meta: компания всё глубже встраивает AI-агентов в свою экосистему. Ранее Meta уже начала развивать MCP и CLI-инструменты для работы с рекламной инфраструктурой, теперь агентная автоматизация расширяется дальше.\n\nЧто это значит для байера: технической рутины и ручной аналитики со временем станет меньше, а ценность нормальных данных, сильных креативов и правильной логики принятия решений — выше.\n\n<a href="https://fb-killa.pro/threads/meta-predstavila-sobstvennogo-ii-agenta-muse-code.34134/">Источник: FB-Killa</a>`,
  };

  try {
    const result = await publishPostToChannel(post, 'fb-killa', dateKey);
    return Response.json({ ok: true, result });
  } catch (error) {
    console.error(error);
    return Response.json({ ok: false, error: error instanceof Error ? error.message : 'Publish failed' }, { status: 500 });
  }
}
