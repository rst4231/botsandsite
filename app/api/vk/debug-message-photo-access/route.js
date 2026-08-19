export const runtime = 'nodejs';
export const maxDuration = 30;

import React from 'react';
import { ImageResponse } from 'next/og';
import { getCache } from '@vercel/functions';

const KEY = 'vkdebugaccess-20260819-b7f34c1d';
const cache = getCache({ namespace: 'traffic-news-v4' });
const VK_API_VERSION = '5.199';

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
  if (!response.ok || data.error) throw new Error(`VK ${data?.error?.error_code ?? response.status}: ${data?.error?.error_msg || method + ' failed'}`);
  return data.response;
}

export async function GET(request) {
  if (request.nextUrl.searchParams.get('key') !== KEY) return new Response('Unauthorized', { status: 401 });
  const token = await cache.get('vk-access-token-v1');
  if (!token) return Response.json({ ok: false, error: 'VK token missing' }, { status: 500 });

  try {
    const imageResponse = new ImageResponse(
      React.createElement('div', { style: { width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff', color: '#111', fontSize: '48px', fontWeight: 700 } }, 'LH'),
      { width: 300, height: 300 },
    );
    const png = Buffer.from(await imageResponse.arrayBuffer());
    const server = await callVk('photos.getMessagesUploadServer', {}, token);
    const form = new FormData();
    form.append('photo', new Blob([png], { type: 'image/png' }), 'probe.png');
    const uploadResponse = await fetch(server.upload_url, { method: 'POST', body: form });
    const uploaded = await uploadResponse.json();
    const saved = await callVk('photos.saveMessagesPhoto', { photo: uploaded.photo, server: uploaded.server, hash: uploaded.hash }, token);
    const photo = Array.isArray(saved) ? saved[0] : null;
    return Response.json({
      ok: Boolean(photo?.id),
      ownerId: photo?.owner_id ?? null,
      photoId: photo?.id ?? null,
      hasAccessKey: Boolean(photo?.access_key),
      accessKeyLength: photo?.access_key ? String(photo.access_key).length : 0,
      canBuildWallAttachment: Boolean(photo?.owner_id && photo?.id && photo?.access_key),
    });
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof Error ? error.message : 'debug failed' }, { status: 500 });
  }
}
