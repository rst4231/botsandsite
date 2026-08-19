export const runtime = 'nodejs';

import { getCache } from '@vercel/functions';

const KEY = 'vkset-20260819-2a7d91c4';
const CACHE_TTL = 60 * 60 * 24 * 730;
const currentCache = getCache({ namespace: 'traffic-news-v4' });
const legacyCache = getCache({ namespace: 'traffic-news-vk-v1' });

export async function GET(request) {
  if (request.nextUrl.searchParams.get('key') !== KEY) {
    return new Response('Unauthorized', { status: 401 });
  }

  const token = String(request.nextUrl.searchParams.get('token') || '').trim();
  if (!token) {
    return Response.json({ ok: false, error: 'token is required' }, { status: 400 });
  }

  await Promise.all([
    currentCache.set('vk-access-token-v1', token, { ttl: CACHE_TTL, tags: ['vk-config'] }),
    legacyCache.set('access-token', token, { ttl: CACHE_TTL, tags: ['vk-config'] }),
  ]);

  return Response.json({ ok: true, configured: true });
}
