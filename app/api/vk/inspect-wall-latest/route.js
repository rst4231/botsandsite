export const runtime = 'nodejs';

import { getCache } from '@vercel/functions';

const KEY = 'vkwallinspect-20260819-6c4e2b81';
const cache = getCache({ namespace: 'traffic-news-v4' });
const VK_API_VERSION = '5.199';
const VK_GROUP_ID = Number(process.env.VK_GROUP_ID || '160851478');

async function vk(method, params, token) {
  const body = new URLSearchParams({ ...Object.fromEntries(Object.entries(params || {}).map(([k, v]) => [k, String(v)])), access_token: token, v: VK_API_VERSION });
  const response = await fetch(`https://api.vk.com/method/${method}`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body, cache: 'no-store' });
  const data = await response.json();
  if (data.error) throw new Error(`VK ${data.error.error_code}: ${data.error.error_msg}`);
  return data.response;
}

export async function GET(request) {
  if (request.nextUrl.searchParams.get('key') !== KEY) return new Response('Unauthorized', { status: 401 });
  const token = await cache.get('vk-access-token-v1');
  if (!token) return Response.json({ ok: false, error: 'token missing' }, { status: 500 });
  try {
    const response = await vk('wall.get', { owner_id: -VK_GROUP_ID, count: 10, offset: 0 }, token);
    const items = Array.isArray(response?.items) ? response.items : [];
    return Response.json({ ok: true, posts: items.map((post) => ({ id: post.id, date: post.date, textStart: String(post.text || '').slice(0, 90), attachmentCount: Array.isArray(post.attachments) ? post.attachments.length : 0, types: Array.isArray(post.attachments) ? post.attachments.map((a) => a.type) : [] })) });
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof Error ? error.message : 'inspect failed' }, { status: 500 });
  }
}
