export const runtime = 'nodejs';
export const maxDuration = 120;

import { waitUntil } from '@vercel/functions';
import { getPreparedStatus, publishPreparedForToday } from '../../../../lib/prepared-content.js';
import { appendNextQueuePost, prepareContentForToday } from '../../../../lib/prepared-generator.js';

export async function GET(request) {
  const secret = String(process.env.CRON_SECRET || '').trim();
  if (!secret) {
    return Response.json({ ok: false, error: 'Cron secret is not configured' }, { status: 503 });
  }
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const before = await getPreparedStatus();
    let preparation = null;

    if (before.scheduledKind && !before.prepared) {
      preparation = await prepareContentForToday();
      if (preparation?.ok === false) {
        return Response.json({ ...preparation, phase: 'prepare-before-publish' }, { status: 502 });
      }
    }

    const result = await publishPreparedForToday();

    if (result?.ok !== false && result?.queueDeleted === true) {
      waitUntil(
        appendNextQueuePost(new Date(), 3)
          .then((tail) => console.log('CONTENT_QUEUE_TAIL_APPENDED', tail))
          .catch((error) => console.error(
            'CONTENT_QUEUE_TAIL_APPEND_ERROR',
            error instanceof Error ? error.message : String(error),
          )),
      );
    }

    return Response.json(
      { ...result, ...(preparation ? { preparation } : {}) },
      { status: result?.ok === false ? 502 : 200 },
    );
  } catch (error) {
    console.error(error);
    return Response.json({
      ok: false,
      error: error instanceof Error ? error.message : 'Prepared publication failed',
    }, { status: 500 });
  }
}
