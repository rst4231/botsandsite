import test from 'node:test';
import assert from 'node:assert/strict';
import { processBusinessSyncEvent } from '../patches/sendpulse-business-sync/sync.mjs';

const BOT_ID = 'bot';
function event() { return { service: 'telegram', title: 'incoming_message', bot: { id: BOT_ID }, contact: { id: 'business' } }; }
function clientFor(destination, source) {
  const calls = [];
  return {
    calls,
    async getContact() { return destination; },
    async getContactByTelegramId() { return source; },
    async setVariables(id, variables) { calls.push(['vars', id, variables]); },
    async setTags(id, tags) { calls.push(['tags', id, tags]); },
  };
}

test('old done marker does not block newer source variables and tags', async () => {
  const client = clientFor(
    { id: 'business', telegram_id: '7', variables: { Business_sync: 'done', NAME: 'Old' }, tags: ['lead'] },
    { id: 'source', telegram_id: '7', variables: { NAME: 'New', AGE: 30 }, tags: ['lead', 'paid'] },
  );
  const result = await processBusinessSyncEvent(event(), { enabled: true, botId: BOT_ID, client });
  assert.equal(result.status, 'success');
  assert.equal(result.variablesCopied, 2);
  assert.equal(result.tagsCopied, 1);
  assert.ok(client.calls.some(([type, , vars]) => type === 'vars' && vars.some((v) => v.variable_name === 'NAME' && v.variable_value === 'New')));
  assert.ok(client.calls.some(([type, , tags]) => type === 'tags' && tags.includes('paid')));
});

test('unchanged source data is not rewritten except marker migration', async () => {
  const source = { id: 'source', telegram_id: '7', variables: { NAME: 'Same' }, tags: ['lead'] };
  const client = clientFor({ id: 'business', telegram_id: '7', variables: { NAME: 'Same' }, tags: ['lead'] }, source);
  const result = await processBusinessSyncEvent(event(), { enabled: true, botId: BOT_ID, client });
  assert.equal(result.status, 'up_to_date');
  assert.equal(result.variablesCopied, 0);
  assert.equal(result.tagsCopied, 0);
  assert.equal(client.calls.filter(([type]) => type === 'tags').length, 0);
});
