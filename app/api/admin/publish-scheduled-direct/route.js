export const runtime = 'nodejs';
export const maxDuration = 60;

import { publishScheduledPost } from '../../../../lib/content-bot.js';

const KEY = 'publish-scheduled-direct-20260817-5e8c2d14';

export async function GET(request) {
  if (request.nextUrl.searchParams.get('key') !== KEY) return new Response('Unauthorized', { status: 401 });
  try {
    const result = await publishScheduledPost(new Date());
    return Response.json({ ok: true, result });
  } catch (error) {
    console.error(error);
    return Response.json({ ok: false, error: error instanceof Error ? error.message : 'Publish failed' }, { status: 500 });
  }
}
