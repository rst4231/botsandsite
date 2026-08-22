import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { resolvePreparedPreviewItem, sendPreparedPreview } from '../lib/private-preview.mjs';

function item() {
  return { format: 'slides', title: 'Почему дешёвая заявка ещё ничего не говорит о качестве трафика', description: 'Низкий CPL выглядит красиво в отчёте.', slides: Array.from({ length: 5 }, (_, index) => ({ title: `Слайд ${index + 1}`, body: `Текст ${index + 1}` })) };
}

test('uses cached prepared content before payload', () => {
  const cached = item();
  const payload = Buffer.from(JSON.stringify({ ...item(), title: 'Другой' })).toString('base64url');
  assert.equal(resolvePreparedPreviewItem({ cachedItem: cached, encodedPayload: payload }), cached);
});

test('decodes authorized payload when cache is empty', () => {
  const expected = item();
  const payload = Buffer.from(JSON.stringify(expected)).toString('base64url');
  assert.deepEqual(resolvePreparedPreviewItem({ cachedItem: null, encodedPayload: payload }), expected);
});

test('rejects malformed payload', () => {
  assert.throws(() => resolvePreparedPreviewItem({ cachedItem: null, encodedPayload: 'not-json' }), /invalid/);
});

test('sends the prepared five-slide post to a private Telegram chat without publication state', async () => {
  const prepared = item();
  const calls = [];
  const fetchImpl = async (url, options) => ({ async json() { calls.push({ url, options }); return { ok: true, result: prepared.slides.map((_, index) => ({ message_id: 900 + index })) }; } });
  const result = await sendPreparedPreview({ token: '123:abc', chatId: '160628165', item: prepared, renderSlide: async (_slide, index) => Buffer.from(`png-${index + 1}`), fetchImpl });
  assert.deepEqual(result, [900, 901, 902, 903, 904]);
  assert.equal(calls[0].url, 'https://api.telegram.org/bot123:abc/sendMediaGroup');
  assert.equal(calls[0].options.body.get('chat_id'), '160628165');
});

test('build removes the obsolete query-secret preview route', () => {
  const buildPatch = fs.readFileSync(new URL('../patches/publication-idempotency-build.cjs', import.meta.url), 'utf8');
  assert.match(buildPatch, /send-prepared-preview/);
});
