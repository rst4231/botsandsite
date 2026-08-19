const DEFAULT_RUNTIME_ISSUE_URL = 'https://api.github.com/repos/rst4231/botsandsite/issues/7';

export function parseRuntimeIssueBody(body, dateKey) {
  const match = String(body || '').match(/```json\s*([\s\S]*?)```/i);
  if (!match) return null;
  let payload;
  try {
    payload = JSON.parse(match[1]);
  } catch {
    return null;
  }
  if (!payload || typeof payload !== 'object') return null;
  if (String(payload.dateKey || '') !== String(dateKey || '')) return null;
  if (!payload.item || typeof payload.item !== 'object') return null;
  if (String(payload.item.dateKey || '') !== String(dateKey || '')) return null;
  return {
    item: payload.item,
    status: payload.status && typeof payload.status === 'object' && !Array.isArray(payload.status)
      ? payload.status
      : {},
    updatedAt: payload.updatedAt || null,
  };
}

export async function loadRuntimeContentIssue(dateKey, {
  fetchImpl = fetch,
  url = DEFAULT_RUNTIME_ISSUE_URL,
} = {}) {
  const response = await fetchImpl(url, {
    headers: {
      accept: 'application/vnd.github+json',
      'user-agent': 'traffic-news-telegram-bot/runtime-content',
    },
    cache: 'no-store',
  });
  if (!response.ok) return null;
  const issue = await response.json();
  return parseRuntimeIssueBody(issue?.body, dateKey);
}
