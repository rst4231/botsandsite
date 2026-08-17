export const runtime = 'nodejs';

import fs from 'node:fs';
import path from 'node:path';

export async function GET() {
  const file = path.join(process.cwd(), 'lib', 'content-bot.js');
  const source = fs.readFileSync(file, 'utf8');
  return new Response(source, { headers: { 'content-type': 'text/plain; charset=utf-8' } });
}
