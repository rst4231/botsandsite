export const runtime = 'nodejs';
export const maxDuration = 60;

import { createPost, publicationKindForDate, publishPostToChannel } from '../../../../lib/content-bot.js';

const KEY = 'publish-evening-now-20260817-8c4f3a21';

function moscowDateKey(date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Moscow',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const get = (type) => parts.find((part) => part.type === type)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export async function GET(request) {
  if (request.nextUrl.searchParams.get('key') !== KEY) {
    return new Response('Unauthorized', { status: 401 });
  }

  const date = new Date();
  const dateKey = moscowDateKey(date);
  const info = publicationKindForDate(date);
  if (!info?.kind) {
    return Response.json({ ok: false, error: 'No scheduled evening post for today', dateKey }, { status: 400 });
  }

  try {
    const post = await createPost(info.kind, date);
    if (!post) {
      return Response.json({ ok: false, error: 'Post generation returned no post', kind: info.kind, dateKey }, { status: 500 });
    }
    const result = await publishPostToChannel(post, info.kind, dateKey);
    return Response.json({ ok: true, dateKey, kind: info.kind, result });
  } catch (error) {
    console.error(error);
    return Response.json({ ok: false, error: error instanceof Error ? error.message : 'Publish failed', dateKey, kind: info.kind }, { status: 500 });
  }
}
