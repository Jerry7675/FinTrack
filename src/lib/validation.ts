import { z } from 'zod';
import { MAX_MINOR } from './money';

/** Shared limits for transaction forms and `transactionInputSchema`. */
export const TRANSACTION_LIMITS = {
  titleMax: 120,
  noteMax: 500,
  tagMax: 40,
} as const;

export const transactionInputSchema = z.object({
  accountId: z.string().min(1),
  categoryId: z.string().nullable().optional(),
  type: z.enum(['expense', 'income']),
  amountMinor: z
    .number()
    .int()
    .positive()
    .max(MAX_MINOR - 1),
  amount: z.number().positive().optional(),
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
