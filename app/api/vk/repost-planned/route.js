export const runtime = 'nodejs';
export const maxDuration = 60;

import { alreadyPublished, createPost, publicationKindForDate, sendToVk } from '../../../../lib/content-bot.js';

const KEY = 'vkrepost-20260816-bf7a9e51';

export async function GET(request) {
  if (request.nextUrl.searchParams.get('key') !== KEY) return new Response('Unauthorized', { status: 401 });
  const dateKey = request.nextUrl.searchParams.get('date') || '2026-08-16';
  const date = new Date(`${dateKey}T12:00:00Z`);
  const info = publicationKindForDate(date);
  if (!info.kind) return Response.json({ ok: false, error: 'No scheduled post for this date' }, { status: 400 });

  try {
    const post = await createPost(info.kind, date);
    const published = post ? await alreadyPublished(info.kind, dateKey, post) : false;
    if (!post || !published) {
      return Response.json({ ok: false, error: 'The planned post is not confirmed as published in Telegram', kind: info.kind }, { status: 409 });
    }
    const postId = await sendToVk(post.text);
    return Response.json({ ok: true, dateKey, kind: info.kind, postId, title: post.title });
  } catch (error) {
    console.error(error);
    return Response.json({ ok: false, error: error instanceof Error ? error.message : 'VK repost failed' }, { status: 500 });
  }
}
