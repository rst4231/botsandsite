import { createHash, timingSafeEqual } from 'node:crypto';

export const SYNC_MARKER_NAME = 'Business_sync';
export const SYNC_MARKER_VALUE = 'done';

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
    && (
      (botId && eventBotId === String(botId))
      || (telegramBotId && eventExternalId === String(telegramBotId))
    );
}

export async function processBusinessSyncEvent(event, options) {
  const {
    enabled = false,
    botId,
    telegramBotId,
    client,
  } = options || {};

  if (!enabled) return { status: 'disabled' };
  if (!eventIsEligible(event, botId, telegramBotId)) {
    return {
      status: 'ignored_event',
      service: event?.service,
      title: event?.title,
      eventBotId: event?.bot?.id,
      eventExternalId: event?.bot?.external_id,
    };
  }
  if (!client) throw new Error('SendPulse client is required');

  const destinationId = event?.contact?.id;
  if (!destinationId) return { status: 'invalid_contact' };

  const destination = await client.getContact(destinationId);
  if (!destination?.id) return { status: 'destination_not_found' };

  if (destination?.variables?.[SYNC_MARKER_NAME] === SYNC_MARKER_VALUE) {
    return { status: 'already_done', destinationId };
  }

  const telegramId = destination.telegram_id;
  if (telegramId === null || telegramId === undefined || telegramId === '') {
    return { status: 'missing_telegram_id', destinationId };
  }

  const source = await client.getContactByTelegramId(botId, telegramId);
  if (!source?.id) return { status: 'no_source', destinationId };
  if (source.id === destinationId) {
    return { status: 'not_business_contact', destinationId, sourceId: source.id };
  }

  const variables = customVariablesFromContact(source);
  const tags = Array.isArray(source.tags)
    ? [...new Set(source.tags.filter((tag) => typeof tag === 'string' && tag.length > 0))]
    : [];

  if (variables.length > 0) {
    await client.setVariables(destinationId, variables);
  }

  if (tags.length > 0) {
    await client.setTags(destinationId, tags);
  }

  await client.setVariables(destinationId, [{
    variable_name: SYNC_MARKER_NAME,
    variable_value: SYNC_MARKER_VALUE,
  }]);

  return {
    status: 'success',
    destinationId,
    sourceId: source.id,
    telegramId: String(telegramId),
    variablesCopied: variables.length,
    tagsCopied: tags.length,
  };
}
