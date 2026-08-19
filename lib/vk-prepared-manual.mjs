const VK_SECTION_EMOJIS = ['🎯', '🔎', '⚙️', '📊', '✅'];
const VK_TEXT_BLOCK_EMOJIS = ['🗓️', '📍', '🎟️', '💡', '✅'];

function cleanVkText(value = '') {
  return String(value)
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function vkHeadlineEmoji(kind) {
  if (kind === 'events') return '📅';
  if (kind === 'team') return '🧩';
  if (kind === 'beginner') return '🚀';
  return '📌';
}

export function buildVkPreparedText(item, footer = '') {
  if (!item || typeof item !== 'object') throw new Error('Prepared VK item is required');
  const title = cleanVkText(item.title);
  const headline = `${vkHeadlineEmoji(item.kind)} ${title}`.trim();

  if (item.format === 'text') {
    const bodyBlocks = cleanVkText(item.body)
      .split(/\n{2,}/)
      .map((block) => block.trim())
      .filter(Boolean)
      .map((block, index) => `${VK_TEXT_BLOCK_EMOJIS[index % VK_TEXT_BLOCK_EMOJIS.length]} ${block}`);
    const body = bodyBlocks.join('\n\n');
    return `${headline}${body ? `\n\n${body}` : ''}${footer}`;
  }

  const intro = cleanVkText(item.description);
  const sections = Array.isArray(item.slides)
    ? item.slides.map((slide, index) => {
        const sectionTitle = cleanVkText(slide?.title);
        const sectionBody = cleanVkText(slide?.body);
        const emoji = VK_SECTION_EMOJIS[index] || '•';
        return `${emoji} ${sectionTitle}${sectionBody ? `\n${sectionBody}` : ''}`.trim();
      }).filter(Boolean)
    : [];

  return [headline, intro, ...sections].filter(Boolean).join('\n\n') + footer;
}

export async function ensureVkPreparedPublished({ item, status = {}, publishWall, publishStory, persist }) {
  if (typeof publishWall !== 'function' || typeof publishStory !== 'function' || typeof persist !== 'function') {
    throw new Error('VK publication callbacks are required');
  }
  const next = { ...status };
  if (!next.vk) {
    next.vk = await publishWall(item);
    await persist(next);
  }
  if (!next.vkStory) {
    next.vkStory = await publishStory(item);
    await persist(next);
  }
  return next;
}

export async function uploadVkStory({ groupId, image, apiCall, fetchImpl = fetch }) {
  if (!groupId) throw new Error('VK group ID is required');
  if (!image) throw new Error('VK story image is required');
  if (typeof apiCall !== 'function') throw new Error('VK apiCall is required');

  const uploadServer = await apiCall('stories.getPhotoUploadServer', {
    group_id: String(groupId),
    add_to_news: 1,
  });
  if (!uploadServer?.upload_url) throw new Error('VK story upload server is unavailable');

  const form = new FormData();
  form.append('photo', new Blob([image], { type: 'image/png' }), 'story.png');
  const uploadResponse = await fetchImpl(uploadServer.upload_url, { method: 'POST', body: form });
  const uploadText = await uploadResponse.text();
  let uploaded;
  try {
    uploaded = JSON.parse(uploadText);
  } catch {
    throw new Error(`VK story upload returned non-JSON (HTTP ${uploadResponse.status}): ${uploadText.slice(0, 180)}`);
  }
  if (!uploadResponse.ok || uploaded?.error) {
    throw new Error(uploaded?.error?.error_msg || uploaded?.error?.type || 'VK story upload failed');
  }
  const uploadResult = uploaded?.response?.upload_result || uploaded?.upload_result;
  if (!uploadResult) throw new Error('VK story upload_result is missing');

  const saved = await apiCall('stories.save', { upload_results: uploadResult });
  const story = Array.isArray(saved?.items)
    ? saved.items[0]
    : Array.isArray(saved)
      ? saved[0]
      : saved?.story || saved;
  return {
    ownerId: Number(story?.owner_id ?? -Number(groupId)),
    storyId: story?.id ?? null,
  };
}
