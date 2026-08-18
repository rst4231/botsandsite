import test from 'node:test';
import assert from 'node:assert/strict';

import {
  secretHashMatches,
  secretMatches,
} from '../patches/sendpulse-business-sync/sync.mjs';

const TEST_SECRET = 'fixture-webhook-secret';
const TEST_SECRET_HASH = [
  '32827ae7210eb50d',
  'b164d52a19c6e1fe',
  '9305fe7a5d4e6245',
  'c58e69ff9f9cf041',
].join('');

test('plain secret comparison still works', () => {
  assert.equal(secretMatches('abc', 'abc'), true);
  assert.equal(secretMatches('abc', 'abcd'), false);
});

test('matches webhook secret against a stored sha256 hex digest', () => {
  assert.equal(secretHashMatches(TEST_SECRET, TEST_SECRET_HASH), true);
  assert.equal(secretHashMatches('wrong', TEST_SECRET_HASH), false);
  assert.equal(secretHashMatches('', TEST_SECRET_HASH), false);
  assert.equal(secretHashMatches(TEST_SECRET, 'not-a-hash'), false);
});
