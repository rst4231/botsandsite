export const runtime = 'nodejs';
export const maxDuration = 60;

import { getCache } from '@vercel/functions';
import { sendToVk } from '../../../../lib/content-bot.js';

const KEY = 'vkexact-20260816-f8c19a64';
const cache = getCache({ namespace: 'traffic-news-v4' });

function decodeEntities(value = '') {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&quot;/gi, '"')
    .replace(/&#039;|&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&amp;/gi, '&');
}

function extractMessageHtml(page = '') {
  const marker = /<div[^>]+class=["'][^"']*tgme_widget_message_text[^"']*["'][^>]*>/i;
  const match = marker.exec(page);
  if (!match) return null;
  const start = (match.index || 0) + match[0].length;
  let pos = start;
  let depth = 1;
  const tag = /<\/?div\b[^>]*>/gi;
  tag.lastIndex = start;
  while (depth > 0) {
    const next = tag.exec(page);
    if (!next) break;
    if (/^<\/div/i.test(next[0])) depth -= 1;
    else depth += 1;
    if (depth === 0) return page.slice(start, next.index);
    pos = tag.lastIndex;
  }
  return page.slice(start, pos);
}

export async function GET(request) {
  if (request.nextUrl.searchParams.get('key') !== KEY) {
    return new Response('Unauthorized', { status: 401 });
  }

  const dateKey = request.nextUrl.searchParams.get('date') || '2026-08-16';
  const kind = request.nextUrl.searchParams.get('kind') || 'beginner';
  const published = await cache.get(`published:${kind}:${dateKey}`);
  if (!published?.messageId) {
    return Response.json({ ok: false, error: 'Telegram publication messageId not found', kind, dateKey }, { status: 404 });
  }

  const messageId = published.messageId;
  const urls = [
    `https://t.me/teamcpalh/${messageId}?embed=1&mode=tme`,
    `https://t.me/teamcpalh/${messageId}?embed=1`,
    `https://t.me/teamcpalh/${messageId}`,
  ];

  let rawText = null;
  let sourceUrl = null;
  for (const url of urls) {
    const response = await fetch(url, {
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; LH-VK-Reposter/1.0)' },
      cache: 'no-store',
      redirect: 'follow',
    });
    if (!response.ok) continue;
    const page = await response.text();
    rawText = extractMessageHtml(page);
    if (rawText) {
      sourceUrl = url;
      break;
    }
  }

  if (!rawText) {
    return Response.json({ ok: false, error: 'Exact Telegram post text could not be fetched', messageId, kind, dateKey }, { status: 502 });
  }

  try {
    const postId = await sendToVk(decodeEntities(rawText));
    return Response.json({ ok: true, kind, dateKey, telegramMessageId: messageId, telegramUrl: `https://t.me/teamcpalh/${messageId}`, postId, sourceUrl });
  } catch (error) {
    console.error(error);
    return Response.json({ ok: false, error: error instanceof Error ? error.message : 'VK repost failed', messageId }, { status: 500 });
  }
}
