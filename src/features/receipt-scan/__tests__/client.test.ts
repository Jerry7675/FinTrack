import { scanReceipt } from '../client';
import { RECEIPT_FIELDS } from '../fields';

const originalFetch = global.fetch;

describe('scanReceipt', () => {
  beforeEach(() => {
    process.env.EXPO_PUBLIC_RECEIPT_SCAN_URL =
      'https://example.com/api/scan-receipt';
  });

  afterEach(() => {
    global.fetch = originalFetch;
    delete process.env.EXPO_PUBLIC_RECEIPT_SCAN_URL;
  });

  it('sends only v, image, and fields keys', async () => {
    let body: Record<string, unknown> = {};
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => ({
        v: 1,
        fields: {
          amount: '1.00',
          currency: 'USD',
          date: null,
          merchant: null,
          categoryHint: null,
        },
      }),
    }) as typeof fetch;

    const res = await scanReceipt('abc123');
    expect(res.ok).toBe(true);
    const call = (global.fetch as jest.Mock).mock.calls[0];
    body = JSON.parse(call[1].body as string);
    expect(Object.keys(body).sort()).toEqual(['fields', 'image', 'v']);
    expect(body.fields).toEqual(RECEIPT_FIELDS);
    expect(body.image).toEqual({ mime: 'image/jpeg', base64: 'abc123' });
  });

  it('maps 429 ip scope', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 429,
      headers: { get: () => '30' },
      json: async () => ({
        error: 'rate_limited',
        scope: 'ip',
        retryAfterSec: 30,
      }),
    }) as typeof fetch;

    const res = await scanReceipt('x');
    expect(res).toEqual({
      ok: false,
      error: 'rate_limited',
      scope: 'ip',
      retryAfterSec: 30,
    });
  });
});
