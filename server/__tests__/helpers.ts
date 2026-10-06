import { RECEIPT_FIELD_KEYS } from '../config';

/** Minimal valid JPEG (SOI + JFIF stub + EOI). */
export const MINIMAL_JPEG_BYTES = Uint8Array.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01,
  0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xff, 0xd9,
]);

export function minimalJpegBase64(): string {
  return Buffer.from(MINIMAL_JPEG_BYTES).toString('base64');
}

export function validFieldsPayload() {
  return RECEIPT_FIELD_KEYS.map((key) => ({
    key,
    description: 'CLIENT_INJECTED_SHOULD_NOT_APPEAR_IN_PROMPT',
  }));
}

export function buildScanBody(overrides?: {
  base64?: string;
  fields?: ReturnType<typeof validFieldsPayload>;
}) {
  return {
    v: 1 as const,
    image: {
      mime: 'image/jpeg' as const,
      base64: overrides?.base64 ?? minimalJpegBase64(),
    },
    fields: overrides?.fields ?? validFieldsPayload(),
  };
}

export function postScan(
  body: unknown,
  headers: Record<string, string> = {}
): Request {
  return new Request('https://example.com/api/scan-receipt', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-real-ip': '203.0.113.10',
      ...headers,
    },
    body: JSON.stringify(body),
  });
}
