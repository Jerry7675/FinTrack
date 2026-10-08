import * as LocalAuthentication from 'expo-local-authentication';

import {
  createPinRecord,
  isValidPinFormat,
  lockoutDelayMs,
  verifyPinAgainstRecord,
} from './pin';
import { runWithRelockSuppressed } from './relock';
import { lockModeRequiresBiometricsFirst } from './secret';
import {
  clearLockSecret,
  type LockMode,
  type LockSecretV1,
  readLockoutState,
  readLockSecret,
  writeLockoutState,
  writeLockSecret,
} from './storage';

export {
  MAX_PIN_ATTEMPTS,
  MAX_PIN_LENGTH,
  MIN_PIN_LENGTH,
} from './constants';
export { isValidPinFormat, lockoutDelayMs } from './pin';
export {
  BACKGROUND_RELOCK_GRACE_MS,
  isRelockSuppressed,
  runWithRelockSuppressed,
  shouldRelockAfterBackground,
} from './relock';
export { reconcileLockSecretStorage, runLegacyLockMigration } from './storage';
export type { LockMode, LockSecretV1 };

export class LockoutError extends Error {
  readonly lockedUntilMs: number;

  constructor(lockedUntilMs: number) {
    super('Too many attempts. Try again later.');
    this.name = 'LockoutError';
    this.lockedUntilMs = lockedUntilMs;
  }
}

export class InvalidPinError extends Error {
  constructor() {
    super('Incorrect PIN');
    this.name = 'InvalidPinError';
  }
}

export async function biometricsAvailable(): Promise<boolean> {
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  const enrolled = await LocalAuthentication.isEnrolledAsync();
  return hasHardware && enrolled;
}

export async function authenticateWithBiometrics(
  promptMessage: string
): Promise<boolean> {
  return runWithRelockSuppressed(async () => {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage,
      cancelLabel: 'Cancel',
      disableDeviceFallback: false,
      fallbackLabel: 'Use device passcode',
    });
    return result.success;
  });
}

async function writePinSecret(mode: LockMode, pin: string): Promise<void> {
  const { pinSalt, pinHash } = await createPinRecord(pin);
  await writeLockSecret({
    version: 1,
    mode,
    pinSalt,
    pinHash,
  });
  await writeLockoutState({ failedAttempts: 0, lockedUntilMs: null });
}

export async function enableBiometricLock(pin: string): Promise<void> {
  if (!isValidPinFormat(pin)) {
    throw new Error('PIN must be 4–8 digits');
  }
  const ok = await authenticateWithBiometrics('Enable FinTrack lock');
  if (!ok) throw new Error('Authentication cancelled');
  await writePinSecret('biometric', pin);
}

export async function enablePinLock(pin: string): Promise<void> {
  if (!isValidPinFormat(pin)) {
    throw new Error('PIN must be 4–8 digits');
  }
  await writePinSecret('pin', pin);
}

export async function disableAppLock(): Promise<void> {
  await clearLockSecret();
}

export async function getLockMode(): Promise<LockMode | null> {
  const secret = await readLockSecret();
  return secret?.mode ?? null;
}

export async function assertUnlocked(pin?: string): Promise<void> {
  const secret = await readLockSecret();
  if (!secret) return;

  const lockout = await readLockoutState();
  const now = Date.now();
  if (lockout.lockedUntilMs && lockout.lockedUntilMs > now) {
    throw new LockoutError(lockout.lockedUntilMs);
  }

  const canTryBiometrics =
    lockModeRequiresBiometricsFirst(secret.mode) &&
    !pin &&
    (await biometricsAvailable());

  if (canTryBiometrics) {
    const ok = await authenticateWithBiometrics('Unlock FinTrack');
    if (ok) {
      await writeLockoutState({ failedAttempts: 0, lockedUntilMs: null });
      return;
    }
    throw new Error('Authentication failed');
  }

  if (!pin) throw new InvalidPinError();
  const valid = await verifyPinAgainstRecord(
    pin,
    secret.pinSalt,
    secret.pinHash
  );
  if (!valid) {
    const failedAttempts = lockout.failedAttempts + 1;
    const delay = lockoutDelayMs(failedAttempts);
    const lockedUntilMs = delay > 0 ? now + delay : null;
    await writeLockoutState({ failedAttempts, lockedUntilMs });
    throw new InvalidPinError();
  }
  await writeLockoutState({ failedAttempts: 0, lockedUntilMs: null });
}

export async function getLockoutRemainingMs(): Promise<number> {
  const lockout = await readLockoutState();
  if (!lockout.lockedUntilMs) return 0;
  return Math.max(0, lockout.lockedUntilMs - Date.now());
}
