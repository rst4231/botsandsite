export const runtime = 'nodejs';
export const maxDuration = 60;

import { getCache } from '@vercel/functions';
import { authorizedContentRequest } from '../../../../lib/content-auth.js';
import { getTelegramConfig } from '../../../../lib/server-config.js';
import { loadDurableVkToken, validateVkToken } from '../../../../lib/vk-token-durable.mjs';

const primary = getCache({ namespace: 'traffic-news-v4' });
const secondary = getCache({ namespace: 'traffic-news-vk-v1' });
const TTL = 60 * 60 * 24 * 730;
const VK_GROUP_ID = process.env.VK_GROUP_ID || '160851478';

export async function POST(request) {
  if (!authorizedContentRequest(request)) return new Response('Unauthorized', { status: 401 });
  try {
    const { token: telegramToken } = getTelegramConfig();
    const token = await loadDurableVkToken(telegramToken);
    await validateVkToken(token, { groupId: VK_GROUP_ID });
    await Promise.all([
      primary.set('vk-access-token-v1', token, { ttl: TTL, tags: ['vk-config'] }),
      secondary.set('access-token', token, { ttl: TTL, tags: ['vk-config'] }),
    ]);
    return Response.json({ ok: true, configured: true, tokenWorks: true, source: 'durable' });
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
