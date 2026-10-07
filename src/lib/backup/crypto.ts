import {
  AESEncryptionKey,
  AESSealedData,
  aesDecryptAsync,
  aesEncryptAsync,
  CryptoDigestAlgorithm,
  digestStringAsync,
  getRandomBytesAsync,
} from 'expo-crypto';

import {
  ENC_PREFIX_V2,
  ENC_PREFIX_V3,
  KDF_ROUNDS_V2,
  KDF_ROUNDS_V3,
} from './constants';

export { KDF_ROUNDS_V2, KDF_ROUNDS_V3 };

export type EncBackupFormat = {
  prefix: string;
  saltHex: string;
  cipherB64: string;
};

export function parseEncBackupBlob(raw: string): EncBackupFormat {
  const trimmed = raw.trim();
  const parts = trimmed.split('.');
  if (parts.length !== 3) {
    throw new Error('Not an encrypted FinTrack backup');
  }
  const [prefix, saltHex, cipherB64] = parts;
  if (prefix !== ENC_PREFIX_V2 && prefix !== ENC_PREFIX_V3) {
    throw new Error('Not an encrypted FinTrack backup');
  }
  if (!/^[0-9a-f]+$/i.test(saltHex) || saltHex.length !== 32) {
    throw new Error('Not an encrypted FinTrack backup');
  }
  return { prefix, saltHex, cipherB64 };
}

export function kdfRoundsForPrefix(prefix: string): number {
  if (prefix === ENC_PREFIX_V2) return KDF_ROUNDS_V2;
  if (prefix === ENC_PREFIX_V3) return KDF_ROUNDS_V3;
  throw new Error('Unsupported encryption format');
}

/**
 * Password-based key for backup encryption (not PBKDF2).
 * Iterated SHA-256: each round replaces material with SHA-256(material).
 * FTENC2 uses 2 000 rounds; FTENC3 uses 120 000. A future FTENC4 may adopt PBKDF2-HMAC-SHA256.
 */
export async function deriveBackupKeyHex(
  password: string,
  saltHex: string,
  rounds: number
): Promise<string> {
  let material = `${password}:${saltHex}`;
  for (let i = 0; i < rounds; i++) {
    material = await digestStringAsync(CryptoDigestAlgorithm.SHA256, material);
  }
  return material;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return globalThis.btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = globalThis.atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

export async function sealBackupPlaintext(
  plaintext: Uint8Array,
  password: string,
  prefix: string,
  rounds: number,
  saltBytes?: Uint8Array
): Promise<string> {
  const salt = saltBytes ?? (await getRandomBytesAsync(16));
  const saltHex = Array.from(salt)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  const keyHex = await deriveBackupKeyHex(password, saltHex, rounds);
  const key = await AESEncryptionKey.import(keyHex, 'hex');
  const sealed = await aesEncryptAsync(plaintext, key);
  const combined = await sealed.combined();
  return `${prefix}.${saltHex}.${bytesToBase64(combined)}`;
}

export async function openBackupCiphertext(
  raw: string,
  password: string
): Promise<Uint8Array> {
  const { prefix, saltHex, cipherB64 } = parseEncBackupBlob(raw);
  const rounds = kdfRoundsForPrefix(prefix);
  const keyHex = await deriveBackupKeyHex(password, saltHex, rounds);
  const key = await AESEncryptionKey.import(keyHex, 'hex');
  const sealed = AESSealedData.fromCombined(base64ToBytes(cipherB64));
  try {
    return await aesDecryptAsync(sealed, key);
  } catch {
    throw new Error('Wrong password or corrupted backup');
  }
}
