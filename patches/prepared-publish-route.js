export const runtime = 'nodejs';
export const maxDuration = 60;

import { publishPreparedForToday } from '../../../../lib/prepared-content.js';
import { prepareContentForToday, replenishContentQueue } from '../../../../lib/prepared-generator.js';

export async function GET(request) {
  const secret = String(process.env.CRON_SECRET || '').trim();
  if (!secret) {
    return Response.json({ ok: false, error: 'Cron secret is not configured' }, { status: 503 });
  }
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return new Response('Unauthorized', { status: 401 });
  }
  try {
    const preparation = await prepareContentForToday();
    if (preparation?.ok === false) {
      return Response.json({ ...preparation, phase: 'prepare-before-publish' }, { status: 502 });
    }

    let queueRefill = null;
    try {
      queueRefill = await replenishContentQueue(new Date(), 30, 1);
    } catch (error) {
      console.error('CONTENT_QUEUE_REFILL_BEFORE_PUBLISH_ERROR', error instanceof Error ? error.message : String(error));
      queueRefill = { ok: false, error: error instanceof Error ? error.message : String(error) };
    }

    const result = await publishPreparedForToday();
    return Response.json({ ...result, preparation, queueRefill }, { status: result?.ok === false ? 502 : 200 });
  } catch (error) {
    console.error(error);
    return Response.json({
      ok: false,
      error: error instanceof Error ? error.message : 'Prepared publication failed',
    }, { status: 500 });
  }
}
