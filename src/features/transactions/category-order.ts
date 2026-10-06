import type { Category } from '@/lib/db/schema';

export type CategoryUsageRow = {
  categoryId: string;
  count: number;
  lastUsedAt: Date | null;
};

/**
 * Order categories for Quick Add chips: last-used category first, then by
 * 90-day usage count, then never-used by sortOrder.
 */
export function orderCategoriesForQuickAdd(
  categories: Category[],
  usage: CategoryUsageRow[],
  lastUsedCategoryId: string | null
): Category[] {
  const byId = new Map(categories.map((c) => [c.id, c]));

  const usedIds = new Set(usage.map((u) => u.categoryId));
  const sortedUsed = [...usage].sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    const aTime = a.lastUsedAt?.getTime() ?? 0;
    const bTime = b.lastUsedAt?.getTime() ?? 0;
    return bTime - aTime;
  });

  const ordered: Category[] = [];
  const seen = new Set<string>();

  const lastUsed = lastUsedCategoryId
    ? byId.get(lastUsedCategoryId)
    : undefined;
  if (lastUsed) {
    ordered.push(lastUsed);
    seen.add(lastUsedCategoryId as string);
  }

  for (const row of sortedUsed) {
    if (seen.has(row.categoryId)) continue;
    const cat = byId.get(row.categoryId);
    if (!cat) continue;
    ordered.push(cat);
    seen.add(row.categoryId);
  }

  const neverUsed = categories
    .filter((c) => !usedIds.has(c.id) && !seen.has(c.id))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));

  for (const cat of neverUsed) {
    ordered.push(cat);
    seen.add(cat.id);
  }

  for (const cat of categories) {
    if (!seen.has(cat.id)) ordered.push(cat);
  }

  return ordered;
}

export function defaultCategoryIdFromOrder(
  ordered: Category[],
  lastUsedCategoryId: string | null
): string | null {
  if (lastUsedCategoryId && ordered.some((c) => c.id === lastUsedCategoryId)) {
    return lastUsedCategoryId;
  }
  return ordered[0]?.id ?? null;
}
