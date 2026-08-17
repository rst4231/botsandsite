import { getCache } from '@vercel/functions';

const VK_API_VERSION = '5.199';
const VK_SCREEN_NAME = 'profit_v_fb';
const VK_FOOTER = '\n\nРекомендуем изучить:\n[Теория](https://vk.ru/app5898182_-160851478#page=67e5217dfe30f032b45b7c82)\n[Практика](https://vk.ru/away.php?to=https%3A%2F%2Fvk.com%2Fapp5898182_-160851478%23s%3D3112330%26force%3D1&utf=1)';
const TELEGRAM_FOOTER_START = '\n\n• <a href="https://t.me/c/1394610823/767">О нас</a>';
const cache = getCache({ namespace: 'traffic-news-vk-v1' });
const CACHE_TTL = 60 * 60 * 24 * 730;

function decodeEntities(value = '') {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

function telegramHtmlToVkText(value = '') {
  const footerIndex = value.lastIndexOf(TELEGRAM_FOOTER_START);
  const body = footerIndex >= 0 ? value.slice(0, footerIndex) : value;
  const withLinks = body.replace(
    /<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi,
    (_, href, label) => `${label.replace(/<[^>]+>/g, '').trim()}\n${href}`,
  );
  return decodeEntities(withLinks)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\r/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function toVkPostText(telegramText = '') {
  return `${telegramHtmlToVkText(telegramText)}${VK_FOOTER}`;
}

export async function setVkAccessToken(token) {
  const normalized = String(token || '').trim();
  if (!normalized) throw new Error('VK access token is empty');
  await cache.set('access-token', normalized, { ttl: CACHE_TTL, tags: ['vk-config'] });
  return true;
}

export async function getVkAccessToken() {
  return process.env.VK_ACCESS_TOKEN || await cache.get('access-token');
}

async function vkMethod(method, params, token) {
  const body = new URLSearchParams({ ...params, access_token: token, v: VK_API_VERSION });
  const response = await fetch(`https://api.vk.com/method/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
    cache: 'no-store',
  });
  const data = await response.json();
  if (!response.ok || data.error) {
    const message = data?.error?.error_msg || `VK API ${method} returned ${response.status}`;
    throw new Error(message);
  }
  return data.response;
}

async function resolveGroupId(token) {
  const cached = await cache.get('group-id');
  if (cached) return Number(cached);
  const result = await vkMethod('utils.resolveScreenName', { screen_name: VK_SCREEN_NAME }, token);
  if (!result || result.type !== 'group' || !result.object_id) throw new Error(`VK group ${VK_SCREEN_NAME} was not found`);
  await cache.set('group-id', Number(result.object_id), { ttl: CACHE_TTL, tags: ['vk-config'] });
  return Number(result.object_id);
}

export async function publishTelegramTextToVk(telegramText, telegramMessageId = null) {
  const token = await getVkAccessToken();
  if (!token) throw new Error('VK access token is not configured');
  const groupId = await resolveGroupId(token);
  const message = toVkPostText(telegramText);
  const response = await vkMethod('wall.post', {
    owner_id: String(-groupId),
    from_group: '1',
    message,
  }, token);
  const postId = response?.post_id;
  if (!postId) throw new Error('VK did not return post_id');
  if (telegramMessageId) {
    await cache.set(`published:${telegramMessageId}`, { postId, groupId }, { ttl: CACHE_TTL, tags: ['vk-publications'] });
  }
  return { ok: true, postId, groupId };
}

export async function vkConfigured() {
  return Boolean(await getVkAccessToken());
}
