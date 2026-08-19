export const runtime = 'nodejs';

import { getCache } from '@vercel/functions';

const KEY = 'vkmigrate-20260819-4f8c1d2a';
const CACHE_TTL = 60 * 60 * 24 * 730;
const legacyVkCache = getCache({ namespace: 'traffic-news-vk-v1' });
const currentCache = getCache({ namespace: 'traffic-news-v4' });

export async function GET(request) {
  if (request.nextUrl.searchParams.get('key') !== KEY) {
    return new Response('Unauthorized', { status: 401 });
  }

  const token = process.env.VK_ACCESS_TOKEN || await legacyVkCache.get('access-token') || null;
  if (!token) {
    return Response.json({ ok: false, migrated: false, error: 'Legacy VK token was not found' }, { status: 404 });
  }

  await currentCache.set('vk-access-token-v1', token, {
    ttl: CACHE_TTL,
    tags: ['vk-config'],
  });

  return Response.json({ ok: true, migrated: true });
}
