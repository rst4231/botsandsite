function requiredReplace(source, search, replacement, label) {
  if (!source.includes(search)) throw new Error(`Publication run guard: ${label} marker missing`);
  return source.replace(search, replacement);
}

function transformPublicationRunGuard(input) {
  let source = String(input || '');
  const recoveryMarker = `  if (!status.telegram) {\n    const recoveredTelegram = await recoverTelegramPublication(item);`;
  const guard = `  const runLease = await acquirePublicationLease({
    status,
    destination: 'run',
    now: new Date(),
    staleMs: 2 * 60 * 1000,
    settleMs: 250,
    confirmations: 2,
    readStatus: async () => (await cache.get(statusKey)) || {},
    writeStatus: async (nextStatus) => cache.set(statusKey, nextStatus, { ttl: CACHE_TTL, tags: ['prepared-publications'] }),
  });
  if (!runLease.acquired) {
    const leaseConflict = runLease.reason === 'active' || runLease.reason === 'lost';
    console.warn('PUBLICATION_DUPLICATE_SKIPPED', schedule.dateKey, runLease.claimId, runLease.reason);
    return {
      ok: leaseConflict,
      ...(leaseConflict ? {} : { error: 'Publication lease could not be confirmed' }),
      skipped: leaseConflict ? 'Prepared publication is already in progress' : 'Prepared publication lease failed',
      dateKey: schedule.dateKey,
      kind: schedule.kind,
      title: item.title,
    };
  }
  status = runLease.status;

`;
  source = requiredReplace(source, recoveryMarker, guard + recoveryMarker, 'early run lease');
  const resultMarker = `  return {
    ok: Object.keys(errors).length === 0,`;
  const release = `  status = releasePublicationClaim(status, 'run', runLease.claimId);
  await cache.set(statusKey, status, { ttl: CACHE_TTL, tags: ['prepared-publications'] });

`;
  source = requiredReplace(source, resultMarker, release + resultMarker, 'run lease release');
  return source;
}

module.exports = { transformPublicationRunGuard };
