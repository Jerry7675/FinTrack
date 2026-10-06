/**
 * Client IP for rate limiting only (never logged).
 * Prefer Vercel's x-real-ip; else rightmost x-forwarded-for (not leftmost — spoofable).
 */
export function resolveClientIp(headers: Headers): string {
  const realIp = headers.get('x-real-ip')?.trim();
  if (realIp) {
    return realIp;
  }
  const xff = headers.get('x-forwarded-for');
  if (xff) {
    const parts = xff
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);
    if (parts.length > 0) {
      return parts[parts.length - 1];
    }
  }
  return 'unknown';
}
