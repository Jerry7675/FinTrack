export type ScanErrorKind =
  | 'offline'
  | 'rate_limited'
  | 'too_large'
  | 'timeout'
  | 'unreadable'
  | 'server';

export type RateLimitScope = 'ip' | 'provider';

export type ScanFieldKey =
  | 'amount'
  | 'currency'
  | 'date'
  | 'merchant'
  | 'categoryHint';

export type ScanFieldsPayload = Record<ScanFieldKey, string | null>;

export type ScanResponse =
  | { ok: true; fields: ScanFieldsPayload }
  | {
      ok: false;
      error: ScanErrorKind;
      scope?: RateLimitScope;
      retryAfterSec?: number;
    }
  | { ok: false; error: 'cancelled' };

export type ScanBannerKind =
  | ScanErrorKind
  | 'photo_open'
  | 'camera_permission'
  | 'library_permission'
  | 'success'
  | 'offline_precheck';

export type AiFilledField = 'amount' | 'date' | 'title' | 'categoryId';
