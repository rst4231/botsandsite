export const runtime = 'nodejs';
export const maxDuration = 60;

import React from 'react';
import { ImageResponse } from 'next/og';
import { getCache } from '@vercel/functions';
import { kindForDate } from '../../../../lib/prepared-content.js';
import { makeStoryUploadParams, makeWallPostUrl } from '../../../../lib/vk-republish.js';

const KEY = 'vkreplace2-20260819-a71d5c4e';
const cache = getCache({ namespace: 'traffic-news-v4' });
const VK_API_VERSION = '5.199';
const VK_GROUP_ID = Number(process.env.VK_GROUP_ID || '160851478');
const VK_FOOTER = '\n\nРекомендуем изучить:\n[https://vk.ru/app5898182_-160851478#page=67e5217dfe30f032b45b7c8|Теория]\n[https://vk.com/app5898182_-160851478#s=3112330&force=1&utf=1|Практика]';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function postText(item) {
  return `${item.title}\n\n${item.description || ''}${VK_FOOTER}`;
}

function slideNode(slide, index, total) {
  const first = index === 0;
  const last = index === total - 1;
  return React.createElement('div', { style: { width: '100%', height: '100%', display: 'flex', position: 'relative', overflow: 'hidden', background: '#fff', color: '#111', fontFamily: 'Arial, sans-serif', padding: '76px' } },
    React.createElement('div', { style: { position: 'absolute', width: '420px', height: '420px', borderRadius: '999px', background: 'rgba(26,105,255,.12)', top: '-160px', right: '-100px' } }),
    React.createElement('div', { style: { position: 'absolute', width: '330px', height: '330px', borderRadius: '999px', background: 'rgba(255,122,0,.12)', bottom: '-120px', left: '-80px' } }),
    React.createElement('div', { style: { width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', border: '2px solid rgba(17,17,17,.08)', borderRadius: '46px', background: 'rgba(255,255,255,.88)', boxShadow: '0 30px 90px rgba(17,17,17,.1)', padding: '64px' } },
      React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
        React.createElement('div', { style: { fontSize: '28px', fontWeight: 700, color: last ? '#ff7a00' : '#1269ff', letterSpacing: '.06em' } }, first ? 'РАЗБОР' : last ? 'ВЫВОД' : 'ПО ШАГАМ'),
        React.createElement('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'center', width: '90px', height: '50px', borderRadius: '999px', background: '#111', color: '#fff', fontSize: '24px', fontWeight: 700 } }, `${index + 1}/${total}`),
      ),
      React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: '38px' } },
        React.createElement('div', { style: { fontSize: first ? '76px' : '62px', lineHeight: 1.03, fontWeight: 800, letterSpacing: '-.045em', maxWidth: '890px' } }, slide.title),
        React.createElement('div', { style: { width: '110px', height: '10px', borderRadius: '999px', background: last ? '#ff7a00' : '#1269ff' } }),
        React.createElement('div', { style: { fontSize: first ? '38px' : '36px', lineHeight: 1.34, fontWeight: 500, whiteSpace: 'pre-wrap', maxWidth: '880px' } }, slide.body),
      ),
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: '14px', fontSize: '24px', fontWeight: 700 } },
        React.createElement('div', { style: { width: '18px', height: '18px', borderRadius: '999px', background: '#1269ff' } }),
        React.createElement('div', { style: { width: '18px', height: '18px', borderRadius: '999px', background: '#ff7a00' } }),
        React.createElement('div', { style: { marginLeft: '8px' } }, 'LH'),
      ),
    ),
  );
}

function storyNode(item) {
  const slide = item.slides[0];
  return React.createElement('div', { style: { width: '100%', height: '100%', display: 'flex', position: 'relative', overflow: 'hidden', background: '#fff', color: '#111', fontFamily: 'Arial, sans-serif', padding: '80px 64px' } },
    React.createElement('div', { style: { position: 'absolute', width: '540px', height: '540px', borderRadius: '999px', background: 'rgba(26,105,255,.13)', top: '-190px', right: '-170px' } }),
    React.createElement('div', { style: { position: 'absolute', width: '430px', height: '430px', borderRadius: '999px', background: 'rgba(255,122,0,.13)', bottom: '-140px', left: '-120px' } }),
    React.createElement('div', { style: { width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', border: '2px solid rgba(17,17,17,.08)', borderRadius: '54px', background: 'rgba(255,255,255,.9)', padding: '72px 64px', boxShadow: '0 30px 90px rgba(17,17,17,.1)' } },
      React.createElement('div', { style: { fontSize: '30px', fontWeight: 800, color: '#1269ff', letterSpacing: '.08em' } }, 'НОВЫЙ ПОСТ'),
      React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: '42px' } },
        React.createElement('div', { style: { fontSize: '78px', lineHeight: 1.04, fontWeight: 800, letterSpacing: '-.045em' } }, slide.title),
        React.createElement('div', { style: { width: '120px', height: '10px', borderRadius: '999px', background: '#ff7a00' } }),
        React.createElement('div', { style: { fontSize: '40px', lineHeight: 1.36, fontWeight: 500 } }, slide.body),
      ),
      React.createElement('div', { style: { fontSize: '34px', fontWeight: 800 } }, 'Нажмите на пост, чтобы открыть'),
    ),
  );
}

async function png(node, width, height) {
  const response = new ImageResponse(node, { width, height });
  return Buffer.from(await response.arrayBuffer());
}

async function vk(method, params, token) {
  const body = new URLSearchParams();
  for (const [k, v] of Object.entries(params || {})) {
    if (v === undefined || v === null) continue;
    body.set(k, Array.isArray(v) ? v.join(',') : String(v));
  }
  body.set('access_token', token);
  body.set('v', VK_API_VERSION);
  const response = await fetch(`https://api.vk.com/method/${method}`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body, cache: 'no-store' });
  const data = await response.json();
  if (!response.ok || data.error) throw new Error(`VK ${data?.error?.error_code ?? response.status}: ${data?.error?.error_msg || method + ' failed'}`);
  return data.response;
}

async function uploadPhoto(image, index, token) {
  let last = 'empty photo';
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    const server = await vk('photos.getMessagesUploadServer', {}, token);
    const form = new FormData();
    form.append('photo', new Blob([image], { type: 'image/png' }), `slide${index}.png`);
    const uploadResponse = await fetch(server.upload_url, { method: 'POST', body: form });
    const raw = await uploadResponse.text();
    let uploaded = null;
    try { uploaded = JSON.parse(raw); } catch {}
    if (uploadResponse.ok && uploaded?.photo) {
      const saved = await vk('photos.saveMessagesPhoto', { photo: uploaded.photo, server: uploaded.server, hash: uploaded.hash }, token);
      const photo = Array.isArray(saved) ? saved[0] : null;
      if (photo?.owner_id && photo?.id) return `photo${photo.owner_id}_${photo.id}`;
      last = 'saveMessagesPhoto returned no photo';
    } else {
      last = raw.slice(0, 300) || `HTTP ${uploadResponse.status}`;
    }
    await sleep(900 * attempt);
  }
  throw new Error(`VK slide ${index} upload failed after retries: ${last}`);
}

async function verifyPost(postId, token) {
  const response = await vk('wall.getById', { posts: `-${VK_GROUP_ID}_${postId}`, extended: 0 }, token);
  const post = Array.isArray(response?.items) ? response.items[0] : Array.isArray(response) ? response[0] : null;
  const attachments = Array.isArray(post?.attachments) ? post.attachments : [];
  return { found: Boolean(post), attachmentCount: attachments.length, types: attachments.map((a) => a.type) };
}

async function publishStory(image, postId, token) {
  const variants = [
    { mode: 'post-sticker', params: makeStoryUploadParams(VK_GROUP_ID, postId), linked: true },
    { mode: 'link', params: { group_id: VK_GROUP_ID, add_to_news: 1, link_text: 'view', link_url: makeWallPostUrl(VK_GROUP_ID, postId) }, linked: true },
    { mode: 'plain', params: { group_id: VK_GROUP_ID, add_to_news: 1 }, linked: false },
  ];
  let lastError = null;
  for (const variant of variants) {
    try {
      const server = await vk('stories.getPhotoUploadServer', variant.params, token);
      const form = new FormData();
      form.append('file', new Blob([image], { type: 'image/png' }), 'story.png');
      const uploadResponse = await fetch(server.upload_url, { method: 'POST', body: form });
      const uploaded = await uploadResponse.json();
      const uploadResult = uploaded?.response?.upload_result || uploaded?.upload_result;
      if (!uploadResult) throw new Error('story upload_result is missing');
      const saved = await vk('stories.save', { upload_results: [uploadResult], extended: 1 }, token);
      const story = saved?.items?.[0] || (Array.isArray(saved) ? saved[0] : null);
      if (!story?.id) throw new Error('stories.save returned no story');
      const check = await vk('stories.getById', { stories: `-${VK_GROUP_ID}_${story.id}`, extended: 1 }, token);
      const found = check?.items?.[0] || (Array.isArray(check) ? check[0] : null);
      if (!found) throw new Error('story verification failed');
      return { storyId: story.id, ownerId: story.owner_id ?? -VK_GROUP_ID, mode: variant.mode, linkedToPost: variant.linked };
    } catch (error) {
      lastError = error;
      console.error(`VK story ${variant.mode} failed:`, error);
    }
  }
  throw lastError || new Error('VK story publication failed');
}

export async function GET(request) {
  if (request.nextUrl.searchParams.get('key') !== KEY) return new Response('Unauthorized', { status: 401 });
  const token = await cache.get('vk-access-token-v1');
  if (!token) return Response.json({ ok: false, error: 'VK token is not configured' }, { status: 500 });
  const schedule = kindForDate(new Date());
  const item = await cache.get(`prepared-content:${schedule.dateKey}`);
  if (!item?.slides?.length) return Response.json({ ok: false, error: 'Prepared slides are missing' }, { status: 404 });
  const statusKey = `prepared-status:${schedule.dateKey}`;
  const status = (await cache.get(statusKey)) || {};
  const oldPostId = Number(status.vk || 5438);

  try {
    const images = await Promise.all(item.slides.map((slide, i) => png(slideNode(slide, i, item.slides.length), 1080, 1350)));
    const attachments = [];
    for (let i = 0; i < images.length; i += 1) {
      attachments.push(await uploadPhoto(images[i], i + 1, token));
      await sleep(700);
    }

    const posted = await vk('wall.post', { owner_id: `-${VK_GROUP_ID}`, from_group: 1, message: postText(item), attachments: attachments.join(',') }, token);
    const newPostId = posted?.post_id;
    if (!newPostId) throw new Error('wall.post returned no post_id');

    const verified = await verifyPost(newPostId, token);
    if (!verified.found || verified.attachmentCount !== item.slides.length || verified.types.some((type) => type !== 'photo')) {
      await vk('wall.delete', { owner_id: `-${VK_GROUP_ID}`, post_id: newPostId }, token).catch(() => {});
      throw new Error(`New VK post verification failed: ${JSON.stringify(verified)}`);
    }

    try { await vk('wall.closeComments', { owner_id: `-${VK_GROUP_ID}`, post_id: newPostId }, token); } catch (error) { console.error(error); }

    const deleted = await vk('wall.delete', { owner_id: `-${VK_GROUP_ID}`, post_id: oldPostId }, token);
    if (deleted !== 1) {
      await vk('wall.delete', { owner_id: `-${VK_GROUP_ID}`, post_id: newPostId }, token).catch(() => {});
      throw new Error(`Could not delete old VK post ${oldPostId}`);
    }

    status.vk = newPostId;
    status.vkImagesAttached = verified.attachmentCount;
    status.vkReplacedPostId = oldPostId;
    await cache.set(statusKey, status, { ttl: 60 * 60 * 24 * 730, tags: ['prepared-publications'] });

    let story = null;
    let storyError = null;
    try {
      story = await publishStory(await png(storyNode(item), 1080, 1920), newPostId, token);
      status.vkStory = story.storyId;
      status.vkStoryMode = story.mode;
      await cache.set(statusKey, status, { ttl: 60 * 60 * 24 * 730, tags: ['prepared-publications'] });
    } catch (error) {
      storyError = error instanceof Error ? error.message : 'Story failed';
    }

    return Response.json({ ok: true, oldPostId, deletedOldPost: true, newPostId, postUrl: makeWallPostUrl(VK_GROUP_ID, newPostId), imagesAttached: verified.attachmentCount, attachmentTypes: verified.types, storyPublished: Boolean(story), storyId: story?.storyId || null, storyMode: story?.mode || null, storyLinkedToPost: story?.linkedToPost ?? false, storyError, telegramPublished: Boolean(status.telegram) });
  } catch (error) {
    return Response.json({ ok: false, oldPostId, error: error instanceof Error ? error.message : 'VK replacement failed', telegramPublished: Boolean(status.telegram) }, { status: 500 });
  }
}
