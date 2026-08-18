export const runtime = 'nodejs';

import { authorizedContentRequest } from '../../../../lib/content-auth.js';
import { getPreparedStatus } from '../../../../lib/prepared-content.js';

export async function GET(request) {
  if (!authorizedContentRequest(request)) return new Response('Unauthorized', { status: 401 });
  return Response.json({ ok: true, status: await getPreparedStatus() });
}
