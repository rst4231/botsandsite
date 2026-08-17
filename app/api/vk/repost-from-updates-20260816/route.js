export const runtime = 'nodejs';
export const maxDuration = 60;

import { getTelegramConfig } from '../../../../lib/server-config.js';
import { sendToVk } from '../../../../lib/content-bot.js';

const KEY = 'vkupdates-20260816-4d2b71e9';

function dateKeyMoscow(unixSeconds) {
  const date = new Date(Number(unixSeconds) * 1000);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Moscow',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

export async function GET(request) {
  if (request.nextUrl.searchParams.get('key') !== KEY) return new Response('Unauthorized', { status: 401 });
  const targetDate = request.nextUrl.searchParams.get('date') || '2026-08-16';
  const { token, chatId } = getTelegramConfig();
  if (!token) return Response.json({ ok: false, error: 'Telegram bot token is missing' }, { status: 500 });

  const params = new URLSearchParams({
    limit: '100',
    timeout: '0',
    allowed_updates: JSON.stringify(['channel_post']),
  });
  const response = await fetch(`https://api.telegram.org/bot${token}/getUpdates?${params}`, { cache: 'no-store' });
  const data = await response.json();
  if (!data.ok) return Response.json({ ok: false, error: data.description || 'Telegram getUpdates failed' }, { status: 502 });

  const candidates = (data.result || [])
    .map((u) => u.channel_post)
    .filter(Boolean)
    .filter((m) => String(m.chat?.id) === String(chatId))
    .filter((m) => dateKeyMoscow(m.date) === targetDate)
    .filter((m) => m.text || m.caption)
    .sort((a, b) => b.date - a.date);

  if (!candidates.length) {
    return Response.json({ ok: false, error: 'No matching Telegram channel_post update found', targetDate, pendingUpdates: (data.result || []).length }, { status: 404 });
  }

  const message = candidates[0];
  const text = message.text || message.caption;
  try {
    const postId = await sendToVk(text);
    return Response.json({ ok: true, targetDate, telegramMessageId: message.message_id, postId, preview: text.slice(0, 160) });
  } catch (error) {
    console.error(error);
    return Response.json({ ok: false, error: error instanceof Error ? error.message : 'VK repost failed', telegramMessageId: message.message_id }, { status: 500 });
  }
}
