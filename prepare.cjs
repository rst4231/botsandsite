const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = process.cwd();
const encodedPath = path.join(root, 'source2.b64');
const archivePath = path.join(root, '.source2.tgz');

if (!fs.existsSync(encodedPath)) throw new Error('source2.b64 was not found');
const encoded = fs.readFileSync(encodedPath, 'utf8').replace(/\s+/g, '');
fs.writeFileSync(archivePath, Buffer.from(encoded, 'base64'));
execFileSync('tar', ['-xzf', archivePath, '-C', root], { stdio: 'inherit' });

const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
if (pkg.name !== 'traffic-news-telegram-bot') {
  throw new Error('Recovered project package.json is invalid');
}

console.log('Recovered traffic-news-telegram-bot source with Telegram → VK integration.');
