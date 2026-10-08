import { describe, expect, it } from '@jest/globals';

import {
  createPinRecord,
  isValidPinFormat,
  lockoutDelayMs,
  timingSafeEqualHex,
  verifyPinAgainstRecord,
} from '@/lib/lock/pin';

describe('app lock PIN helpers', () => {
  it('validates PIN length', () => {
    expect(isValidPinFormat('123')).toBe(false);
    expect(isValidPinFormat('1234')).toBe(true);
    expect(isValidPinFormat('12345678')).toBe(true);
    expect(isValidPinFormat('123456789')).toBe(false);
  });

  it('verifies PIN against stored hash', async () => {
    const { pinSalt, pinHash } = await createPinRecord('4321');
    await expect(
      verifyPinAgainstRecord('4321', pinSalt, pinHash)
    ).resolves.toBe(true);
    await expect(
      verifyPinAgainstRecord('9999', pinSalt, pinHash)
    ).resolves.toBe(false);
  });

  it('uses constant-time hex comparison', () => {
    expect(timingSafeEqualHex('abcd', 'abcd')).toBe(true);
    expect(timingSafeEqualHex('abcd', 'abce')).toBe(false);
    expect(timingSafeEqualHex('ab', 'abcd')).toBe(false);
  });

  it('escalates lockout delay after repeated failures', () => {
    expect(lockoutDelayMs(4)).toBe(0);
    expect(lockoutDelayMs(5)).toBe(30_000);
    expect(lockoutDelayMs(6)).toBe(60_000);
    expect(lockoutDelayMs(9)).toBeGreaterThan(60_000);
  });
});
