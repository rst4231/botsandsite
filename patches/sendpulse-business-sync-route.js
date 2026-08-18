export const runtime = 'nodejs';
export const maxDuration = 30;

import { createSendPulseClient } from '../../../../lib/sendpulse-business-sync/client.mjs';
import {
  normalizeWebhookPayload,
  processBusinessSyncEvent,
  secretMatches,
} from '../../../../lib/sendpulse-business-sync/sync.mjs';

const DEFAULT_IRINA_BOT_ID = '6671465ac84ab24b4702fa25';

function maskedTelegramId(value) {
  const text = String(value || '');
  if (text.length <= 4) return '***';
  return `${text.slice(0, 2)}***${text.slice(-2)}`;
}

function logResult(result) {
  const base = {
    destinationId: result?.destinationId,
    sourceId: result?.sourceId,
  };

  if (result?.status === 'success') {
    console.info('business_sync_success', {
      ...base,
      telegramId: maskedTelegramId(result.telegramId),
      variablesCopied: result.variablesCopied,
      tagsCopied: result.tagsCopied,
    });
    return;
  }

  const eventName = {
    disabled: 'business_sync_disabled',
    ignored_event: 'business_sync_ignored_event',
    already_done: 'business_sync_already_done',
    no_source: 'business_sync_no_source',
    not_business_contact: 'business_sync_ignored_event',
    invalid_contact: 'business_sync_ignored_event',
    destination_not_found: 'business_sync_no_source',
    missing_telegram_id: 'business_sync_no_source',
  }[result?.status] || 'business_sync_ignored_event';

  console.info(eventName, { ...base, status: result?.status });
}

export async function POST(request) {
  const expectedSecret = process.env.SENDPULSE_BUSINESS_WEBHOOK_SECRET || '';
  const providedSecret = request.nextUrl?.searchParams?.get('key')
    || new URL(request.url).searchParams.get('key')
    || '';

  if (!secretMatches(providedSecret, expectedSecret)) {
    return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const events = normalizeWebhookPayload(payload);
  if (!events) {
    return Response.json({ ok: false, error: 'Invalid webhook payload' }, { status: 400 });
  }

  const enabled = process.env.SENDPULSE_BUSINESS_SYNC_ENABLED === 'true';
  if (!enabled) {
    console.info('business_sync_disabled');
    return Response.json({ ok: true, enabled: false, processed: 0 });
  }

  const botId = process.env.SENDPULSE_IRINA_BOT_ID || DEFAULT_IRINA_BOT_ID;

  let client;
  try {
    client = createSendPulseClient({
      apiKey: process.env.SENDPULSE_API_KEY,
      clientId: process.env.SENDPULSE_CLIENT_ID,
      clientSecret: process.env.SENDPULSE_CLIENT_SECRET,
    });
  } catch (error) {
    console.error('business_sync_failure', { name: error?.name, message: error?.message });
    return Response.json({ ok: false, error: 'SendPulse client is not configured' }, { status: 500 });
  }

  const results = [];
  try {
    for (const event of events) {
      const result = await processBusinessSyncEvent(event, {
        enabled: true,
        botId,
        client,
      });
      results.push(result);
      logResult(result);
    }
  } catch (error) {
    console.error('business_sync_failure', {
      name: error?.name,
      status: error?.status,
      code: error?.code,
      path: error?.path,
    });
    return Response.json({ ok: false, error: 'SendPulse sync failed' }, { status: 500 });
  }

  return Response.json({
    ok: true,
    enabled: true,
    processed: results.length,
    results: results.map((result) => ({
      status: result.status,
      destinationId: result.destinationId,
      sourceId: result.sourceId,
      variablesCopied: result.variablesCopied,
      tagsCopied: result.tagsCopied,
    })),
  });
}
