export const runtime = 'nodejs';

import { getPreparedHistory } from '../../../../lib/prepared-content.js';

export async function GET(request) {
  const limit = Number(request.nextUrl.searchParams.get('limit') || 60);
  return Response.json({ ok: true, ...(await getPreparedHistory(limit)) });
}
