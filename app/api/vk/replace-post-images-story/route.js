export const runtime = 'nodejs';
export const maxDuration = 60;

import React from 'react';
import { ImageResponse } from 'next/og';
import { getCache } from '@vercel/functions';
import { kindForDate } from '../../../../lib/prepared-content.js';
import { makeStoryUploadParams, makeWallPostUrl } from '../../../../lib/vk-republish.js';

const KEY = 'vkreplace-20260819-e54d13a7';
const CACHE_TTL = 60 * 60 * 24 * 730;
const cache = getCache({ namespace: 'traffic-news-v4' });
const legacyCache = getCache({ namespace: 'traffic-news-vk-v1' });
const VK_API_VERSION = '5.199';
const VK_GROUP_ID = Number(process.env.VK_GROUP_ID || '160851478');
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
        width: '100%', height: '100%', display: 'flex', position: 'relative', overflow: 'hidden',
        background: '#ffffff', color: '#111111', fontFamily: 'Arial, sans-serif', padding: '76px',
      },
    },
    React.createElement('div', { style: { position: 'absolute', width: '420px', height: '420px', borderRadius: '999px', background: 'rgba(26, 105, 255, 0.12)', top: '-160px', right: '-100px' } }),
    React.createElement('div', { style: { position: 'absolute', width: '330px', height: '330px', borderRadius: '999px', background: 'rgba(255, 122, 0, 0.12)', bottom: '-120px', left: '-80px' } }),
    React.createElement(
      'div',
      { style: { width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', border: '2px solid rgba(17,17,17,0.08)', borderRadius: '46px', background: 'rgba(255,255,255,0.86)', boxShadow: '0 30px 90px rgba(17,17,17,0.10)', padding: '64px' } },
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

function storyNode(item) {
  const first = item.slides?.[0] || { title: item.title, body: item.description || '' };
  return React.createElement(
    'div',
    { style: { width: '100%', height: '100%', display: 'flex', position: 'relative', overflow: 'hidden', background: '#ffffff', color: '#111111', fontFamily: 'Arial, sans-serif', padding: '80px 64px' } },
    React.createElement('div', { style: { position: 'absolute', width: '520px', height: '520px', borderRadius: '999px', background: 'rgba(26,105,255,0.13)', top: '-180px', right: '-160px' } }),
    React.createElement('div', { style: { position: 'absolute', width: '440px', height: '440px', borderRadius: '999px', background: 'rgba(255,122,0,0.13)', bottom: '-150px', left: '-130px' } }),
    React.createElement(
      'div',
      { style: { width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', border: '2px solid rgba(17,17,17,0.08)', borderRadius: '54px', background: 'rgba(255,255,255,0.9)', padding: '72px 64px', boxShadow: '0 30px 90px rgba(17,17,17,0.10)' } },
      React.createElement('div', { style: { fontSize: '30px', fontWeight: 800, color: '#1269ff', letterSpacing: '0.08em' } }, 'НОВЫЙ ПОСТ'),
      React.createElement(
        'div',
        { style: { display: 'flex', flexDirection: 'column', gap: '42px' } },
        React.createElement('div', { style: { fontSize: '78px', lineHeight: 1.04, fontWeight: 800, letterSpacing: '-0.045em' } }, first.title),
        React.createElement('div', { style: { width: '120px', height: '10px', borderRadius: '999px', background: '#ff7a00' } }),
        React.createElement('div', { style: { fontSize: '40px', lineHeight: 1.36, fontWeight: 500 } }, first.body),
      ),
      React.createElement(
        'div',
        { style: { display: 'flex', flexDirection: 'column', gap: '20px' } },
        React.createElement('div', { style: { fontSize: '34px', fontWeight: 800 } }, 'Нажмите на пост, чтобы открыть'),
        React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: '14px', fontSize: '26px', fontWeight: 700 } },
          React.createElement('div', { style: { width: '18px', height: '18px', borderRadius: '999px', background: '#1269ff' } }),
          React.createElement('div', { style: { width: '18px', height: '18px', borderRadius: '999px', background: '#ff7a00' } }),
          React.createElement('div', { style: { marginLeft: '8px' } }, 'LH'),
        ),
      ),
    ),
  );
}

async function renderPng(node, width, height) {
  const response = new ImageResponse(node, { width, height });
  return Buffer.from(await response.arrayBuffer());
}

async function callVk(method, params, token) {
  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(params || {})) {
    if (value === undefined || value === null) continue;
    body.set(key, Array.isArray(value) ? value.join(',') : String(value));
  }
  body.set('access_token', token);
  body.set('v', VK_API_VERSION);
  const response = await fetch(`https://api.vk.com/method/${method}`, {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body, cache: 'no-store',
  });
  const data = await response.json();
  if (!response.ok || data.error) {
    const code = data?.error?.error_code ?? response.status;
    const message = data?.error?.error_msg || `${method} failed`;
    throw new Error(`VK ${code}: ${message}`);
  }
  return data.response;
}

async function uploadWallImages(images, token) {
  const attachments = [];
  for (let index = 0; index < images.length; index += 1) {
    const server = await callVk('photos.getWallUploadServer', { group_id: VK_GROUP_ID }, token);
    if (!server?.upload_url) throw new Error('VK wall photo upload server is unavailable');
    const form = new FormData();
    form.append('photo', new Blob([images[index]], { type: 'image/png' }), `slide${index + 1}.png`);
    const uploadResponse = await fetch(server.upload_url, { method: 'POST', body: form });
    const uploaded = await uploadResponse.json();
    if (!uploadResponse.ok) throw new Error(`VK wall photo upload failed for slide ${index + 1}`);
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

async function uploadStoryVariant(storyImage, token, params) {
  const server = await callVk('stories.getPhotoUploadServer', params, token);
  if (!server?.upload_url) throw new Error('VK story upload server is unavailable');
  const form = new FormData();
  form.append('file', new Blob([storyImage], { type: 'image/png' }), 'story.png');
  const uploadResponse = await fetch(server.upload_url, { method: 'POST', body: form });
  const uploaded = await uploadResponse.json();
  if (!uploadResponse.ok) throw new Error('VK story image upload failed');
  const uploadResult = uploaded?.response?.upload_result || uploaded?.upload_result;
  if (!uploadResult) throw new Error('VK story upload did not return upload_result');
  const saved = await callVk('stories.save', { upload_results: uploadResult, extended: 1 }, token);
  const story = Array.isArray(saved?.items) ? saved.items[0] : null;
  if (!story?.id) throw new Error('VK stories.save did not return a story id');
  return { storyId: story.id, ownerId: story.owner_id ?? -VK_GROUP_ID };
}

async function publishStory(storyImage, token, postId) {
  const linked = makeStoryUploadParams(VK_GROUP_ID, postId);
  try {
    const result = await uploadStoryVariant(storyImage, token, linked);
    return { ...result, linkedToPost: true, mode: 'post-sticker' };
  } catch (firstError) {
    console.error('VK story post-sticker mode failed:', firstError);
  }

  try {
    const result = await uploadStoryVariant(storyImage, token, {
      group_id: VK_GROUP_ID,
      add_to_news: 1,
      link_text: 'view',
      link_url: makeWallPostUrl(VK_GROUP_ID, postId),
    });
    return { ...result, linkedToPost: true, mode: 'link' };
  } catch (secondError) {
    console.error('VK story link mode failed:', secondError);
  }

  const result = await uploadStoryVariant(storyImage, token, { group_id: VK_GROUP_ID, add_to_news: 1 });
  return { ...result, linkedToPost: false, mode: 'plain' };
}

export async function GET(request) {
  if (request.nextUrl.searchParams.get('key') !== KEY) return new Response('Unauthorized', { status: 401 });
  const token = String(request.nextUrl.searchParams.get('token') || '').trim();
  if (!token) return Response.json({ ok: false, error: 'token is required' }, { status: 400 });

  if (process.env.PUBLISHING_ENABLED === 'false') {
    return Response.json({ ok: false, error: 'Publishing is disabled' }, { status: 409 });
  }

  const schedule = kindForDate(new Date());
  if (!schedule.kind) return Response.json({ ok: false, error: 'No publication is scheduled for today' }, { status: 400 });
  const item = await cache.get(`prepared-content:${schedule.dateKey}`);
  if (!item || item.format !== 'slides' || !Array.isArray(item.slides) || item.slides.length === 0) {
    return Response.json({ ok: false, error: 'Prepared slide content is unavailable' }, { status: 404 });
  }

  await Promise.all([
    cache.set(VK_TOKEN_CACHE_KEY, token, { ttl: CACHE_TTL, tags: ['vk-config'] }),
    legacyCache.set('access-token', token, { ttl: CACHE_TTL, tags: ['vk-config'] }),
  ]);

  const statusKey = `prepared-status:${schedule.dateKey}`;
  const status = (await cache.get(statusKey)) || {};
  const oldPostId = Number(status.vk || 5438);

  try {
    const slideImages = await Promise.all(item.slides.map((slide, index) => renderPng(slideNode(slide, index, item.slides.length), 1080, 1350)));
    const storyImage = await renderPng(storyNode(item), 1080, 1920);

    // Upload and save all images first. The old post remains intact until this succeeds.
    const attachments = await uploadWallImages(slideImages, token);
    if (attachments.length !== item.slides.length) throw new Error('Not all VK slide images were uploaded');

    const deleted = await callVk('wall.delete', { owner_id: `-${VK_GROUP_ID}`, post_id: oldPostId }, token);
    if (deleted !== 1) throw new Error(`VK wall.delete returned ${String(deleted)}`);

    const posted = await callVk('wall.post', {
      owner_id: `-${VK_GROUP_ID}`,
      from_group: 1,
      message: vkText(item),
      attachments: attachments.join(','),
    }, token);
    const newPostId = posted?.post_id;
    if (!newPostId) throw new Error('VK wall.post did not return post_id');

    try {
      await callVk('wall.closeComments', { owner_id: `-${VK_GROUP_ID}`, post_id: newPostId }, token);
    } catch (commentError) {
      console.error('VK post published but comments could not be closed:', commentError);
    }

    status.vk = newPostId;
    status.vkImagesAttached = attachments.length;
    status.vkReplacedPostId = oldPostId;
    await cache.set(statusKey, status, { ttl: CACHE_TTL, tags: ['prepared-publications'] });

    let story = null;
    let storyError = null;
    try {
      story = await publishStory(storyImage, token, newPostId);
      status.vkStory = story.storyId;
      status.vkStoryMode = story.mode;
      await cache.set(statusKey, status, { ttl: CACHE_TTL, tags: ['prepared-publications'] });
    } catch (error) {
      storyError = error instanceof Error ? error.message : 'VK story publication failed';
      console.error(error);
    }

    return Response.json({
      ok: true,
      dateKey: schedule.dateKey,
      title: item.title,
      oldPostId,
      deletedOldPost: true,
      newPostId,
      postUrl: makeWallPostUrl(VK_GROUP_ID, newPostId),
      imagesAttached: attachments.length,
      storyPublished: Boolean(story),
      storyId: story?.storyId || null,
      storyOwnerId: story?.ownerId || null,
      storyLinkedToPost: story?.linkedToPost ?? false,
      storyMode: story?.mode || null,
      storyError,
      telegramPublished: Boolean(status.telegram),
      tokenConfigured: true,
    });
  } catch (error) {
    console.error(error);
    return Response.json({
      ok: false,
      error: error instanceof Error ? error.message : 'VK replace flow failed',
      oldPostId,
      telegramPublished: Boolean(status.telegram),
    }, { status: 500 });
  }
}
