import { createHash, timingSafeEqual } from 'node:crypto';

const EXPECTED_HASH = '59d9c6d3e18f3b33c7f64257af4b08043b46c5186414f2e87b1d00cbf91e4d86';

export function authorizedContentRequest(request) {
  const key = request.nextUrl.searchParams.get('key') || '';
  const actual = createHash('sha256').update(key).digest();
  const expected = Buffer.from(EXPECTED_HASH, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
