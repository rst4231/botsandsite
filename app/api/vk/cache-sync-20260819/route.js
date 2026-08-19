export const runtime = 'nodejs';

import { getCache } from '@vercel/functions';

const primary = getCache({ namespace: 'traffic-news-v4' });
const secondary = getCache({ namespace: 'traffic-news-vk-v1' });
const TTL = 60 * 60 * 24 * 730;

export async function GET() {
  const envToken = String(process.env.VK_ACCESS_TOKEN || '').trim();
  const [primaryToken, secondaryToken] = await Promise.all([
    primary.get('vk-access-token-v1'),
    secondary.get('access-token'),
  ]);

  let copied = null;
  const sourceToken = envToken || primaryToken || secondaryToken || null;
  if (sourceToken) {
    await Promise.all([
      primary.set('vk-access-token-v1', sourceToken, { ttl: TTL, tags: ['vk-config'] }),
      secondary.set('access-token', sourceToken, { ttl: TTL, tags: ['vk-config'] }),
    ]);
    copied = envToken ? 'env-to-both' : primaryToken ? 'primary-to-both' : 'secondary-to-both';
  }

  let tokenWorks = false;
  let vkError = null;
  if (sourceToken) {
    try {
      const body = new URLSearchParams({ access_token: sourceToken, v: '5.199' });
      const response = await fetch('https://api.vk.com/method/photos.getMessagesUploadServer', {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body,
        cache: 'no-store',
      });
      const data = await response.json();
      tokenWorks = Boolean(data?.response?.upload_url);
      if (data?.error) vkError = { code: data.error.error_code, message: data.error.error_msg };
    } catch (error) {
      vkError = { message: error instanceof Error ? error.message : String(error) };
    }
  }

  return Response.json({
    ok: true,
    envConfigured: Boolean(envToken),
    primaryBefore: Boolean(primaryToken),
    secondaryBefore: Boolean(secondaryToken),
    sourceFound: Boolean(sourceToken),
    copied,
    tokenWorks,
    vkError,
  });
}
