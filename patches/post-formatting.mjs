const INLINE_MARKDOWN = /\*\*([^\n]+?)\*\*|\[([^\]\n]+)\]\((https:\/\/[^\s)<>"']+)\)/g;

export function parsePostInline(input = '') {
  const source = String(input ?? '');
  const nodes = [];
  let end = 0;
  for (const match of source.matchAll(INLINE_MARKDOWN)) {
    if (match.index > end) nodes.push({ type: 'text', text: source.slice(end, match.index) });
    if (match[1] !== undefined) nodes.push({ type: 'bold', children: parsePostInline(match[1]) });
    else nodes.push({ type: 'link', label: match[2], url: match[3] });
    end = match.index + match[0].length;
  }
  if (end < source.length) nodes.push({ type: 'text', text: source.slice(end) });
  return nodes;
}

function escapeHtml(value) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export function telegramBodyHtml(body) {
  const render = (nodes) => nodes.map((node) => {
    if (node.type === 'bold') return `<b>${render(node.children)}</b>`;
    if (node.type === 'link') return `<a href="${escapeHtml(node.url)}">${escapeHtml(node.label)}</a>`;
    return escapeHtml(node.text);
  }).join('');
  return render(parsePostInline(body));
}

export function vkBodyText(body) {
  const render = (nodes) => nodes.map((node) => {
    if (node.type === 'bold') return render(node.children);
    if (node.type === 'link') return `${node.label} — ${node.url}`;
    return node.text;
  }).join('');
  return render(parsePostInline(body));
}
