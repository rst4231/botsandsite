function requiredReplace(source, search, replacement, label) {
  if (!source.includes(search)) throw new Error(`Publication run guard: ${label} marker missing`);
  return source.replace(search, replacement);
}

function transformPublicationRunGuard(input) {
  let source = String(input || '');
  const recoveryMarker = `  if (!status.telegram) {\n    const recoveredTelegram = await recoverTelegramPublication(item);`;
  const guard = `  const runClaim = claimPublication(status, 'run', new Date(), 2 * 60 * 1000);\n  if (!runClaim.acquired) {\n    console.warn('PUBLICATION_DUPLICATE_SKIPPED', schedule.dateKey, runClaim.claimId);\n    return {\n      ok: true,\n      skipped: 'Prepared publication is already in progress',\n      dateKey: schedule.dateKey,\n      kind: schedule.kind,\n      title: item.title,\n    };\n  }\n  status = runClaim.status;\n  await cache.set(statusKey, status, { ttl: CACHE_TTL, tags: ['prepared-publications'] });\n\n`;
  source = requiredReplace(source, recoveryMarker, guard + recoveryMarker, 'early run claim');
  return source;
}

module.exports = { transformPublicationRunGuard };
