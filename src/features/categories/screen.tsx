import { useCallback, useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import {
  AppText,
  Button,
  CategoryGlyph,
  ConfirmDialog,
  Field,
  FormScroll,
  IconButton,
  Screen,
  ScreenHeader,
  useThemeColors,
} from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';
import { CATEGORY_ICONS } from '@/lib/categories/icons';
import { db } from '@/lib/db/client';
import {
  createCategory,
  listCategories,
  softDeleteCategory,
  updateCategory,
} from '@/lib/db/queries';
import type { Category } from '@/lib/db/schema';
import { layout } from '@/lib/layout';
import { useApp } from '@/providers/app-provider';

type Draft = {
  name: string;
  kind: 'expense' | 'income';
  iconKey: string;
};

const emptyDraft = (): Draft => ({
  name: '',
  kind: 'expense',
  iconKey: 'other',
});

export function CategoriesScreen() {
  const { colorScheme } = useApp();
  const theme = useThemeColors();
  const { showToast } = useToast();
  const [items, setItems] = useState<Category[]>([]);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Category | null>(null);

  const load = useCallback(async () => {
    setItems(await listCategories(db));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const startEdit = (c: Category) => {
    setEditingId(c.id);
    setDraft({
      name: c.name,
      kind: c.kind,
      iconKey: c.iconKey,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraft(emptyDraft());
  };

  const save = async () => {
    if (!draft.name.trim()) {
      showToast('Enter a category name', 'error');
      return;
    }
    const color = draft.kind === 'income' ? '#1A7A4C' : '#C43C2C';
    try {
      if (editingId) {
        await updateCategory(db, editingId, {
          name: draft.name.trim(),
          kind: draft.kind,
          iconKey: draft.iconKey,
          color,
        });
        showToast('Category updated', 'success');
      } else {
        await createCategory(db, {
          name: draft.name.trim(),
          kind: draft.kind,
          iconKey: draft.iconKey,
          color,
        });
        showToast('Category added', 'success');
      }
      cancelEdit();
      await load();
    } catch (e) {
      showToast(`Save failed: ${String(e)}`, 'error');
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    try {
      await softDeleteCategory(db, pendingDelete.id);
      if (editingId === pendingDelete.id) cancelEdit();
      showToast('Category removed', 'success');
      setPendingDelete(null);
      await load();
    } catch (e) {
      showToast(`Remove failed: ${String(e)}`, 'error');
    }
  };

  const chipClass = (active: boolean) =>
    `rounded-full px-3 py-1.5 ${
      active
        ? 'bg-accent'
        : colorScheme === 'dark'
          ? 'bg-surface-dark-raised'
          : 'bg-surface-raised'
    }`;

  return (
    <Screen>
      <FormScroll
        contentContainerStyle={{
          paddingHorizontal: layout.gutter,
        }}
      >
        <ScreenHeader title='Categories' />
        <AppText size='sm' muted className='mt-1'>
          {editingId ? 'Editing category' : 'Add a category'}
        </AppText>

        <View className='mt-4 flex-row gap-2'>
          {(['expense', 'income'] as const).map((k) => (
            <Pressable
              key={k}
              onPress={() => setDraft((d) => ({ ...d, kind: k }))}
              className={chipClass(draft.kind === k)}
            >
              <AppText size='sm' weight='medium'>
                {k}
              </AppText>
            </Pressable>
          ))}
        </View>

        <View className='mt-4 gap-3'>
          <Field
            label='Name'
            value={draft.name}
            onChangeText={(name) => setDraft((d) => ({ ...d, name }))}
            placeholder='Food, Salary…'
          />
          <AppText size='sm' muted>
            Icon
          </AppText>
          <View className='flex-row flex-wrap gap-2'>
            {CATEGORY_ICONS.map((icon) => (
              <Pressable
                key={icon.key}
                onPress={() => setDraft((d) => ({ ...d, iconKey: icon.key }))}
              >
                <CategoryGlyph
                  iconKey={icon.key}
                  color={draft.iconKey === icon.key ? '#1A7A4C' : '#6B7280'}
                />
              </Pressable>
            ))}
          </View>
          <View className='flex-row gap-2'>
            {editingId ? (
              <View className='flex-1'>
                <Button
                  label='Cancel'
                  variant='secondary'
                  onPress={cancelEdit}
                />
              </View>
            ) : null}
            <View className='flex-1'>
              <Button
                label={editingId ? 'Save changes' : 'Add category'}
                onPress={save}
              />
            </View>
          </View>
        </View>

        <AppText size='sm' muted className='mt-6 mb-1'>
          Your categories
        </AppText>
        {items.map((c) => (
          <View
            key={c.id}
            className='flex-row items-center gap-3 py-3'
            style={{
              borderBottomWidth: 1,
              borderBottomColor: colorScheme === 'dark' ? '#2A3A33' : '#D5DED8',
            }}
          >
            <CategoryGlyph iconKey={c.iconKey} color={c.color} />
            <View className='flex-1'>
              <AppText weight='medium'>{c.name}</AppText>
              <AppText size='sm' muted>
                {c.kind}
                {c.isDefault ? ' · default' : ''}
              </AppText>
            </View>
            <IconButton
              name='create-outline'
              color={theme.accent}
              onPress={() => startEdit(c)}
            />
            <IconButton
              name='trash-outline'
              color={theme.expense}
              onPress={() => setPendingDelete(c)}
            />
          </View>
        ))}
      </FormScroll>

      <ConfirmDialog
        visible={pendingDelete !== null}
        title={`Remove ${pendingDelete?.name}?`}
        message={
          pendingDelete?.isDefault
            ? 'This is a default category. Past transactions keep their history; it will no longer appear when adding new ones.'
            : 'This category will be hidden. Past transactions keep their history.'
        }
        onCancel={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
      />
    </Screen>
  );
}
