import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const clientPath = path.join(here, '..', 'patches', 'publication-calendar-client.jsx');
const pagePath = path.join(here, '..', 'patches', 'calendar-page.jsx');

test('calendar uses a client dialog to open the prepared post by date', () => {
  assert.ok(fs.existsSync(clientPath), 'calendar preview client is missing');
  const client = fs.readFileSync(clientPath, 'utf8');
  const page = fs.readFileSync(pagePath, 'utf8');

  assert.match(client, /['"]use client['"]/);
  assert.match(client, /role="dialog"/);
  assert.match(client, /aria-modal="true"/);
  assert.match(client, /setSelectedItem\(item\)/);
  assert.match(client, /preparedContent/);
  assert.match(client, /preparedContent\.slides\.map/);
  assert.match(client, /Пост ещё не подготовлен/);

  assert.match(page, /calendarPreparedPreview/);
  assert.match(page, /preparedContent/);
  assert.match(page, /PublicationCalendarClient/);
});

test('calendar falls back to durable prepared content when runtime cache is empty', () => {
  const page = fs.readFileSync(pagePath, 'utf8');
  assert.match(page, /loadRuntimeContentIssue/);
  assert.match(page, /const cachedPrepared = await cache\.get/);
  assert.match(page, /const durableFallback = cachedPrepared \? null : await loadRuntimeContentIssue\(item\.dateKey\)/);
  assert.match(page, /const prepared = cachedPrepared \|\| durableFallback\?\.item \|\| null/);
});

test('calendar page no longer renders the legacy deployment status block', () => {
  const page = fs.readFileSync(pagePath, 'utf8');
  assert.doesNotMatch(page, /LegacyPage/);
  assert.doesNotMatch(page, /legacy-page\.jsx/);
});

test('calendar page sets the browser title to Помощник', () => {
  const page = fs.readFileSync(pagePath, 'utf8');
  assert.match(page, /<title>Помощник<\/title>/);
});
