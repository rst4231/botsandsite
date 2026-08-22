import test from 'node:test';
import assert from 'node:assert/strict';

import {
  customVariablesFromContact,
  normalizeWebhookPayload,
  processBusinessSyncEvent,
  secretMatches,
} from '../patches/sendpulse-business-sync/sync.mjs';
import { createSendPulseClient } from '../patches/sendpulse-business-sync/client.mjs';

const BOT_ID = '6671465ac84ab24b4702fa25';

function event(overrides = {}) {
  return { service: 'telegram', title: 'incoming_message', bot: { id: BOT_ID }, contact: { id: 'business-contact' }, ...overrides };
}

function fakeClient({ destination, source, failTags = false, failVariables = false } = {}) {
  const calls = [];
  return {
    calls,
    async getContact(id) {
      calls.push(['getContact', id]);
      return destination ?? { id, telegram_id: '123456789', variables: {}, tags: [] };
    },
    async getContactByTelegramId(botId, telegramId) { calls.push(['getContactByTelegramId', botId, String(telegramId)]); return source; },
    async setVariables(contactId, variables) { calls.push(['setVariables', contactId, structuredClone(variables)]); if (failVariables) throw new Error('variable write failed'); return true; },
    async setTags(contactId, tags) { calls.push(['setTags', contactId, [...tags]]); if (failTags) throw new Error('tag write failed'); return true; },
  };
}

test('normalizes webhook object and array payloads', () => {
  assert.deepEqual(normalizeWebhookPayload({ title: 'x' }), [{ title: 'x' }]);
  assert.deepEqual(normalizeWebhookPayload([{ title: 'x' }, null]), [{ title: 'x' }]);
  assert.equal(normalizeWebhookPayload('invalid'), null);
});

test('compares webhook secrets without requiring equal raw lengths', () => {
  assert.equal(secretMatches('abc', 'abc'), true);
  assert.equal(secretMatches('abc', 'abcd'), false);
  assert.equal(secretMatches('', 'abc'), false);
});

test('extracts only writable custom variable values and excludes sync marker', () => {
  assert.deepEqual(customVariablesFromContact({ variables: { NAME: 'Artem', AGE: 31, Active: false, Empty: '', Business_sync: 'done', NullValue: null, ObjectValue: { x: 1 } } }), [
    { variable_name: 'NAME', variable_value: 'Artem' },
    { variable_name: 'AGE', variable_value: 31 },
    { variable_name: 'Active', variable_value: false },
    { variable_name: 'Empty', variable_value: '' },
  ]);
});

test('skips all work when feature is disabled', async () => {
  const client = fakeClient();
  const result = await processBusinessSyncEvent(event(), { enabled: false, botId: BOT_ID, client });
  assert.equal(result.status, 'disabled');
  assert.deepEqual(client.calls, []);
});

test('ignores unsupported service, title, and another bot', async () => {
  for (const current of [event({ service: 'instagram' }), event({ title: 'outgoing_message' }), event({ bot: { id: 'another-bot' } })]) {
    const client = fakeClient();
    const result = await processBusinessSyncEvent(current, { enabled: true, botId: BOT_ID, client });
    assert.equal(result.status, 'ignored_event');
    assert.deepEqual(client.calls, []);
  }
});

test('old synchronized marker does not stop checking for newer source data', async () => {
  const client = fakeClient({ destination: { id: 'business-contact', telegram_id: '123456789', variables: { Business_sync: 'done' }, tags: [] }, source: null });
  const result = await processBusinessSyncEvent(event(), { enabled: true, botId: BOT_ID, client });
  assert.equal(result.status, 'no_source');
  assert.deepEqual(client.calls.map(([name]) => name), ['getContact', 'getContactByTelegramId']);
});

test('ordinary bot incoming message is not treated as a Business contact', async () => {
  const client = fakeClient({ destination: { id: 'normal-contact', telegram_id: '123456789', variables: {} }, source: { id: 'normal-contact', telegram_id: '123456789', variables: { NAME: 'Artem' } } });
  const result = await processBusinessSyncEvent(event({ contact: { id: 'normal-contact' } }), { enabled: true, botId: BOT_ID, client });
  assert.equal(result.status, 'not_business_contact');
  assert.equal(client.calls.filter(([name]) => name === 'setVariables').length, 0);
});

test('safely skips when the ordinary Irina subscriber cannot be resolved', async () => {
  const client = fakeClient({ source: null });
  const result = await processBusinessSyncEvent(event(), { enabled: true, botId: BOT_ID, client });
  assert.equal(result.status, 'no_source');
  assert.equal(client.calls.filter(([name]) => name.startsWith('set')).length, 0);
});

test('copies every changed custom variable and missing tag, then writes fingerprint marker last', async () => {
  const client = fakeClient({ source: { id: 'normal-contact', telegram_id: '123456789', variables: { NAME: 'Artem', AGE: 31, Goal: 'profit', Business_sync: 'old-value' }, tags: ['купил', 'лид', 'купил'] } });
  const result = await processBusinessSyncEvent(event(), { enabled: true, botId: BOT_ID, client });
  assert.deepEqual(result, { status: 'success', destinationId: 'business-contact', sourceId: 'normal-contact', telegramId: '123456789', variablesCopied: 3, tagsCopied: 2 });
  const writes = client.calls.filter(([name]) => name === 'setVariables' || name === 'setTags');
  assert.deepEqual(writes.slice(0, 2), [
    ['setVariables', 'business-contact', [
      { variable_name: 'NAME', variable_value: 'Artem' },
      { variable_name: 'AGE', variable_value: 31 },
      { variable_name: 'Goal', variable_value: 'profit' },
    ]],
    ['setTags', 'business-contact', ['купил', 'лид']],
  ]);
  const marker = writes[2][2][0];
  assert.equal(marker.variable_name, 'Business_sync');
  assert.match(marker.variable_value, /^v2:[a-f0-9]{64}$/);
});

test('does not write marker after tag copy failure', async () => {
  const client = fakeClient({ source: { id: 'normal-contact', telegram_id: '123456789', variables: { NAME: 'Artem' }, tags: ['lead'] }, failTags: true });
  await assert.rejects(processBusinessSyncEvent(event(), { enabled: true, botId: BOT_ID, client }), /tag write failed/);
  const markerWrites = client.calls.filter(([name, , variables]) => name === 'setVariables' && variables?.some((variable) => variable.variable_name === 'Business_sync'));
  assert.equal(markerWrites.length, 0);
});

function jsonResponse(payload, status = 200) {
  return { ok: status >= 200 && status < 300, status, async json() { return payload; } };
}

test('REST client uses exact Telegram contact endpoints and request bodies', async () => {
  const calls = [];
  const fetchImpl = async (url, init = {}) => { calls.push({ url: String(url), init: { ...init } }); return jsonResponse({ success: true, data: { id: 'ok' } }); };
  const client = createSendPulseClient({ apiKey: 'sp_apikey_test', fetchImpl });
  await client.getContact('contact-1');
  await client.getContactByTelegramId(BOT_ID, 123456789);
  await client.setVariables('contact-2', [{ variable_name: 'NAME', variable_value: 'Artem' }]);
  await client.setTags('contact-2', ['lead', 'купил']);
  assert.equal(calls[0].url, 'https://api.sendpulse.com/telegram/contacts/get?id=contact-1');
  assert.equal(calls[1].url, `https://api.sendpulse.com/telegram/contacts/getByTelegramId?bot_id=${BOT_ID}&telegram_id=123456789`);
  assert.deepEqual(JSON.parse(calls[2].init.body), { contact_id: 'contact-2', variables: [{ variable_name: 'NAME', variable_value: 'Artem' }] });
  assert.deepEqual(JSON.parse(calls[3].init.body), { contact_id: 'contact-2', tags: ['lead', 'купил'] });
  for (const call of calls) assert.equal(call.init.headers.authorization, 'Bearer sp_apikey_test');
});

test('REST client obtains one OAuth token and reuses it', async () => {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    if (String(url).endsWith('/oauth/access_token')) return jsonResponse({ access_token: 'oauth-token', token_type: 'Bearer', expires_in: 3600 });
    return jsonResponse({ success: true, data: { id: 'contact' } });
  };
  const client = createSendPulseClient({ clientId: 'client-id', clientSecret: 'client-secret', fetchImpl });
  await client.getContact('one');
  await client.getContact('two');
  assert.equal(calls.filter((call) => call.url.endsWith('/oauth/access_token')).length, 1);
  assert.deepEqual(JSON.parse(calls[0].init.body), { grant_type: 'client_credentials', client_id: 'client-id', client_secret: 'client-secret' });
  assert.equal(calls[1].init.headers.authorization, 'Bearer oauth-token');
  assert.equal(calls[2].init.headers.authorization, 'Bearer oauth-token');
});
