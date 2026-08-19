export function formatVkPhotoAttachment(photo) {
  if (!photo?.owner_id || !photo?.id) throw new Error('VK photo is missing owner_id or id');
  const base = `photo${photo.owner_id}_${photo.id}`;
  return photo.access_key ? `${base}_${photo.access_key}` : base;
}
