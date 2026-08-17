export const runtime = 'nodejs';
export const maxDuration = 60;

import { publishPostToChannel } from '../../../../lib/content-bot.js';

const KEY = 'publish-fallback-now-20260817-71de3c8a';

export async function GET(request) {
  if (request.nextUrl.searchParams.get('key') !== KEY) return new Response('Unauthorized', { status: 401 });

  const dateKey = '2026-08-17';
  const post = {
    id: 'fb-killa-manual-2026-08-17-ai-ads',
    title: 'Meta всё сильнее автоматизирует Facebook Ads',
    sourceUrl: 'https://fb-killa.pro/threads/chto-novogo-v-facebook-ads-k-ijulju-2026-7-obnovlenij-kotorye-naprjamuju-kasajutsja-arbitrazhnika.33585/',
    text: `<b>Meta всё сильнее автоматизирует Facebook Ads</b>\n\nНа FB-Killa разобрали несколько изменений, которые уже стоит учитывать в работе с рекламой.\n\nВо-первых, Meta активнее двигает flexible media: в одно объявление можно загружать несколько близких вариаций креатива и отдавать алгоритму выбор, какую из них показывать конкретному пользователю. Для тестов это удобно: меньше раздробленных объявлений и быстрее видно, какая версия цепляет аудиторию.\n\nВо-вторых, появилась возможность гарантированно дать новому объявлению часть бюджета на тест. Это решает старую проблему, когда алгоритм продолжает крутить старого фаворита, а свежий креатив почти не получает спенда.\n\nЕщё один важный момент — атрибуция. FB-Killa отдельно советует смотреть, за счёт каких окон Meta записывает себе конверсии, потому что view-through может заметно приукрашивать результат в кабинете.\n\nИ самое интересное: Meta продолжает открывать управление Ads через AI, MCP и CLI. Для команд это уже не просто игрушка — можно быстрее собирать отчёты, искать слабые адсеты и автоматизировать часть ежедневных проверок.\n\nИсточник: https://fb-killa.pro/threads/chto-novogo-v-facebook-ads-k-ijulju-2026-7-obnovlenij-kotorye-naprjamuju-kasajutsja-arbitrazhnika.33585/`
  };

  try {
    const result = await publishPostToChannel(post, 'fb-killa', dateKey);
    return Response.json({ ok: true, dateKey, kind: 'fb-killa', title: post.title, result });
  } catch (error) {
    console.error(error);
    return Response.json({ ok: false, error: error instanceof Error ? error.message : 'Publish failed' }, { status: 500 });
  }
}
