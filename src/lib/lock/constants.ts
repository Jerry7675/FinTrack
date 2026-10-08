export const LOCK_SECRET_KEY = 'fintrack_lock_secret_v1';
export const LOCKOUT_KEY = 'fintrack_lockout_v1';
/** @deprecated Migrated into {@link LOCK_SECRET_KEY}. */
export const LEGACY_PIN_MARKER_KEY = 'fintrack_pin';

export const MIN_PIN_LENGTH = 4;
export const MAX_PIN_LENGTH = 8;
export const MAX_PIN_ATTEMPTS = 5;
export const BASE_LOCKOUT_MS = 30_000;
export const PIN_KDF_ROUNDS = 12_000;
