import * as SecureStore from 'expo-secure-store';
import {
  LEGACY_PIN_MARKER_KEY,
  LOCK_SECRET_KEY,
  LOCKOUT_KEY,
} from './constants';
import { parseLockSecretJson } from './secret';

const SECURE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

export type LockMode = 'biometric' | 'pin';

export type LockSecretV1 = {
  version: 1;
  mode: LockMode;
  pinSalt: string;
  pinHash: string;
};

export type LockoutState = {
  failedAttempts: number;
  lockedUntilMs: number | null;
};

export type LegacyLockMigrationResult =
  | { type: 'none' }
  | { type: 'disable_app_lock' }
  | { type: 'cleared_invalid_secret' };

export async function runLegacyLockMigration(): Promise<LegacyLockMigrationResult> {
  const legacy = await SecureStore.getItemAsync(
    LEGACY_PIN_MARKER_KEY,
    SECURE_OPTIONS
  );
  if (!legacy) return { type: 'none' };

  if (legacy === 'biometric') {
    await SecureStore.deleteItemAsync(LEGACY_PIN_MARKER_KEY, SECURE_OPTIONS);
    await SecureStore.deleteItemAsync(LOCK_SECRET_KEY, SECURE_OPTIONS);
    await clearLockoutState();
    return { type: 'disable_app_lock' };
  }

  if (legacy === 'soft') {
    await SecureStore.deleteItemAsync(LEGACY_PIN_MARKER_KEY, SECURE_OPTIONS);
    await SecureStore.deleteItemAsync(LOCK_SECRET_KEY, SECURE_OPTIONS);
    await clearLockoutState();
    return { type: 'disable_app_lock' };
  }

  await SecureStore.deleteItemAsync(LEGACY_PIN_MARKER_KEY, SECURE_OPTIONS);
  return { type: 'none' };
}

async function readRawLockSecret(): Promise<string | null> {
  return SecureStore.getItemAsync(LOCK_SECRET_KEY, SECURE_OPTIONS);
}

export async function readLockSecret(): Promise<LockSecretV1 | null> {
  const raw = await readRawLockSecret();
  if (!raw) return null;
  const parsed = parseLockSecretJson(raw);
  if (!parsed) {
    await clearLockSecret();
    return null;
  }
  return parsed;
}

export async function reconcileLockSecretStorage(
  lockEnabledInSettings: boolean
): Promise<{
  secret: LockSecretV1 | null;
  disableAppLock: boolean;
}> {
  const migration = await runLegacyLockMigration();
  if (migration.type === 'disable_app_lock') {
    return { secret: null, disableAppLock: true };
  }

  const raw = await readRawLockSecret();
  if (!raw) {
    return { secret: null, disableAppLock: false };
  }

  const parsed = parseLockSecretJson(raw);
  if (!parsed) {
    await clearLockSecret();
    return {
      secret: null,
      disableAppLock: lockEnabledInSettings,
    };
  }

  return { secret: parsed, disableAppLock: false };
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

export async function readLockoutState(): Promise<LockoutState> {
  const raw = await SecureStore.getItemAsync(LOCKOUT_KEY, SECURE_OPTIONS);
  if (!raw) return { failedAttempts: 0, lockedUntilMs: null };
  try {
    const parsed = JSON.parse(raw) as LockoutState;
    if (
      typeof parsed.failedAttempts !== 'number' ||
      (parsed.lockedUntilMs !== null &&
        typeof parsed.lockedUntilMs !== 'number')
    ) {
      return { failedAttempts: 0, lockedUntilMs: null };
    }
    return parsed;
  } catch {
    await clearLockoutState();
    return { failedAttempts: 0, lockedUntilMs: null };
  }
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
