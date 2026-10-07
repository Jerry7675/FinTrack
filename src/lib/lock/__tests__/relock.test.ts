import { describe, expect, it } from '@jest/globals';

import {
  BACKGROUND_RELOCK_GRACE_MS,
  isRelockSuppressed,
  resumeAppRelock,
  runWithRelockSuppressed,
  shouldRelockAfterBackground,
  suppressAppRelock,
} from '@/lib/lock/relock';

describe('background re-lock', () => {
  it('waits for the configured grace period', () => {
    expect(shouldRelockAfterBackground(BACKGROUND_RELOCK_GRACE_MS - 1)).toBe(
      false
    );
    expect(shouldRelockAfterBackground(BACKGROUND_RELOCK_GRACE_MS)).toBe(true);
  });

  it('suppresses re-lock while picker or auth UI is open', async () => {
    expect(isRelockSuppressed()).toBe(false);
    suppressAppRelock();
    expect(isRelockSuppressed()).toBe(true);
    resumeAppRelock();
    expect(isRelockSuppressed()).toBe(false);
  });

  it('balances nested suppress calls', async () => {
    await runWithRelockSuppressed(async () => {
      expect(isRelockSuppressed()).toBe(true);
      suppressAppRelock();
      expect(isRelockSuppressed()).toBe(true);
      resumeAppRelock();
    });
    expect(isRelockSuppressed()).toBe(false);
  });
});
