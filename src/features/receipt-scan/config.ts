/** Scan endpoint; hidden in UI when unset. */
export function getReceiptScanUrl(): string | undefined {
  const url = process.env.EXPO_PUBLIC_RECEIPT_SCAN_URL?.trim();
  return url ? url : undefined;
}

export function isReceiptScanConfigured(): boolean {
  return getReceiptScanUrl() != null;
}

export const SCAN_TIMEOUT_MS = 30_000;
