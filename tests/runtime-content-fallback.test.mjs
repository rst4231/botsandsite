import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRuntimeIssueBody, loadRuntimeContentIssue } from '../lib/runtime-content-issue.mjs';

const body = `<!-- traffic-news-runtime-v1 -->\n\`\`\`json\n${JSON.stringify({
  dateKey: '2026-08-19',
  item: { dateKey: '2026-08-19', kind: 'practical', title: 'Test', format: 'slides', slides: [] },
  status: { vk: 5442, vkStory: { storyId: 456240350 } },
})}\n\`\`\``;

test('parses durable runtime content for the requested date', () => {
  const parsed = parseRuntimeIssueBody(body, '2026-08-19');
  assert.equal(parsed.item.title, 'Test');
  assert.equal(parsed.status.vk, 5442);
  assert.equal(parsed.status.vkStory.storyId, 456240350);
});

test('ignores runtime content from another date', () => {
  assert.equal(parseRuntimeIssueBody(body, '2026-08-20'), null);
});

test('loads runtime content from the public issue endpoint', async () => {
  const result = await loadRuntimeContentIssue('2026-08-19', {
    fetchImpl: async () => ({ ok: true, async json() { return { body }; } }),
    url: 'https://example.test/issue',
  });
  assert.equal(result.item.title, 'Test');
});
