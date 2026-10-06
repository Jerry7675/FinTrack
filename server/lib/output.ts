import { z } from 'zod';

import {
  ALLOWED_CATEGORY_HINTS,
  MERCHANT_MAX_CHARS,
  RAW_FIELD_CAPS,
  type ReceiptFieldKey,
} from '../config';

const CONTROL_AND_BIDI = /[\p{Cc}\u200B-\u200F\u202A-\u202E\u2066-\u2069]/gu;

export type ReceiptFields = Record<ReceiptFieldKey, string | null>;

const rawFieldSchema = z
  .object({
    amount: z.string().nullable().optional(),
    currency: z.string().nullable().optional(),
    date: z.string().nullable().optional(),
    merchant: z.string().nullable().optional(),
    categoryHint: z.string().nullable().optional(),
  })
  .strip();

function stripControlChars(value: string): string {
  return value.replace(CONTROL_AND_BIDI, '');
}

export function capRaw(
  value: string | null | undefined,
  max: number
): string | null {
  if (value == null) {
    return null;
  }
  if (value.length > max) {
    return null;
  }
  return value;
}

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

const AMOUNT_PATTERN = /^\d{1,13}(\.\d{1,3})?$/;

function validateAmount(raw: string | null): string | null {
  if (raw == null) {
    return null;
  }
  if (!AMOUNT_PATTERN.test(raw)) {
    return null;
  }
  const n = Number.parseFloat(raw);
  if (!Number.isFinite(n) || n <= 0) {
    return null;
  }
  return raw;
}

function validateCurrency(raw: string | null): string | null {
  if (raw == null) {
    return null;
  }
  const upper = raw.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(upper)) {
    return null;
  }
  return upper;
}

function isValidCalendarDate(iso: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) {
    return false;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1) {
    return false;
  }
  const d = new Date(Date.UTC(year, month - 1, day));
  return (
    d.getUTCFullYear() === year &&
    d.getUTCMonth() === month - 1 &&
    d.getUTCDate() === day
  );
}

function validateDate(raw: string | null): string | null {
  if (raw == null) {
    return null;
  }
  const trimmed = raw.trim();
  if (!isValidCalendarDate(trimmed)) {
    return null;
  }
  return trimmed;
}

function validateMerchant(raw: string | null): string | null {
  if (raw == null) {
    return null;
  }
  const cleaned = collapseWhitespace(stripControlChars(raw));
  if (cleaned.length < 1 || cleaned.length > MERCHANT_MAX_CHARS) {
    return null;
  }
  return cleaned;
}

function validateCategoryHint(raw: string | null): string | null {
  if (raw == null) {
    return null;
  }
  const trimmed = raw.trim().toLowerCase();
  if (!(ALLOWED_CATEGORY_HINTS as readonly string[]).includes(trimmed)) {
    return null;
  }
  return trimmed;
}

export function parseModelJson(text: string): unknown {
  const trimmed = text.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)```$/i.exec(trimmed);
  const inner = fence ? fence[1].trim() : trimmed;
  return JSON.parse(inner) as unknown;
}

export function sanitizeModelFields(parsed: unknown): ReceiptFields {
  const obj = rawFieldSchema.parse(parsed);

  const amountRaw = capRaw(
    obj.amount == null ? null : stripControlChars(String(obj.amount)),
    RAW_FIELD_CAPS.amount
  );
  const currencyRaw = capRaw(
    obj.currency == null ? null : stripControlChars(String(obj.currency)),
    RAW_FIELD_CAPS.currency
  );
  const dateRaw = capRaw(
    obj.date == null ? null : stripControlChars(String(obj.date)),
    RAW_FIELD_CAPS.date
  );
  const merchantRaw = capRaw(
    obj.merchant == null ? null : stripControlChars(String(obj.merchant)),
    RAW_FIELD_CAPS.merchant
  );
  const categoryRaw = capRaw(
    obj.categoryHint == null
      ? null
      : stripControlChars(String(obj.categoryHint)),
    RAW_FIELD_CAPS.categoryHint
  );

  return {
    amount: validateAmount(amountRaw),
    currency: validateCurrency(currencyRaw),
    date: validateDate(dateRaw),
    merchant: validateMerchant(merchantRaw),
    categoryHint: validateCategoryHint(categoryRaw),
  };
}

export function allFieldsNull(fields: ReceiptFields): boolean {
  return Object.values(fields).every((v) => v == null);
}
