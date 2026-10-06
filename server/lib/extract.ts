import { OpenRouter } from '@openrouter/sdk';
import {
  OpenRouterError,
  PaymentRequiredResponseError,
  TooManyRequestsResponseError,
} from '@openrouter/sdk/models/errors';
import type { SendChatCompletionRequestResponse } from '@openrouter/sdk/models/operations';

import {
  getOpenRouterModel,
  PROVIDER_MAX_TOKENS,
  PROVIDER_TEMPERATURE,
  PROVIDER_TIMEOUT_MS,
} from '../config.js';
import { buildSystemPrompt, buildUserPrompt } from './prompt.js';

export type ExtractResult =
  | { ok: true; content: string }
  | { ok: false; kind: 'provider_rate_limited'; retryAfterSec?: number }
  | { ok: false; kind: 'provider_error' };

export type OpenRouterClient = {
  chat: {
    send: OpenRouter['chat']['send'];
  };
};

export function createOpenRouterClient(apiKey: string): OpenRouterClient {
  return new OpenRouter({ apiKey });
}

function getRetryAfterSec(error: unknown): number | undefined {
  if (!(error instanceof OpenRouterError)) {
    return undefined;
  }
  const raw = error.headers.get('retry-after');
  if (!raw) {
    return undefined;
  }
  const sec = Number.parseInt(raw, 10);
  if (!Number.isFinite(sec)) {
    return undefined;
  }
  return Math.min(600, Math.max(1, sec));
}

function isProviderRateLimitError(error: unknown): boolean {
  if (
    error instanceof TooManyRequestsResponseError ||
    error instanceof PaymentRequiredResponseError
  ) {
    return true;
  }
  return (
    error instanceof OpenRouterError &&
    (error.statusCode === 429 || error.statusCode === 402)
  );
}

export async function extractReceiptFields(
  imageBase64: string,
  client: OpenRouterClient,
  model = getOpenRouterModel()
): Promise<ExtractResult> {
  try {
    const response = await client.chat.send(
      {
        chatRequest: {
          model,
          messages: [
            { role: 'system', content: buildSystemPrompt() },
            {
              role: 'user',
              content: [
                { type: 'text', text: buildUserPrompt() },
                {
                  type: 'image_url',
                  imageUrl: {
                    url: `data:image/jpeg;base64,${imageBase64}`,
                  },
                },
              ],
            },
          ],
          temperature: PROVIDER_TEMPERATURE,
          maxTokens: PROVIDER_MAX_TOKENS,
          responseFormat: { type: 'json_object' },
        },
      },
      {
        timeoutMs: PROVIDER_TIMEOUT_MS,
        retries: { strategy: 'none' },
        signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
      }
    );

    const content = extractTextContent(response);
    if (!content) {
      return { ok: false, kind: 'provider_error' };
    }
    return { ok: true, content };
  } catch (error) {
    if (isProviderRateLimitError(error)) {
      return {
        ok: false,
        kind: 'provider_rate_limited',
        retryAfterSec: getRetryAfterSec(error),
      };
    }
    return { ok: false, kind: 'provider_error' };
  }
}

function extractTextContent(
  response: SendChatCompletionRequestResponse
): string | null {
  if (!('choices' in response)) {
    return null;
  }
  const content = response.choices[0]?.message?.content;
  if (typeof content === 'string') {
    return content;
  }
  if (Array.isArray(content)) {
    const textPart = content.find(
      (part) => part.type === 'text' && 'text' in part
    );
    if (textPart && 'text' in textPart && typeof textPart.text === 'string') {
      return textPart.text;
    }
  }
  return null;
}
