/** Pinned free vision model (verified via OpenRouter /api/v1/models, 2026-10-06). */
export const DEFAULT_OPENROUTER_MODEL = 'google/gemma-4-31b-it:free';

export function getOpenRouterModel(): string {
  return process.env.OPENROUTER_MODEL?.trim() || DEFAULT_OPENROUTER_MODEL;
}

/** ~3 MB JSON body cap (app sends ~1.5 MB JPEG base64). */
export const MAX_REQUEST_BODY_BYTES = 3 * 1024 * 1024;

/** Decoded JPEG cap (~2 MB). */
export const MAX_DECODED_JPEG_BYTES = 2 * 1024 * 1024;

export const RATE_LIMIT_MAX_REQUESTS = 10;
export const RATE_LIMIT_WINDOW_MS = 60_000;

/** Max distinct IPs tracked in memory before evicting oldest. */
export const RATE_LIMIT_MAX_TRACKED_IPS = 10_000;

export const PROVIDER_TIMEOUT_MS = 25_000;
export const PROVIDER_MAX_TOKENS = 512;
export const PROVIDER_TEMPERATURE = 0.1;

/** Raw string caps before semantic validation (spec §7.1). */
export const RAW_FIELD_CAPS = {
  amount: 32,
  currency: 8,
  date: 10,
  merchant: 300,
  categoryHint: 32,
} as const;

export const MERCHANT_MAX_CHARS = 120;

export const ALLOWED_CATEGORY_HINTS = [
  'food',
  'transport',
  'shopping',
  'home',
  'health',
  'entertainment',
  'bills',
  'education',
  'travel',
  'saas',
  'cloud',
  'hardware',
  'internet',
  'office',
  'contractor',
  'marketing',
  'training',
  'domains',
  'other',
] as const;

export type ReceiptFieldKey =
  | 'amount'
  | 'currency'
  | 'date'
  | 'merchant'
  | 'categoryHint';

export const RECEIPT_FIELD_KEYS: ReceiptFieldKey[] = [
  'amount',
  'currency',
  'date',
  'merchant',
  'categoryHint',
];
