import { z } from 'zod';

export const transactionInputSchema = z.object({
  accountId: z.string().min(1),
  categoryId: z.string().nullable().optional(),
  type: z.enum(['expense', 'income']),
  amount: z.number().positive(),
  currencyCode: z.string().length(3),
  title: z.string().min(1).max(120),
  note: z.string().max(500).optional(),
  tagNames: z.array(z.string().min(1).max(40)).optional(),
});

export const accountInputSchema = z.object({
  groupId: z.string().min(1),
  name: z.string().min(1).max(80),
  currencyCode: z.string().length(3),
  type: z.enum(['cash', 'bank', 'wallet', 'credit', 'other']).optional(),
});

export const groupInputSchema = z.object({
  name: z.string().min(1).max(80),
  icon: z.string().optional(),
});
