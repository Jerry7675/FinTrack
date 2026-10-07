import { beforeEach, describe, expect, it } from '@jest/globals';
import * as SecureStore from 'expo-secure-store';

import {
  assertUnlocked,
  enablePinLock,
  InvalidPinError,
  LockoutError,
} from '@/lib/lock';
import { LOCK_SECRET_KEY, LOCKOUT_KEY } from '@/lib/lock/constants';

describe('assertUnlocked lockout', () => {
  beforeEach(async () => {
    await SecureStore.deleteItemAsync(LOCK_SECRET_KEY);
    await SecureStore.deleteItemAsync(LOCKOUT_KEY);
    await enablePinLock('1234');
  });

  it('applies backoff after repeated wrong PINs', async () => {
    for (let i = 0; i < 5; i++) {
      await expect(assertUnlocked('0000')).rejects.toBeInstanceOf(
        InvalidPinError
      );
    }
    await expect(assertUnlocked('1234')).rejects.toBeInstanceOf(LockoutError);
  });
});
