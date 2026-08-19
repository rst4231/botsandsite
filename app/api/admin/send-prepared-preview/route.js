export const runtime = 'nodejs';
export const maxDuration = 60;

import React from 'react';
import { ImageResponse } from 'next/og';
import { createHash, timingSafeEqual } from 'node:crypto';
import { getCache } from '@vercel/functions';
import { getTelegramConfig } from '../../../../lib/server-config.js';
import { resolvePreparedPreviewItem, sendPreparedPreview } from '../../../../lib/private-preview.mjs';

const cache = getCache({ namespace: 'traffic-news-v4' });
const CHAT_ID = '160628165';
const EXPECTED_KEY_HASH = '216d437e31494986525ed0cc11dffb1228782089398a36d484be767ae7148be3';

function authorized(request) {
  const key = request.nextUrl.searchParams.get('key') || '';
  const actual = createHash('sha256').update(key).digest();
  const expected = Buffer.from(EXPECTED_KEY_HASH, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function moscowDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Moscow', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function slideNode(slide, index, total) {
  const number = String(index + 1).padStart(2, '0');
  const isFirst = index === 0;
  const isLast = index === total - 1;
  return React.createElement('div', { style: { width: '100%', height: '100%', display: 'flex', position: 'relative', overflow: 'hidden', background: '#ffffff', color: '#111111', fontFamily: 'Arial, sans-serif', padding: '76px' } },
    React.createElement('div', { style: { position: 'absolute', width: '420px', height: '420px', borderRadius: '999px', background: 'rgba(26, 105, 255, 0.12)', top: '-160px', right: '-100px' } }),
    React.createElement('div', { style: { position: 'absolute', width: '330px', height: '330px', borderRadius: '999px', background: 'rgba(255, 122, 0, 0.12)', bottom: '-120px', left: '-80px' } }),
    React.createElement('div', { style: { width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', border: '2px solid rgba(17, 17, 17, 0.08)', borderRadius: '46px', background: 'rgba(255,255,255,0.86)', boxShadow: '0 30px 90px rgba(17, 17, 17, 0.10)', padding: '64px' } },
      React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
        React.createElement('div', { style: { fontSize: '28px', fontWeight: 700, color: isLast ? '#ff7a00' : '#1269ff', letterSpacing: '0.06em' } }, isFirst ? 'РАЗБОР' : isLast ? 'ВЫВОД' : 'ПО ШАГАМ'),
        React.createElement('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'center', width: '82px', height: '50px', borderRadius: '999px', background: '#111111', color: '#ffffff', fontSize: '24px', fontWeight: 700 } }, `${number}/${String(total).padStart(2, '0')}`)),
      React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: '38px' } },
        React.createElement('div', { style: { fontSize: isFirst ? '76px' : '62px', lineHeight: 1.03, fontWeight: 800, letterSpacing: '-0.045em', maxWidth: '890px' } }, slide.title),
        React.createElement('div', { style: { width: '110px', height: '10px', borderRadius: '999px', background: isLast ? '#ff7a00' : '#1269ff' } }),
        React.createElement('div', { style: { fontSize: isFirst ? '38px' : '36px', lineHeight: 1.34, fontWeight: 500, whiteSpace: 'pre-wrap', maxWidth: '880px' } }, slide.body)),
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: '14px', fontSize: '24px', fontWeight: 700 } },
        React.createElement('div', { style: { width: '18px', height: '18px', borderRadius: '999px', background: '#1269ff' } }),
        React.createElement('div', { style: { width: '18px', height: '18px', borderRadius: '999px', background: '#ff7a00' } }),
        React.createElement('div', { style: { marginLeft: '8px' } }, 'LH'))));
}

async function renderSlidePng(slide, index, total) {
  const response = new ImageResponse(slideNode(slide, index, total), { width: 1080, height: 1350 });
  return Buffer.from(await response.arrayBuffer());
}

export async function GET(request) {
  if (!authorized(request)) return new Response('Unauthorized', { status: 401 });
  const dateKey = moscowDateKey();
  const cachedItem = await cache.get(`prepared-content:${dateKey}`);
  let item;
  try {
    item = resolvePreparedPreviewItem({ cachedItem, encodedPayload: request.nextUrl.searchParams.get('payload') || '' });
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof Error ? error.message : 'Invalid preview payload', dateKey }, { status: 400 });
  }
  if (!item) return Response.json({ ok: false, error: 'No prepared content for today', dateKey }, { status: 404 });
  if (item.dateKey && item.dateKey !== dateKey) return Response.json({ ok: false, error: 'Preview payload date does not match today', dateKey }, { status: 409 });

  const sentKey = `private-preview-sent:${dateKey}:${CHAT_ID}`;
  const alreadySent = await cache.get(sentKey);
  if (alreadySent?.messageIds?.length) return Response.json({ ok: true, skipped: 'Preview was already sent', dateKey, messageIds: alreadySent.messageIds });

  const { token } = getTelegramConfig();
  if (!token) return Response.json({ ok: false, error: 'Telegram token is not configured' }, { status: 500 });
  try {
    const messageIds = await sendPreparedPreview({ token, chatId: CHAT_ID, item, renderSlide: renderSlidePng });
    await cache.set(sentKey, { messageIds, sentAt: new Date().toISOString() }, { ttl: 60 * 60 * 24 * 7, tags: ['private-preview'] });
    return Response.json({ ok: true, dateKey, title: item.title, messageIds });
  } catch (error) {
    console.error('PRIVATE_PREVIEW_SEND_ERROR', error);
    return Response.json({ ok: false, error: error instanceof Error ? error.message : 'Private preview failed', dateKey }, { status: 500 });
  }
}
