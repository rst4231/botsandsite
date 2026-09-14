const SITE_TITLE = 'Помощник';

const SITE_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="16" fill="#2563EB"/>
  <rect x="14" y="17" width="36" height="34" rx="8" fill="#FFFFFF"/>
  <rect x="20" y="12" width="5" height="12" rx="2.5" fill="#BFDBFE"/>
  <rect x="39" y="12" width="5" height="12" rx="2.5" fill="#BFDBFE"/>
  <path d="M20 29h24M22 37h7M35 37h7M22 44h7" stroke="#2563EB" stroke-width="4" stroke-linecap="round"/>
  <path d="M43 42l1.7 3.3L48 47l-3.3 1.7L43 52l-1.7-3.3L38 47l3.3-1.7L43 42Z" fill="#FACC15"/>
</svg>\n`;

function transformLayout(source) {
  const input = String(source || '');
  if (!input.trim()) return `export const metadata = { title: '${SITE_TITLE}' };\n`;

  if (/export\s+const\s+metadata\s*=\s*\{[\s\S]*?title\s*:\s*['"]Помощник['"]/m.test(input)) {
    return input;
  }

  const metadataPattern = /export\s+const\s+metadata\s*=\s*([\s\S]*?);(?=\s*(?:export|function|const|let|var|class|$))/m;
  const match = input.match(metadataPattern);
  if (match) {
    const existingValue = match[1].trim();
    const replacement = `const baseMetadata = ${existingValue};\nexport const metadata = { ...baseMetadata, title: '${SITE_TITLE}' };`;
    return input.replace(metadataPattern, replacement);
  }

  return `export const metadata = { title: '${SITE_TITLE}' };\n\n${input}`;
}

module.exports = {
  SITE_ICON_SVG,
  SITE_TITLE,
  transformLayout,
};
