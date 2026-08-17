export const runtime = 'nodejs';
export const maxDuration = 60;

import { getTelegramConfig } from '../../../../lib/server-config.js';

const KEY = 'tgchannel-20260817-31bc4f9e';

function stripTags(value = '') {
  return value
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&#039;/gi, "'")
    .trim();
}

function parseFeed(page = '') {
  const results = [];
  const re = /<div[^>]+class=["'][^"']*tgme_widget_message_wrap[^"']*["'][^>]*>[\s\S]*?(?=<div[^>]+class=["'][^"']*tgme_widget_message_wrap|$)/gi;
  for (const match of page.matchAll(re)) {
    const block = match[0];
    const postRef = block.match(/data-post=["']([^"']+)["']/i)?.[1] || null;
    const datetime = block.match(/<time[^>]+datetime=["']([^"']+)["']/i)?.[1] || null;
    const textHtml = block.match(/<div[^>]+class=["'][^"']*tgme_widget_message_text[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)?.[1] || '';
    if (postRef || datetime || textHtml) results.push({ postRef, datetime, preview: stripTags(textHtml).slice(0, 220) });
  }
  return results;
}

export async function GET(request) {
  if (request.nextUrl.searchParams.get('key') !== KEY) return new Response('Unauthorized', { status: 401 });
  const { token, chatId } = getTelegramConfig();
  if (!token) return Response.json({ ok: false, error: 'Telegram token missing' }, { status: 500 });

  const tg = await fetch(`https://api.telegram.org/bot${token}/getChat?chat_id=${encodeURIComponent(chatId)}`, { cache: 'no-store' });
  const data = await tg.json();
  if (!data.ok) return Response.json({ ok: false, error: data.description || 'getChat failed' }, { status: 502 });
  const chat = data.result;
  const username = chat.username || null;
  let feed = [];
  let feedStatus = null;
  if (username) {
    const r = await fetch(`https://t.me/s/${username}`, { headers: { 'user-agent': 'Mozilla/5.0' }, cache: 'no-store' });
    feedStatus = r.status;
    if (r.ok) feed = parseFeed(await r.text());
  }
  return Response.json({ ok: true, chat: { id: chat.id, title: chat.title, username, type: chat.type }, feedStatus, feed });
}
