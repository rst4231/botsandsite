export const runtime = 'nodejs';
export const maxDuration = 60;

import React from 'react';
import { ImageResponse } from 'next/og';
import { getCache } from '@vercel/functions';
import { kindForDate } from '../../../../lib/prepared-content.js';

const KEY = 'vkonly-20260819-7d4f2b93';
const CACHE_TTL = 60 * 60 * 24 * 730;
const cache = getCache({ namespace: 'traffic-news-v4' });
const VK_API_VERSION = '5.199';
const VK_GROUP_ID = process.env.VK_GROUP_ID || '160851478';
const VK_TOKEN_CACHE_KEY = 'vk-access-token-v1';
const VK_FOOTER = '\n\nРекомендуем изучить:\n[https://vk.ru/app5898182_-160851478#page=67e5217dfe30f032b45b7c8|Теория]\n[https://vk.com/app5898182_-160851478#s=3112330&force=1&utf=1|Практика]';

function vkText(item) {
  const body = item.format === 'text' ? item.body : item.description;
  return `${item.title}\n\n${body}${VK_FOOTER}`;
}

function slideNode(slide, index, total) {
  const number = String(index + 1).padStart(2, '0');
  const isFirst = index === 0;
  const isLast = index === total - 1;

  return React.createElement(
    'div',
    {
      style: {
        width: '100%',
        height: '100%',
        display: 'flex',
        position: 'relative',
        overflow: 'hidden',
        background: '#ffffff',
        color: '#111111',
        fontFamily: 'Arial, sans-serif',
        padding: '76px',
      },
    },
    React.createElement('div', {
      style: {
        position: 'absolute',
        width: '420px',
        height: '420px',
        borderRadius: '999px',
        background: 'rgba(26, 105, 255, 0.12)',
        top: '-160px',
        right: '-100px',
      },
    }),
    React.createElement('div', {
      style: {
        position: 'absolute',
        width: '330px',
        height: '330px',
        borderRadius: '999px',
        background: 'rgba(255, 122, 0, 0.12)',
        bottom: '-120px',
        left: '-80px',
      },
    }),
    React.createElement(
      'div',
      {
        style: {
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          border: '2px solid rgba(17, 17, 17, 0.08)',
          borderRadius: '46px',
          background: 'rgba(255,255,255,0.86)',
          boxShadow: '0 30px 90px rgba(17, 17, 17, 0.10)',
          padding: '64px',
        },
      },
      React.createElement(
        'div',
        { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
        React.createElement('div', {
          style: {
            fontSize: '28px',
            fontWeight: 700,
            color: isLast ? '#ff7a00' : '#1269ff',
            letterSpacing: '0.06em',
          },
        }, isFirst ? 'РАЗБОР' : isLast ? 'ВЫВОД' : 'ПО ШАГАМ'),
        React.createElement('div', {
          style: {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '82px',
            height: '50px',
            borderRadius: '999px',
            background: '#111111',
            color: '#ffffff',
            fontSize: '24px',
            fontWeight: 700,
          },
        }, `${number}/${String(total).padStart(2, '0')}`),
      ),
      React.createElement(
        'div',
        { style: { display: 'flex', flexDirection: 'column', gap: '38px' } },
        React.createElement('div', {
          style: {
            fontSize: isFirst ? '76px' : '62px',
            lineHeight: 1.03,
            fontWeight: 800,
            letterSpacing: '-0.045em',
            maxWidth: '890px',
          },
        }, slide.title),
        React.createElement('div', {
          style: {
            width: '110px',
            height: '10px',
            borderRadius: '999px',
            background: isLast ? '#ff7a00' : '#1269ff',
          },
        }),
        React.createElement('div', {
          style: {
            fontSize: isFirst ? '38px' : '36px',
            lineHeight: 1.34,
            fontWeight: 500,
            whiteSpace: 'pre-wrap',
            maxWidth: '880px',
          },
        }, slide.body),
      ),
      React.createElement(
        'div',
        { style: { display: 'flex', alignItems: 'center', gap: '14px', fontSize: '24px', fontWeight: 700 } },
        React.createElement('div', {
          style: { width: '18px', height: '18px', borderRadius: '999px', background: '#1269ff' },
        }),
        React.createElement('div', {
          style: { width: '18px', height: '18px', borderRadius: '999px', background: '#ff7a00' },
        }),
        React.createElement('div', { style: { marginLeft: '8px' } }, 'LH'),
      ),
    ),
  );
}

async function renderSlidePng(slide, index, total) {
  const response = new ImageResponse(slideNode(slide, index, total), {
    width: 1080,
    height: 1350,
  });
  return Buffer.from(await response.arrayBuffer());
}

async function getVkAccessToken() {
  return process.env.VK_ACCESS_TOKEN || await cache.get(VK_TOKEN_CACHE_KEY) || null;
}

async function callVk(method, params, token) {
  const body = new URLSearchParams({
    ...Object.fromEntries(Object.entries(params).map(([key, value]) => [key, String(value)])),
    access_token: token,
    v: VK_API_VERSION,
  });
  const response = await fetch(`https://api.vk.com/method/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
    cache: 'no-store',
  });
  const data = await response.json();
  if (data.error) throw new Error(`VK ${data.error.error_code}: ${data.error.error_msg}`);
  return data.response;
}

async function uploadVkImages(images, token) {
  const attachments = [];
  for (let index = 0; index < images.length; index += 1) {
    const uploadServer = await callVk('photos.getWallUploadServer', { group_id: VK_GROUP_ID }, token);
    if (!uploadServer?.upload_url) throw new Error('VK upload server is unavailable');
    const form = new FormData();
    form.append('photo', new Blob([images[index]], { type: 'image/png' }), `slide${index + 1}.png`);
    const uploadResponse = await fetch(uploadServer.upload_url, { method: 'POST', body: form });
    const uploaded = await uploadResponse.json();
    const saved = await callVk('photos.saveWallPhoto', {
      group_id: VK_GROUP_ID,
      photo: uploaded.photo,
      server: uploaded.server,
      hash: uploaded.hash,
    }, token);
    const photo = Array.isArray(saved) ? saved[0] : null;
    if (!photo?.owner_id || !photo?.id) throw new Error(`VK failed to save slide ${index + 1}`);
    attachments.push(`photo${photo.owner_id}_${photo.id}`);
  }
  return attachments;
}

async function sendVk(item, images = []) {
  const token = await getVkAccessToken();
  if (!token) throw new Error('VK access token is not configured');
  const attachments = images.length ? await uploadVkImages(images, token) : [];
  const post = await callVk('wall.post', {
    owner_id: `-${VK_GROUP_ID}`,
    from_group: 1,
    message: vkText(item),
    ...(attachments.length ? { attachments: attachments.join(',') } : {}),
  }, token);
  const postId = post?.post_id;
  if (!postId) throw new Error('VK wall.post did not return post_id');
  try {
    await callVk('wall.closeComments', {
      owner_id: `-${VK_GROUP_ID}`,
      post_id: postId,
    }, token);
  } catch (error) {
    console.error('VK post published but comments could not be closed:', error);
  }
  return postId;
}

export async function GET(request) {
  if (request.nextUrl.searchParams.get('key') !== KEY) return new Response('Unauthorized', { status: 401 });
  if (process.env.PUBLISHING_ENABLED === 'false') {
    return Response.json({ ok: false, error: 'Publishing is disabled' }, { status: 409 });
  }

  const schedule = kindForDate(new Date());
  if (!schedule.kind) {
    return Response.json({ ok: false, error: 'No publication is scheduled for today' }, { status: 400 });
  }

  const item = await cache.get(`prepared-content:${schedule.dateKey}`);
  if (!item) {
    return Response.json({ ok: false, error: 'No prepared content for today', dateKey: schedule.dateKey }, { status: 404 });
  }
  if (item.kind !== schedule.kind) {
    return Response.json({ ok: false, error: 'Prepared content kind does not match today schedule' }, { status: 409 });
  }

  const statusKey = `prepared-status:${schedule.dateKey}`;
  const status = (await cache.get(statusKey)) || {};
  if (status.vk) {
    return Response.json({
      ok: true,
      skipped: 'Prepared VK content was already published',
      dateKey: schedule.dateKey,
      kind: schedule.kind,
      title: item.title,
      vkPostId: status.vk,
      telegramPublished: Boolean(status.telegram),
    });
  }

  try {
    const images = item.format === 'slides'
      ? await Promise.all(item.slides.map((slide, index) => renderSlidePng(slide, index, item.slides.length)))
      : [];
    const postId = await sendVk(item, images);
    status.vk = postId;
    await cache.set(statusKey, status, { ttl: CACHE_TTL, tags: ['prepared-publications'] });

    return Response.json({
      ok: true,
      dateKey: schedule.dateKey,
      kind: schedule.kind,
      title: item.title,
      vkPostId: postId,
      telegramPublished: Boolean(status.telegram),
    });
  } catch (error) {
    console.error(error);
    return Response.json({
      ok: false,
      error: error instanceof Error ? error.message : 'VK-only publication failed',
    }, { status: 500 });
  }
}
