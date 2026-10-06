import * as SecureStore from 'expo-secure-store';

const CONSENT_KEY = 'fintrack_receipt_scan';

export const CONSENT_VERSION = 2;

export type ReceiptScanConsent = {
  enabled: boolean;
  consentVersion: number;
  consentedAt: number;
};

export async function readReceiptScanConsent(): Promise<ReceiptScanConsent | null> {
  try {
    const raw = await SecureStore.getItemAsync(CONSENT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ReceiptScanConsent;
    if (
      typeof parsed.enabled !== 'boolean' ||
      typeof parsed.consentVersion !== 'number' ||
      typeof parsed.consentedAt !== 'number'
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function isConsentActive(record: ReceiptScanConsent | null): boolean {
  if (!record?.enabled) return false;
  return record.consentVersion >= CONSENT_VERSION;
}

export async function setReceiptScanConsentEnabled(
  enabled: boolean
): Promise<void> {
  if (!enabled) {
    await SecureStore.setItemAsync(
      CONSENT_KEY,
      JSON.stringify({
        enabled: false,
        consentVersion: CONSENT_VERSION,
        consentedAt: Date.now(),
      })
    );
    return;
  }
  await SecureStore.setItemAsync(
    CONSENT_KEY,
    JSON.stringify({
      enabled: true,
      consentVersion: CONSENT_VERSION,
      consentedAt: Date.now(),
    })
  );
}
