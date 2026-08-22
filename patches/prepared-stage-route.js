export const runtime = 'nodejs';
export const maxDuration = 60;

import { authorizedContentRequest } from '../../../../lib/content-auth.js';
import { stagePreparedContent } from '../../../../lib/prepared-content.js';

export async function POST(request) {
  if (!authorizedContentRequest(request)) return new Response('Unauthorized', { status: 401 });
  try {
    const payload = await request.json();
    return Response.json(await stagePreparedContent(payload));
  } catch (error) {
    console.error(error);
    return Response.json({
      ok: false,
      error: error instanceof Error ? error.message : 'Failed to stage prepared content',
    }, { status: 400 });
  }
}
