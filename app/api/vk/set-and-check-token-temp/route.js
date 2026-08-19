export const runtime = 'nodejs';
export const maxDuration = 30;

import { getCache } from '@vercel/functions';

const KEY = 'vkcheck-20260819-5c2a7f91';
const VK_API_VERSION = '5.199';
const VK_GROUP_ID = process.env.VK_GROUP_ID || '160851478';
const currentCache = getCache({ namespace: 'traffic-news-v4' });
const legacyCache = getCache({ namespace: 'traffic-news-vk-v1' });
const CACHE_TTL = 60 * 60 * 24 * 730;

async function callVk(method, params, token) {
  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(params || {})) {
    if (value !== undefined && value !== null) body.set(key, String(value));
  }
  body.set('access_token', token);
  body.set('v', VK_API_VERSION);
  const response = await fetch(`https://api.vk.com/method/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
    cache: 'no-store',
  });
  const data = await response.json();
  if (data.error) {
    const error = new Error(data.error.error_msg || `${method} failed`);
    error.code = data.error.error_code;
    throw error;
  }
  return data.response;
}

export async function GET(request) {
  if (request.nextUrl.searchParams.get('key') !== KEY) return new Response('Unauthorized', { status: 401 });
  const token = String(request.nextUrl.searchParams.get('token') || '').trim();
  if (!token) return Response.json({ ok: false, error: 'token is required' }, { status: 400 });

  await Promise.all([
    currentCache.set('vk-access-token-v1', token, { ttl: CACHE_TTL, tags: ['vk-config'] }),
    legacyCache.set('access-token', token, { ttl: CACHE_TTL, tags: ['vk-config'] }),
  ]);

  const result = {
    ok: true,
    configured: true,
    wallPhotoUpload: false,
    wallPhotoSave: false,
    groupId: VK_GROUP_ID,
  };

  try {
    const upload = await callVk('photos.getWallUploadServer', { group_id: VK_GROUP_ID }, token);
    result.wallPhotoUpload = Boolean(upload?.upload_url);
    result.uploadServerReceived = Boolean(upload?.upload_url);
  } catch (error) {
    result.wallPhotoUploadError = { code: error.code || null, message: error.message };
  }

  try {
    const user = await callVk('users.get', {}, token);
    result.userToken = Array.isArray(user) && Boolean(user[0]?.id);
    result.userId = Array.isArray(user) ? user[0]?.id || null : null;
  } catch (error) {
    result.userToken = false;
    result.usersGetError = { code: error.code || null, message: error.message };
  }

  return Response.json(result);
}
