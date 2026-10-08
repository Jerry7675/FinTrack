import {
  CryptoDigestAlgorithm,
  digestStringAsync,
  getRandomBytesAsync,
} from 'expo-crypto';

import {
  BASE_LOCKOUT_MS,
  MAX_PIN_ATTEMPTS,
  MAX_PIN_LENGTH,
  MIN_PIN_LENGTH,
  PIN_KDF_ROUNDS,
} from './constants';

export function normalizePinInput(raw: string): string {
  return raw.replace(/\D/g, '');
}

export function isValidPinFormat(pin: string): boolean {
  const digits = normalizePinInput(pin);
  return digits.length >= MIN_PIN_LENGTH && digits.length <= MAX_PIN_LENGTH;
}

export async function hashPin(pin: string, saltHex: string): Promise<string> {
  const normalized = normalizePinInput(pin);
  let material = `fintrack-pin:${normalized}:${saltHex}`;
  for (let i = 0; i < PIN_KDF_ROUNDS; i++) {
    material = await digestStringAsync(CryptoDigestAlgorithm.SHA256, material);
  }
  return material;
}

export async function createPinRecord(pin: string): Promise<{
  pinSalt: string;
  pinHash: string;
}> {
  const salt = await getRandomBytesAsync(16);
  const pinSalt = Array.from(salt)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  const pinHash = await hashPin(pin, pinSalt);
  return { pinSalt, pinHash };
}

export function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export async function verifyPinAgainstRecord(
  pin: string,
  pinSalt: string,
  pinHash: string
): Promise<boolean> {
  const candidate = await hashPin(pin, pinSalt);
  return timingSafeEqualHex(candidate, pinHash);
}

export function lockoutDelayMs(failedAttempts: number): number {
  if (failedAttempts < MAX_PIN_ATTEMPTS) return 0;
  const exponent = Math.min(failedAttempts - MAX_PIN_ATTEMPTS, 4);
  return BASE_LOCKOUT_MS * 2 ** exponent;
}
