import type { LockMode, LockSecretV1 } from './storage';

export function isLockSecretComplete(
  secret: Partial<LockSecretV1> | null | undefined
): boolean {
  if (secret?.version !== 1) return false;
  if (secret.mode !== 'biometric' && secret.mode !== 'pin') return false;
  return Boolean(
    secret.pinSalt &&
      secret.pinHash &&
      secret.pinSalt.length > 0 &&
      secret.pinHash.length > 0
  );
}

export function parseLockSecretJson(raw: string): LockSecretV1 | null {
  try {
    const parsed = JSON.parse(raw) as Partial<LockSecretV1>;
    if (!isLockSecretComplete(parsed)) return null;
    return parsed as LockSecretV1;
  } catch {
    return null;
  }
}

export function lockModeRequiresBiometricsFirst(mode: LockMode): boolean {
  return mode === 'biometric';
}
