const fs = require('fs');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');

const cwd = process.cwd();
const archivePath = path.join(cwd, '.source3.tgz');
const chunks = fs.readdirSync(cwd).filter((name) => /^source3\.b64\.\d+$/.test(name)).sort();
if (!chunks.length) throw new Error('Corrected source archive chunks are missing');

const encoded = chunks.map((name) => fs.readFileSync(path.join(cwd, name), 'utf8').trim()).join('');
fs.writeFileSync(archivePath, Buffer.from(encoded, 'base64'));
execFileSync('tar', ['-xzf', archivePath, '-C', cwd], { stdio: 'inherit' });

const pkg = JSON.parse(fs.readFileSync(path.join(cwd, 'package.json'), 'utf8'));
if (pkg.name !== 'traffic-news-telegram-bot') throw new Error('Recovered project is invalid');

const nextBin = path.join(cwd, 'node_modules', '.bin', 'next');
const result = spawnSync(nextBin, ['build'], { cwd, stdio: 'inherit', env: process.env });
process.exit(result.status ?? 1);
