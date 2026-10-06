import { z } from 'zod';

import { RECEIPT_FIELD_KEYS } from '../config';

const fieldDefSchema = z.object({
  key: z.enum(['amount', 'currency', 'date', 'merchant', 'categoryHint']),
  description: z.string().max(200),
});

export const scanRequestSchema = z.object({
  v: z.literal(1),
  image: z.object({
    mime: z.literal('image/jpeg'),
    base64: z.string().min(1),
  }),
  fields: z.array(fieldDefSchema).length(RECEIPT_FIELD_KEYS.length),
});

export type ScanRequest = z.infer<typeof scanRequestSchema>;

/** Client `fields` must match known keys only (order-independent). */
export function fieldsMatchExpected(fields: ScanRequest['fields']): boolean {
  const keys = fields.map((f) => f.key).sort();
  const expected = [...RECEIPT_FIELD_KEYS].sort();
  return keys.every((k, i) => k === expected[i]);
}
