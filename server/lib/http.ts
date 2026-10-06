export type ErrorBody = {
  error: 'rate_limited' | 'too_large' | 'unreadable' | 'server';
  scope?: 'ip' | 'provider';
  retryAfterSec?: number;
};

export function jsonResponse(
  status: number,
  body: unknown,
  extraHeaders?: Record<string, string>
): Response {
  const headers: Record<string, string> = {
    'content-type': 'application/json; charset=utf-8',
    ...extraHeaders,
  };
  return new Response(JSON.stringify(body), { status, headers });
}

export function errorResponse(
  status: number,
  body: ErrorBody,
  extraHeaders?: Record<string, string>
): Response {
  return jsonResponse(status, body, extraHeaders);
}
