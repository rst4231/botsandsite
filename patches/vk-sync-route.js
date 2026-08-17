export const runtime = 'nodejs';
export const maxDuration = 60;

import { publishTelegramTextToVk } from '../../../../lib/vk.js';

const PUBLIC_CHANNEL_FEED_URL = 'https://t.me/s/teamcpalh';

function datePartsInMoscow(date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Moscow', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(date);
  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

function dateKeyInMoscow(date) {
  const p = datePartsInMoscow(date);
  return `${p.year}-${p.month}-${p.day}`;
}

function moscowMinuteOfDay(date) {
  const p = datePartsInMoscow(date);
  return Number(p.hour) * 60 + Number(p.minute);
}

function yesterdayKey() {
  return dateKeyInMoscow(new Date(Date.now() - 24 * 60 * 60 * 1000));
}

function extractMessages(page) {
  const starts = [...page.matchAll(/<div[^>]+class=["'][^"']*tgme_widget_message_wrap[^"']*["'][^>]*>/gi)];
  const messages = [];
  for (let i = 0; i < starts.length; i += 1) {
    const from = starts[i].index;
    const to = i + 1 < starts.length ? starts[i + 1].index : page.length;
    const block = page.slice(from, to);
    const datetime = block.match(/<time[^>]+datetime=["']([^"']+)["']/i)?.[1];
    const rawText = block.match(/<div[^>]+class=["'][^"']*tgme_widget_message_text[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)?.[1];
    const postRef = block.match(/data-post=["']([^"']+)["']/i)?.[1] || null;
    if (!datetime || !rawText) continue;
    messages.push({ datetime, postRef, rawText });
  }
  return messages;
}

export async function GET(request) {
  const response = await fetch(PUBLIC_CHANNEL_FEED_URL, {
    headers: { 'user-agent': 'Mozilla/5.0 (compatible; LH-VK-Sync/1.0)' }, cache: 'no-store',
  });
  if (!response.ok) return Response.json({ ok: false, error: `Telegram feed returned ${response.status}` }, { status: 502 });
  const page = await response.text();
  const targetDate = request.nextUrl.searchParams.get('date') || yesterdayKey();
  const targetMinute = 18 * 60 + 40;
  const candidates = extractMessages(page)
    .filter((item) => dateKeyInMoscow(new Date(item.datetime)) === targetDate)
    .sort((a, b) => Math.abs(moscowMinuteOfDay(new Date(a.datetime)) - targetMinute) - Math.abs(moscowMinuteOfDay(new Date(b.datetime)) - targetMinute));
  if (!candidates.length) return Response.json({ ok: false, error: `No Telegram post found for ${targetDate}` }, { status: 404 });
  const post = candidates[0];
  const result = await publishTelegramTextToVk(post.rawText);
  return Response.json({ ok: true, targetDate, telegram: post.postRef, telegramTime: post.datetime, vk: result });
}
