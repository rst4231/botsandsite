export const runtime = 'nodejs';
export const maxDuration = 60;

import React from 'react';
import { ImageResponse } from 'next/og';
import { getCache } from '@vercel/functions';
import { kindForDate } from '../../../../lib/prepared-content.js';

const KEY = 'vkslideprobe-20260819-8bd4f261';
const cache = getCache({ namespace: 'traffic-news-v4' });
const TOKEN_KEY = 'vk-access-token-v1';
const VK_API_VERSION = '5.199';

function slideNode(slide, index, total) {
  const number = String(index + 1).padStart(2, '0');
  const isFirst = index === 0;
  const isLast = index === total - 1;
  return React.createElement(
    'div',
    { style: { width: '100%', height: '100%', display: 'flex', position: 'relative', overflow: 'hidden', background: '#ffffff', color: '#111111', fontFamily: 'Arial, sans-serif', padding: '76px' } },
    React.createElement('div', { style: { position: 'absolute', width: '420px', height: '420px', borderRadius: '999px', background: 'rgba(26,105,255,0.12)', top: '-160px', right: '-100px' } }),
    React.createElement('div', { style: { position: 'absolute', width: '330px', height: '330px', borderRadius: '999px', background: 'rgba(255,122,0,0.12)', bottom: '-120px', left: '-80px' } }),
    React.createElement(
      'div',
      { style: { width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', border: '2px solid rgba(17,17,17,0.08)', borderRadius: '46px', background: 'rgba(255,255,255,0.86)', boxShadow: '0 30px 90px rgba(17,17,17,0.10)', padding: '64px' } },
      React.createElement(
        'div',
        { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
        React.createElement('div', { style: { fontSize: '28px', fontWeight: 700, color: isLast ? '#ff7a00' : '#1269ff', letterSpacing: '0.06em' } }, isFirst ? 'РАЗБОР' : isLast ? 'ВЫВОД' : 'ПО ШАГАМ'),
        React.createElement('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'center', width: '82px', height: '50px', borderRadius: '999px', background: '#111111', color: '#ffffff', fontSize: '24px', fontWeight: 700 } }, `${number}/${String(total).padStart(2, '0')}`),
      ),
      React.createElement(
        'div',
        { style: { display: 'flex', flexDirection: 'column', gap: '38px' } },
        React.createElement('div', { style: { fontSize: isFirst ? '76px' : '62px', lineHeight: 1.03, fontWeight: 800, letterSpacing: '-0.045em', maxWidth: '890px' } }, slide.title),
        React.createElement('div', { style: { width: '110px', height: '10px', borderRadius: '999px', background: isLast ? '#ff7a00' : '#1269ff' } }),
        React.createElement('div', { style: { fontSize: isFirst ? '38px' : '36px', lineHeight: 1.34, fontWeight: 500, whiteSpace: 'pre-wrap', maxWidth: '880px' } }, slide.body),
      ),
      React.createElement(
        'div',
        { style: { display: 'flex', alignItems: 'center', gap: '14px', fontSize: '24px', fontWeight: 700 } },
        React.createElement('div', { style: { width: '18px', height: '18px', borderRadius: '999px', background: '#1269ff' } }),
        React.createElement('div', { style: { width: '18px', height: '18px', borderRadius: '999px', background: '#ff7a00' } }),
        React.createElement('div', { style: { marginLeft: '8px' } }, 'LH'),
      ),
    ),
  );
}

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
  const schedule = kindForDate(new Date());
  const item = await cache.get(`prepared-content:${schedule.dateKey}`);
  if (!token || !item?.slides?.length) return Response.json({ ok: false, error: 'token or slides missing' }, { status: 500 });

  const results = [];
  for (let index = 0; index < item.slides.length; index += 1) {
    const response = new ImageResponse(slideNode(item.slides[index], index, item.slides.length), { width: 1080, height: 1350 });
    const png = Buffer.from(await response.arrayBuffer());
    const server = await callVk('photos.getMessagesUploadServer', {}, token);
    const form = new FormData();
    form.append('photo', new Blob([png], { type: 'image/png' }), `slide${index + 1}.png`);
    const uploadResponse = await fetch(server.upload_url, { method: 'POST', body: form });
    const raw = await uploadResponse.text();
    let uploaded = null;
    try { uploaded = JSON.parse(raw); } catch {}
    results.push({
      slide: index + 1,
      pngBytes: png.length,
      uploadStatus: uploadResponse.status,
      keys: uploaded && typeof uploaded === 'object' ? Object.keys(uploaded) : [],
      hasPhoto: typeof uploaded?.photo === 'string' && uploaded.photo.length > 0,
      photoLength: typeof uploaded?.photo === 'string' ? uploaded.photo.length : null,
      error: uploaded?.error || null,
      rawPreview: raw.slice(0, 300),
    });
  }

  return Response.json({ ok: results.every((item) => item.hasPhoto), results });
}
