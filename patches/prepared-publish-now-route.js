export const runtime = 'nodejs';
export const maxDuration = 60;

import { authorizedContentRequest } from '../../../../lib/content-auth.js';
import { publishPreparedForToday } from '../../../../lib/prepared-content.js';

function moscowMinuteOfDay(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Moscow',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return Number(values.hour) * 60 + Number(values.minute);
}

export function manualPublicationBlockedByCronWindow(date = new Date()) {
  const minute = moscowMinuteOfDay(date);
  return minute >= (18 * 60 + 38) && minute <= (18 * 60 + 45);
}

export async function POST(request) {
  if (!authorizedContentRequest(request)) return new Response('Unauthorized', { status: 401 });
  if (manualPublicationBlockedByCronWindow()) {
    return Response.json({
      ok: false,
      error: 'Manual publication is disabled during the scheduled cron window',
    }, { status: 409 });
  }
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
