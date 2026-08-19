export const runtime = 'nodejs';
export const maxDuration = 60;

import { getCache } from '@vercel/functions';
import { kindForDate } from '../../../../lib/prepared-content.js';

const KEY = 'vktext-20260819-83c6e5a1';
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

export async function GET(request) {
  if (request.nextUrl.searchParams.get('key') !== KEY) return new Response('Unauthorized', { status: 401 });

  const schedule = kindForDate(new Date());
  const item = await cache.get(`prepared-content:${schedule.dateKey}`);
  if (!schedule.kind || !item) {
    return Response.json({ ok: false, error: 'Prepared content is unavailable' }, { status: 404 });
  }

  const statusKey = `prepared-status:${schedule.dateKey}`;
  const status = (await cache.get(statusKey)) || {};
  if (status.vk) {
    return Response.json({ ok: true, skipped: 'VK already published', vkPostId: status.vk, telegramPublished: Boolean(status.telegram) });
  }

  const token = process.env.VK_ACCESS_TOKEN || await cache.get(VK_TOKEN_CACHE_KEY) || null;
  if (!token) return Response.json({ ok: false, error: 'VK access token is not configured' }, { status: 500 });

  try {
    const result = await callVk('wall.post', {
      owner_id: `-${VK_GROUP_ID}`,
      from_group: 1,
      message: vkText(item),
    }, token);
    const postId = result?.post_id;
    if (!postId) throw new Error('VK wall.post did not return post_id');

    try {
      await callVk('wall.closeComments', { owner_id: `-${VK_GROUP_ID}`, post_id: postId }, token);
    } catch (error) {
      console.error('VK post published but comments could not be closed:', error);
    }

    status.vk = postId;
    await cache.set(statusKey, status, { ttl: CACHE_TTL, tags: ['prepared-publications'] });

    return Response.json({
      ok: true,
      dateKey: schedule.dateKey,
      kind: schedule.kind,
      title: item.title,
      vkPostId: postId,
      imagesAttached: false,
      telegramPublished: Boolean(status.telegram),
    });
  } catch (error) {
    console.error(error);
    return Response.json({ ok: false, error: error instanceof Error ? error.message : 'VK text publication failed' }, { status: 500 });
  }
}
