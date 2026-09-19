import { eq, isNull } from 'drizzle-orm';

import { DEFAULT_CATEGORIES } from '@/lib/categories/icons';
import { createId } from '@/lib/id';

import type { AppDatabase } from './client';
import { categories, settings } from './schema';

export async function ensureSeedData(database: AppDatabase): Promise<void> {
  const existingSettings = await database.select().from(settings).limit(1);
  if (existingSettings.length === 0) {
    await database.insert(settings).values({
      id: 'default',
      theme: 'system',
      lockEnabled: false,
      onboardingDone: false,
      defaultCurrency: 'USD',
      remindersEnabled: true,
      updatedAt: new Date(),
    });
  }

  const existingCategories = await database
    .select()
    .from(categories)
    .where(isNull(categories.deletedAt));

  if (existingCategories.length === 0) {
    await database.insert(categories).values(
      DEFAULT_CATEGORIES.map((cat, index) => ({
        id: createId(),
        name: cat.name,
        kind: cat.kind,
        iconKey: cat.iconKey,
        color: cat.color,
        isDefault: true,
        sortOrder: index,
        createdAt: new Date(),
        updatedAt: new Date(),
      }))
    );
    return;
  }

  // Backfill IT / missing default categories for existing installs
  const names = new Set(existingCategories.map((c) => c.name.toLowerCase()));
  const missing = DEFAULT_CATEGORIES.filter(
    (c) => !names.has(c.name.toLowerCase())
  );
  if (missing.length) {
    const start = existingCategories.length;
    await database.insert(categories).values(
      missing.map((cat, index) => ({
        id: createId(),
        name: cat.name,
        kind: cat.kind,
        iconKey: cat.iconKey,
        color: cat.color,
        isDefault: true,
        sortOrder: start + index,
        createdAt: new Date(),
        updatedAt: new Date(),
      }))
    );
  }
}

export async function getSettings(database: AppDatabase) {
  const rows = await database
    .select()
    .from(settings)
    .where(eq(settings.id, 'default'));
  return rows[0] ?? null;
}
