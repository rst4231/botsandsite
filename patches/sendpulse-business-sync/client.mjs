const DEFAULT_BASE_URL = 'https://api.sendpulse.com';
const TOKEN_EARLY_REFRESH_MS = 60_000;

export class SendPulseApiError extends Error {
  constructor(message, { status, code, path } = {}) {
    super(message);
    this.name = 'SendPulseApiError';
    this.status = status;
    this.code = code;
    this.path = path;
  }
}

export function createSendPulseClient({
  clientId,
  clientSecret,
  apiKey,
  fetchImpl = globalThis.fetch,
  baseUrl = DEFAULT_BASE_URL,
} = {}) {
  if (typeof fetchImpl !== 'function') throw new Error('fetch implementation is required');
  if (!apiKey && (!clientId || !clientSecret)) {
    throw new Error('SendPulse API key or OAuth client credentials are required');
  }

  let cachedToken = apiKey || null;
  let tokenExpiresAt = apiKey ? Number.POSITIVE_INFINITY : 0;

  async function parseResponse(response, path) {
    let payload;
    try {
      payload = await response.json();
    } catch {
      throw new SendPulseApiError('SendPulse returned invalid JSON', { status: response.status, path });
    }

    if (!response.ok || payload?.success === false) {
      const code = payload?.error_code ?? payload?.code;
      throw new SendPulseApiError('SendPulse API request failed', {
        status: response.status,
        code,
        path,
      });
    }

    return payload;
  }

  async function getToken() {
    if (cachedToken && Date.now() < tokenExpiresAt) return cachedToken;

    const path = '/oauth/access_token';
    const response = await fetchImpl(`${baseUrl}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });

    const payload = await parseResponse(response, path);
    if (!payload?.access_token) {
      throw new SendPulseApiError('SendPulse OAuth response did not include an access token', {
        status: response.status,
        path,
      });
    }

    cachedToken = payload.access_token;
    const expiresInMs = Math.max(0, Number(payload.expires_in || 3600) * 1000 - TOKEN_EARLY_REFRESH_MS);
    tokenExpiresAt = Date.now() + expiresInMs;
    return cachedToken;
  }

  async function request(path, { method = 'GET', query, body } = {}) {
    const token = await getToken();
    const url = new URL(`${baseUrl}${path}`);
    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value !== undefined && value !== null && value !== '') {
          url.searchParams.set(key, String(value));
        }
      }
    }

    const headers = { authorization: `Bearer ${token}` };
    const init = { method, headers };
    if (body !== undefined) {
      headers['content-type'] = 'application/json';
      init.body = JSON.stringify(body);
    }

    const response = await fetchImpl(url, init);
    const payload = await parseResponse(response, path);
    return payload?.data;
  }

  return {
    getContact(id) {
      return request('/telegram/contacts/get', { query: { id } });
    },

    getContactByTelegramId(botId, telegramId) {
      return request('/telegram/contacts/getByTelegramId', {
        query: { bot_id: botId, telegram_id: telegramId },
      });
    },

    setVariables(contactId, variables) {
      return request('/telegram/contacts/setVariable', {
        method: 'POST',
        body: { contact_id: contactId, variables },
      });
    },

    setTags(contactId, tags) {
      return request('/telegram/contacts/setTag', {
        method: 'POST',
        body: { contact_id: contactId, tags },
      });
    },
  };
}
