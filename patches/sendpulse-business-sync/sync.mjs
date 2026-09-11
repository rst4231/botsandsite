import { createHash, timingSafeEqual } from 'node:crypto';

export const SYNC_MARKER_NAME = 'Business_sync';

export function normalizeWebhookPayload(payload) {
  if (Array.isArray(payload)) return payload.filter((item) => item && typeof item === 'object');
  if (payload && typeof payload === 'object') return [payload];
  return null;
}

export function secretMatches(actual, expected) {
  if (!actual || !expected) return false;
  const actualHash = createHash('sha256').update(String(actual)).digest();
  const expectedHash = createHash('sha256').update(String(expected)).digest();
  return timingSafeEqual(actualHash, expectedHash);
}

export function secretHashMatches(actual, expectedHashHex) {
  if (!actual || !/^[a-f0-9]{64}$/i.test(String(expectedHashHex || ''))) return false;
  const actualHash = createHash('sha256').update(String(actual)).digest();
  const expectedHash = Buffer.from(String(expectedHashHex), 'hex');
  return timingSafeEqual(actualHash, expectedHash);
}

export function customVariablesFromContact(contact) {
  const variables = contact?.variables;
  if (!variables || typeof variables !== 'object' || Array.isArray(variables)) return [];
  return Object.entries(variables)
    .filter(([name, value]) => name !== SYNC_MARKER_NAME && value !== null && value !== undefined)
    .filter(([, value]) => ['string', 'number', 'boolean'].includes(typeof value))
    .map(([name, value]) => ({ variable_name: name, variable_value: value }));
}

function eventIsEligible(event, botId, telegramBotId) {
  const eventBotId = String(event?.bot?.id ?? '');
  const eventExternalId = String(event?.bot?.external_id ?? '');
  return event?.service === 'telegram'
    && event?.title === 'incoming_message'
    && ((botId && eventBotId === String(botId)) || (telegramBotId && eventExternalId === String(telegramBotId)));
}

function sameValue(a, b) {
  return String(a ?? '') === String(b ?? '') && typeof a === typeof b;
}

function sourceFingerprint(variables, tags) {
  return `v2:${createHash('sha256').update(JSON.stringify({ variables, tags })).digest('hex')}`;
}

export async function processBusinessSyncEvent(event, options) {
  const { enabled = false, botId, telegramBotId, client } = options || {};
  if (!enabled) return { status: 'disabled' };
  if (!eventIsEligible(event, botId, telegramBotId)) {
    return { status: 'ignored_event', service: event?.service, title: event?.title, eventBotId: event?.bot?.id, eventExternalId: event?.bot?.external_id };
  }
  if (!client) throw new Error('SendPulse client is required');

  const destinationId = event?.contact?.id;
  if (!destinationId) return { status: 'invalid_contact' };
  const destination = await client.getContact(destinationId);
  if (!destination?.id) return { status: 'destination_not_found' };
  const telegramId = destination.telegram_id;
  if (telegramId === null || telegramId === undefined || telegramId === '') return { status: 'missing_telegram_id', destinationId };

  const source = await client.getContactByTelegramId(botId, telegramId);
  if (!source?.id) return { status: 'no_source', destinationId };
  if (source.id === destinationId) return { status: 'not_business_contact', destinationId, sourceId: source.id };

  const wroteDmVariable = { variable_name: 'Написал в лс', variable_value: 'Да' };
  const currentWroteDmValue = source?.variables && typeof source.variables === 'object' && !Array.isArray(source.variables)
    ? source.variables[wroteDmVariable.variable_name]
    : undefined;
  if (!sameValue(currentWroteDmValue, wroteDmVariable.variable_value)) {
    await client.setVariables(source.id, [wroteDmVariable]);
  }

  const sourceVariables = customVariablesFromContact(source);
  const destinationVariables = destination?.variables && typeof destination.variables === 'object' ? destination.variables : {};
  const variables = sourceVariables.filter(({ variable_name, variable_value }) => !sameValue(destinationVariables[variable_name], variable_value));
  const sourceTags = Array.isArray(source.tags) ? [...new Set(source.tags.filter((tag) => typeof tag === 'string' && tag.length > 0))] : [];
  const destinationTags = new Set(Array.isArray(destination.tags) ? destination.tags : []);
  const tags = sourceTags.filter((tag) => !destinationTags.has(tag));
  const marker = sourceFingerprint(sourceVariables, sourceTags);

  if (variables.length) await client.setVariables(destinationId, variables);
  if (tags.length) await client.setTags(destinationId, tags);
  if (destinationVariables[SYNC_MARKER_NAME] !== marker) {
    await client.setVariables(destinationId, [{ variable_name: SYNC_MARKER_NAME, variable_value: marker }]);
  }

  return {
    status: variables.length || tags.length ? 'success' : 'up_to_date',
    destinationId,
    sourceId: source.id,
    telegramId: String(telegramId),
    variablesCopied: variables.length,
    tagsCopied: tags.length,
  };
}

export const MAXIM_BOT_ID = '64819370817732c35a00574c';
export const MAXIM_TELEGRAM_BOT_ID = '5882326561';
export const MAXIM_PROFILE_NOTE_MAX_LENGTH = 1900;

const PROFILE_TECHNICAL_VARIABLES = new Set([
  SYNC_MARKER_NAME, 'Написал в лс', 'fbc', 'fbp', 'campaign', 'campaign_id',
  'adset', 'adset_id', 'ad', 'ad_id', 'ref', 'referrer', 'referral_source',
]);

function profileHasValue(value) {
  return value !== null && value !== undefined && String(value).trim() !== '';
}

function profileTechnicalVariables(value = process.env.SENDPULSE_IRINA_PROFILE_TECHNICAL_VARIABLES) {
  return String(value || '').split(/[,\n]/).map((item) => item.trim()).filter(Boolean);
}

function isProfileTechnicalVariable(name, extra = []) {
  const normalized = String(name || '').trim();
  const lower = normalized.toLowerCase();
  return !normalized || PROFILE_TECHNICAL_VARIABLES.has(normalized) || PROFILE_TECHNICAL_VARIABLES.has(lower)
    || extra.includes(normalized) || lower.startsWith('utm_') || lower.startsWith('sync_');
}

export function buildMaximProfileNote(variables, technicalVariables = profileTechnicalVariables()) {
  if (!variables || typeof variables !== 'object' || Array.isArray(variables)) return '';
  const entries = Object.entries(variables).filter(([name, value]) => !isProfileTechnicalVariable(name, technicalVariables) && profileHasValue(value));
  const byName = new Map(entries);
  const names = [...['NAME', 'Возраст'].filter((name) => byName.has(name)), ...entries.map(([name]) => name).filter((name) => name !== 'NAME' && name !== 'Возраст')];
  return names.map((name) => `${name === 'NAME' ? 'Имя' : name}: ${String(byName.get(name)).replace(/\s*\n\s*/g, ' / ').replace(/\s+/g, ' ').trim()}`).join('\n');
}

export function buildMaximInfo(existingInfo, profileNote) {
  const profile = String(profileNote || '').trim();
  const existing = String(existingInfo || '').trim();
  if (!profile) return { changed: false, value: existing };
  if (!existing) return { changed: true, value: profile };
  const block = `Анкета из Ирины:\n${profile}`;
  if (existing === profile || existing.includes(block)) return { changed: false, value: existing };
  return { changed: true, value: `${existing}\n\n${block}` };
}

function splitMaximProfileNote(text, maxLength = MAXIM_PROFILE_NOTE_MAX_LENGTH) {
  const chunks = [];
  let current = '';
  for (const line of String(text || '').split('\n').filter(Boolean)) {
    const candidate = current ? `${current}\n${line}` : line;
    if (candidate.length <= maxLength) current = candidate;
    else { chunks.push(current); current = line.slice(0, maxLength); }
  }
  if (current) chunks.push(current);
  return chunks;
}

let profileNotesTokenCache = { token: '', expiresAt: 0 };

async function profileNotesToken() {
  const now = Date.now();
  if (profileNotesTokenCache.token && profileNotesTokenCache.expiresAt > now + 60_000) return profileNotesTokenCache.token;
  const clientId = process.env.SENDPULSE_CLIENT_ID;
  const clientSecret = process.env.SENDPULSE_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error('SendPulse credentials are required for profile notes');
  const response = await fetch('https://api.sendpulse.com/oauth/access_token', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ grant_type: 'client_credentials', client_id: clientId, client_secret: clientSecret }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data?.access_token) throw new Error(`SendPulse auth failed: ${response.status}`);
  profileNotesTokenCache = { token: data.access_token, expiresAt: now + Math.max(60, Number(data.expires_in) || 3600) * 1000 };
  return profileNotesTokenCache.token;
}

function defaultMaximNotesApi() {
  async function request(path, { method = 'GET', query, body } = {}) {
    const url = new URL(`https://api.sendpulse.com/telegram/contacts/${path}`);
    if (query) for (const [key, value] of Object.entries(query)) if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
    const response = await fetch(url, { method, headers: { authorization: `Bearer ${await profileNotesToken()}`, ...(body ? { 'content-type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(`SendPulse notes API failed: ${response.status}`);
    return data?.data ?? data;
  }
  return {
    async listNotes({ botId, contactId }) { const data = await request('notes', { query: { bot_id: botId, contact_id: contactId } }); return Array.isArray(data?.list) ? data.list : Array.isArray(data) ? data : []; },
    async createNote({ botId, contactId, text }) { return request('createNote', { method: 'POST', body: { bot_id: botId, contact_id: contactId, text } }); },
  };
}

export async function processMaximProfileSyncEvent(event, options) {
  const { enabled = false, sourceBotId, sourceTelegramBotId, client, notesApi, technicalProfileVariables } = options || {};
  if (!enabled) return { status: 'disabled' };
  const eventBotId = String(event?.bot?.id ?? '');
  const eventExternalId = String(event?.bot?.external_id ?? '');
  const eligible = event?.service === 'telegram' && event?.title === 'incoming_message'
    && (eventBotId === MAXIM_BOT_ID || eventExternalId === MAXIM_TELEGRAM_BOT_ID);
  if (!eligible) return { status: 'ignored_event' };
  if (!client) throw new Error('SendPulse client is required');
  const destinationId = event?.contact?.id;
  if (!destinationId) return { status: 'invalid_contact' };
  const destination = await client.getContact(destinationId);
  if (!destination?.id) return { status: 'destination_not_found' };
  const telegramId = destination.telegram_id;
  if (telegramId === null || telegramId === undefined || telegramId === '') return { status: 'missing_telegram_id', destinationId };
  const source = await client.getContactByTelegramId(sourceBotId, telegramId);
  if (!source?.id) return { status: 'no_source', destinationId };
  if (source.id === destinationId) return { status: 'not_business_contact', destinationId, sourceId: source.id };

  const sourceVariables = source.variables && typeof source.variables === 'object' && !Array.isArray(source.variables) ? source.variables : {};
  const destinationVariables = destination.variables && typeof destination.variables === 'object' && !Array.isArray(destination.variables) ? destination.variables : {};
  const profileVariables = ['NAME', 'Возраст'].filter((name) => profileHasValue(sourceVariables[name]) && !profileHasValue(destinationVariables[name])).map((name) => ({ variable_name: name, variable_value: String(sourceVariables[name]) }));
  const profileNote = buildMaximProfileNote(sourceVariables, technicalProfileVariables || profileTechnicalVariables());
  const info = buildMaximInfo(destinationVariables.INFO, profileNote);
  let profileNotesCreated = 0;
  if (profileNote) {
    const api = notesApi || defaultMaximNotesApi();
    const existing = await api.listNotes({ botId: MAXIM_BOT_ID, contactId: destinationId });
    const texts = new Set((Array.isArray(existing) ? existing : []).map((note) => String(note?.text || '')));
    for (const text of splitMaximProfileNote(profileNote)) if (!texts.has(text)) { await api.createNote({ botId: MAXIM_BOT_ID, contactId: destinationId, text }); profileNotesCreated += 1; }
  }
  const variables = [...profileVariables, ...(info.changed ? [{ variable_name: 'INFO', variable_value: info.value }] : [])];
  if (variables.length) await client.setVariables(destinationId, variables);
  return { status: variables.length || profileNotesCreated ? 'success' : 'up_to_date', destinationId, sourceId: source.id, telegramId: String(telegramId), variablesCopied: profileVariables.length, infoUpdated: info.changed, profileNotesCreated, sync: 'irina_to_maxim' };
}
