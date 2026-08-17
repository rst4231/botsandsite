export const runtime = 'nodejs';
export const maxDuration = 60;

import { sendToTelegram, sendToVk } from '../../../../lib/content-bot.js';

const KEY = 'publish-fbkilla-now-20260817-61b8c29e';
const TEXT = `#новости\n\n<b>Крупная рекламная экосистема запустила собственного ИИ-агента Muse Code</b>\n\nПоявился новый ИИ-инструмент Muse Code, который умеет самостоятельно выполнять сложные технические задачи: планировать работу, писать код, проверять результат и запускать несколько агентов параллельно.\n\nИнтереснее здесь не сам инструмент для программистов, а направление развития всей рекламной инфраструктуры. Всё больше технических процессов постепенно переводят на управление через ИИ и автоматизированных агентов.\n\nДля арбитражных команд это может означать меньше ручной работы с отчётами, аналитикой и техническими операциями. То, на что сейчас байер тратит время каждый день, постепенно можно будет отдавать автоматике.\n\nПри этом сами решения по связкам, креативам и масштабированию никуда не исчезают — ценность смещается от ручной рутины к правильной интерпретации данных.\n\n• <a href="https://t.me/c/1394610823/767">О нас</a> | <a href="https://t.me/c/1394610823/779">Кейсы</a> | <a href="https://app.lava.top/products/1a995492-be5d-4957-8dfb-29bb21d7f387">Руководство</a> | <a href="https://t.me/+B7YJykmJSkEzMmJi">Канал</a>`;

export async function GET(request) {
  if (request.nextUrl.searchParams.get('key') !== KEY) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const telegramMessageId = await sendToTelegram(TEXT);
    const vkPostId = await sendToVk(TEXT);
    return Response.json({ ok: true, telegramMessageId, vkPostId });
  } catch (error) {
    console.error(error);
    return Response.json({ ok: false, error: error instanceof Error ? error.message : 'Publish failed' }, { status: 500 });
  }
}
