import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('sends the prepared five-slide post to a private Telegram chat without publication state', async () => {
  let sendPreparedPreview;
  try {
    ({ sendPreparedPreview } = await import('../lib/private-preview.mjs'));
  } catch {
    assert.fail('private preview sender is not implemented');
  }

  const item = {
    format: 'slides',
    title: 'Почему дешёвая заявка ещё ничего не говорит о качестве трафика',
    description: 'Низкий CPL выглядит красиво в отчёте.',
    slides: Array.from({ length: 5 }, (_, index) => ({
      title: `Слайд ${index + 1}`,
      body: `Текст ${index + 1}`,
    })),
  };

  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    return {
      async json() {
        return { ok: true, result: item.slides.map((_, index) => ({ message_id: 900 + index })) };
      },
    };
  };

  const result = await sendPreparedPreview({
    token: '123:abc',
    chatId: '160628165',
    item,
    renderSlide: async (_slide, index) => Buffer.from(`png-${index + 1}`),
    fetchImpl,
  });

  assert.deepEqual(result, [900, 901, 902, 903, 904]);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://api.telegram.org/bot123:abc/sendMediaGroup');
  assert.equal(calls[0].options.method, 'POST');

  const form = calls[0].options.body;
  assert.equal(form.get('chat_id'), '160628165');
  const media = JSON.parse(form.get('media'));
  assert.equal(media.length, 5);
  assert.equal(media[0].caption.includes('<b>Почему дешёвая заявка ещё ничего не говорит о качестве трафика</b>'), true);
  assert.equal(media[0].caption.includes('О нас'), true);
  assert.equal(media[0].parse_mode, 'HTML');
  assert.equal(media.slice(1).every((entry) => !('caption' in entry)), true);
});

test('preview route reads prepared content but never marks the scheduled publication as published', async () => {
  let source;
  try {
    source = await readFile(new URL('../app/api/admin/send-prepared-preview/route.js', import.meta.url), 'utf8');
  } catch {
    assert.fail('private preview route is not implemented');
  }

  assert.match(source, /prepared-content:/);
  assert.match(source, /160628165/);
  assert.doesNotMatch(source, /prepared-status:/);
  assert.doesNotMatch(source, /publishPreparedForToday/);
});
