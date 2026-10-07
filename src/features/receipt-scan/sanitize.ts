const CONTROL_AND_BIDI = /[\p{Cc}\u200B-\u200F\u202A-\u202E\u2066-\u2069]/gu;

/** Strip control and bidi override characters from model merchant text. */
export function cleanMerchantInput(raw: string): string {
  return raw.replace(CONTROL_AND_BIDI, '').replace(/\s+/g, ' ').trim();
}
