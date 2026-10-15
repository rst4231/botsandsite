import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { publicationForDateKey } from '../patches/publication-calendar.mjs';

const publication = fs.readFileSync(new URL('../patches/prepared-content.js', import.meta.url), 'utf8');
const generator = fs.readFileSync(new URL('../patches/prepared-generator.js', import.meta.url), 'utf8');
const storyBuild = fs.readFileSync(new URL('../patches/story-link-build.cjs', import.meta.url), 'utf8');
const calendarPage = fs.readFileSync(new URL('../patches/calendar-page.jsx', import.meta.url), 'utf8');
const calendarClient = fs.readFileSync(new URL('../patches/publication-calendar-client.jsx', import.meta.url), 'utf8');

test('third Saturday has exactly one guides slot at 18:40 Moscow time', () => {
  assert.equal(publicationForDateKey('2026-10-17')?.kind, 'guides');
  assert.equal(publicationForDateKey('2026-11-21')?.kind, 'guides');
  assert.equal(publicationForDateKey('2026-12-19')?.kind, 'guides');
  assert.equal(publicationForDateKey('2026-10-17')?.time, '18:40 МСК');
  assert.equal(publicationForDateKey('2026-10-10')?.kind, 'events');
  assert.equal(publicationForDateKey('2026-10-24'), null);
});

test('guides content uses editable D1 template, no AI rewrite, and does not replace occupied slot', () => {
  assert.match(generator, /getQueuePost\('2099-01-01'\)/);
  assert.match(generator, /monthlyGuidesContent\(dateKey\)/);
  assert.match(generator, /const existing = await getQueuePost\(target\.dateKey\)/);
  assert.match(generator, /if \(existing\)/);
  assert.match(generator, /await putQueuePost\(item\)/);
  assert.match(publication, /guideSlot: true/);
});

test('guides publish to Telegram only, with a clickable markdown link and without common footer', () => {
  assert.match(publication, /item\?\.description !== 'monthly-guides'/);
  assert.match(publication, /if \(isMonthlyGuides\(item\)\) \{\s*return .*guideTextHtml/s);
  assert.match(publication, /if \(!status\.vk && !isMonthlyGuides\(item\)\)/);
  assert.match(storyBuild, /!status\.vk && !isMonthlyGuides\(item\)/);
  assert.match(publication, /status\?\.telegram\s*&& \(isMonthlyGuides\(item\) \|\|/);
  assert.match(publication, /isMonthlyGuides\(item\) && status\.telegram/);
  assert.match(publication, /isMonthlyGuides\(item\)\) && !status\.historySaved/);
  assert.match(publication, /if \(!isMonthlyGuides\(item\)\) \{/);
});

test('guides appear in calendar with preview and outgoing link', () => {
  assert.match(calendarPage, /occupiedByOtherPost/);
  assert.match(calendarPage, /description !== 'monthly-guides'/);
  assert.match(calendarClient, /Третья суббота · Руководства/);
  assert.match(calendarClient, /isGuides=\{item\.kind === 'guides'\}/);
  assert.match(calendarClient, /href=\{link\[2\]\}/);
});
