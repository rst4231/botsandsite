import assert from 'node:assert/strict';

let module;
try {
  module = await import('./app/api/proxy/telegram-link-handler.js');
} catch (error) {
  assert.fail(`Telegram link handler is not implemented: ${error.code || error.message}`);
}

const { injectTelegramBotLinkHandler } = module;
assert.equal(typeof injectTelegramBotLinkHandler, 'function');

const original = '<!doctype html><html><head><title>x</title></head><body><a href="https://t.me/teachercpa_bot?start=abc" target="_blank">Bot</a></body></html>';
const patched = injectTelegramBotLinkHandler(original);

assert.notEqual(patched, original, 'HTML should be patched');
assert.match(patched, /data-telegram-bot-link-handler/);
assert.match(patched, /a\[href\^="https:\/\/t\.me\/teachercpa_bot"\]/);
assert.match(patched, /openTelegramLink/);
assert.match(patched, /telegram\.close/);
assert.match(patched, /window\.location\.assign/);
assert.equal(injectTelegramBotLinkHandler(patched), patched, 'injection must be idempotent');

const withoutHead = '<div>No head</div>';
assert.equal(injectTelegramBotLinkHandler(withoutHead), withoutHead, 'non-document HTML should stay unchanged');
