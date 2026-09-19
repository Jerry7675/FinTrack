import { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';

import {
  Button,
  ConfirmDialog,
  Field,
  ListRow,
  Screen,
  ScreenHeader,
} from '@/components/ui/primitives';
import { db } from '@/lib/db/client';
import { createGoal, listGoals, softDeleteGoal } from '@/lib/db/queries';
import type { Goal } from '@/lib/db/schema';
import { layout } from '@/lib/layout';
import { formatMoney } from '@/lib/money';
import { useApp } from '@/providers/app-provider';

export function GoalsScreen() {
  const { settings } = useApp();
  const [items, setItems] = useState<Goal[]>([]);
  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [pending, setPending] = useState<string | null>(null);

  const load = useCallback(async () => {
    setItems(await listGoals(db));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const add = async () => {
    const value = Number.parseFloat(target);
    if (!name.trim() || !Number.isFinite(value)) {
      Alert.alert('Enter name and target');
      return;
    }
    await createGoal(db, {
      name: name.trim(),
      target: value,
      currencyCode: settings?.defaultCurrency ?? 'USD',
    });
    setName('');
    setTarget('');
    await load();
  };

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: layout.gutter,
          paddingBottom: 40,
        }}
      >
        <ScreenHeader title='Goals' />
        <View className='mt-4 gap-3'>
          <Field label='Name' value={name} onChangeText={setName} />
          <Field
            label='Target'
            value={target}
            onChangeText={setTarget}
            keyboardType='decimal-pad'
          />
          <Button label='Add goal' onPress={add} />
        </View>
        {items.map((g) => {
          const pct = Math.min(
            100,
            Math.round((g.currentMinor / Math.max(g.targetMinor, 1)) * 100)
          );
          return (
            <ListRow
              key={g.id}
              title={g.name}
              subtitle={`${formatMoney(g.currentMinor, g.currencyCode)} / ${formatMoney(g.targetMinor, g.currencyCode)} · ${pct}%`}
              onPress={() => setPending(g.id)}
            />
          );
        })}
      </ScrollView>
      <ConfirmDialog
        visible={pending !== null}
        title='Delete goal?'
        message='Remove this savings goal.'
        onCancel={() => setPending(null)}
        onConfirm={async () => {
          if (pending) await softDeleteGoal(db, pending);
          setPending(null);
          await load();
        }}
      />
    </Screen>
  );
}
