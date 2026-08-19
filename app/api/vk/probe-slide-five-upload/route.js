export const runtime = 'nodejs';
export const maxDuration = 30;

import React from 'react';
import { ImageResponse } from 'next/og';
import { getCache } from '@vercel/functions';
import { kindForDate } from '../../../../lib/prepared-content.js';

const KEY = 'vkslide5-20260819-91c84a2e';
const cache = getCache({ namespace: 'traffic-news-v4' });
const VK_API_VERSION = '5.199';

async function callVk(method, params, token) {
  const body = new URLSearchParams({ ...Object.fromEntries(Object.entries(params || {}).map(([k, v]) => [k, String(v)])), access_token: token, v: VK_API_VERSION });
  const response = await fetch(`https://api.vk.com/method/${method}`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body, cache: 'no-store' });
  const data = await response.json();
  if (data.error) throw new Error(`VK ${data.error.error_code}: ${data.error.error_msg}`);
  return data.response;
}

export async function GET(request) {
  if (request.nextUrl.searchParams.get('key') !== KEY) return new Response('Unauthorized', { status: 401 });
  const token = await cache.get('vk-access-token-v1');
  const schedule = kindForDate(new Date());
  const item = await cache.get(`prepared-content:${schedule.dateKey}`);
  const slide = item?.slides?.[4];
  if (!token || !slide) return Response.json({ ok: false, error: 'missing data' }, { status: 500 });

  const node = React.createElement('div', { style: { width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', background: '#fff', color: '#111', fontFamily: 'Arial, sans-serif', padding: '90px' } },
    React.createElement('div', { style: { fontSize: '64px', lineHeight: 1.05, fontWeight: 800 } }, slide.title),
    React.createElement('div', { style: { fontSize: '36px', lineHeight: 1.35, marginTop: '50px' } }, slide.body),
  );
  const imageResponse = new ImageResponse(node, { width: 1080, height: 1350 });
  const png = Buffer.from(await imageResponse.arrayBuffer());
  const server = await callVk('photos.getMessagesUploadServer', {}, token);
  const form = new FormData();
  form.append('photo', new Blob([png], { type: 'image/png' }), 'slide5.png');
  const uploadResponse = await fetch(server.upload_url, { method: 'POST', body: form });
  const raw = await uploadResponse.text();
  let uploaded = null;
  try { uploaded = JSON.parse(raw); } catch {}
  return Response.json({ ok: Boolean(uploaded?.photo), pngBytes: png.length, uploadStatus: uploadResponse.status, photoLength: typeof uploaded?.photo === 'string' ? uploaded.photo.length : null, rawPreview: raw.slice(0, 300) });
}
