function queueConfig() {
  const baseUrl = String(process.env.CONTENT_QUEUE_API_URL || '').trim().replace(/\/+$/, '');
  const apiKey = String(process.env.CONTENT_QUEUE_API_KEY || '').trim();
  return { baseUrl, apiKey, configured: Boolean(baseUrl && apiKey) };
}

export function queueConfigured() {
  return queueConfig().configured;
}

async function queueRequest(path, { method = 'GET', body = null, allow404 = false } = {}) {
  const config = queueConfig();
  if (!config.configured) {
    if (allow404) return null;
    throw new Error('Content queue API is not configured');
  }

  const response = await fetch(`${config.baseUrl}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${config.apiKey}`,
      ...(body === null ? {} : { 'content-type': 'application/json' }),
    },
    ...(body === null ? {} : { body: JSON.stringify(body) }),
    cache: 'no-store',
  });

  if (allow404 && response.status === 404) return null;
  const data = await response.json().catch(() => null);
  if (!response.ok || data?.ok === false) {
    throw new Error(data?.error || `Content queue request failed: ${response.status}`);
  }
  return data;
}

export async function getQueuePost(dateKey) {
  const data = await queueRequest(`/posts/${encodeURIComponent(dateKey)}`, { allow404: true });
  return data?.item || null;
}

export async function listQueuePosts({ from = null, to = null } = {}) {
  const params = new URLSearchParams();
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  const suffix = params.size ? `?${params.toString()}` : '';
  const data = await queueRequest(`/queue${suffix}`);
  return Array.isArray(data?.items) ? data.items : [];
}

export async function putQueuePost(item) {
  if (!item?.dateKey) throw new Error('Queue item dateKey is required');
  const data = await queueRequest(`/posts/${encodeURIComponent(item.dateKey)}`, {
    method: 'PUT',
    body: item,
  });
  return data?.item || item;
}

export async function patchQueuePostStatus(dateKey, status) {
  return queueRequest(`/posts/${encodeURIComponent(dateKey)}`, {
    method: 'PATCH',
    body: status || {},
  });
}

export async function deleteQueuePost(dateKey) {
  if (!queueConfigured()) return { ok: true, skipped: 'Content queue API is not configured' };
  return queueRequest(`/posts/${encodeURIComponent(dateKey)}`, { method: 'DELETE' });
}
