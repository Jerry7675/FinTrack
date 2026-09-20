import { format, parse } from 'date-fns';
import { useCallback, useEffect, useState } from 'react';
import { Alert, View } from 'react-native';

import {
  AppText,
  Button,
  Card,
  ConfirmDialog,
  Field,
  FormScroll,
  GoalRing,
  IconButton,
  ProgressBar,
  Screen,
  ScreenHeader,
  useThemeColors,
} from '@/components/ui/primitives';
import { db } from '@/lib/db/client';
import {
  addGoalContribution,
  createGoal,
  listGoals,
  softDeleteGoal,
} from '@/lib/db/queries';
import type { Goal } from '@/lib/db/schema';
import { layout } from '@/lib/layout';
import { formatMoney } from '@/lib/money';
import { goalSuggestedMonthly } from '@/lib/planning';
import { useApp } from '@/providers/app-provider';

export function GoalsScreen() {
  const { settings } = useApp();
  const c = useThemeColors();
  const [items, setItems] = useState<Goal[]>([]);
  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [starting, setStarting] = useState('');
  const [deadline, setDeadline] = useState('');
  const [pending, setPending] = useState<string | null>(null);
  const [contributeId, setContributeId] = useState<string | null>(null);
  const [contributeAmount, setContributeAmount] = useState('');

  const load = useCallback(async () => {
    setItems(await listGoals(db));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const add = async () => {
    const value = Number.parseFloat(target);
    const startVal = starting.trim() ? Number.parseFloat(starting) : undefined;
    if (!name.trim() || !Number.isFinite(value)) {
      Alert.alert('Enter name and target');
      return;
    }
    if (startVal != null && !Number.isFinite(startVal)) {
      Alert.alert('Starting amount must be a number');
      return;
    }
    let deadlineAt: Date | null = null;
    if (deadline.trim()) {
      const parsed = parse(deadline.trim(), 'yyyy-MM-dd', new Date());
      if (Number.isNaN(parsed.getTime())) {
        Alert.alert('Deadline must be YYYY-MM-DD');
        return;
      }
      deadlineAt = parsed;
    }
    await createGoal(db, {
      name: name.trim(),
      target: value,
      current: startVal,
      currencyCode: settings?.defaultCurrency ?? 'USD',
      deadlineAt,
    });
    setName('');
    setTarget('');
    setStarting('');
    setDeadline('');
    await load();
  };

  const submitContribution = async () => {
    if (!contributeId) return;
    const value = Number.parseFloat(contributeAmount);
    if (!Number.isFinite(value) || value === 0) {
      Alert.alert('Enter a contribution amount');
      return;
    }
    const goal = items.find((g) => g.id === contributeId);
    await addGoalContribution(
      db,
      contributeId,
      value,
      goal?.currencyCode ?? settings?.defaultCurrency ?? 'USD'
    );
    setContributeId(null);
    setContributeAmount('');
    await load();
  };

  return (
    <Screen>
      <FormScroll
        contentContainerStyle={{
          paddingHorizontal: layout.gutter,
        }}
      >
        <ScreenHeader title='Goals' />
        <AppText muted className='mt-1'>
          Save toward a target and track completion over time.
        </AppText>
        <View className='mt-4 gap-3'>
          <Field label='Name' value={name} onChangeText={setName} />
          <Field
            label='Target'
            value={target}
            onChangeText={setTarget}
            keyboardType='decimal-pad'
          />
          <Field
            label='Starting amount (optional)'
            value={starting}
            onChangeText={setStarting}
            keyboardType='decimal-pad'
          />
          <Field
            label='Deadline YYYY-MM-DD (optional)'
            value={deadline}
            onChangeText={setDeadline}
            placeholder='2027-03-01'
            autoCapitalize='none'
          />
          <Button label='Add goal' onPress={add} />
        </View>

        <View className='mt-6 gap-3'>
          {items.length === 0 ? (
            <AppText muted>
              No goals yet. Create a goal and start tracking your progress.
            </AppText>
          ) : null}
          {items.map((g) => {
            const pct = Math.min(
              1,
              g.currentMinor / Math.max(g.targetMinor, 1)
            );
            const remaining = Math.max(0, g.targetMinor - g.currentMinor);
            const suggested = goalSuggestedMonthly(remaining, g.deadlineAt);
            return (
              <Card key={g.id}>
                <View className='flex-row items-center gap-3'>
                  <GoalRing
                    progress={pct}
                    size={52}
                    label={`${Math.round(pct * 100)}%`}
                  />
                  <View className='flex-1'>
                    <AppText weight='semibold'>{g.name}</AppText>
                    <AppText size='sm' muted>
                      {formatMoney(g.currentMinor, g.currencyCode)} /{' '}
                      {formatMoney(g.targetMinor, g.currencyCode)}
                    </AppText>
                  </View>
                  <IconButton
                    name='trash-outline'
                    color={c.expense}
                    onPress={() => setPending(g.id)}
                  />
                </View>
                <View className='mt-3'>
                  <ProgressBar progress={pct} />
                </View>
                <AppText size='sm' muted className='mt-2'>
                  {formatMoney(remaining, g.currencyCode)} remaining
                  {g.deadlineAt
                    ? ` · target ${format(g.deadlineAt, 'MMM d, yyyy')}`
                    : ''}
                </AppText>
                {suggested != null ? (
                  <AppText
                    size='sm'
                    className='mt-1'
                    style={{ color: c.accent }}
                  >
                    Suggested monthly · {formatMoney(suggested, g.currencyCode)}
                  </AppText>
                ) : null}
                {contributeId === g.id ? (
                  <View className='mt-3 gap-2'>
                    <Field
                      label='Contribution'
                      value={contributeAmount}
                      onChangeText={setContributeAmount}
                      keyboardType='decimal-pad'
                      placeholder='Amount to add'
                    />
                    <View className='flex-row gap-2'>
                      <View className='flex-1'>
                        <Button
                          label='Cancel'
                          variant='secondary'
                          onPress={() => {
                            setContributeId(null);
                            setContributeAmount('');
                          }}
                        />
                      </View>
                      <View className='flex-1'>
                        <Button label='Add' onPress={submitContribution} />
                      </View>
                    </View>
                  </View>
                ) : (
                  <View className='mt-3'>
                    <Button
                      label='Add contribution'
                      variant='secondary'
                      icon='add-outline'
                      onPress={() => setContributeId(g.id)}
                    />
                  </View>
                )}
              </Card>
            );
          })}
        </View>
      </FormScroll>
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
