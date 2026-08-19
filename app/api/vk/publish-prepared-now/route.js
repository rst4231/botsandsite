export const runtime = 'nodejs';
export const maxDuration = 60;

import React from 'react';
import { ImageResponse } from 'next/og';
import { getCache } from '@vercel/functions';
import { authorizedContentRequest } from '../../../../lib/content-auth.js';
import { buildVkPreparedText, ensureVkPreparedPublished, uploadVkStory } from '../../../../lib/vk-prepared-manual.mjs';

const CACHE_TTL = 60 * 60 * 24 * 730;
const cache = getCache({ namespace: 'traffic-news-v4' });
const VK_API_VERSION = '5.199';
const VK_GROUP_ID = process.env.VK_GROUP_ID || '160851478';
const VK_TOKEN_CACHE_KEY = 'vk-access-token-v1';
const VK_FOOTER = '\n\nРекомендуем изучить:\n[https://vk.ru/app5898182_-160851478#page=67e5217dfe30f032b45b7c8|Теория]\n[https://vk.com/app5898182_-160851478#s=3112330&force=1&utf=1|Практика]';

function moscowDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Moscow', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
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

function storyNode(item) {
  const slide = item.slides?.[0] || { title: item.title, body: item.description };
  return React.createElement(
    'div',
    {
      style: {
        width: '100%', height: '100%', display: 'flex', position: 'relative', overflow: 'hidden',
        background: '#ffffff', color: '#111111', fontFamily: 'Arial, sans-serif', padding: '90px',
      },
    },
    React.createElement('div', { style: { position: 'absolute', width: '620px', height: '620px', borderRadius: '999px', background: 'rgba(26, 105, 255, 0.12)', top: '-230px', right: '-200px' } }),
    React.createElement('div', { style: { position: 'absolute', width: '520px', height: '520px', borderRadius: '999px', background: 'rgba(255, 122, 0, 0.12)', bottom: '-180px', left: '-180px' } }),
    React.createElement(
      'div',
      {
        style: {
          width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
          border: '2px solid rgba(17, 17, 17, 0.08)', borderRadius: '54px', background: 'rgba(255,255,255,0.88)',
          boxShadow: '0 34px 100px rgba(17, 17, 17, 0.10)', padding: '74px',
        },
      },
      React.createElement('div', { style: { fontSize: '30px', fontWeight: 800, color: '#1269ff', letterSpacing: '0.08em' } }, 'ПРАКТИКА'),
      React.createElement(
        'div',
        { style: { display: 'flex', flexDirection: 'column', gap: '46px' } },
        React.createElement('div', { style: { fontSize: '82px', lineHeight: 1.02, fontWeight: 800, letterSpacing: '-0.045em' } }, slide.title),
        React.createElement('div', { style: { width: '130px', height: '12px', borderRadius: '999px', background: '#ff7a00' } }),
        React.createElement('div', { style: { fontSize: '42px', lineHeight: 1.35, fontWeight: 500, whiteSpace: 'pre-wrap' } }, slide.body),
      ),
      React.createElement(
        'div',
        { style: { display: 'flex', alignItems: 'center', gap: '16px' } },
        React.createElement('div', { style: { width: '22px', height: '22px', borderRadius: '999px', background: '#1269ff' } }),
        React.createElement('div', { style: { width: '22px', height: '22px', borderRadius: '999px', background: '#ff7a00' } }),
      ),
    ),
  );
}

async function renderStoryPng(item) {
  const response = new ImageResponse(storyNode(item), { width: 1080, height: 1920 });
  return Buffer.from(await response.arrayBuffer());
}

export async function GET(request) {
  if (!authorizedContentRequest(request)) return new Response('Unauthorized', { status: 401 });

  const dateKey = moscowDateKey();
  const item = await cache.get(`prepared-content:${dateKey}`);
  if (!item) return Response.json({ ok: false, error: 'No prepared content for today', dateKey }, { status: 404 });
  if (item.format !== 'slides' || !Array.isArray(item.slides) || item.slides.length !== 5) {
    return Response.json({ ok: false, error: 'Prepared VK story requires five slides', dateKey }, { status: 409 });
  }

  const token = await getVkAccessToken();
  if (!token) return Response.json({ ok: false, error: 'VK access token is not configured', dateKey }, { status: 500 });

  const statusKey = `prepared-status:${dateKey}`;
  const currentStatus = (await cache.get(statusKey)) || {};
  const apiCall = (method, params) => callVk(method, params, token);

  try {
    const nextStatus = await ensureVkPreparedPublished({
      item,
      status: currentStatus,
      publishWall: async () => {
        const post = await apiCall('wall.post', {
          owner_id: `-${VK_GROUP_ID}`,
          from_group: 1,
          message: buildVkPreparedText(item, VK_FOOTER),
        });
        const postId = post?.post_id;
        if (!postId) throw new Error('VK wall.post did not return post_id');
        try {
          await apiCall('wall.closeComments', { owner_id: `-${VK_GROUP_ID}`, post_id: postId });
        } catch (error) {
          console.error('VK manual post published but comments could not be closed:', error);
        }
        return postId;
      },
      publishStory: async () => uploadVkStory({
        groupId: VK_GROUP_ID,
        image: await renderStoryPng(item),
        apiCall,
      }),
      persist: async (status) => cache.set(statusKey, status, { ttl: CACHE_TTL, tags: ['prepared-publications'] }),
    });

    return Response.json({
      ok: true,
      dateKey,
      title: item.title,
      vkPostId: nextStatus.vk,
      vkStory: nextStatus.vkStory,
      telegramPublished: Boolean(nextStatus.telegram),
    });
  } catch (error) {
    console.error('VK_PREPARED_NOW_ERROR', error);
    const persistedStatus = (await cache.get(statusKey)) || currentStatus;
    return Response.json({
      ok: false,
      dateKey,
      error: error instanceof Error ? error.message : 'VK prepared publication failed',
      vkPostId: persistedStatus.vk || null,
      vkStory: persistedStatus.vkStory || null,
    }, { status: 500 });
  }
}
