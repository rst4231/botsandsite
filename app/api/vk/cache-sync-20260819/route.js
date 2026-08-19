export const runtime = 'nodejs';

import { getCache } from '@vercel/functions';

const primary = getCache({ namespace: 'traffic-news-v4' });
const secondary = getCache({ namespace: 'traffic-news-vk-v1' });
const TTL = 60 * 60 * 24 * 730;

export async function GET() {
  const [primaryToken, secondaryToken] = await Promise.all([
    primary.get('vk-access-token-v1'),
    secondary.get('access-token'),
  ]);

  let copied = null;
  if (!primaryToken && secondaryToken) {
    await primary.set('vk-access-token-v1', secondaryToken, { ttl: TTL, tags: ['vk-config'] });
    copied = 'secondary-to-primary';
  } else if (primaryToken && !secondaryToken) {
    await secondary.set('access-token', primaryToken, { ttl: TTL, tags: ['vk-config'] });
    copied = 'primary-to-secondary';
  }

  return Response.json({
    ok: true,
    primaryBefore: Boolean(primaryToken),
    secondaryBefore: Boolean(secondaryToken),
    copied,
  });
}
