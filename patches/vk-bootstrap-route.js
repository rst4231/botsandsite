export const runtime = 'nodejs';

import { setVkAccessToken, vkConfigured } from '../../../../lib/vk.js';

export async function GET(request) {
  const token = request.nextUrl.searchParams.get('token');
  if (!token) return Response.json({ ok: false, error: 'token is required' }, { status: 400 });
  await setVkAccessToken(token);
  return Response.json({ ok: true, vkConfigured: await vkConfigured() });
}
