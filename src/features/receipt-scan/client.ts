import { z } from 'zod';

import { getReceiptScanUrl, SCAN_TIMEOUT_MS } from './config';
import { RECEIPT_FIELDS } from './fields';
import type { RateLimitScope, ScanErrorKind, ScanResponse } from './types';

const successSchema = z.object({
  v: z.literal(1),
  fields: z
    .object({
      amount: z.string().nullable().optional(),
      currency: z.string().nullable().optional(),
      date: z.string().nullable().optional(),
      merchant: z.string().nullable().optional(),
      categoryHint: z.string().nullable().optional(),
    })
    .strip(),
});

const errorSchema = z.object({
  error: z.enum(['rate_limited', 'too_large', 'unreadable', 'server']),
  scope: z.enum(['ip', 'provider']).optional(),
  retryAfterSec: z.number().optional(),
});

function clampRetry(sec: number | undefined): number | undefined {
  if (sec == null || !Number.isFinite(sec)) return undefined;
  return Math.min(600, Math.max(1, Math.round(sec)));
}

function parseRetryAfterHeader(header: string | null): number | undefined {
  if (!header) return undefined;
  const n = Number(header);
  return clampRetry(n);
}

function networkFailure(signal: AbortSignal): boolean {
  return !signal.aborted;
}

export async function scanReceipt(
  imageBase64: string,
  signal?: AbortSignal
): Promise<ScanResponse> {
  const url = getReceiptScanUrl();
  if (!url) {
    return { ok: false, error: 'server' };
  }

  const controller = new AbortController();
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, SCAN_TIMEOUT_MS);
  const onAbort = () => controller.abort();
  signal?.addEventListener('abort', onAbort);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        v: 1,
        image: { mime: 'image/jpeg', base64: imageBase64 },
        fields: RECEIPT_FIELDS,
      }),
      signal: controller.signal,
    });

    if (signal?.aborted) {
      return { ok: false, error: 'cancelled' };
    }

    const retryHeader = parseRetryAfterHeader(res.headers.get('Retry-After'));

    let json: unknown;
    try {
      json = await res.json();
    } catch {
      return { ok: false, error: 'server' };
    }

    if (res.status === 429) {
      const parsed = errorSchema.safeParse(json);
      const scope: RateLimitScope =
        parsed.success && parsed.data.scope === 'ip' ? 'ip' : 'provider';
      const retryAfterSec =
        clampRetry(parsed.success ? parsed.data.retryAfterSec : undefined) ??
        retryHeader;
      return {
        ok: false,
        error: 'rate_limited',
        scope,
        retryAfterSec,
      };
    }

    if (res.status === 413) {
      return { ok: false, error: 'too_large' };
    }

    if (res.status === 422) {
      return { ok: false, error: 'unreadable' };
    }

    if (!res.ok) {
      const parsed = errorSchema.safeParse(json);
      if (parsed.success) {
        const kind = parsed.data.error as ScanErrorKind;
        if (kind === 'rate_limited') {
          return {
            ok: false,
            error: 'rate_limited',
            scope: parsed.data.scope === 'ip' ? 'ip' : 'provider',
            retryAfterSec: clampRetry(parsed.data.retryAfterSec) ?? retryHeader,
          };
        }
        if (
          kind === 'too_large' ||
          kind === 'unreadable' ||
          kind === 'server'
        ) {
          return { ok: false, error: kind };
        }
      }
      return { ok: false, error: 'server' };
    }

    const parsed = successSchema.safeParse(json);
    if (!parsed.success) {
      return { ok: false, error: 'server' };
    }

    const f = parsed.data.fields;
    return {
      ok: true,
      fields: {
        amount: f.amount ?? null,
        currency: f.currency ?? null,
        date: f.date ?? null,
        merchant: f.merchant ?? null,
        categoryHint: f.categoryHint ?? null,
      },
    };
  } catch (e) {
    if (
      (signal?.aborted || (e instanceof Error && e.name === 'AbortError')) &&
      !timedOut
    ) {
      return { ok: false, error: 'cancelled' };
    }
    if (timedOut) {
      return { ok: false, error: 'timeout' };
    }
    if (networkFailure(controller.signal)) {
      return { ok: false, error: 'offline' };
    }
    return { ok: false, error: 'server' };
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', onAbort);
  }
}
