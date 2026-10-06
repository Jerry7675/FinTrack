/**
 * @jest-environment node
 */

import { extractReceiptFields } from '../lib/extract';

describe('extractReceiptFields', () => {
  it('maps OpenRouter 402 to provider_rate_limited', async () => {
    const client = {
      chat: {
        send: jest.fn().mockRejectedValue({ status: 402 }),
      },
    };
    const result = await extractReceiptFields('abc', client);
    expect(result).toEqual({ ok: false, kind: 'provider_rate_limited' });
  });

  it('uses fixed prompts and does not embed client field descriptions', async () => {
    const send = jest.fn().mockResolvedValue({
      choices: [{ message: { content: '{}' } }],
    });
    const client = { chat: { send } };
    await extractReceiptFields('abc', client);
    const args = send.mock.calls[0]?.[0] as {
      messages?: { role: string; content: unknown }[];
    };
    const system = args.messages?.find((m) => m.role === 'system')?.content;
    const userText = (
      args.messages?.find((m) => m.role === 'user')?.content as
        | { type: string; text?: string }[]
        | undefined
    )?.find((p) => p.type === 'text')?.text;
    expect(String(system)).toContain('categoryHint');
    expect(String(userText)).not.toContain('client description');
    expect(String(system)).not.toContain('client description');
  });
});
