export const runtime = 'nodejs';

import { getCache } from '@vercel/functions';

const KEY = 'verify5440-20260819-64ac39ef';
const cache = getCache({ namespace: 'traffic-news-v4' });
const VK_API_VERSION = '5.199';
const GROUP_ID = '160851478';
const POST_ID = '5440';

async function call(method, params, token) {
  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(params || {})) body.set(key, String(value));
  if (token) body.set('access_token', token);
  body.set('v', VK_API_VERSION);
  const response = await fetch(`https://api.vk.com/method/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
    cache: 'no-store',
  });
  return response.json();
}

function summarize(data) {
  if (data?.error) return { errorCode: data.error.error_code, errorMessage: data.error.error_msg };
  const response = data?.response;
  const item = Array.isArray(response) ? response[0] : Array.isArray(response?.items) ? response.items.find((x) => Number(x.id) === Number(POST_ID)) : null;
  return {
    found: Boolean(item),
    postId: item?.id || null,
    attachmentCount: Array.isArray(item?.attachments) ? item.attachments.length : null,
    attachmentTypes: Array.isArray(item?.attachments) ? item.attachments.map((x) => x.type) : [],
  };
}

export async function GET(request) {
  if (request.nextUrl.searchParams.get('key') !== KEY) return new Response('Unauthorized', { status: 401 });
  const token = process.env.VK_ACCESS_TOKEN || await cache.get('vk-access-token-v1') || null;

  const attempts = {};
  attempts.getByIdWithGroupToken = summarize(await call('wall.getById', { posts: `-${GROUP_ID}_${POST_ID}` }, token));
  attempts.wallGetWithGroupToken = summarize(await call('wall.get', { owner_id: `-${GROUP_ID}`, count: 10, filter: 'all' }, token));
  attempts.getByIdPublic = summarize(await call('wall.getById', { posts: `-${GROUP_ID}_${POST_ID}` }, null));
  attempts.wallGetPublic = summarize(await call('wall.get', { owner_id: `-${GROUP_ID}`, count: 10, filter: 'all' }, null));

  return Response.json({ ok: true, attempts });
}
