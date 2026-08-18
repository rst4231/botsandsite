import { createHash, timingSafeEqual } from 'node:crypto';

const EXPECTED_HASH = 'f2dae2d08fccb7499bb937be70f03342d6e62e35a3af6839aedf7eb35357b82d';

export function authorizedContentRequest(request) {
  const key = request.nextUrl.searchParams.get('key') || '';
  const actual = createHash('sha256').update(key).digest();
  const expected = Buffer.from(EXPECTED_HASH, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
