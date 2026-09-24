import test from 'node:test';
import assert from 'node:assert/strict';
import { acquirePublicationLease, claimPublication, releasePublicationClaim, deterministicVkGuid } from '../patches/publication-state.mjs';

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


test('confirmed publication lease persists ownership before allowing work', async () => {
  let stored = {};
  const lease = await acquirePublicationLease({
    status: {},
    destination: 'run',
    settleMs: 0,
    confirmations: 1,
    readStatus: async () => stored,
    writeStatus: async (next) => { stored = structuredClone(next); },
  });
  assert.equal(lease.acquired, true);
  assert.equal(stored.publicationClaims.run.id, lease.claimId);
});

test('publication lease refuses work when another invocation overwrites the claim', async () => {
  let stored = {};
  let writes = 0;
  const lease = await acquirePublicationLease({
    status: {},
    destination: 'run',
    settleMs: 0,
    confirmations: 1,
    readStatus: async () => stored,
    writeStatus: async (next) => {
      writes += 1;
      stored = structuredClone(next);
      if (writes === 1) stored.publicationClaims.run.id = 'other-run';
    },
  });
  assert.equal(lease.acquired, false);
  assert.equal(lease.reason, 'lost');
});
