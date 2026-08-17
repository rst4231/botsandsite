const fs = require('fs');
const path = require('path');

const cwd = process.cwd();
const chunks = fs.readdirSync(cwd).filter((name) => /^source\.b64\.\d+$/.test(name)).sort();
if (!chunks.length) throw new Error('Source archive chunks are missing');

const archive = Buffer.concat(chunks.map((name) => Buffer.from(fs.readFileSync(path.join(cwd, name), 'utf8').trim(), 'base64')));
for (const name of chunks) fs.unlinkSync(path.join(cwd, name));
fs.writeFileSync(path.join(cwd, 'source.b64.00'), archive.toString('base64'));
require('./restore.cjs');
