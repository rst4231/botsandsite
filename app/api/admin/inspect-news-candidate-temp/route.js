export const runtime = 'nodejs';
export const maxDuration = 60;

import { createPost } from '../../../../lib/content-bot.js';

export async function GET() {
  const post = await createPost('fb-killa', new Date());
  return Response.json({ post });
}
