export const runtime = 'nodejs';

import { getPreparedStatus } from '../../../../lib/prepared-content.js';

export async function GET() {
  return Response.json({ ok: true, status: await getPreparedStatus() });
}
