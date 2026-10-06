/**
 * @jest-environment node
 */

import { RATE_LIMIT_MAX_TRACKED_IPS } from '../config';
import { resolveClientIp } from '../lib/client-ip';
import {
  checkRateLimit,
  rateLimitBucketCount,
  resetRateLimitState,
} from '../lib/rate-limit';

describe('resolveClientIp', () => {
  it('prefers x-real-ip over leftmost x-forwarded-for', () => {
    const headers = new Headers({
      'x-real-ip': '198.51.100.1',
      'x-forwarded-for': '9.9.9.9, 198.51.100.1',
    });
    expect(resolveClientIp(headers)).toBe('198.51.100.1');
  });

  it('uses rightmost x-forwarded-for when x-real-ip is absent', () => {
    const headers = new Headers({
      'x-forwarded-for': '9.9.9.9, 203.0.113.5',
    });
    expect(resolveClientIp(headers)).toBe('203.0.113.5');
    expect(resolveClientIp(headers)).not.toBe('9.9.9.9');
  });
});

describe('rate limit map bounds', () => {
  beforeEach(() => resetRateLimitState());

  it('evicts oldest entries when over max tracked IPs', () => {
    const now = Date.now();
    for (let i = 0; i < RATE_LIMIT_MAX_TRACKED_IPS + 50; i++) {
      checkRateLimit(`ip-${i}`, now + i);
    }
    expect(rateLimitBucketCount()).toBeLessThanOrEqual(
      RATE_LIMIT_MAX_TRACKED_IPS
    );
  });
});
