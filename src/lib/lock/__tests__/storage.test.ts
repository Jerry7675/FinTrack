import { beforeEach, describe, expect, it } from '@jest/globals';
import * as SecureStore from 'expo-secure-store';

import { LEGACY_PIN_MARKER_KEY, LOCK_SECRET_KEY } from '@/lib/lock/constants';
import {
  reconcileLockSecretStorage,
  runLegacyLockMigration,
  writeLockSecret,
} from '@/lib/lock/storage';

describe('lock storage migration', () => {
  beforeEach(async () => {
    await SecureStore.deleteItemAsync(LOCK_SECRET_KEY);
    await SecureStore.deleteItemAsync(LEGACY_PIN_MARKER_KEY);
  });

  it("disables app lock when migrating legacy 'soft' marker", async () => {
    await SecureStore.setItemAsync(LEGACY_PIN_MARKER_KEY, 'soft');
    const migration = await runLegacyLockMigration();
    expect(migration).toEqual({ type: 'disable_app_lock' });
    const legacy = await SecureStore.getItemAsync(LEGACY_PIN_MARKER_KEY);
    expect(legacy).toBeNull();
  });

  it('clears corrupt lock secret and requests disable when lock was enabled', async () => {
    await SecureStore.setItemAsync(LOCK_SECRET_KEY, '{not-json');
    const result = await reconcileLockSecretStorage(true);
    expect(result.secret).toBeNull();
    expect(result.disableAppLock).toBe(true);
    const raw = await SecureStore.getItemAsync(LOCK_SECRET_KEY);
    expect(raw).toBeNull();
  });

  it('treats pin mode without hash as invalid and clears storage', async () => {
    await SecureStore.setItemAsync(
      LOCK_SECRET_KEY,
      JSON.stringify({ version: 1, mode: 'pin' })
    );
    const result = await reconcileLockSecretStorage(true);
    expect(result.secret).toBeNull();
    expect(result.disableAppLock).toBe(true);
  });

  it('keeps valid biometric secret with PIN fallback fields', async () => {
    await writeLockSecret({
      version: 1,
      mode: 'biometric',
      pinSalt: 'aa'.repeat(16),
      pinHash: 'bb'.repeat(32),
    });
    const result = await reconcileLockSecretStorage(true);
    expect(result.disableAppLock).toBe(false);
    expect(result.secret?.mode).toBe('biometric');
  });
});
