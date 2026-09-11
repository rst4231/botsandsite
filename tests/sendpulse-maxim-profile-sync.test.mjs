import test from 'node:test';
import assert from 'node:assert/strict';
import { MAXIM_BOT_ID, processBusinessSyncEvent, processMaximProfileSyncEvent } from '../patches/sendpulse-business-sync/sync.mjs';

const IRINA_BOT_ID = '6671465ac84ab24b4702fa25';
const IRINA_TG_BOT_ID = '6934241673';

function client({ sourceVariables = {}, destinationVariables = {} } = {}) {
  const writes = [];
  return {
    writes,
    async getContact(id) { return { id, telegram_id: '123456789', variables: destinationVariables, tags: [] }; },
    async getContactByTelegramId(botId) { assert.equal(botId, IRINA_BOT_ID); return { id: 'irina-contact', telegram_id: '123456789', variables: sourceVariables, tags: [] }; },
    async setVariables(contactId, variables) { writes.push({ contactId, variables }); },
    async setTags() {},
  };
}

function maximEvent() {
  return { service: 'telegram', title: 'incoming_message', bot: { id: MAXIM_BOT_ID }, contact: { id: 'maxim-contact' } };
}

function options(api, notesApi) {
  return { enabled: true, sourceBotId: IRINA_BOT_ID, sourceTelegramBotId: IRINA_TG_BOT_ID, client: api, notesApi };
}

test('separate Maxim sync copies empty fields, INFO and a filtered note from Irina', async () => {
  const api = client({ sourceVariables: { NAME: 'Антон', 'Возраст': 30, 'Опыт': 'Новичок', utm_source: 'facebook', Business_sync: 'x', 'Написал в лс': 'Да' } });
  const created = [];
  const notesApi = { async listNotes() { return []; }, async createNote(value) { created.push(value); } };
  const result = await processMaximProfileSyncEvent(maximEvent(), options(api, notesApi));
  assert.equal(result.status, 'success');
  assert.deepEqual(created, [{ botId: MAXIM_BOT_ID, contactId: 'maxim-contact', text: 'Имя: Антон\nВозраст: 30\nОпыт: Новичок' }]);
  assert.deepEqual(api.writes[0].variables, [
    { variable_name: 'NAME', variable_value: 'Антон' },
    { variable_name: 'Возраст', variable_value: '30' },
    { variable_name: 'INFO', variable_value: 'Имя: Антон\nВозраст: 30\nОпыт: Новичок' },
  ]);
});

test('separate Maxim sync preserves filled fields and appends INFO only once', async () => {
  const profile = 'Имя: Антон\nВозраст: 30\nОпыт: Новичок';
  const api = client({ sourceVariables: { NAME: 'Антон', 'Возраст': 30, 'Опыт': 'Новичок' }, destinationVariables: { NAME: 'Своё имя', 'Возраст': 40, INFO: 'Старое' } });
  const notesApi = { async listNotes() { return [{ text: profile }]; }, async createNote() { throw new Error('duplicate note'); } };
  await processMaximProfileSyncEvent(maximEvent(), options(api, notesApi));
  assert.equal(api.writes[0].variables[0].variable_name, 'INFO');
  assert.equal(api.writes[0].variables[0].variable_value, `Старое\n\nАнкета из Ирины:\n${profile}`);
});

test('separate Maxim sync still processes a cross-bot contact when SendPulse returns the same contact ID', async () => {
  const api = client({ sourceVariables: { NAME: 'Антон', 'Возраст': 30 } });
  const originalGetContactByTelegramId = api.getContactByTelegramId;
  api.getContactByTelegramId = async (...args) => ({ ...(await originalGetContactByTelegramId(...args)), id: 'maxim-contact' });
  const notesApi = { async listNotes() { return []; }, async createNote() {} };
  const result = await processMaximProfileSyncEvent(maximEvent(), options(api, notesApi));
  assert.equal(result.status, 'success');
  assert.equal(api.writes[0].variables[0].variable_name, 'NAME');
});

test('old Business Sync function remains Irina-only and keeps Написал в лс behavior', async () => {
  const api = client({ sourceVariables: { NAME: 'Антон' } });
  const result = await processBusinessSyncEvent(maximEvent(), { enabled: true, botId: IRINA_BOT_ID, telegramBotId: IRINA_TG_BOT_ID, client: api });
  assert.equal(result.status, 'ignored_event');
  assert.deepEqual(api.writes, []);
});
