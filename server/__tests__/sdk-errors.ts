import {
  PaymentRequiredResponseError,
  TooManyRequestsResponseError,
} from '@openrouter/sdk/models/errors';

function httpMeta(status: number, headers?: Headers) {
  const response = new Response('', { status, headers });
  const request = new Request('https://openrouter.ai/api/v1/chat/completions');
  return { response, request, body: '' };
}

export function paymentRequiredError(
  retryAfterSec?: number
): PaymentRequiredResponseError {
  const headers = retryAfterSec
    ? new Headers({ 'retry-after': String(retryAfterSec) })
    : undefined;
  return new PaymentRequiredResponseError(
    { error: { code: 402, message: 'Payment required' } },
    httpMeta(402, headers)
  );
}

export function tooManyRequestsError(
  retryAfterSec?: number
): TooManyRequestsResponseError {
  const headers = retryAfterSec
    ? new Headers({ 'retry-after': String(retryAfterSec) })
    : undefined;
  return new TooManyRequestsResponseError(
    { error: { code: 429, message: 'Too many requests' } },
    httpMeta(429, headers)
  );
}
