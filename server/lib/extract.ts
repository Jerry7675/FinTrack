import { OpenRouter } from '@openrouter/sdk';

import {
  getOpenRouterModel,
  PROVIDER_MAX_TOKENS,
  PROVIDER_TEMPERATURE,
  PROVIDER_TIMEOUT_MS,
} from '../config';
import { buildSystemPrompt, buildUserPrompt } from './prompt';

export type ExtractResult =
  | { ok: true; content: string }
  | { ok: false; kind: 'provider_rate_limited'; retryAfterSec?: number }
  | { ok: false; kind: 'provider_error' };

export type OpenRouterClient = {
  chat: {
    send: (args: Record<string, unknown>) => Promise<unknown>;
  };
};

export function createOpenRouterClient(apiKey: string): OpenRouterClient {
  return new OpenRouter({ apiKey }) as unknown as OpenRouterClient;
}

function getRetryAfterSec(error: unknown): number | undefined {
  if (error && typeof error === 'object' && 'headers' in error) {
    const headers = (error as { headers?: Record<string, string> }).headers;
    const raw = headers?.['retry-after'] ?? headers?.['Retry-After'];
    if (raw) {
      const sec = Number.parseInt(String(raw), 10);
      if (Number.isFinite(sec)) {
        return Math.min(600, Math.max(1, sec));
      }
    }
  }
  return undefined;
}

function isRateOrCreditError(status: number): boolean {
  return status === 429 || status === 402;
}

export async function extractReceiptFields(
  imageBase64: string,
  client: OpenRouterClient,
  model = getOpenRouterModel()
): Promise<ExtractResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);

  try {
    const response = await client.chat.send({
      model,
      messages: [
        { role: 'system', content: buildSystemPrompt() },
        {
          role: 'user',
          content: [
            { type: 'text', text: buildUserPrompt() },
            {
              type: 'image_url',
              image_url: {
                url: `data:image/jpeg;base64,${imageBase64}`,
              },
            },
          ],
        },
      ],
      temperature: PROVIDER_TEMPERATURE,
      max_tokens: PROVIDER_MAX_TOKENS,
      response_format: { type: 'json_object' },
      signal: controller.signal,
    });

    const content = extractTextContent(response);
    if (!content) {
      return { ok: false, kind: 'provider_error' };
    }
    return { ok: true, content };
  } catch (error) {
    const status =
      error &&
      typeof error === 'object' &&
      'status' in error &&
      typeof (error as { status: unknown }).status === 'number'
        ? (error as { status: number }).status
        : 0;

    if (isRateOrCreditError(status)) {
      return {
        ok: false,
        kind: 'provider_rate_limited',
        retryAfterSec: getRetryAfterSec(error),
      };
    }
    return { ok: false, kind: 'provider_error' };
  } finally {
    clearTimeout(timer);
  }
}

function extractTextContent(response: unknown): string | null {
  if (!response || typeof response !== 'object') {
    return null;
  }
  const choices = (response as { choices?: unknown[] }).choices;
  const first = choices?.[0];
  if (!first || typeof first !== 'object') {
    return null;
  }
  const message = (first as { message?: { content?: unknown } }).message;
  const content = message?.content;
  if (typeof content === 'string') {
    return content;
  }
  if (Array.isArray(content)) {
    const textPart = content.find(
      (p) =>
        p && typeof p === 'object' && (p as { type?: string }).type === 'text'
    ) as { text?: string } | undefined;
    return textPart?.text ?? null;
  }
  return null;
}
