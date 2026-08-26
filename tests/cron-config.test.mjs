import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const config = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));

test('production has exactly one daily publishing cron at 18:40 Moscow time', () => {
  assert.deepEqual(config.crons, [
    { path: '/api/cron/publish', schedule: '40 15 * * *' },
  ]);
});
