import test from 'node:test';
import assert from 'node:assert/strict';
import { buildVkPreparedText, ensureVkPreparedPublished, uploadVkStory } from '../lib/vk-prepared-manual.mjs';

const item = {
  kind: 'practical',
  title: 'Заголовок',
  description: 'Описание',
  format: 'slides',
  slides: [
    { title: 'Слайд 1', body: 'Текст 1' },
    { title: 'Слайд 2', body: 'Текст 2' },
    { title: 'Слайд 3', body: 'Текст 3' },
    { title: 'Слайд 4', body: 'Текст 4' },
    { title: 'Слайд 5', body: 'Текст 5' },
  ],
};

test('builds a readable VK post with spacing and restrained emoji', () => {
  const text = buildVkPreparedText(item, '\n\n📚 Рекомендуем изучить:\nFOOTER');
  assert.match(text, /^📌 Заголовок\n\nОписание/);
  assert.match(text, /🎯 Слайд 1\nТекст 1\n\n🔎 Слайд 2\nТекст 2/);
  assert.match(text, /⚙️ Слайд 3\nТекст 3/);
  assert.match(text, /📊 Слайд 4\nТекст 4/);
  assert.match(text, /✅ Слайд 5\nТекст 5/);
  assert.match(text, /📚 Рекомендуем изучить:\nFOOTER$/);
  assert.doesNotMatch(text, /\n{3,}/);
});

test('decorates event text blocks without collapsing spacing', () => {
  const text = buildVkPreparedText({
    kind: 'events',
    title: 'События месяца',
    body: `Первое событие.\n\nВторое событие.`,
    format: 'text',
    slides: [],
  });
  assert.equal(text, `📅 События месяца\n\n🗓️ Первое событие.\n\n📍 Второе событие.`);
});

test('persists wall success before attempting story and does not duplicate existing wall post', async () => {
  const persisted = [];
  let wallCalls = 0;
  let storyCalls = 0;
  const result = await ensureVkPreparedPublished({
    item,
    status: {},
    publishWall: async () => { wallCalls += 1; return 321; },
    publishStory: async () => { storyCalls += 1; return { ownerId: -160851478, storyId: 77 }; },
    persist: async (status) => persisted.push(structuredClone(status)),
  });
  assert.equal(wallCalls, 1);
  assert.equal(storyCalls, 1);
  assert.equal(persisted[0].vk, 321);
  assert.equal(result.vk, 321);
  assert.equal(result.vkStory.storyId, 77);

  await ensureVkPreparedPublished({
    item,
    status: result,
    publishWall: async () => { wallCalls += 1; return 999; },
    publishStory: async () => { storyCalls += 1; return { storyId: 999 }; },
    persist: async () => {},
  });
  assert.equal(wallCalls, 1);
  assert.equal(storyCalls, 1);
});

test('uploads story photo field and saves upload_result', async () => {
  const apiCalls = [];
  const fetchCalls = [];
  const apiCall = async (method, params) => {
    apiCalls.push({ method, params });
    if (method === 'stories.getPhotoUploadServer') return { upload_url: 'https://upload.example/story' };
    if (method === 'stories.save') return { count: 1, items: [{ owner_id: -160851478, id: 55 }] };
    throw new Error('unexpected method');
  };
  const fetchImpl = async (url, options) => {
    fetchCalls.push({ url, options });
    assert.equal(options.body.has('photo'), true);
    assert.equal(options.body.has('file'), false);
    return { ok: true, status: 200, async text() { return JSON.stringify({ response: { upload_result: 'abc123' } }); } };
  };
  const result = await uploadVkStory({
    groupId: '160851478',
    image: Buffer.from('png'),
    apiCall,
    fetchImpl,
  });
  assert.deepEqual(apiCalls[0], { method: 'stories.getPhotoUploadServer', params: { group_id: '160851478', add_to_news: 1 } });
  assert.equal(fetchCalls[0].url, 'https://upload.example/story');
  assert.equal(apiCalls[1].method, 'stories.save');
  assert.deepEqual(apiCalls[1].params, { upload_results: 'abc123' });
  assert.deepEqual(result, { ownerId: -160851478, storyId: 55 });
});

test('reports non-JSON story upload response without hiding the HTTP status', async () => {
  const apiCall = async (method) => {
    if (method === 'stories.getPhotoUploadServer') return { upload_url: 'https://upload.example/story' };
    throw new Error('unexpected method');
  };
  await assert.rejects(
    uploadVkStory({
      groupId: '160851478',
      image: Buffer.from('png'),
      apiCall,
      fetchImpl: async () => ({ ok: false, status: 502, async text() { return '<!DOCTYPE html>'; } }),
    }),
    /non-JSON \(HTTP 502\)/,
  );
});
