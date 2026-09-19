import { FlashList } from '@shopify/flash-list';
import { format } from 'date-fns';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  View,
} from 'react-native';

import {
  ActivityDots,
  buildDailySeries,
  CHART_RANGES,
  type ChartRange,
  RangeFilters,
  SpendAreaChart,
} from '@/components/charts/widgets';
import { ProfileAvatar } from '@/components/media/images';
import {
  ActionTile,
  BalanceCard,
  SummaryStrip,
  TransactionCard,
} from '@/components/ui/cards';
import {
  AppText,
  Chip,
  EmptyState,
  Field,
  IconButton,
  Screen,
  useThemeColors,
} from '@/components/ui/primitives';
import { characters } from '@/constants/characters';
import { AddTransactionSheet } from '@/features/transactions/add-sheet';
import { db } from '@/lib/db/client';
import { getAccountBalance, listTransactions } from '@/lib/db/queries';
import { layout } from '@/lib/layout';
import { formatMoney } from '@/lib/money';
import { useApp } from '@/providers/app-provider';

export function DashboardScreen() {
  const { settings, accounts, groups, setActiveScope, colorScheme, refresh } =
    useApp();
  const c = useThemeColors();
  const [balances, setBalances] = useState<Record<string, number>>({});
  const [txns, setTxns] = useState<
    Awaited<ReturnType<typeof listTransactions>>
  >([]);
  const [refreshing, setRefreshing] = useState(false);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<
    'expense' | 'income' | 'transfer' | null
  >(null);
  const [chartRange, setChartRange] = useState<ChartRange>('7d');

  const activeAccount = accounts.find(
    (a) => a.id === settings?.activeAccountId
  );
  const activeGroup = groups.find((g) => g.id === settings?.activeGroupId);

  const scopeLabel = activeAccount
    ? activeAccount.name
    : activeGroup
      ? activeGroup.name
      : 'All accounts';

  const currency =
    activeAccount?.currencyCode ?? settings?.defaultCurrency ?? 'USD';

  const chartDays = CHART_RANGES.find((r) => r.key === chartRange)?.days ?? 7;

  const load = useCallback(async () => {
    const map: Record<string, number> = {};
    const scopedAccounts = activeAccount
      ? [activeAccount]
      : activeGroup
        ? accounts.filter((a) => a.groupId === activeGroup.id)
        : accounts;

    await Promise.all(
      scopedAccounts.map(async (a) => {
        map[a.id] = await getAccountBalance(db, a.id);
      })
    );
    setBalances(map);

    const rows = await listTransactions(db, {
      accountId: activeAccount?.id,
      groupId: !activeAccount ? activeGroup?.id : undefined,
      query: query || undefined,
      type: typeFilter,
      limit: 200,
    });
    setTxns(rows);
  }, [activeAccount, activeGroup, accounts, query, typeFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const totalBalance = useMemo(() => {
    const scoped = activeAccount
      ? [activeAccount.id]
      : activeGroup
        ? accounts.filter((a) => a.groupId === activeGroup.id).map((a) => a.id)
        : accounts.map((a) => a.id);
    return scoped.reduce((sum, id) => sum + (balances[id] ?? 0), 0);
  }, [activeAccount, activeGroup, accounts, balances]);

  const expenseRows = useMemo(
    () =>
      txns
        .filter((t) => t.transaction.type === 'expense')
        .map((t) => ({
          occurredAt: t.transaction.occurredAt,
          amountMinor: t.transaction.amountMinor,
        })),
    [txns]
  );

  const chartPoints = useMemo(
    () => buildDailySeries(expenseRows, Math.min(chartDays, 90)),
    [expenseRows, chartDays]
  );

  const summary = useMemo(() => {
    let spent = 0;
    let income = 0;
    let transfers = 0;
    for (const row of txns) {
      const t = row.transaction;
      if (t.type === 'expense') spent += t.amountMinor;
      else if (t.type === 'income') income += t.amountMinor;
      else transfers += Math.abs(t.amountMinor);
    }
    return { spent, income, transfers };
  }, [txns]);

  const activityMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of expenseRows) {
      const key = format(row.occurredAt, 'yyyy-MM-dd');
      map.set(key, (map.get(key) ?? 0) + row.amountMinor);
    }
    return map;
  }, [expenseRows]);

  const onRefresh = async () => {
    setRefreshing(true);
    await refresh();
    await load();
    setRefreshing(false);
  };

  return (
    <Screen>
      <View className='flex-1' style={{ paddingHorizontal: layout.gutter }}>
        <FlashList
          data={txns}
          keyExtractor={(item) => item.transaction.id}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListHeaderComponent={
            <View>
              <View className='flex-row items-center justify-between pt-2'>
                <Pressable
                  onPress={() => setSwitcherOpen(true)}
                  className='flex-1 flex-row items-center gap-3'
                >
                  <ProfileAvatar
                    path={settings?.profileImagePath}
                    fallback={characters.hero}
                    size={44}
                  />
                  <View className='flex-1'>
                    <AppText size='sm' muted>
                      Welcome back
                    </AppText>
                    <View className='flex-row items-center gap-1'>
                      <AppText size='lg' weight='semibold'>
                        {scopeLabel}
                      </AppText>
                      <AppText muted>▾</AppText>
                    </View>
                  </View>
                </Pressable>
                <IconButton
                  name='notifications-outline'
                  onPress={() => router.push('/(tabs)/settings')}
                />
              </View>

              <View className='mt-5'>
                <BalanceCard
                  amount={formatMoney(totalBalance, currency)}
                  onAdd={() => setAddOpen(true)}
                />
              </View>

              <View className='mt-4 flex-row gap-3'>
                <ActionTile
                  label='Add'
                  icon='add-circle-outline'
                  tone='green'
                  onPress={() => setAddOpen(true)}
                />
                <ActionTile
                  label='Accounts'
                  icon='wallet-outline'
                  tone='mint'
                  onPress={() => router.push('/(tabs)/accounts')}
                />
                <ActionTile
                  label='Insights'
                  icon='stats-chart-outline'
                  tone='slate'
                  onPress={() => router.push('/(tabs)/insights')}
                />
              </View>

              <View className='mt-4'>
                <SummaryStrip
                  items={[
                    {
                      label: 'Spent',
                      value: formatMoney(summary.spent, currency),
                    },
                    {
                      label: 'Income',
                      value: formatMoney(summary.income, currency),
                    },
                    {
                      label: 'Transfers',
                      value: formatMoney(summary.transfers, currency),
                    },
                  ]}
                />
              </View>

              <View className='mt-4'>
                <RangeFilters value={chartRange} onChange={setChartRange} />
              </View>
              <View className='mt-3'>
                <SpendAreaChart points={chartPoints} title='Spending trend' />
              </View>

              <View className='mt-3'>
                <ActivityDots amountsByDay={activityMap} />
              </View>

              <View className='mt-4'>
                <Field
                  placeholder='Search name, notes, tags…'
                  value={query}
                  onChangeText={setQuery}
                />
              </View>

              <View className='mt-3 flex-row flex-wrap gap-2'>
                {(
                  [
                    [null, 'All'],
                    ['expense', 'Expense'],
                    ['income', 'Income'],
                    ['transfer', 'Transfer'],
                  ] as const
                ).map(([value, label]) => (
                  <Chip
                    key={label}
                    label={label}
                    active={typeFilter === value}
                    onPress={() => setTypeFilter(value)}
                  />
                ))}
              </View>

              <AppText size='sm' muted weight='semibold' className='mb-2 mt-5'>
                TRANSACTIONS
              </AppText>
            </View>
          }
          ListEmptyComponent={
            <EmptyState
              title='No transactions yet'
              subtitle='Tap + to add your first income or expense'
              character={characters.empty}
            />
          }
          renderItem={({ item }) => {
            const t = item.transaction;
            const isExpense = t.type === 'expense';
            const signed =
              t.type === 'transfer'
                ? t.amountMinor
                : isExpense
                  ? -t.amountMinor
                  : t.amountMinor;
            return (
              <TransactionCard
                title={t.title}
                subtitle={`${format(t.occurredAt, 'MMM d')} · ${item.account.name}`}
                amount={formatMoney(signed, t.currencyCode, { sign: true })}
                amountColor={isExpense ? c.expense : c.income}
                iconKey={item.category?.iconKey ?? 'other'}
                iconColor={item.category?.color ?? '#6B7280'}
                onPress={() => router.push(`/transaction/${t.id}`)}
              />
            );
          }}
        />
      </View>

      <Modal visible={switcherOpen} animationType='slide' transparent>
        <Pressable
          className='flex-1 bg-black/40'
          onPress={() => setSwitcherOpen(false)}
        />
        <View
          className={`max-h-[70%] rounded-t-3xl px-5 pb-10 pt-4 ${
            colorScheme === 'dark' ? 'bg-surface-dark-raised' : 'bg-white'
          }`}
        >
          <AppText size='lg' weight='semibold' className='mb-3'>
            Switch account
          </AppText>
          <ScrollView>
            <Pressable
              className='py-3'
              onPress={async () => {
                await setActiveScope({ groupId: null, accountId: null });
                setSwitcherOpen(false);
              }}
            >
              <AppText weight='medium'>All accounts</AppText>
            </Pressable>
            {groups.map((g) => (
              <View key={g.id}>
                <Pressable
                  className='py-3'
                  onPress={async () => {
                    await setActiveScope({ groupId: g.id, accountId: null });
                    setSwitcherOpen(false);
                  }}
                >
                  <AppText weight='semibold'>{g.name}</AppText>
                  <AppText size='sm' muted>
                    Group total
                  </AppText>
                </Pressable>
                {accounts
                  .filter((a) => a.groupId === g.id)
                  .map((a) => (
                    <Pressable
                      key={a.id}
                      className='border-l-2 border-accent py-2.5 pl-4'
                      onPress={async () => {
                        await setActiveScope({
                          groupId: g.id,
                          accountId: a.id,
                        });
                        setSwitcherOpen(false);
                      }}
                    >
                      <AppText>{a.name}</AppText>
                      <AppText size='sm' muted>
                        {a.currencyCode} · {a.type}
                      </AppText>
                    </Pressable>
                  ))}
              </View>
            ))}
          </ScrollView>
        </View>
      </Modal>

      <AddTransactionSheet
        visible={addOpen}
        onClose={() => setAddOpen(false)}
        onSaved={async () => {
          setAddOpen(false);
          await load();
          const { updateWidgetSnapshot } = await import(
            '@/features/widgets/update'
          );
          await updateWidgetSnapshot();
        }}
      />
    </Screen>
  );
}
