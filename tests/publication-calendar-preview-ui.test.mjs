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
