export const runtime = 'nodejs';

import { authorizedContentRequest } from '../../../../lib/content-auth.js';
import { getPreparedHistory } from '../../../../lib/prepared-content.js';

export async function GET(request) {
  if (!authorizedContentRequest(request)) return new Response('Unauthorized', { status: 401 });
  const limit = Number(request.nextUrl.searchParams.get('limit') || 60);
  return Response.json({ ok: true, ...(await getPreparedHistory(limit)) });
}
