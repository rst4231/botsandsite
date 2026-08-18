import React from 'react';
import { ImageResponse } from 'next/og';
import { createHash } from 'node:crypto';
import { getCache } from '@vercel/functions';
import { getTelegramConfig } from './server-config.js';

const CACHE_TTL = 60 * 60 * 24 * 730;
const cache = getCache({ namespace: 'traffic-news-v4' });
const VK_API_VERSION = '5.199';
const VK_GROUP_ID = process.env.VK_GROUP_ID || '160851478';
const VK_TOKEN_CACHE_KEY = 'vk-access-token-v1';
const PUBLIC_CHANNEL_FEED_URL = 'https://t.me/s/teamcpalh';

const TELEGRAM_FOOTER = '\n\n• <a href="https://t.me/c/1394610823/767">О нас</a> | <a href="https://t.me/c/1394610823/779">Кейсы</a> | <a href="https://app.lava.top/products/1a995492-be5d-4957-8dfb-29bb21d7f387">Руководство</a> | <a href="https://t.me/+B7YJykmJSkEzMmJi">Канал</a>';
const VK_FOOTER = '\n\nРекомендуем изучить:\n[https://vk.ru/app5898182_-160851478#page=67e5217dfe30f032b45b7c8|Теория]\n[https://vk.com/app5898182_-160851478#s=3112330&force=1&utf=1|Практика]';
const HISTORY_KEY = 'prepared-content-history-v1';
const FORBIDDEN_BRANDS = /(?:\bMeta\b|\bFacebook\b|\bInstagram\b|\bМета\b|Фейсбук|Инстаграм)/i;
const KINDS = new Set(['practical', 'team', 'beginner', 'events']);

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function decodeHtmlEntities(value = '') {
  return String(value)
    .replace(/&nbsp;/gi, ' ')
    .replace(/&quot;/gi, '"')
    .replace(/&#039;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&amp;/gi, '&');
}

function htmlToText(value = '') {
  return decodeHtmlEntities(value)
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function normalize(value = '') {
  return String(value)
    .toLocaleLowerCase('ru-RU')
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

function fingerprint(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

export function datePartsInMoscow(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Moscow',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const year = Number(values.year);
  const month = Number(values.month);
  const day = Number(values.day);
  return {
    year,
    month,
    day,
    dateKey: `${values.year}-${values.month}-${values.day}`,
    weekday: new Date(Date.UTC(year, month - 1, day)).getUTCDay(),
  };
}

export function kindForDate(date = new Date()) {
  const parts = datePartsInMoscow(date);
  if (parts.weekday === 3) return { ...parts, kind: 'practical' };
  if (parts.weekday === 5) return { ...parts, kind: 'team' };
  if (parts.weekday === 0) return { ...parts, kind: 'beginner' };
  if (parts.weekday === 6 && parts.day >= 8 && parts.day <= 14) return { ...parts, kind: 'events' };
  return { ...parts, kind: null };
}

function allPublicText(item) {
  const slideText = Array.isArray(item.slides)
    ? item.slides.map((slide) => `${slide.title || ''} ${slide.body || ''}`).join(' ')
    : '';
  return `${item.title || ''} ${item.description || ''} ${item.body || ''} ${slideText}`;
}

function telegramText(item) {
  if (item.format === 'text') {
    return `<b>${escapeHtml(item.title)}</b>\n\n${escapeHtml(item.body)}${TELEGRAM_FOOTER}`;
  }
  return `<b>${escapeHtml(item.title)}</b>\n\n${escapeHtml(item.description)}${TELEGRAM_FOOTER}`;
}

function validatePreparedItem(input, now = new Date()) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Prepared content payload is invalid');
  const today = kindForDate(now);
  if (!today.kind) throw new Error('No publication is scheduled for today');
  const item = {
    dateKey: String(input.dateKey || ''),
    kind: String(input.kind || ''),
    title: String(input.title || '').trim(),
    description: String(input.description || '').trim(),
    body: String(input.body || '').trim(),
    format: String(input.format || ''),
    slides: Array.isArray(input.slides) ? input.slides.map((slide) => ({
      title: String(slide?.title || '').trim(),
      body: String(slide?.body || '').trim(),
    })) : [],
  };

  if (item.dateKey !== today.dateKey) throw new Error(`Payload date must be ${today.dateKey}`);
  if (!KINDS.has(item.kind) || item.kind !== today.kind) throw new Error(`Expected kind ${today.kind}`);
  if (!item.title || item.title.length > 140) throw new Error('Title is missing or too long');

  if (item.kind === 'events') {
    item.format = 'text';
    item.slides = [];
    if (!item.body || item.body.length > 3200) throw new Error('Events text is missing or too long');
  } else {
    item.format = 'slides';
    if (item.slides.length !== 5) throw new Error('Exactly five slides are required');
    for (const [index, slide] of item.slides.entries()) {
      if (!slide.title || slide.title.length > 85) throw new Error(`Slide ${index + 1} title is missing or too long`);
      if (!slide.body || slide.body.length > 300) throw new Error(`Slide ${index + 1} body is missing or too long`);
    }
    if (!item.description || item.description.length > 450) throw new Error('Description is missing or too long');
    if (telegramText(item).length > 1000) throw new Error('Telegram caption is too long');
  }

  if (FORBIDDEN_BRANDS.test(allPublicText(item))) {
    throw new Error('Public content contains a forbidden platform brand');
  }
  return item;
}

async function preparedHistory() {
  const value = await cache.get(HISTORY_KEY);
  return Array.isArray(value) ? value : [];
}

async function recentTelegramHistory(limit = 30) {
  try {
    const response = await fetch(PUBLIC_CHANNEL_FEED_URL, {
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; LHContentHistory/1.0)' },
      cache: 'no-store',
    });
    if (!response.ok) return [];
    const page = await response.text();
    const starts = [...page.matchAll(/<div[^>]+class=["'][^"']*tgme_widget_message[^"']*["'][^>]+data-post=["']([^"']+)["'][^>]*>/gi)];
    return starts.map((match, index) => {
      const start = match.index || 0;
      const end = index + 1 < starts.length ? starts[index + 1].index : page.length;
      const block = page.slice(start, end);
      const dateMatch = block.match(/<time[^>]+datetime=["']([^"']+)["']/i);
      const textMatch = block.match(/<div[^>]+class=["'][^"']*tgme_widget_message_text[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
      return {
        postRef: match[1],
        datetime: dateMatch?.[1] || null,
        text: textMatch ? htmlToText(textMatch[1]) : '',
      };
    }).filter((entry) => entry.text).slice(-Math.max(1, Math.min(limit, 50))).reverse();
  } catch {
    return [];
  }
}

export async function getPreparedHistory(limit = 60) {
  const max = Math.max(1, Math.min(Number(limit) || 60, 100));
  const [history, legacyCache, telegram] = await Promise.all([
    preparedHistory(),
    cache.get('post-history'),
    recentTelegramHistory(Math.min(max, 40)),
  ]);
  return {
    generatedHistory: history.slice(0, max),
    legacyPublicationIndex: Array.isArray(legacyCache) ? legacyCache.slice(0, max) : [],
    recentTelegram: telegram,
  };
}

export async function stagePreparedContent(input, now = new Date()) {
  const item = validatePreparedItem(input, now);
  const history = await preparedHistory();
  const itemFingerprint = fingerprint({
    kind: item.kind,
    title: normalize(item.title),
    description: normalize(item.description),
    body: normalize(item.body),
    slides: item.slides.map((slide) => [normalize(slide.title), normalize(slide.body)]),
  });
  if (history.some((entry) => entry.fingerprint === itemFingerprint)) {
    throw new Error('This material exactly repeats an earlier publication');
  }
  if (history.some((entry) => normalize(entry.title) === normalize(item.title))) {
    throw new Error('This title has already been published');
  }

  const staged = {
    ...item,
    fingerprint: itemFingerprint,
    stagedAt: new Date().toISOString(),
  };
  await cache.set(`prepared-content:${item.dateKey}`, staged, {
    ttl: 60 * 60 * 24 * 7,
    tags: ['prepared-content'],
  });
  return {
    ok: true,
    queued: true,
    dateKey: item.dateKey,
    kind: item.kind,
    format: item.format,
    title: item.title,
  };
}

export async function getPreparedStatus(date = new Date()) {
  const { dateKey, kind } = kindForDate(date);
  const [content, status] = await Promise.all([
    cache.get(`prepared-content:${dateKey}`),
    cache.get(`prepared-status:${dateKey}`),
  ]);
  return {
    dateKey,
    scheduledKind: kind,
    prepared: Boolean(content),
    title: content?.title || null,
    format: content?.format || null,
    stagedAt: content?.stagedAt || null,
    telegramPublished: Boolean(status?.telegram),
    vkPublished: Boolean(status?.vk),
  };
}

function vkText(item) {
  const body = item.format === 'text' ? item.body : item.description;
  return `${item.title}\n\n${body}${VK_FOOTER}`;
}

function slideNode(slide, index, total) {
  const number = String(index + 1).padStart(2, '0');
  const isFirst = index === 0;
  const isLast = index === total - 1;

  return React.createElement(
    'div',
    {
      style: {
        width: '100%',
        height: '100%',
        display: 'flex',
        position: 'relative',
        overflow: 'hidden',
        background: '#ffffff',
        color: '#111111',
        fontFamily: 'Arial, sans-serif',
        padding: '76px',
      },
    },
    React.createElement('div', {
      style: {
        position: 'absolute',
        width: '420px',
        height: '420px',
        borderRadius: '999px',
        background: 'rgba(26, 105, 255, 0.12)',
        top: '-160px',
        right: '-100px',
      },
    }),
    React.createElement('div', {
      style: {
        position: 'absolute',
        width: '330px',
        height: '330px',
        borderRadius: '999px',
        background: 'rgba(255, 122, 0, 0.12)',
        bottom: '-120px',
        left: '-80px',
      },
    }),
    React.createElement(
      'div',
      {
        style: {
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          border: '2px solid rgba(17, 17, 17, 0.08)',
          borderRadius: '46px',
          background: 'rgba(255,255,255,0.86)',
          boxShadow: '0 30px 90px rgba(17, 17, 17, 0.10)',
          padding: '64px',
        },
      },
      React.createElement(
        'div',
        { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
        React.createElement('div', {
          style: {
            fontSize: '28px',
            fontWeight: 700,
            color: isLast ? '#ff7a00' : '#1269ff',
            letterSpacing: '0.06em',
          },
        }, isFirst ? 'РАЗБОР' : isLast ? 'ВЫВОД' : 'ПО ШАГАМ'),
        React.createElement('div', {
          style: {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '82px',
            height: '50px',
            borderRadius: '999px',
            background: '#111111',
            color: '#ffffff',
            fontSize: '24px',
            fontWeight: 700,
          },
        }, `${number}/${String(total).padStart(2, '0')}`),
      ),
      React.createElement(
        'div',
        { style: { display: 'flex', flexDirection: 'column', gap: '38px' } },
        React.createElement('div', {
          style: {
            fontSize: isFirst ? '76px' : '62px',
            lineHeight: 1.03,
            fontWeight: 800,
            letterSpacing: '-0.045em',
            maxWidth: '890px',
          },
        }, slide.title),
        React.createElement('div', {
          style: {
            width: '110px',
            height: '10px',
            borderRadius: '999px',
            background: isLast ? '#ff7a00' : '#1269ff',
          },
        }),
        React.createElement('div', {
          style: {
            fontSize: isFirst ? '38px' : '36px',
            lineHeight: 1.34,
            fontWeight: 500,
            whiteSpace: 'pre-wrap',
            maxWidth: '880px',
          },
        }, slide.body),
      ),
      React.createElement(
        'div',
        { style: { display: 'flex', alignItems: 'center', gap: '14px', fontSize: '24px', fontWeight: 700 } },
        React.createElement('div', {
          style: { width: '18px', height: '18px', borderRadius: '999px', background: '#1269ff' },
        }),
        React.createElement('div', {
          style: { width: '18px', height: '18px', borderRadius: '999px', background: '#ff7a00' },
        }),
        React.createElement('div', { style: { marginLeft: '8px' } }, 'LH'),
      ),
    ),
  );
}

async function renderSlidePng(slide, index, total) {
  const response = new ImageResponse(slideNode(slide, index, total), {
    width: 1080,
    height: 1350,
  });
  return Buffer.from(await response.arrayBuffer());
}

async function sendTelegramText(text) {
  const { token, chatId } = getTelegramConfig();
  if (!token || !chatId) throw new Error('Telegram production settings are missing');
  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    }),
  });
  const data = await response.json();
  if (!data.ok) throw new Error(data.description || 'Telegram publishing failed');
  return [data.result.message_id];
}

async function sendTelegramSlides(item, images) {
  const { token, chatId } = getTelegramConfig();
  if (!token || !chatId) throw new Error('Telegram production settings are missing');
  const caption = telegramText(item);

  const form = new FormData();
  form.append('chat_id', chatId);
  const media = [];
  images.forEach((image, index) => {
    const field = `slide${index + 1}`;
    form.append(field, new Blob([image], { type: 'image/png' }), `${field}.png`);
    media.push({
      type: 'photo',
      media: `attach://${field}`,
      ...(index === 0 ? { caption, parse_mode: 'HTML' } : {}),
    });
  });
  form.append('media', JSON.stringify(media));

  const response = await fetch(`https://api.telegram.org/bot${token}/sendMediaGroup`, {
    method: 'POST',
    body: form,
  });
  const data = await response.json();
  if (!data.ok) throw new Error(data.description || 'Telegram media publishing failed');
  return (data.result || []).map((entry) => entry.message_id);
}

async function getVkAccessToken() {
  return process.env.VK_ACCESS_TOKEN || await cache.get(VK_TOKEN_CACHE_KEY) || null;
}

async function callVk(method, params, token) {
  const body = new URLSearchParams({
    ...Object.fromEntries(Object.entries(params).map(([key, value]) => [key, String(value)])),
    access_token: token,
    v: VK_API_VERSION,
  });
  const response = await fetch(`https://api.vk.com/method/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
    cache: 'no-store',
  });
  const data = await response.json();
  if (data.error) throw new Error(`VK ${data.error.error_code}: ${data.error.error_msg}`);
  return data.response;
}

async function uploadVkImages(images, token) {
  const attachments = [];
  for (let index = 0; index < images.length; index += 1) {
    const uploadServer = await callVk('photos.getWallUploadServer', { group_id: VK_GROUP_ID }, token);
    if (!uploadServer?.upload_url) throw new Error('VK upload server is unavailable');
    const form = new FormData();
    form.append('photo', new Blob([images[index]], { type: 'image/png' }), `slide${index + 1}.png`);
    const uploadResponse = await fetch(uploadServer.upload_url, { method: 'POST', body: form });
    const uploaded = await uploadResponse.json();
    const saved = await callVk('photos.saveWallPhoto', {
      group_id: VK_GROUP_ID,
      photo: uploaded.photo,
      server: uploaded.server,
      hash: uploaded.hash,
    }, token);
    const photo = Array.isArray(saved) ? saved[0] : null;
    if (!photo?.owner_id || !photo?.id) throw new Error(`VK failed to save slide ${index + 1}`);
    attachments.push(`photo${photo.owner_id}_${photo.id}`);
  }
  return attachments;
}

async function sendVk(item, images = []) {
  const token = await getVkAccessToken();
  if (!token) throw new Error('VK access token is not configured');
  const attachments = images.length ? await uploadVkImages(images, token) : [];
  const post = await callVk('wall.post', {
    owner_id: `-${VK_GROUP_ID}`,
    from_group: 1,
    message: vkText(item),
    ...(attachments.length ? { attachments: attachments.join(',') } : {}),
  }, token);
  const postId = post?.post_id;
  if (!postId) throw new Error('VK wall.post did not return post_id');
  try {
    await callVk('wall.closeComments', {
      owner_id: `-${VK_GROUP_ID}`,
      post_id: postId,
    }, token);
  } catch (error) {
    console.error('VK post published but comments could not be closed:', error);
  }
  return postId;
}

async function savePublishedHistory(item, status) {
  const history = await preparedHistory();
  const entry = {
    dateKey: item.dateKey,
    kind: item.kind,
    format: item.format,
    title: item.title,
    description: item.description,
    body: item.body,
    slides: item.slides,
    fingerprint: item.fingerprint,
    publishedAt: new Date().toISOString(),
    telegramMessageIds: status.telegram || [],
    vkPostId: status.vk || null,
  };
  const next = [entry, ...history.filter((existing) => existing.dateKey !== item.dateKey)].slice(0, 100);
  await cache.set(HISTORY_KEY, next, {
    ttl: CACHE_TTL,
    tags: ['prepared-content-history'],
  });
}

export async function publishPreparedForToday(now = new Date()) {
  const schedule = kindForDate(now);
  if (!schedule.kind) return { ok: true, skipped: 'No publication scheduled for today' };
  if (process.env.PUBLISHING_ENABLED === 'false') return { ok: true, skipped: 'Publishing is disabled' };

  const item = await cache.get(`prepared-content:${schedule.dateKey}`);
  if (!item) {
    return {
      ok: true,
      skipped: 'No prepared content from the 09:00 ChatGPT generation',
      dateKey: schedule.dateKey,
      kind: schedule.kind,
    };
  }
  if (item.kind !== schedule.kind) throw new Error('Prepared content kind does not match today schedule');

  const statusKey = `prepared-status:${schedule.dateKey}`;
  const status = (await cache.get(statusKey)) || {};
  if (status.telegram && status.vk) {
    return { ok: true, skipped: 'Prepared content was already published', ...status };
  }

  let images = [];
  if (item.format === 'slides' && (!status.telegram || !status.vk)) {
    images = await Promise.all(item.slides.map((slide, index) => renderSlidePng(slide, index, item.slides.length)));
  }

  const errors = {};

  if (!status.telegram) {
    try {
      status.telegram = item.format === 'slides'
        ? await sendTelegramSlides(item, images)
        : await sendTelegramText(telegramText(item));
      await cache.set(statusKey, status, { ttl: CACHE_TTL, tags: ['prepared-publications'] });
    } catch (error) {
      errors.telegram = error instanceof Error ? error.message : 'Telegram publishing failed';
    }
  }

  if (!status.vk) {
    try {
      status.vk = await sendVk(item, images);
      await cache.set(statusKey, status, { ttl: CACHE_TTL, tags: ['prepared-publications'] });
    } catch (error) {
      errors.vk = error instanceof Error ? error.message : 'VK publishing failed';
    }
  }

  if (status.telegram && status.vk && !status.historySaved) {
    await savePublishedHistory(item, status);
    status.historySaved = true;
    await cache.set(statusKey, status, { ttl: CACHE_TTL, tags: ['prepared-publications'] });
  }

  return {
    ok: Object.keys(errors).length === 0,
    dateKey: schedule.dateKey,
    kind: schedule.kind,
    title: item.title,
    telegramMessageIds: status.telegram || null,
    vkPostId: status.vk || null,
    errors,
  };
}
