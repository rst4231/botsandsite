const fs = require('fs');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');

const cwd = process.cwd();
const encodedPath = path.join(cwd, 'source2.b64');
const archivePath = path.join(cwd, '.source2.tgz');

if (!fs.existsSync(encodedPath)) throw new Error('source2.b64 is missing');
const encoded = fs.readFileSync(encodedPath, 'utf8').replace(/\s+/g, '');
fs.writeFileSync(archivePath, Buffer.from(encoded, 'base64'));
execFileSync('tar', ['-xzf', archivePath, '-C', cwd], { stdio: 'inherit' });

const pkg = JSON.parse(fs.readFileSync(path.join(cwd, 'package.json'), 'utf8'));
if (pkg.name !== 'traffic-news-telegram-bot') throw new Error('Recovered project is invalid');

const nextBin = path.join(cwd, 'node_modules', '.bin', 'next');
const result = spawnSync(nextBin, ['build'], { cwd, stdio: 'inherit', env: process.env });
process.exit(result.status ?? 1);
