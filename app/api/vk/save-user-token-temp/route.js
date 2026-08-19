export const runtime = 'nodejs';

import { getCache } from '@vercel/functions';

const VK_API_VERSION = '5.199';
const VK_GROUP_ID = process.env.VK_GROUP_ID || '160851478';
const cache = getCache({ namespace: 'traffic-news-v4' });
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
  if (!response.ok || data.error) {
    const message = data?.error?.error_msg || `${method} failed`;
    const error = new Error(message);
    error.code = data?.error?.error_code || response.status;
    throw error;
  }
  return data.response;
}

async function exchangeCode({ code, appId, deviceId, codeVerifier, state, redirectUrl }) {
  const query = new URLSearchParams({
    grant_type: 'authorization_code',
    redirect_uri: redirectUrl,
    client_id: String(appId),
    code_verifier: codeVerifier,
    state,
    device_id: deviceId,
  });
  const response = await fetch(`https://id.vk.ru/oauth2/auth?${query.toString()}`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ code }),
    cache: 'no-store',
  });
  const data = await response.json();
  if (!response.ok || data?.error) {
    const message = data?.error_description || data?.error || 'VK ID code exchange failed';
    const error = new Error(message);
    error.code = data?.error || response.status;
    throw error;
  }
  if (data?.state && data.state !== state) {
    const error = new Error('VK state does not match the authorization request');
    error.code = 'state_mismatch';
    throw error;
  }
  return data;
}

export async function POST(request) {
  try {
    const payload = await request.json();
    const code = String(payload?.code || '').trim();
    const appId = Number(payload?.appId || 0);
    const deviceId = String(payload?.deviceId || '').trim();
    const codeVerifier = String(payload?.codeVerifier || '').trim();
    const state = String(payload?.state || '').trim();
    const redirectUrl = String(payload?.redirectUrl || '').trim();

    if (!code || !appId || !deviceId || !codeVerifier || !state || !redirectUrl) {
      return Response.json({
        ok: false,
        error: 'code, appId, deviceId, codeVerifier, state and redirectUrl are required',
      }, { status: 400 });
    }

    const tokens = await exchangeCode({ code, appId, deviceId, codeVerifier, state, redirectUrl });
    const accessToken = String(tokens?.access_token || '').trim();
    const refreshToken = String(tokens?.refresh_token || '').trim();
    const expiresIn = Number(tokens?.expires_in || 0);
    const scope = String(tokens?.scope || '').trim();

    if (!accessToken) throw new Error('VK ID did not return access_token');

    const user = await callVk('users.get', {}, accessToken);
    const userId = Array.isArray(user) ? Number(user[0]?.id || 0) : 0;
    if (!userId) throw new Error('VK did not identify the authorized user');

    const uploadServer = await callVk('photos.getWallUploadServer', { group_id: VK_GROUP_ID }, accessToken);
    if (!uploadServer?.upload_url) throw new Error('User token cannot upload wall photos for this community');

    const expiresAt = expiresIn > 0 ? Date.now() + expiresIn * 1000 : null;
    await Promise.all([
      cache.set('vk-user-access-token-v1', accessToken, { ttl: CACHE_TTL, tags: ['vk-user-auth'] }),
      refreshToken
        ? cache.set('vk-user-refresh-token-v1', refreshToken, { ttl: CACHE_TTL, tags: ['vk-user-auth'] })
        : Promise.resolve(),
      cache.set('vk-user-auth-meta-v1', {
        userId,
        appId,
        deviceId,
        expiresIn,
        expiresAt,
        scope,
        verifiedWallPhotoUpload: true,
        verifiedAt: new Date().toISOString(),
      }, { ttl: CACHE_TTL, tags: ['vk-user-auth'] }),
    ]);

    return Response.json({
      ok: true,
      userId,
      groupId: Number(VK_GROUP_ID),
      wallPhotoUpload: true,
      refreshTokenStored: Boolean(refreshToken),
      expiresIn: expiresIn || null,
      scope: scope || null,
    });
  } catch (error) {
    return Response.json({
      ok: false,
      error: error instanceof Error ? error.message : String(error || 'VK user token validation failed'),
      code: error?.code || null,
    }, { status: 400 });
  }
}
