import { format, formatDistanceToNow } from 'date-fns';
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';

import {
  AppText,
  Button,
  EmptyState,
  FormScroll,
  ListRow,
  Screen,
  ScreenHeader,
} from '@/components/ui/primitives';
import { characters } from '@/constants/characters';
import { db } from '@/lib/db/client';
import {
  listRecycleBin,
  type RecycleItem,
  restoreRecycleItem,
} from '@/lib/db/queries';
import { layout } from '@/lib/layout';
import { useApp } from '@/providers/app-provider';

export function RecycleBinScreen() {
  const { refresh } = useApp();
  const [items, setItems] = useState<RecycleItem[]>([]);

  const load = useCallback(async () => {
    setItems(await listRecycleBin(db));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const restore = async (item: RecycleItem) => {
    await restoreRecycleItem(db, item.entity, item.id);
    await load();
    await refresh();
  };

  return (
    <Screen>
      <FormScroll contentContainerStyle={{ paddingHorizontal: layout.gutter }}>
        <ScreenHeader title='Recently deleted' />
        <AppText muted className='mt-1'>
          Soft-deleted items can be restored. Nothing is permanently erased
          here.
        </AppText>

        {items.length === 0 ? (
          <EmptyState
            title='Recycle bin is empty'
            subtitle='Deleted transactions, budgets, goals, and more appear here.'
            character={characters.empty}
          />
        ) : (
          <View className='mt-4'>
            {items.map((item) => (
              <ListRow
                key={`${item.entity}-${item.id}`}
                title={item.title}
                subtitle={`${item.subtitle} · deleted ${formatDistanceToNow(item.deletedAt, { addSuffix: true })} (${format(item.deletedAt, 'MMM d')})`}
                right={
                  <Button
                    label='Restore'
                    variant='secondary'
                    onPress={() => restore(item)}
                  />
                }
              />
            ))}
          </View>
        )}
      </FormScroll>
    </Screen>
  );
}
