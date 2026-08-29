import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPublicationCalendar,
  nextPublication,
  publicationForDateKey,
} from '../patches/publication-calendar.mjs';

test('builds exactly 30 consecutive Moscow calendar days', () => {
  const items = buildPublicationCalendar(new Date('2026-08-29T12:00:00Z'), 30);
  assert.equal(items.length, 30);
  assert.equal(items[0].dateKey, '2026-08-29');
  assert.equal(items.at(-1).dateKey, '2026-09-27');
});

test('maps Wednesday, Friday and Sunday to the correct rubrics', () => {
  assert.equal(publicationForDateKey('2026-09-02')?.kind, 'practical');
  assert.equal(publicationForDateKey('2026-09-04')?.kind, 'team');
  assert.equal(publicationForDateKey('2026-09-06')?.kind, 'beginner');
});

test('maps only the second Saturday to industry events', () => {
  assert.equal(publicationForDateKey('2026-09-05'), null);
  assert.equal(publicationForDateKey('2026-09-12')?.kind, 'events');
  assert.equal(publicationForDateKey('2026-09-19'), null);
});

test('all scheduled publications use 18:40 Moscow time', () => {
  const items = buildPublicationCalendar(new Date('2026-08-29T12:00:00Z'), 30);
  const scheduled = items.filter((item) => item.scheduled);
  assert.ok(scheduled.length > 0);
  assert.ok(scheduled.every((item) => item.time === '18:40 МСК'));
});

test('next publication skips today after 18:40 Moscow time', () => {
  const items = buildPublicationCalendar(new Date('2026-08-30T16:00:00Z'), 30);
  const next = nextPublication(items, new Date('2026-08-30T16:00:00Z'));
  assert.equal(next.dateKey, '2026-09-02');
});

test('next publication still returns today before 18:40 Moscow time', () => {
  const items = buildPublicationCalendar(new Date('2026-08-30T14:00:00Z'), 30);
  const next = nextPublication(items, new Date('2026-08-30T14:00:00Z'));
  assert.equal(next.dateKey, '2026-08-30');
});
