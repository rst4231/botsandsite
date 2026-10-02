import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const config = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));

test('production preparation and publication crons use Moscow schedule', () => {
  assert.deepEqual(config.crons, [
    { path: '/api/cron/prepare', schedule: '0 6 * * *' },
    { path: '/api/cron/prepare-recovery', schedule: '20 15 * * *' },
    { path: '/api/cron/publish', schedule: '40 15 * * *' },
  ]);
});
