export const runtime = 'nodejs';
export const maxDuration = 60;

import React from 'react';
import { ImageResponse } from 'next/og';
import { getCache } from '@vercel/functions';
import { kindForDate } from '../../../../lib/prepared-content.js';
import { makeStoryUploadParams, makeWallPostUrl } from '../../../../lib/vk-republish.js';

const KEY = 'vkstory5439-20260819-3f7c12d8';
const cache = getCache({ namespace: 'traffic-news-v4' });
const VK_API_VERSION = '5.199';
const VK_GROUP_ID = Number(process.env.VK_GROUP_ID || '160851478');
const POST_ID = 5439;

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
      React.createElement('div', { style: { fontSize: '34px', fontWeight: 800 } }, 'Открыть пост'),
    ),
  );
}

async function tryStory(image, token, mode, params, linked) {
  const server = await vk('stories.getPhotoUploadServer', params, token);
  if (!server?.upload_url) throw new Error(`${mode}: no story upload URL`);
  const form = new FormData();
  form.append('file', new Blob([image], { type: 'image/png' }), 'story.png');
  const uploadResponse = await fetch(server.upload_url, { method: 'POST', body: form });
  const uploaded = await uploadResponse.json();
  const uploadResult = uploaded?.response?.upload_result || uploaded?.upload_result;
  if (!uploadResult) throw new Error(`${mode}: upload_result missing`);
  const saved = await vk('stories.save', { upload_results: [uploadResult], extended: 1 }, token);
  const story = saved?.items?.[0] || (Array.isArray(saved) ? saved[0] : null);
  if (!story?.id) throw new Error(`${mode}: stories.save returned no id`);
  return { storyId: story.id, ownerId: story.owner_id ?? -VK_GROUP_ID, mode, linkedToPost: linked };
}

export async function GET(request) {
  if (request.nextUrl.searchParams.get('key') !== KEY) return new Response('Unauthorized', { status: 401 });
  const token = await cache.get('vk-access-token-v1');
  if (!token) return Response.json({ ok: false, error: 'VK token missing' }, { status: 500 });
  const schedule = kindForDate(new Date());
  const item = await cache.get(`prepared-content:${schedule.dateKey}`);
  if (!item?.slides?.length) return Response.json({ ok: false, error: 'Prepared content missing' }, { status: 404 });

  const imageResponse = new ImageResponse(storyNode(item), { width: 1080, height: 1920 });
  const image = Buffer.from(await imageResponse.arrayBuffer());
  const variants = [
    ['post-sticker', makeStoryUploadParams(VK_GROUP_ID, POST_ID), true],
    ['link', { group_id: VK_GROUP_ID, add_to_news: 1, link_text: 'view', link_url: makeWallPostUrl(VK_GROUP_ID, POST_ID) }, true],
    ['plain', { group_id: VK_GROUP_ID, add_to_news: 1 }, false],
  ];

  let story = null;
  const errors = [];
  for (const [mode, params, linked] of variants) {
    try {
      story = await tryStory(image, token, mode, params, linked);
      break;
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  const statusKey = `prepared-status:${schedule.dateKey}`;
  const status = (await cache.get(statusKey)) || {};
  status.vk = POST_ID;
  status.vkImagesAttached = 5;
  status.vkReplacedPostId = 5438;
  if (story) {
    status.vkStory = story.storyId;
    status.vkStoryMode = story.mode;
  }
  await cache.set(statusKey, status, { ttl: 60 * 60 * 24 * 730, tags: ['prepared-publications'] });

  return Response.json({ ok: Boolean(story), postId: POST_ID, postUrl: makeWallPostUrl(VK_GROUP_ID, POST_ID), imagesAttached: 5, storyPublished: Boolean(story), storyId: story?.storyId || null, storyMode: story?.mode || null, storyLinkedToPost: story?.linkedToPost ?? false, errors, telegramPublished: Boolean(status.telegram) }, { status: story ? 200 : 500 });
}
