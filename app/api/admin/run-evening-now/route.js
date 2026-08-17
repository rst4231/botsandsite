export const runtime = 'nodejs';
export const maxDuration = 60;

import { GET as runCronPublish } from '../../cron/publish/route.js';

const KEY = 'run-evening-now-20260817-9f2c6e41';

export async function GET(request) {
  if (request.nextUrl.searchParams.get('key') !== KEY) {
    return new Response('Unauthorized', { status: 401 });
  }

  const url = new URL('/api/cron/publish', request.url);
  const headers = new Headers();
  if (process.env.CRON_SECRET) {
    headers.set('authorization', `Bearer ${process.env.CRON_SECRET}`);
  }

  const cronRequest = new Request(url, { method: 'GET', headers });
  return runCronPublish(cronRequest);
}
