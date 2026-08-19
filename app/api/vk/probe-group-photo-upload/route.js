export const runtime = 'nodejs';
export const maxDuration = 30;

import React from 'react';
import { ImageResponse } from 'next/og';
import { getCache } from '@vercel/functions';

const KEY = 'vkprobe-20260819-74ac29f1';
const cache = getCache({ namespace: 'traffic-news-v4' });
const VK_API_VERSION = '5.199';
const TOKEN_KEY = 'vk-access-token-v1';

async function callVk(method, params, token) {
  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(params || {})) {
    if (value !== undefined && value !== null) body.set(key, String(value));
  }
  body.set('access_token', token);
  body.set('v', VK_API_VERSION);
  const response = await fetch(`https://api.vk.com/method/${method}`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body, cache: 'no-store' });
  const data = await response.json();
  if (!response.ok || data.error) throw new Error(`VK ${data?.error?.error_code ?? response.status}: ${data?.error?.error_msg || method + ' failed'}`);
  return data.response;
}

export async function GET(request) {
  if (request.nextUrl.searchParams.get('key') !== KEY) return new Response('Unauthorized', { status: 401 });
  const token = await cache.get(TOKEN_KEY);
  if (!token) return Response.json({ ok: false, error: 'VK token missing' }, { status: 500 });
  try {
    const imageResponse = new ImageResponse(
      React.createElement('div', { style: { width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#fff', color: '#111', fontSize: '64px', fontWeight: 700, padding: '80px' } },
        React.createElement('div', null, 'LH'),
        React.createElement('div', { style: { fontSize: '36px', marginTop: '40px' } }, '1080×1350 upload probe'),
      ),
      { width: 1080, height: 1350 },
    );
    const png = Buffer.from(await imageResponse.arrayBuffer());
    const server = await callVk('photos.getMessagesUploadServer', {}, token);
    if (!server?.upload_url) throw new Error('No message photo upload URL');
    const form = new FormData();
    form.append('photo', new Blob([png], { type: 'image/png' }), 'probe-large.png');
    const uploadResponse = await fetch(server.upload_url, { method: 'POST', body: form });
    const raw = await uploadResponse.text();
    let uploaded = null;
    try { uploaded = JSON.parse(raw); } catch {}
    return Response.json({
      ok: uploadResponse.ok && Boolean(uploaded?.photo),
      pngBytes: png.length,
      uploadStatus: uploadResponse.status,
      keys: uploaded && typeof uploaded === 'object' ? Object.keys(uploaded) : [],
      photoType: typeof uploaded?.photo,
      photoLength: typeof uploaded?.photo === 'string' ? uploaded.photo.length : null,
      serverPresent: uploaded?.server !== undefined,
      hashPresent: uploaded?.hash !== undefined,
      error: uploaded?.error || null,
      rawPreview: raw.slice(0, 600),
    });
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof Error ? error.message : 'probe failed' }, { status: 500 });
  }
}
