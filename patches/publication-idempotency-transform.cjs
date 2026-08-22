function requiredReplace(source, search, replacement, label) {
  if (!source.includes(search)) throw new Error(`Publication idempotency patch: ${label} marker missing`);
  return source.replace(search, replacement);
}

function replaceRegex(source, pattern, replacement, label) {
  if (!pattern.test(source)) throw new Error(`Publication idempotency patch: ${label} pattern missing`);
  return source.replace(pattern, replacement);
}

function helperSource() {
  return `async function recoverVkPost(item) {
  const token = await getVkAccessToken();
  if (!token) return null;
  try {
    const wall = await callVk('wall.get', { owner_id: \`-\${VK_GROUP_ID}\`, count: 30 }, token);
    const expectedTitle = normalize(item.title);
    const post = (wall?.items || []).find((entry) => normalize(entry?.text || '').includes(expectedTitle));
    return post?.id || null;
  } catch (error) {
    console.error('VK_PUBLICATION_RECOVERY_ERROR', error instanceof Error ? error.message : String(error));
    return null;
  }
}

async function recoverTelegramPublication(item) {
  const entries = await recentTelegramHistory(30);
  const expectedTitle = normalize(item.title);
  const match = entries.find((entry) => normalize(entry.text || '').includes(expectedTitle));
  if (!match) return null;
  const messageId = Number(String(match.postRef || '').split('/').pop());
  return Number.isInteger(messageId) && messageId > 0 ? [messageId] : [String(match.postRef)];
}
`;
}

function transformPreparedContent(input) {
  let source = String(input || '');

  const durableImport = "import { loadDurableVkToken, validateVkToken } from './vk-token-durable.mjs';";
  const stateImport = "import { claimPublication, releasePublicationClaim, deterministicVkGuid } from './publication-state.mjs';";
  if (!source.includes(stateImport)) {
    if (source.includes(durableImport)) source = source.replace(durableImport, `${durableImport}\n${stateImport}`);
    else source = requiredReplace(source, "import { getTelegramConfig } from './server-config.js';", "import { getTelegramConfig } from './server-config.js';\n" + stateImport, 'import');
  }

  const vkLoaderPattern = /async function getVkAccessToken\(\) \{[\s\S]*?\n\}\n\nexport async function getPreparedVkConfigurationStatus\(\) \{[\s\S]*?\n\}/;
  source = replaceRegex(source, vkLoaderPattern, `async function getVkAccessToken() {
  try {
    const telegram = getTelegramConfig();
    const durableToken = await loadDurableVkToken(telegram?.token);
    if (durableToken) {
      await cache.set(VK_TOKEN_CACHE_KEY, durableToken, { ttl: CACHE_TTL, tags: ['vk-config'] });
      return durableToken;
    }
  } catch (error) {
    console.error('VK_DURABLE_TOKEN_FALLBACK_ERROR', error instanceof Error ? error.message : String(error));
  }
  const cachedToken = await cache.get(VK_TOKEN_CACHE_KEY);
  if (cachedToken) return cachedToken;
  return String(process.env.VK_ACCESS_TOKEN || '').trim() || null;
}

export async function getPreparedVkConfigurationStatus() {
  const token = await getVkAccessToken();
  if (!token) return { configured: false, healthy: false, groupId: VK_GROUP_ID, error: 'VK access token is not configured' };
  try {
    await validateVkToken(token, { groupId: VK_GROUP_ID });
    return { configured: true, healthy: true, groupId: VK_GROUP_ID, error: null };
  } catch (error) {
    return { configured: true, healthy: false, groupId: VK_GROUP_ID, error: error instanceof Error ? error.message : String(error) };
  }
}`, 'VK loader');

  if (!source.includes('async function recoverVkPost(item)')) {
    source = requiredReplace(source, 'async function sendVk(item) {', `${helperSource()}\nasync function sendVk(item) {`, 'VK publisher');
  }
  source = requiredReplace(source, '    message: vkText(item),\n  }, token);', '    message: vkText(item),\n    guid: deterministicVkGuid(item),\n  }, token);', 'VK guid');

  source = requiredReplace(source,
    '  const history = await preparedHistory();\n  const itemFingerprint = fingerprint({',
    '  const history = await preparedHistory();\n  const publicHistory = await recentTelegramHistory(40);\n  const itemFingerprint = fingerprint({',
    'stage history');
  source = requiredReplace(source,
    "  if (history.some((entry) => normalize(entry.title) === normalize(item.title))) {\n    throw new Error('This title has already been published');\n  }",
    "  if (history.some((entry) => normalize(entry.title) === normalize(item.title))) {\n    throw new Error('This title has already been published');\n  }\n  if (publicHistory.some((entry) => normalize(entry.text || '').includes(normalize(item.title)))) {\n    throw new Error('This title is already present in the public Telegram history');\n  }",
    'public title dedupe');

  if (source.includes('  const status = { ...(durableFallback?.status || {}), ...cachedStatus };')) {
    source = source.replace('  const status = { ...(durableFallback?.status || {}), ...cachedStatus };', '  let status = { ...(durableFallback?.status || {}), ...cachedStatus };');
  } else {
    source = requiredReplace(source, '  const status = (await cache.get(statusKey)) || {};', '  let status = (await cache.get(statusKey)) || {};', 'mutable publication status');
  }

  const imagesMarker = '  let images = [];';
  const recoveryBlock = `  if (!status.telegram) {
    const recoveredTelegram = await recoverTelegramPublication(item);
    if (recoveredTelegram) {
      status.telegram = recoveredTelegram;
      await cache.set(statusKey, status, { ttl: CACHE_TTL, tags: ['prepared-publications'] });
    }
  }
  if (!status.vk) {
    const recoveredVk = await recoverVkPost(item);
    if (recoveredVk) {
      status.vk = recoveredVk;
      await cache.set(statusKey, status, { ttl: CACHE_TTL, tags: ['prepared-publications'] });
    }
  }

`;
  source = requiredReplace(source, imagesMarker, recoveryBlock + imagesMarker, 'publication recovery');

  const telegramBlock = `  if (!status.telegram) {
    try {
      status.telegram = item.format === 'slides'
        ? await sendTelegramSlides(item, images)
        : await sendTelegramText(telegramText(item));
      await cache.set(statusKey, status, { ttl: CACHE_TTL, tags: ['prepared-publications'] });
    } catch (error) {
      errors.telegram = error instanceof Error ? error.message : 'Telegram publishing failed';
    }
  }`;
  const hardenedTelegramBlock = `  if (!status.telegram) {
    const claim = claimPublication(status, 'telegram');
    if (!claim.acquired) {
      errors.telegram = 'Telegram publication is already in progress';
    } else {
      status = claim.status;
      await cache.set(statusKey, status, { ttl: CACHE_TTL, tags: ['prepared-publications'] });
      try {
        status.telegram = item.format === 'slides'
          ? await sendTelegramSlides(item, images)
          : await sendTelegramText(telegramText(item));
        status = releasePublicationClaim(status, 'telegram', claim.claimId);
        await cache.set(statusKey, status, { ttl: CACHE_TTL, tags: ['prepared-publications'] });
      } catch (error) {
        status = releasePublicationClaim(status, 'telegram', claim.claimId);
        await cache.set(statusKey, status, { ttl: CACHE_TTL, tags: ['prepared-publications'] });
        errors.telegram = error instanceof Error ? error.message : 'Telegram publishing failed';
      }
    }
  }`;
  source = requiredReplace(source, telegramBlock, hardenedTelegramBlock, 'Telegram claim');

  return source;
}

module.exports = { transformPreparedContent };
