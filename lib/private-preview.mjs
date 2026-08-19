const TELEGRAM_FOOTER = '\n\n• <a href="https://t.me/c/1394610823/767">О нас</a> | <a href="https://t.me/c/1394610823/779">Кейсы</a> | <a href="https://app.lava.top/products/1a995492-be5d-4957-8dfb-29bb21d7f387">Руководство</a> | <a href="https://t.me/+B7YJykmJSkEzMmJi">Канал</a>';

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function telegramCaption(item) {
  return `<b>${escapeHtml(item.title)}</b>\n\n${escapeHtml(item.description)}${TELEGRAM_FOOTER}`;
}

export function resolvePreparedPreviewItem({ cachedItem, encodedPayload }) {
  if (cachedItem) return cachedItem;
  if (!encodedPayload) return null;

  let item;
  try {
    item = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
  } catch {
    throw new Error('Preview payload is invalid');
  }

  if (item?.format !== 'slides' || !Array.isArray(item.slides) || item.slides.length !== 5) {
    throw new Error('Preview payload requires exactly five slides');
  }
  if (!String(item.title || '').trim() || !String(item.description || '').trim()) {
    throw new Error('Preview payload requires title and description');
  }
  return item;
}

export async function sendPreparedPreview({ token, chatId, item, renderSlide, fetchImpl = fetch }) {
  if (!token) throw new Error('Telegram token is missing');
  if (!chatId) throw new Error('Telegram chat ID is missing');
  if (item?.format !== 'slides' || !Array.isArray(item.slides) || item.slides.length !== 5) {
    throw new Error('Prepared preview requires exactly five slides');
  }

  const images = await Promise.all(item.slides.map((slide, index) => renderSlide(slide, index, item.slides.length)));
  const form = new FormData();
  form.append('chat_id', String(chatId));
  const media = images.map((image, index) => {
    const field = `slide${index + 1}`;
    form.append(field, new Blob([image], { type: 'image/png' }), `${field}.png`);
    return {
      type: 'photo',
      media: `attach://${field}`,
      ...(index === 0 ? { caption: telegramCaption(item), parse_mode: 'HTML' } : {}),
    };
  });
  form.append('media', JSON.stringify(media));

  const response = await fetchImpl(`https://api.telegram.org/bot${token}/sendMediaGroup`, {
    method: 'POST',
    body: form,
  });
  const data = await response.json();
  if (!data.ok) throw new Error(data.description || 'Telegram preview sending failed');
  return (data.result || []).map((entry) => entry.message_id);
}
