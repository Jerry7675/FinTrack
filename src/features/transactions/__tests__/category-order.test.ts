import { describe, expect, it } from '@jest/globals';

import {
  defaultCategoryIdFromOrder,
  orderCategoriesForQuickAdd,
} from '@/features/transactions/category-order';
import type { Category } from '@/lib/db/schema';

const baseCat = (id: string, sortOrder: number, name = id): Category => ({
  id,
  name,
  kind: 'expense',
  iconKey: 'ellipse',
  color: '#000',
  isDefault: false,
  sortOrder,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
});

describe('orderCategoriesForQuickAdd', () => {
  const cats = [
    baseCat('a', 0, 'Alpha'),
    baseCat('b', 1, 'Beta'),
    baseCat('c', 2, 'Gamma'),
  ];

  it('puts last-used category first even when sortOrder differs', () => {
    const ordered = orderCategoriesForQuickAdd(
      cats,
      [
        { categoryId: 'b', count: 1, lastUsedAt: new Date() },
        { categoryId: 'c', count: 5, lastUsedAt: new Date() },
      ],
      'a'
    );
    expect(ordered.map((c) => c.id)).toEqual(['a', 'c', 'b']);
  });

  it('orders never-used by sortOrder', () => {
    const ordered = orderCategoriesForQuickAdd(cats, [], null);
    expect(ordered.map((c) => c.id)).toEqual(['a', 'b', 'c']);
  });
});

describe('defaultCategoryIdFromOrder', () => {
  it('prefers last used when present in ordered list', () => {
    const cats = [baseCat('a', 0), baseCat('b', 1)];
    expect(defaultCategoryIdFromOrder(cats, 'b')).toBe('b');
  });

  it('falls back to first ordered chip, not silent sortOrder only', () => {
    const ordered = orderCategoriesForQuickAdd(
      [baseCat('a', 0), baseCat('b', 1)],
      [{ categoryId: 'b', count: 3, lastUsedAt: new Date() }],
      'b'
    );
    expect(defaultCategoryIdFromOrder(ordered, 'b')).toBe('b');
  });
});
