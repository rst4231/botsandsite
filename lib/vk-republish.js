export function makeWallPostUrl(groupId, postId) {
  return `https://vk.com/wall-${Number(groupId)}_${Number(postId)}`;
}

export function makePostClickableStickers(groupId, postId) {
  return JSON.stringify({
    original_width: 1080,
    original_height: 1920,
    clickable_stickers: [
      {
        id: 1,
        type: 'post',
        post_owner_id: -Number(groupId),
        post_id: Number(postId),
        clickable_area: [
          { x: 5, y: 70 },
          { x: 95, y: 70 },
          { x: 95, y: 95 },
          { x: 5, y: 95 },
        ],
      },
    ],
  });
}

export function makeStoryUploadParams(groupId, postId) {
  return {
    group_id: Number(groupId),
    add_to_news: 1,
    link_text: 'view',
    link_url: makeWallPostUrl(groupId, postId),
    clickable_stickers: makePostClickableStickers(groupId, postId),
  };
}

export function isGroupPhotoAuthError(error) {
  const message = error instanceof Error ? error.message : String(error || '');
  return /VK\s+27:/.test(message) && /group auth/i.test(message);
}
