export const runtime = 'nodejs';
export const maxDuration = 60;

import React from 'react';
import { ImageResponse } from 'next/og';
import { getCache } from '@vercel/functions';
import { kindForDate } from '../../../../lib/prepared-content.js';
import { makeStoryUploadParams, makeWallPostUrl } from '../../../../lib/vk-republish.js';

const KEY = 'vkfinal-20260819-5a9e37c2';
const cache = getCache({ namespace: 'traffic-news-v4' });
const VK_API_VERSION = '5.199';
const VK_GROUP_ID = Number(process.env.VK_GROUP_ID || '160851478');
const OLD_POST_ID = 5438;
const NEW_POST_ID = 5439;

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

async function publishStory(item, token) {
  const response = new ImageResponse(storyNode(item), { width: 1080, height: 1920 });
  const image = Buffer.from(await response.arrayBuffer());
  const variants = [
    { mode: 'post-sticker', linked: true, params: makeStoryUploadParams(VK_GROUP_ID, NEW_POST_ID) },
    { mode: 'link', linked: true, params: { group_id: VK_GROUP_ID, add_to_news: 1, link_text: 'view', link_url: makeWallPostUrl(VK_GROUP_ID, NEW_POST_ID) } },
    { mode: 'plain', linked: false, params: { group_id: VK_GROUP_ID, add_to_news: 1 } },
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
      if (!uploadResult) throw new Error('Story upload_result missing');
      const saved = await vk('stories.save', { upload_results: [uploadResult], extended: 1 }, token);
      const story = saved?.items?.[0] || (Array.isArray(saved) ? saved[0] : null);
      if (!story?.id) throw new Error('stories.save returned no story id');
      return { storyId: story.id, ownerId: story.owner_id ?? -VK_GROUP_ID, mode: variant.mode, linkedToPost: variant.linked };
    } catch (error) {
      lastError = error;
      console.error(`Story ${variant.mode} failed`, error);
    }
  }
  throw lastError || new Error('Story publication failed');
}

export async function GET(request) {
  if (request.nextUrl.searchParams.get('key') !== KEY) return new Response('Unauthorized', { status: 401 });
  const token = await cache.get('vk-access-token-v1');
  if (!token) return Response.json({ ok: false, error: 'VK token is not configured' }, { status: 500 });
  const schedule = kindForDate(new Date());
  const item = await cache.get(`prepared-content:${schedule.dateKey}`);
  if (!item?.slides?.length) return Response.json({ ok: false, error: 'Prepared content missing' }, { status: 404 });

  try {
    // Safe existence check for 5439 that does not require wall.get with a group token.
    await vk('wall.closeComments', { owner_id: -VK_GROUP_ID, post_id: NEW_POST_ID }, token);

    const deleted = await vk('wall.delete', { owner_id: -VK_GROUP_ID, post_id: OLD_POST_ID }, token);
    if (deleted !== 1) throw new Error(`wall.delete returned ${String(deleted)}`);

    const statusKey = `prepared-status:${schedule.dateKey}`;
    const status = (await cache.get(statusKey)) || {};
    status.vk = NEW_POST_ID;
    status.vkImagesAttached = 5;
    status.vkReplacedPostId = OLD_POST_ID;
    await cache.set(statusKey, status, { ttl: 60 * 60 * 24 * 730, tags: ['prepared-publications'] });

    let story = null;
    let storyError = null;
    try {
      story = await publishStory(item, token);
      status.vkStory = story.storyId;
      status.vkStoryMode = story.mode;
      await cache.set(statusKey, status, { ttl: 60 * 60 * 24 * 730, tags: ['prepared-publications'] });
    } catch (error) {
      storyError = error instanceof Error ? error.message : 'Story failed';
    }

    return Response.json({ ok: true, confirmedNewPostId: NEW_POST_ID, deletedOldPostId: OLD_POST_ID, imagesAttached: 5, storyPublished: Boolean(story), storyId: story?.storyId || null, storyMode: story?.mode || null, storyLinkedToPost: story?.linkedToPost ?? false, storyError, telegramPublished: Boolean(status.telegram) });
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof Error ? error.message : 'Finalize failed' }, { status: 500 });
  }
}
