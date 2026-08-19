export const runtime = 'nodejs';
export const maxDuration = 60;

import { publishPreparedForToday } from '../../../../lib/prepared-content.js';
import { authorizedContentRequest } from '../../../../lib/content-auth.js';

export async function GET(request) {
  const secret = process.env.CRON_SECRET || '';
  const cronAuthorized = !secret || request.headers.get('authorization') === `Bearer ${secret}`;
  if (!cronAuthorized && !authorizedContentRequest(request)) {
    return new Response('Unauthorized', { status: 401 });
  }
  try {
    return Response.json(await publishPreparedForToday());
  } catch (error) {
    console.error(error);
    return Response.json({
      ok: false,
      error: error instanceof Error ? error.message : 'Prepared publication failed',
    }, { status: 500 });
  }
}
