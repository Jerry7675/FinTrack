export type LogKind =
  | 'bad_request'
  | 'too_large'
  | 'rate_limited'
  | 'missing_api_key'
  | 'provider_rate_limited'
  | 'provider_error'
  | 'unreadable'
  | 'internal';

/** Safe logging: error kind only — never IP, image, model output, or keys. */
export function logError(kind: LogKind): void {
  console.error(`[receipt-scan] ${kind}`);
}
