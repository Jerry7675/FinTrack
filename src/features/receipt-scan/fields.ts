export type ReceiptFieldDef = {
  key: 'amount' | 'currency' | 'date' | 'merchant' | 'categoryHint';
  description: string;
};

/** Static field list sent with every scan request (not user data). */
export const RECEIPT_FIELDS: ReceiptFieldDef[] = [
  {
    key: 'amount',
    description: 'Total paid as decimal string with dot, no grouping',
  },
  { key: 'currency', description: 'ISO 4217 currency code' },
  { key: 'date', description: 'Transaction date YYYY-MM-DD' },
  { key: 'merchant', description: 'Merchant or store name, max 120 chars' },
  {
    key: 'categoryHint',
    description: 'One expense category icon key from the app list',
  },
];
