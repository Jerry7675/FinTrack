import * as SecureStore from 'expo-secure-store';

import {
  LEGACY_PIN_MARKER_KEY,
  LOCK_SECRET_KEY,
  LOCKOUT_KEY,
} from './constants';

const SECURE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

export type LockMode = 'biometric' | 'pin';

export type LockSecretV1 = {
  version: 1;
  mode: LockMode;
  pinSalt?: string;
  pinHash?: string;
};

export type LockoutState = {
  failedAttempts: number;
  lockedUntilMs: number | null;
};

export async function readLockSecret(): Promise<LockSecretV1 | null> {
  const raw = await SecureStore.getItemAsync(LOCK_SECRET_KEY, SECURE_OPTIONS);
  if (!raw) {
    await migrateLegacyPinMarker();
    const migrated = await SecureStore.getItemAsync(
      LOCK_SECRET_KEY,
      SECURE_OPTIONS
    );
    if (!migrated) return null;
    return JSON.parse(migrated) as LockSecretV1;
  }
  return JSON.parse(raw) as LockSecretV1;
}

export async function writeLockSecret(secret: LockSecretV1): Promise<void> {
  await SecureStore.setItemAsync(
    LOCK_SECRET_KEY,
    JSON.stringify(secret),
    SECURE_OPTIONS
  );
}

export async function clearLockSecret(): Promise<void> {
  await SecureStore.deleteItemAsync(LOCK_SECRET_KEY, SECURE_OPTIONS);
  await SecureStore.deleteItemAsync(LEGACY_PIN_MARKER_KEY, SECURE_OPTIONS);
  await clearLockoutState();
}

async function migrateLegacyPinMarker(): Promise<void> {
  const legacy = await SecureStore.getItemAsync(
    LEGACY_PIN_MARKER_KEY,
    SECURE_OPTIONS
  );
  if (!legacy) return;
  if (legacy === 'biometric') {
    await writeLockSecret({ version: 1, mode: 'biometric' });
  } else if (legacy === 'soft') {
    await writeLockSecret({ version: 1, mode: 'pin' });
  }
  await SecureStore.deleteItemAsync(LEGACY_PIN_MARKER_KEY, SECURE_OPTIONS);
}

export async function readLockoutState(): Promise<LockoutState> {
  const raw = await SecureStore.getItemAsync(LOCKOUT_KEY, SECURE_OPTIONS);
  if (!raw) return { failedAttempts: 0, lockedUntilMs: null };
  return JSON.parse(raw) as LockoutState;
}

export async function writeLockoutState(state: LockoutState): Promise<void> {
  await SecureStore.setItemAsync(
    LOCKOUT_KEY,
    JSON.stringify(state),
    SECURE_OPTIONS
  );
}

export async function clearLockoutState(): Promise<void> {
  await SecureStore.deleteItemAsync(LOCKOUT_KEY, SECURE_OPTIONS);
}
