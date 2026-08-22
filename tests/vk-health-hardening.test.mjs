import test from 'node:test';
import assert from 'node:assert/strict';
import { validateVkToken } from '../patches/vk-token-durable.mjs';

test('VK validator reports API auth errors instead of token presence', async () => {
  await assert.rejects(
    validateVkToken('bad', { fetchImpl: async () => ({ ok: true, status: 200, async json() { return { error: { error_code: 5, error_msg: 'User authorization failed' } }; } }) }),
    /User authorization failed/,
  );
});

test('VK validator accepts a successful API response', async () => {
  assert.equal(await validateVkToken('ok', { fetchImpl: async () => ({ ok: true, status: 200, async json() { return { response: { count: 0, items: [] } }; } }) }), true);
});
