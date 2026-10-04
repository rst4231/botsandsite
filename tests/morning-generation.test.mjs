import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const generator = fs.readFileSync(new URL('../patches/prepared-generator.js', import.meta.url), 'utf8');
const route = fs.readFileSync(new URL('../patches/prepared-generate-route.js', import.meta.url), 'utf8');
const build = fs.readFileSync(new URL('../patches/morning-generation-build.cjs', import.meta.url), 'utf8');
const productionBuild = fs.readFileSync(new URL('../build.cjs', import.meta.url), 'utf8');

test('morning generator uses Vercel AI Gateway and existing prepared-content validation', () => {
  assert.match(generator, /ai-gateway\.vercel\.sh\/v1/);
  assert.match(generator, /VERCEL_OIDC_TOKEN/);
  assert.match(generator, /getPreparedHistory/);
  assert.match(generator, /getPreparedStatus/);
  assert.match(generator, /stagePreparedContent/);
  assert.match(generator, /Exactly|five|5/);
  assert.doesNotMatch(generator, /update_issue|api\.github\.com\/repos\/.*\/issues\/7/);
});

test('events generation requires a web-search tool', () => {
  assert.match(generator, /web_search/);
  assert.match(generator, /web_search_preview/);
});

test('prepare cron fails closed behind CRON_SECRET', () => {
  assert.match(route, /CRON_SECRET/);
  assert.match(route, /authorization/);
  assert.match(route, /status: 503/);
  assert.match(route, /status: 401/);
});

test('build wires morning and recovery routes without replacing publisher', () => {
  assert.match(productionBuild, /app\/api\/cron\/prepare\/route\.js/);
  assert.match(productionBuild, /app\/api\/cron\/prepare-recovery\/route\.js/);
  assert.match(productionBuild, /lib\/prepared-generator\.js/);
  assert.match(build, /app\/api\/cron\/prepare\/route\.js/);
  assert.match(build, /app\/api\/cron\/prepare-recovery\/route\.js/);
  assert.match(build, /app\/api\/cron\/publish/);
  assert.match(build, /0 6 \* \* \*/);
  assert.match(build, /20 15 \* \* \*/);
  assert.match(build, /40 15 \* \* \*/);
});
