export const runtime = 'nodejs';
export const maxDuration = 60;

import { prepareContentForToday } from '../../../../lib/prepared-generator.js';

export async function GET(request) {
  const secret = String(process.env.CRON_SECRET || '').trim();
  if (!secret) {
    return Response.json({ ok: false, error: 'Cron secret is not configured' }, { status: 503 });
  }
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return new Response('Unauthorized', { status: 401 });
  }
  try {
    const result = await prepareContentForToday();
    return Response.json(result, { status: result?.ok === false ? 502 : 200 });
  } catch (error) {
    console.error('MORNING_CONTENT_PREPARE_ERROR', error);
    return Response.json({
      ok: false,
      error: error instanceof Error ? error.message : 'Morning content preparation failed',
    }, { status: 500 });
  }
}
