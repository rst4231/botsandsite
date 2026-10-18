import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parsePostInline, telegramBodyHtml, vkBodyText } from '../patches/post-formatting.mjs';

test('Telegram uses embedded links in event titles and bold headings', () => {
  const source = '**1. [Affiliate World Asia](https://affiliateworldconferences.com/asia)**\n9–10 декабря 2026';
  assert.equal(telegramBodyHtml(source), '<b>1. <a href="https://affiliateworldconferences.com/asia">Affiliate World Asia</a></b>\n9–10 декабря 2026');
});

test('VK keeps visible normal event URL without markdown', () => {
  const source = '**2. [AffPapa Conference](https://example.org/event?a=1&b=2)**';
  assert.equal(vkBodyText(source), '2. AffPapa Conference — https://example.org/event?a=1&b=2');
});

test('Telegram HTML and link attributes are escaped safely', () => {
  const source = '<script>alert(1)</script> **A&B** [Открыть](https://example.org/?a=1&b=2)';
  assert.equal(telegramBodyHtml(source), '&lt;script&gt;alert(1)&lt;/script&gt; <b>A&amp;B</b> <a href="https://example.org/?a=1&amp;b=2">Открыть</a>');
});

test('non-HTTPS links stay plain text', () => {
  const source = '[Опасно](javascript:alert(1)) и [OK](https://example.org)';
  assert.equal(parsePostInline(source).filter((part) => part.type === 'link').length, 1);
  assert.match(telegramBodyHtml(source), /\[Опасно\]\(javascript:alert\(1\)\)/);
});

test('plain text stays unchanged, guides can use same formatter', () => {
  const source = 'Привет\n\nПлан на неделю';
  assert.equal(telegramBodyHtml(source), source);
  assert.equal(vkBodyText(source), source);
});

test('assembled app copies formatter and uses it in calendar and publisher', () => {
  const build = fs.readFileSync(new URL('../build.cjs', import.meta.url), 'utf8');
  const content = fs.readFileSync(new URL('../patches/prepared-content.js', import.meta.url), 'utf8');
  const calendar = fs.readFileSync(new URL('../patches/publication-calendar-client.jsx', import.meta.url), 'utf8');
  assert.match(build, /copyPatch\('post-formatting\.mjs', 'lib\/post-formatting\.mjs'\)/);
  assert.match(build, /vkBodyText\(item\.body\)/);
  assert.match(content, /telegramBodyHtml\(item\.body\)/);
  assert.match(calendar, /parsePostInline\(paragraph\)/);
});
