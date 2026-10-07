export const BACKUP_SCHEMA_VERSION = 1;
/** Pre-hardening encrypted backup format (SHA-256 × 2 000 KDF). */
export const ENC_PREFIX_V2 = 'FTENC2';
/** Current encrypted backup format (SHA-256 × 120 000 KDF). */
export const ENC_PREFIX_V3 = 'FTENC3';
/** Prefix used for newly exported encrypted backups. */
export const ENC_PREFIX = ENC_PREFIX_V3;
export const LEGACY_ENC_PREFIX = 'FTENC1';
export const MIN_BACKUP_PASSWORD_LENGTH = 8;
export const KDF_ROUNDS_V2 = 2000;
export const KDF_ROUNDS_V3 = 120_000;

export const SUPPORTED_ENC_PREFIXES = [ENC_PREFIX_V2, ENC_PREFIX_V3] as const;

export function isEncryptedBackupBlob(raw: string): boolean {
  const trimmed = raw.trim();
  if (trimmed.startsWith(`${LEGACY_ENC_PREFIX}.`)) return true;
  return SUPPORTED_ENC_PREFIXES.some((p) => trimmed.startsWith(`${p}.`));
}
