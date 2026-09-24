import { createHash, randomUUID } from 'node:crypto';

export const DEFAULT_CLAIM_STALE_MS = 15 * 60 * 1000;

function clone(value) {
  return value && typeof value === 'object' ? structuredClone(value) : {};
}

function wait(ms) {
  return ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve();
}

export function claimPublication(status, destination, now = new Date(), staleMs = DEFAULT_CLAIM_STALE_MS) {
  const next = clone(status);
  const claims = { ...(next.publicationClaims || {}) };
  const existing = claims[destination];
  const existingMs = Date.parse(existing?.startedAt || '');
  const active = existing && Number.isFinite(existingMs) && now.getTime() - existingMs < staleMs;
  if (active) return { acquired: false, claimId: existing.id, status: next, reason: 'active' };
  const claimId = randomUUID();
  claims[destination] = { id: claimId, startedAt: now.toISOString() };
  next.publicationClaims = claims;
  return { acquired: true, claimId, status: next, reason: null };
}

export async function acquirePublicationLease({
  status,
  destination,
  readStatus,
  writeStatus,
  now = new Date(),
  staleMs = DEFAULT_CLAIM_STALE_MS,
  settleMs = 250,
  confirmations = 2,
} = {}) {
  if (typeof readStatus !== 'function' || typeof writeStatus !== 'function') {
    throw new Error('Publication lease requires readStatus and writeStatus callbacks');
  }
  const claim = claimPublication(status, destination, now, staleMs);
  if (!claim.acquired) return claim;
  await writeStatus(claim.status);

  let latest = claim.status;
  let confirmed = 0;
  const attempts = Math.max(confirmations + 2, 3);
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    await wait(settleMs);
    latest = (await readStatus()) || {};
    const currentId = latest?.publicationClaims?.[destination]?.id || null;
    if (currentId === claim.claimId) {
      confirmed += 1;
      if (confirmed >= Math.max(1, confirmations)) {
        return { acquired: true, claimId: claim.claimId, status: latest, reason: null };
      }
      continue;
    }
    if (currentId) return { acquired: false, claimId: currentId, status: latest, reason: 'lost' };
    confirmed = 0;
    await writeStatus(claim.status);
  }
  return { acquired: false, claimId: claim.claimId, status: latest, reason: 'unconfirmed' };
}

export function releasePublicationClaim(status, destination, claimId = null) {
  const next = clone(status);
  const claims = { ...(next.publicationClaims || {}) };
  if (claimId && claims[destination]?.id && claims[destination].id !== claimId) return next;
  delete claims[destination];
  if (Object.keys(claims).length) next.publicationClaims = claims;
  else delete next.publicationClaims;
  return next;
}

export function deterministicVkGuid(item = {}) {
  return createHash('sha256')
    .update(JSON.stringify({ dateKey: item.dateKey || '', fingerprint: item.fingerprint || '', title: item.title || '' }))
    .digest('hex')
    .slice(0, 64);
}
