import test from 'node:test';
import assert from 'node:assert/strict';
import { findContentDuplicate } from '../patches/content-duplicate-guard.mjs';

const history = {
  generatedHistory: [{
    dateKey: '2026-09-27',
    kind: 'beginner',
    title: 'Первый запуск: что проверить до первых трат',
    description: 'Перед стартом проверь оффер, GEO, креатив, страницу и основные метрики.',
    slides: [
      { title: 'Проверь оффер и GEO', body: 'Уточни выплату, доставку и ограничения по GEO.' },
      { title: 'Смотри на всю цепочку', body: 'CTR, CPC, конверсия, CPL и апрув показывают разные этапы.' },
    ],
  }],
};

test('lexical guard blocks an identical title', () => {
  const match = findContentDuplicate({ kind: 'beginner', title: 'Первый запуск: что проверить до первых трат' }, history);
  assert.equal(match?.reason, 'same-title');
});

test('lexical guard blocks a strongly overlapping title', () => {
  const match = findContentDuplicate({
    kind: 'beginner',
    title: 'Первый запуск: что проверить перед первыми тратами',
    description: 'Проверь оффер и GEO до старта.',
  }, history);
  assert.ok(match);
});

test('lexical guard allows an unrelated concrete topic', () => {
  const match = findContentDuplicate({
    kind: 'beginner',
    title: 'Почему заявка теряется после отправки формы',
    description: 'Разбираем технический путь лида между формой, трекером и партнерской сетью.',
  }, history);
  assert.equal(match, null);
});
