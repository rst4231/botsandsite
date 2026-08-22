import test from 'node:test';
import assert from 'node:assert/strict';
import { claimPublication, releasePublicationClaim, deterministicVkGuid } from '../patches/publication-state.mjs';

test('active claim blocks a second publication attempt', () => {
  const first = claimPublication({}, 'telegram', new Date('2026-08-22T10:00:00Z'));
  const second = claimPublication(first.status, 'telegram', new Date('2026-08-22T10:05:00Z'));
  assert.equal(first.acquired, true);
  assert.equal(second.acquired, false);
  assert.equal(second.claimId, first.claimId);
});

test('stale claim can be recovered', () => {
  const first = claimPublication({}, 'telegram', new Date('2026-08-22T10:00:00Z'));
  const second = claimPublication(first.status, 'telegram', new Date('2026-08-22T10:20:00Z'));
  assert.equal(second.acquired, true);
  assert.notEqual(second.claimId, first.claimId);
});

test('claim cleanup removes empty publicationClaims', () => {
  const claimed = claimPublication({}, 'telegram');
  const released = releasePublicationClaim(claimed.status, 'telegram', claimed.claimId);
  assert.equal('publicationClaims' in released, false);
});

test('VK guid is deterministic and bounded to 64 characters', () => {
  const item = { dateKey: '2026-08-22', fingerprint: 'abc', title: 'Test' };
  assert.equal(deterministicVkGuid(item), deterministicVkGuid(item));
  assert.equal(deterministicVkGuid(item).length, 64);
});
