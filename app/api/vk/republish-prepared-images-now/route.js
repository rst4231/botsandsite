export const runtime = 'nodejs';
export const maxDuration = 60;

import React from 'react';
import { ImageResponse } from 'next/og';
import { getCache } from '@vercel/functions';
import { kindForDate } from '../../../../lib/prepared-content.js';
import { formatVkPhotoAttachment } from '../../../../lib/vk-photo-attachment.js';

const KEY = 'vkrepublish-images-20260819-4e8bc21d';
const cache = getCache({ namespace: 'traffic-news-v4' });
const VK_API_VERSION = '5.199';
const VK_GROUP_ID = process.env.VK_GROUP_ID || '160851478';
const VK_TOKEN_CACHE_KEY = 'vk-access-token-v1';
const CACHE_TTL = 60 * 60 * 24 * 730;
const VK_FOOTER = '\n\nРекомендуем изучить:\n[https://vk.ru/app5898182_-160851478#page=67e5217dfe30f032b45b7c8|Теория]\n[https://vk.com/app5898182_-160851478#s=3112330&force=1&utf=1|Практика]';

const FALLBACK_ITEM = {
  dateKey: '2026-08-19',
  kind: 'practical',
  title: 'Почему дешёвая заявка ещё ничего не говорит о качестве трафика',
  description: 'Низкий CPL выглядит красиво в отчёте, но сам по себе почти ничего не доказывает. Смотрите дальше заявки: валидность, контакт, подтверждение, продажу и итоговую экономику. Иногда более дорогой лид приносит заметно больше денег.',
  body: '',
  format: 'slides',
  slides: [
    {
      title: 'Дешёвая заявка ≠ хороший трафик',
      body: 'CPL показывает только стоимость входа в воронку. Он не говорит, отвечает ли человек, подходит ли по условиям, подтверждает ли заказ и приносит ли в итоге деньги.',
    },
    {
      title: 'Смотрите глубже заявки',
      body: 'После CPL проверяйте валидность контактов, дозвон, подтверждение, выкуп или продажу. Чем дальше метрика от клика, тем точнее она показывает реальную ценность трафика.',
    },
    {
      title: 'Пример: дороже, но выгоднее',
      body: 'Источник A: CPL $1,50 и подтверждение 12% = $12,50 за подтверждённый лид. Источник B: CPL $2,30 и подтверждение 28% = $8,21. Дешёвая заявка проиграла.',
    },
    {
      title: 'Почему CPL может обманывать',
      body: 'Кликбейт, слишком широкая аудитория, слабое намерение, дубли и мусорные контакты легко снижают цену заявки. В отчёте цифра радует, а в кассе результата нет.',
    },
    {
      title: 'Оптимизируйте по деньгам',
      body: 'Сравнивайте источники по цене подтверждения или продажи, EPC и ROI после достаточного объёма данных. Лучший трафик не тот, где лид дешевле, а тот, где экономика сильнее.',
    },
  ],
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function vkText(item) {
  return `${item.title}\n\n${item.description}${VK_FOOTER}`;
}

function slideNode(slide, index, total) {
  const number = String(index + 1).padStart(2, '0');
  const isFirst = index === 0;
  const isLast = index === total - 1;
  return React.createElement(
    'div',
    {
      style: {
        width: '100%', height: '100%', display: 'flex', position: 'relative', overflow: 'hidden',
        background: '#ffffff', color: '#111111', fontFamily: 'Arial, sans-serif', padding: '76px',
      },
    },
    React.createElement('div', {
      style: { position: 'absolute', width: '420px', height: '420px', borderRadius: '999px', background: 'rgba(26, 105, 255, 0.12)', top: '-160px', right: '-100px' },
    }),
    React.createElement('div', {
      style: { position: 'absolute', width: '330px', height: '330px', borderRadius: '999px', background: 'rgba(255, 122, 0, 0.12)', bottom: '-120px', left: '-80px' },
    }),
    React.createElement(
      'div',
      {
        style: {
          width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
          border: '2px solid rgba(17, 17, 17, 0.08)', borderRadius: '46px', background: 'rgba(255,255,255,0.86)',
          boxShadow: '0 30px 90px rgba(17, 17, 17, 0.10)', padding: '64px',
        },
      },
      React.createElement(
        'div',
        { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
        React.createElement('div', { style: { fontSize: '28px', fontWeight: 700, color: isLast ? '#ff7a00' : '#1269ff', letterSpacing: '0.06em' } }, isFirst ? 'РАЗБОР' : isLast ? 'ВЫВОД' : 'ПО ШАГАМ'),
        React.createElement('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'center', width: '82px', height: '50px', borderRadius: '999px', background: '#111111', color: '#ffffff', fontSize: '24px', fontWeight: 700 } }, `${number}/${String(total).padStart(2, '0')}`),
      ),
      React.createElement(
        'div',
        { style: { display: 'flex', flexDirection: 'column', gap: '38px' } },
        React.createElement('div', { style: { fontSize: isFirst ? '76px' : '62px', lineHeight: 1.03, fontWeight: 800, letterSpacing: '-0.045em', maxWidth: '890px' } }, slide.title),
        React.createElement('div', { style: { width: '110px', height: '10px', borderRadius: '999px', background: isLast ? '#ff7a00' : '#1269ff' } }),
        React.createElement('div', { style: { fontSize: isFirst ? '38px' : '36px', lineHeight: 1.34, fontWeight: 500, whiteSpace: 'pre-wrap', maxWidth: '880px' } }, slide.body),
      ),
      React.createElement(
        'div',
        { style: { display: 'flex', alignItems: 'center', gap: '14px', fontSize: '24px', fontWeight: 700 } },
        React.createElement('div', { style: { width: '18px', height: '18px', borderRadius: '999px', background: '#1269ff' } }),
        React.createElement('div', { style: { width: '18px', height: '18px', borderRadius: '999px', background: '#ff7a00' } }),
        React.createElement('div', { style: { marginLeft: '8px' } }, 'LH'),
      ),
    ),
  );
}

async function renderSlidePng(slide, index, total) {
  const response = new ImageResponse(slideNode(slide, index, total), { width: 1080, height: 1350 });
  return Buffer.from(await response.arrayBuffer());
}

async function callVk(method, params, token) {
  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(params || {})) {
    if (value !== undefined && value !== null) body.set(key, String(value));
  }
  body.set('access_token', token);
  body.set('v', VK_API_VERSION);
  const response = await fetch(`https://api.vk.com/method/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
    cache: 'no-store',
  });
  const data = await response.json();
  if (!response.ok || data.error) throw new Error(`VK ${data?.error?.error_code ?? response.status}: ${data?.error?.error_msg || method + ' failed'}`);
  return data.response;
}

async function uploadImages(images, token) {
  const attachments = [];
  for (let index = 0; index < images.length; index += 1) {
    let photo = null;
    let lastError = null;
    for (let attempt = 1; attempt <= 3 && !photo; attempt += 1) {
      try {
        const server = await callVk('photos.getMessagesUploadServer', {}, token);
        if (!server?.upload_url) throw new Error('VK message photo upload server is unavailable');
        const form = new FormData();
        form.append('photo', new Blob([images[index]], { type: 'image/png' }), `slide${index + 1}.png`);
        const uploadResponse = await fetch(server.upload_url, { method: 'POST', body: form });
        const uploaded = await uploadResponse.json();
        if (!uploadResponse.ok || !uploaded?.photo) throw new Error(`VK upload returned empty photo for slide ${index + 1}`);
        const saved = await callVk('photos.saveMessagesPhoto', {
          photo: uploaded.photo,
          server: uploaded.server,
          hash: uploaded.hash,
        }, token);
        photo = Array.isArray(saved) ? saved[0] : null;
        if (!photo?.owner_id || !photo?.id || !photo?.access_key) throw new Error(`VK failed to save slide ${index + 1} with access_key`);
      } catch (error) {
        lastError = error;
        photo = null;
        if (attempt < 3) await sleep(500 * attempt);
      }
    }
    if (!photo) throw lastError || new Error(`VK failed to upload slide ${index + 1}`);
    attachments.push(formatVkPhotoAttachment(photo));
    if (index + 1 < images.length) await sleep(250);
  }
  return attachments;
}

export async function GET(request) {
  if (request.nextUrl.searchParams.get('key') !== KEY) return new Response('Unauthorized', { status: 401 });

  const token = process.env.VK_ACCESS_TOKEN || await cache.get(VK_TOKEN_CACHE_KEY) || null;
  if (!token) return Response.json({ ok: false, error: 'VK access token is not configured' }, { status: 500 });

  const schedule = kindForDate(new Date());
  let item = await cache.get(`prepared-content:${schedule.dateKey}`);
  if (!item && schedule.dateKey === FALLBACK_ITEM.dateKey) item = FALLBACK_ITEM;
  if (!item || item.format !== 'slides' || item.slides?.length !== 5) {
    return Response.json({ ok: false, error: 'Prepared five-slide content is unavailable' }, { status: 404 });
  }

  try {
    const images = await Promise.all(item.slides.map((slide, index) => renderSlidePng(slide, index, item.slides.length)));
    const attachments = await uploadImages(images, token);
    if (attachments.length !== 5 || !attachments.every((value) => value.split('_').length >= 3)) {
      throw new Error('VK attachments are incomplete');
    }

    const posted = await callVk('wall.post', {
      owner_id: `-${VK_GROUP_ID}`,
      from_group: 1,
      message: vkText(item),
      attachments: attachments.join(','),
    }, token);
    const postId = posted?.post_id;
    if (!postId) throw new Error('VK wall.post did not return post_id');

    const statusKey = `prepared-status:${schedule.dateKey}`;
    const status = (await cache.get(statusKey)) || {};
    const previousVkPostId = status.vk || null;
    status.vk = postId;
    status.vkReplacedAt = new Date().toISOString();
    status.previousVkPostId = previousVkPostId;
    if (!status.telegram) status.historySaved = false;
    await cache.set(statusKey, status, { ttl: CACHE_TTL, tags: ['prepared-publications'] });

    return Response.json({
      ok: true,
      dateKey: schedule.dateKey,
      title: item.title,
      previousVkPostId,
      vkPostId: postId,
      attachmentCount: attachments.length,
      attachmentsIncludeAccessKeys: attachments.every((value) => value.split('_').length >= 3),
      telegramPublished: Boolean(status.telegram),
    });
  } catch (error) {
    console.error(error);
    return Response.json({ ok: false, error: error instanceof Error ? error.message : 'VK image republish failed' }, { status: 500 });
  }
}
