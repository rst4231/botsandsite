export const runtime = 'nodejs';
export const maxDuration = 60;

import { authorizedContentRequest } from '../../../../lib/content-auth.js';
import { publishPreparedForToday } from '../../../../lib/prepared-content.js';

export async function POST(request) {
  if (!authorizedContentRequest(request)) return new Response('Unauthorized', { status: 401 });
  try {
    const result = await publishPreparedForToday();
    return Response.json(result, { status: result?.ok === false ? 502 : 200 });
  } catch (error) {
    console.error('MANUAL_PREPARED_PUBLICATION_ERROR', error);
    return Response.json({
      ok: false,
      error: error instanceof Error ? error.message : 'Manual prepared publication failed',
    }, { status: 500 });
  }
}
