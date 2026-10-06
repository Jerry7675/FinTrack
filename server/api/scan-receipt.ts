import { MAX_DECODED_JPEG_BYTES, MAX_REQUEST_BODY_BYTES } from '../config.js';
import { resolveClientIp } from '../lib/client-ip.js';
import {
  createOpenRouterClient,
  extractReceiptFields,
  type OpenRouterClient,
} from '../lib/extract.js';
import { errorResponse, jsonResponse } from '../lib/http.js';
import { decodeBase64Image, isJpegBuffer } from '../lib/jpeg.js';
import { logError } from '../lib/log.js';
import {
  allFieldsNull,
  parseModelJson,
  type ReceiptFields,
  sanitizeModelFields,
} from '../lib/output.js';
import { checkRateLimit } from '../lib/rate-limit.js';
import { fieldsMatchExpected, scanRequestSchema } from '../lib/validate.js';

export type ScanReceiptDeps = {
  getApiKey: () => string | undefined;
  createClient: (apiKey: string) => OpenRouterClient;
  extract: typeof extractReceiptFields;
  now?: () => number;
};

const defaultDeps: ScanReceiptDeps = {
  getApiKey: () => process.env.OPENROUTER_API_KEY,
  createClient: createOpenRouterClient,
  extract: extractReceiptFields,
};

export async function handleScanReceipt(
  request: Request,
  deps: ScanReceiptDeps = defaultDeps
): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response(null, { status: 405 });
  }

  const contentLength = Number(request.headers.get('content-length') ?? '0');
  if (contentLength > MAX_REQUEST_BODY_BYTES) {
    logError('too_large');
    return errorResponse(413, { error: 'too_large' });
  }

  const clientIp = resolveClientIp(request.headers);
  const rate = checkRateLimit(clientIp, deps.now?.() ?? Date.now());
  if (!rate.allowed) {
    logError('rate_limited');
    return errorResponse(
      429,
      {
        error: 'rate_limited',
        scope: 'ip',
        retryAfterSec: rate.retryAfterSec,
      },
      { 'Retry-After': String(rate.retryAfterSec) }
    );
  }

  let bodyText: string;
  try {
    bodyText = await request.text();
  } catch {
    logError('bad_request');
    return errorResponse(400, { error: 'server' });
  }

  if (bodyText.length > MAX_REQUEST_BODY_BYTES) {
    logError('too_large');
    return errorResponse(413, { error: 'too_large' });
  }

  let json: unknown;
  try {
    json = JSON.parse(bodyText) as unknown;
  } catch {
    logError('bad_request');
    return errorResponse(400, { error: 'server' });
  }

  const parsed = scanRequestSchema.safeParse(json);
  if (!parsed.success || !fieldsMatchExpected(parsed.data.fields)) {
    logError('bad_request');
    return errorResponse(400, { error: 'server' });
  }

  const decoded = decodeBase64Image(parsed.data.image.base64);
  if (!decoded || decoded.length > MAX_DECODED_JPEG_BYTES) {
    logError('too_large');
    return errorResponse(413, { error: 'too_large' });
  }
  if (!isJpegBuffer(decoded)) {
    logError('bad_request');
    return errorResponse(400, { error: 'server' });
  }

  const apiKey = deps.getApiKey();
  if (!apiKey) {
    logError('missing_api_key');
    return errorResponse(500, { error: 'server' });
  }

  const client = deps.createClient(apiKey);
  const extracted = await deps.extract(parsed.data.image.base64, client);
  if (!extracted.ok) {
    if (extracted.kind === 'provider_rate_limited') {
      logError('provider_rate_limited');
      const headers: Record<string, string> = {};
      if (extracted.retryAfterSec) {
        headers['Retry-After'] = String(extracted.retryAfterSec);
      }
      return errorResponse(
        429,
        {
          error: 'rate_limited',
          scope: 'provider',
          retryAfterSec: extracted.retryAfterSec,
        },
        headers
      );
    }
    logError('provider_error');
    return errorResponse(502, { error: 'server' });
  }

  let modelJson: unknown;
  try {
    modelJson = parseModelJson(extracted.content);
  } catch {
    logError('unreadable');
    return errorResponse(422, { error: 'unreadable' });
  }

  const fields = sanitizeModelFields(modelJson);

  if (allFieldsNull(fields)) {
    logError('unreadable');
    return errorResponse(422, { error: 'unreadable' });
  }

  return jsonResponse(200, { v: 1, fields });
}

export async function POST(request: Request): Promise<Response> {
  return handleScanReceipt(request);
}
