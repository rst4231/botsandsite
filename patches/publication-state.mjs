import { createHash, randomUUID } from 'node:crypto';

export const DEFAULT_CLAIM_STALE_MS = 15 * 60 * 1000;

function clone(value) {
  return value && typeof value === 'object' ? structuredClone(value) : {};
}

export function claimPublication(status, destination, now = new Date(), staleMs = DEFAULT_CLAIM_STALE_MS) {
  const next = clone(status);
  const claims = { ...(next.publicationClaims || {}) };
  const existing = claims[destination];
  const existingMs = Date.parse(existing?.startedAt || '');
  const active = existing && Number.isFinite(existingMs) && now.getTime() - existingMs < staleMs;
  if (active) return { acquired: false, claimId: existing.id, status: next };
  const claimId = randomUUID();
  claims[destination] = { id: claimId, startedAt: now.toISOString() };
  next.publicationClaims = claims;
  return { acquired: true, claimId, status: next };
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
