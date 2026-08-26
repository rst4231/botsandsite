import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { transformPublicationRunGuard } = require('../patches/publication-run-guard-transform.cjs');

test('run guard is inserted before recovery and image rendering', () => {
  const fixture = `async function publishPreparedForToday() {\n  let status = {};\n  const statusKey = 'x';\n  if (!status.telegram) {\n    const recoveredTelegram = await recoverTelegramPublication(item);\n  }\n  let images = [];\n}`;
  const source = transformPublicationRunGuard(fixture);
  const claim = source.indexOf("claimPublication(status, 'run'");
  const recovery = source.indexOf('recoverTelegramPublication(item)');
  const images = source.indexOf('let images = []');
  assert.ok(claim >= 0);
  assert.ok(claim < recovery);
  assert.ok(claim < images);
  assert.match(source, /2 \* 60 \* 1000/);
  assert.match(source, /PUBLICATION_DUPLICATE_SKIPPED/);
});
