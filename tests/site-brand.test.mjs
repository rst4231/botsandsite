import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { transformLayout, SITE_ICON_SVG } = require('../patches/site-brand.cjs');

test('site brand replaces an existing metadata export and forces the browser title', () => {
  const source = "export const metadata = { title: 'Old title', description: 'x' };\nexport default function Layout({ children }) { return children; }";
  const result = transformLayout(source);
  assert.match(result, /const baseMetadata = \{ title: 'Old title'/);
  assert.match(result, /export const metadata = \{ \.\.\.baseMetadata, title: 'Помощник' \};/);
  assert.doesNotMatch(result, /export const metadata = \{ title: 'Old title'/);
});

test('site brand adds metadata when a layout has no metadata export', () => {
  const source = 'export default function Layout({ children }) { return children; }';
  const result = transformLayout(source);
  assert.match(result, /export const metadata = \{ title: 'Помощник' \};/);
});

test('site icon is an svg calendar assistant mark', () => {
  assert.match(SITE_ICON_SVG, /<svg/);
  assert.match(SITE_ICON_SVG, /<rect/);
  assert.match(SITE_ICON_SVG, /<path/);
  assert.match(SITE_ICON_SVG, /#2563EB/i);
});
