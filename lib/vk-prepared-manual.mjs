export function buildVkPreparedText(item, footer = '') {
  if (!item || typeof item !== 'object') throw new Error('Prepared VK item is required');
  const title = String(item.title || '').trim();
  const body = item.format === 'text'
    ? String(item.body || '').trim()
    : [
        String(item.description || '').trim(),
        ...(Array.isArray(item.slides)
          ? item.slides.map((slide) => `${String(slide?.title || '').trim()}\n${String(slide?.body || '').trim()}`.trim())
          : []),
      ].filter(Boolean).join('\n\n');
  return `${title}${body ? `\n\n${body}` : ''}${footer}`;
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
  form.append('file', new Blob([image], { type: 'image/png' }), 'story.png');
  const uploadResponse = await fetchImpl(uploadServer.upload_url, { method: 'POST', body: form });
  const uploaded = await uploadResponse.json();
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
