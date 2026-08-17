export const runtime = 'nodejs';

import * as contentBot from '../../../../lib/content-bot.js';

const KEY = 'inspect-content-bot-20260817-c62e91';

export async function GET(request) {
  if (request.nextUrl.searchParams.get('key') !== KEY) return new Response('Unauthorized', { status: 401 });
  return Response.json({ ok: true, exports: Object.keys(contentBot).sort() });
}
