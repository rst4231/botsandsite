export const runtime = 'nodejs';
export const maxDuration = 60;

import { publishPreparedForToday } from '../../../../lib/prepared-content.js';

export async function GET(request) {
  const secret = process.env.CRON_SECRET || '';
  if (secret && request.headers.get('authorization') !== `Bearer ${secret}`) {
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
