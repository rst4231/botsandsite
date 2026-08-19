export const runtime = 'nodejs';
export const maxDuration = 60;

import { getCache } from '@vercel/functions';
import { authorizedContentRequest } from '../../../../lib/content-auth.js';

const primary = getCache({ namespace: 'traffic-news-v4' });
const secondary = getCache({ namespace: 'traffic-news-vk-v1' });
const TTL = 60 * 60 * 24 * 730;
const VK_API_VERSION = '5.199';
const VK_GROUP_ID = process.env.VK_GROUP_ID || '160851478';

async function validateToken(token) {
  const body = new URLSearchParams({
    owner_id: `-${VK_GROUP_ID}`,
    access_token: token,
    v: VK_API_VERSION,
  });
  const response = await fetch('https://api.vk.com/method/stories.get', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
    cache: 'no-store',
  });
  const data = await response.json();
  if (data?.error) {
    const error = new Error(data.error.error_msg || 'VK token validation failed');
    error.code = data.error.error_code || response.status;
    throw error;
  }
  return true;
}

export async function GET(request) {
  if (!authorizedContentRequest(request)) return new Response('Unauthorized', { status: 401 });
  const token = String(request.nextUrl.searchParams.get('token') || '').trim();
  if (!token) return Response.json({ ok: false, error: 'token is required' }, { status: 400 });

  try {
    await validateToken(token);
    await Promise.all([
      primary.set('vk-access-token-v1', token, { ttl: TTL, tags: ['vk-config'] }),
      secondary.set('access-token', token, { ttl: TTL, tags: ['vk-config'] }),
    ]);
    return Response.json({ ok: true, configured: true, tokenWorks: true });
  } catch (error) {
    return Response.json({
      ok: false,
      configured: false,
      tokenWorks: false,
      error: error instanceof Error ? error.message : String(error),
      code: error?.code || null,
    }, { status: 400 });
  }
}
