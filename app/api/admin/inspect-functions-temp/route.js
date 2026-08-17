export const runtime = 'nodejs';

import { createPost, publishScheduledPost, sendToVk, sendToTelegram, publicationKindForDate } from '../../../../lib/content-bot.js';

export async function GET() {
  return Response.json({
    createPost: createPost.toString(),
    publishScheduledPost: publishScheduledPost.toString(),
    sendToVk: sendToVk.toString(),
    sendToTelegram: sendToTelegram.toString(),
    publicationKindForDate: publicationKindForDate.toString(),
  });
}
