import test from 'node:test';
import assert from 'node:assert/strict';

import { processBusinessSyncEvent } from '../patches/sendpulse-business-sync/sync.mjs';

const SENDPULSE_BOT_ID = '6671465ac84ab24b4702fa25';
const TELEGRAM_BOT_ID = '6934241673';

function fakeClient() {
  const calls = [];
  return {
    calls,
    async getContact(id) {
      calls.push(['getContact', id]);
      return {
        id,
        telegram_id: '123456789',
        variables: { Business_sync: 'done' },
      };
    },
  };
}

test('accepts Telegram Business incoming message by Telegram external bot id', async () => {
  const client = fakeClient();
  const result = await processBusinessSyncEvent({
    service: 'telegram',
    title: 'incoming_message',
    bot: {
      id: 'different-sendpulse-id',
      external_id: 6934241673,
    },
    contact: { id: 'business-contact' },
  }, {
    enabled: true,
    botId: SENDPULSE_BOT_ID,
    telegramBotId: TELEGRAM_BOT_ID,
    client,
  });

  assert.equal(result.status, 'already_done');
  assert.deepEqual(client.calls, [['getContact', 'business-contact']]);
});

test('still rejects another Telegram bot when neither id matches Irina', async () => {
  const client = fakeClient();
  const result = await processBusinessSyncEvent({
    service: 'telegram',
    title: 'incoming_message',
    bot: {
      id: 'another-sendpulse-id',
      external_id: 1111111111,
    },
    contact: { id: 'business-contact' },
  }, {
    enabled: true,
    botId: SENDPULSE_BOT_ID,
    telegramBotId: TELEGRAM_BOT_ID,
    client,
  });

  assert.equal(result.status, 'ignored_event');
  assert.deepEqual(client.calls, []);
  assert.equal(result.eventExternalId, 1111111111);
});
