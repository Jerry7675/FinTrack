/**
 * @jest-environment node
 */

import type { ChatResult } from '@openrouter/sdk/models';

import { extractReceiptFields, type OpenRouterClient } from '../lib/extract';
import { paymentRequiredError, tooManyRequestsError } from './sdk-errors';

function mockClient(send: OpenRouterClient['chat']['send']): OpenRouterClient {
  return { chat: { send } };
}

function chatResult(content: string): ChatResult {
  return {
    id: 'id',
    object: 'chat.completion',
    created: 0,
    model: 'test',
    systemFingerprint: null,
    choices: [
      {
        index: 0,
        finishReason: 'stop',
        message: { role: 'assistant', content },
      },
    ],
  };
}

describe('extractReceiptFields', () => {
  it('maps PaymentRequiredResponseError (402) to provider_rate_limited', async () => {
    const send = jest
      .fn()
      .mockRejectedValue(
        paymentRequiredError(60)
      ) as OpenRouterClient['chat']['send'];
    const result = await extractReceiptFields('abc', mockClient(send));
    expect(result).toEqual({
      ok: false,
      kind: 'provider_rate_limited',
      retryAfterSec: 60,
    });
  });

  it('maps TooManyRequestsResponseError (429) to provider_rate_limited', async () => {
    const send = jest
      .fn()
      .mockRejectedValue(
        tooManyRequestsError(30)
      ) as OpenRouterClient['chat']['send'];
    const result = await extractReceiptFields('abc', mockClient(send));
    expect(result).toEqual({
      ok: false,
      kind: 'provider_rate_limited',
      retryAfterSec: 30,
    });
  });

  it('uses typed chatRequest with imageUrl and fixed prompts', async () => {
    const send = jest
      .fn()
      .mockResolvedValue(chatResult('{}')) as OpenRouterClient['chat']['send'];
    await extractReceiptFields('abc', mockClient(send));
    expect(send).toHaveBeenCalledTimes(1);
    const [request, options] = (send as jest.Mock).mock.calls[0] ?? [];
    expect(request?.chatRequest.maxTokens).toBeDefined();
    expect(request?.chatRequest.responseFormat).toEqual({
      type: 'json_object',
    });
    expect(options?.timeoutMs).toBeGreaterThan(0);
    const messages = request?.chatRequest.messages ?? [];
    const user = messages.find((m: { role: string }) => m.role === 'user');
    const parts = Array.isArray(user?.content) ? user.content : [];
    const imagePart = parts.find(
      (p: { type: string }) => p.type === 'image_url'
    );
    expect(
      imagePart && 'imageUrl' in imagePart && imagePart.imageUrl.url
    ).toContain('data:image/jpeg;base64,abc');
    const system = messages.find((m: { role: string }) => m.role === 'system');
    expect(String(system?.content)).toContain('categoryHint');
    expect(String(system?.content)).not.toContain('client description');
  });
});
