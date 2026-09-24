import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { transformPublicationRunGuard } = require('../patches/publication-run-guard-transform.cjs');

test('run guard confirms a distributed lease before recovery and image rendering', () => {
  const fixture = `async function publishPreparedForToday() {
  let status = {};
  const statusKey = 'x';
  if (!status.telegram) {
    const recoveredTelegram = await recoverTelegramPublication(item);
  }
  let images = [];
  const errors = {};
  return {
    ok: Object.keys(errors).length === 0,
  };
}`;
  const source = transformPublicationRunGuard(fixture);
  const lease = source.indexOf('acquirePublicationLease');
  const recovery = source.indexOf('recoverTelegramPublication(item)');
  const images = source.indexOf('let images = []');
  assert.ok(lease >= 0 && lease < recovery && lease < images);
  assert.match(source, /confirmations: 2/);
  assert.match(source, /settleMs: 250/);
  assert.match(source, /releasePublicationClaim\(status, 'run'/);
});
