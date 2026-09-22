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
    const bodyBlocks = cleanVkText(item.body).split(/\n{2,}/).map((block) => block.trim()).filter(Boolean).map((block, index) => `${VK_TEXT_BLOCK_EMOJIS[index % VK_TEXT_BLOCK_EMOJIS.length]} ${block}`);
    const body = bodyBlocks.join('\n\n');
    return `${headline}${body ? `\n\n${body}` : ''}${footer}`;
  }
  const intro = cleanVkText(item.description);
  const sections = Array.isArray(item.slides) ? item.slides.map((slide, index) => {
    const sectionTitle = cleanVkText(slide?.title);
    const sectionBody = cleanVkText(slide?.body);
    const emoji = VK_SECTION_EMOJIS[index] || '•';
    return `${emoji} ${sectionTitle}${sectionBody ? `\n${sectionBody}` : ''}`.trim();
  }).filter(Boolean) : [];
  return [headline, intro, ...sections].filter(Boolean).join('\n\n') + footer;
}

export function buildVkPostUrl(groupId, postId) {
  if (!groupId || !postId) throw new Error('VK group ID and post ID are required');
  return `https://vk.com/wall-${String(groupId).replace(/^-/, '')}_${postId}`;
}

export function summarizeVkStories(stories = []) {
  const published = Array.isArray(stories) ? stories.filter((story) => story?.storyId) : [];
  const expirations = published.map((story) => Number(story?.expiresAt)).filter((value) => Number.isFinite(value) && value > 0);
  return {
    count: published.length,
    storyIds: published.map((story) => story.storyId),
    expiresAt: expirations.length ? Math.min(...expirations) : null,
    lifetimeVerified: published.length > 0 && published.every((story) => story?.lifetimeVerified === true),
  };
}

export async function ensureVkPreparedPublished({ item, status = {}, publishWall, publishStory, publishStories, persist }) {
  if (typeof publishWall !== 'function' || (typeof publishStory !== 'function' && typeof publishStories !== 'function') || typeof persist !== 'function') throw new Error('VK publication callbacks are required');
  const next = { ...status };
  if (!next.vk) { next.vk = await publishWall(item); await persist(next); }
  if (!next.vkStory) {
    if (typeof publishStories === 'function') {
      next.vkStories = await publishStories(item, next.vk, next.vkStories, async (stories) => {
        next.vkStories = stories;
        await persist(next);
      });
      next.vkStory = summarizeVkStories(next.vkStories);
    } else {
      next.vkStory = await publishStory(item, next.vk);
    }
    await persist(next);
  }
  return next;
}

function storyFromResponse(value) {
  return Array.isArray(value?.items) ? value.items[0] : Array.isArray(value) ? value[0] : value?.story || value;
}

function storyLifetime(story) {
  const date = Number(story?.date);
  const expiresAt = Number(story?.expires_at);
  if (!Number.isFinite(date) || date <= 0 || !Number.isFinite(expiresAt) || expiresAt <= date) {
    return { expiresAt: null, lifetimeSeconds: null, lifetimeVerified: false };
  }
  const lifetimeSeconds = expiresAt - date;
  return {
    expiresAt,
    lifetimeSeconds,
    lifetimeVerified: lifetimeSeconds >= (48 * 60 * 60 - 120),
  };
}

export async function publishVkStorySequence({ slides, existingStories = [], renderStory, publishStory, persist = async () => {} }) {
  if (!Array.isArray(slides)) throw new Error('VK story slides are required');
  if (typeof renderStory !== 'function' || typeof publishStory !== 'function' || typeof persist !== 'function') throw new Error('VK story sequence callbacks are required');
  const stories = Array.isArray(existingStories) ? existingStories.slice(0, slides.length) : [];
  for (let index = 0; index < slides.length; index += 1) {
    if (stories[index]?.storyId) continue;
    const image = await renderStory(slides[index], index);
    const published = await publishStory(image, index, slides[index]);
    stories[index] = { ...published, slideIndex: index };
    await persist(stories.slice());
  }
  return stories;
}

export async function uploadVkStory({ groupId, image, apiCall, fetchImpl = fetch, linkUrl = '', linkText = 'more' }) {
  if (!groupId) throw new Error('VK group ID is required');
  if (!image) throw new Error('VK story image is required');
  if (typeof apiCall !== 'function') throw new Error('VK apiCall is required');
  const uploadParams = { group_id: String(groupId), add_to_news: 1 };
  if (linkUrl) { uploadParams.link_url = String(linkUrl); uploadParams.link_text = String(linkText || 'more'); }
  const uploadServer = await apiCall('stories.getPhotoUploadServer', uploadParams);
  if (!uploadServer?.upload_url) throw new Error('VK story upload server is unavailable');
  const form = new FormData();
  form.append('photo', new Blob([image], { type: 'image/png' }), 'story.png');
  const uploadResponse = await fetchImpl(uploadServer.upload_url, { method: 'POST', body: form });
  const uploadText = await uploadResponse.text();
  let uploaded;
  try { uploaded = JSON.parse(uploadText); } catch { throw new Error(`VK story upload returned non-JSON (HTTP ${uploadResponse.status}): ${uploadText.slice(0, 180)}`); }
  if (!uploadResponse.ok || uploaded?.error) throw new Error(uploaded?.error?.error_msg || uploaded?.error?.type || 'VK story upload failed');
  const uploadResult = uploaded?.response?.upload_result || uploaded?.upload_result;
  if (!uploadResult) throw new Error('VK story upload_result is missing');
  const saved = await apiCall('stories.save', { upload_results: uploadResult });
  const story = storyFromResponse(saved);
  const storyId = Number(story?.id);
  if (!Number.isInteger(storyId) || storyId <= 0) throw new Error('VK story id is missing');
  const ownerId = Number(story?.owner_id ?? -Number(groupId));
  let lifetime = storyLifetime(story);
  try {
    const details = storyFromResponse(await apiCall('stories.getById', { stories: `${ownerId}_${storyId}` }));
    const checked = storyLifetime(details);
    if (checked.lifetimeSeconds) lifetime = checked;
  } catch {}
  return { ownerId, storyId, ...lifetime };
}
