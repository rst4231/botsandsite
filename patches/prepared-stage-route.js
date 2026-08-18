export const runtime = 'nodejs';
export const maxDuration = 60;

import { authorizedContentRequest } from '../../../../lib/content-auth.js';
import { stagePreparedContent } from '../../../../lib/prepared-content.js';

export async function GET(request) {
  if (!authorizedContentRequest(request)) return new Response('Unauthorized', { status: 401 });
  try {
    const encoded = request.nextUrl.searchParams.get('payload') || '';
    if (!encoded) return Response.json({ ok: false, error: 'payload is required' }, { status: 400 });
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    return Response.json(await stagePreparedContent(payload));
  } catch (error) {
    console.error(error);
    return Response.json({
      ok: false,
      error: error instanceof Error ? error.message : 'Failed to stage prepared content',
    }, { status: 400 });
  }
}
