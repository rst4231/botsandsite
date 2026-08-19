export const runtime = 'nodejs';

import { createHash, timingSafeEqual } from 'node:crypto';
import { getCache } from '@vercel/functions';

const primary = getCache({ namespace: 'traffic-news-v4' });
const secondary = getCache({ namespace: 'traffic-news-vk-v1' });
const TTL = 60 * 60 * 24 * 730;
const EXPECTED_KEY_HASH = '0256ce3186c51136247fc1ffc6539d44eef5bca196d29a749d14376c72632ef4';

function authorized(value) {
  const actual = createHash('sha256').update(value || '').digest();
  const expected = Buffer.from(EXPECTED_KEY_HASH, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

async function validateToken(token) {
  const body = new URLSearchParams({ access_token: token, v: '5.199' });
  const response = await fetch('https://api.vk.com/method/photos.getMessagesUploadServer', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
    cache: 'no-store',
  });
  const data = await response.json();
  if (!data?.response?.upload_url) {
    const error = new Error(data?.error?.error_msg || 'VK token validation failed');
    error.code = data?.error?.error_code || response.status;
    throw error;
  }
}

export async function GET(request) {
  const key = request.nextUrl.searchParams.get('key') || '';
  if (!authorized(key)) return new Response('Unauthorized', { status: 401 });

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
