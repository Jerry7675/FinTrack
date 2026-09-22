import { FlashList } from '@shopify/flash-list';
import { format, isToday } from 'date-fns';
import { type Href, router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
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
  GoalRing,
  IconButton,
  Screen,
  useThemeColors,
} from '@/components/ui/primitives';
import { characters } from '@/constants/characters';
import { AddTransactionSheet } from '@/features/transactions/add-sheet';
import { useReloadOnFocus } from '@/hooks/use-reload-on-focus';
import { parseDashboardLayout } from '@/lib/dashboard-layout';
import { db } from '@/lib/db/client';
import {
  getAccountBalance,
  listGoals,
  listTransactions,
} from '@/lib/db/queries';
import type { Goal } from '@/lib/db/schema';
import { layout } from '@/lib/layout';
import { formatMoney } from '@/lib/money';
import { listUpcomingPlanning } from '@/lib/planning/materialize';
import { useApp } from '@/providers/app-provider';

type TxnRow = Awaited<ReturnType<typeof listTransactions>>[number];
type UpcomingItem = Awaited<ReturnType<typeof listUpcomingPlanning>>[number];

type ListItem =
  | { kind: 'header' }
  | { kind: 'balance' }
  | { kind: 'actions' }
  | { kind: 'planning' }
  | { kind: 'summary' }
  | { kind: 'goals' }
  | { kind: 'chart' }
  | { kind: 'activity' }
  | { kind: 'txnFilters' }
  | { kind: 'txn'; row: TxnRow }
  | { kind: 'txnEmpty' };

export function DashboardScreen() {
  const {
    settings,
    accounts,
    groups,
    setActiveScope,
    colorScheme,
    refresh,
    bumpData,
  } = useApp();
  const c = useThemeColors();
  const [balances, setBalances] = useState<Record<string, number>>({});
  const [txns, setTxns] = useState<TxnRow[]>([]);
  const [upcoming, setUpcoming] = useState<UpcomingItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<
    'expense' | 'income' | 'transfer' | null
  >(null);
  const [chartRange, setChartRange] = useState<ChartRange>('7d');
  const [goals, setGoals] = useState<Goal[]>([]);

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
    setGoals(await listGoals(db));
    setUpcoming(await listUpcomingPlanning(db, 7));
  }, [activeAccount, activeGroup, accounts, query, typeFilter]);

  useReloadOnFocus(load);

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

  const dashLayout = useMemo(
    () => parseDashboardLayout(settings?.dashboardLayout),
    [settings?.dashboardLayout]
  );
  const orderedSections = dashLayout.filter((card) => card.visible);

  const listData = useMemo(() => {
    const items: ListItem[] = [{ kind: 'header' }];
    for (const section of orderedSections) {
      if (section.id === 'balance') items.push({ kind: 'balance' });
      else if (section.id === 'actions') items.push({ kind: 'actions' });
      else if (section.id === 'planning') items.push({ kind: 'planning' });
      else if (section.id === 'summary') items.push({ kind: 'summary' });
      else if (section.id === 'goals') items.push({ kind: 'goals' });
      else if (section.id === 'chart') items.push({ kind: 'chart' });
      else if (section.id === 'activity') items.push({ kind: 'activity' });
      else if (section.id === 'transactions') {
        items.push({ kind: 'txnFilters' });
        if (txns.length === 0) items.push({ kind: 'txnEmpty' });
        else {
          for (const row of txns) items.push({ kind: 'txn', row });
        }
      }
    }
    return items;
  }, [orderedSections, txns]);

  const keyExtractor = useCallback((item: ListItem, index: number) => {
    if (item.kind === 'txn') return `txn-${item.row.transaction.id}`;
    return `${item.kind}-${index}`;
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: ListItem }) => {
      if (item.kind === 'header') {
        return (
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
              name='options-outline'
              onPress={() => router.push('/planning/customize-home' as Href)}
            />
            <IconButton
              name='notifications-outline'
              onPress={() => router.push('/(tabs)/settings')}
            />
          </View>
        );
      }

      if (item.kind === 'balance') {
        return (
          <View className='mt-5'>
            <BalanceCard
              amount={formatMoney(totalBalance, currency)}
              onAdd={() => setAddOpen(true)}
            />
          </View>
        );
      }

      if (item.kind === 'actions') {
        return (
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
        );
      }

      if (item.kind === 'planning') {
        return (
          <View className='mt-4'>
            <View className='mb-2 flex-row items-center justify-between'>
              <AppText size='sm' muted weight='semibold'>
                MONEY MOVING
              </AppText>
              <Pressable onPress={() => router.push('/planning/recurring')}>
                <AppText size='sm' className='text-accent'>
                  Plans
                </AppText>
              </Pressable>
            </View>
            {upcoming.length === 0 ? (
              <Pressable
                onPress={() => router.push('/planning/subscriptions')}
                className='rounded-2xl px-4 py-3'
                style={{ backgroundColor: c.surfaceRaised }}
              >
                <AppText size='sm' muted>
                  No upcoming posts in the next 7 days. Add rent or a
                  subscription to keep balance honest.
                </AppText>
              </Pressable>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View className='flex-row gap-2'>
                  {upcoming.slice(0, 8).map((u) => (
                    <Pressable
                      key={`${u.kind}-${u.id}`}
                      onPress={() =>
                        router.push(
                          u.kind === 'subscription'
                            ? '/planning/subscriptions'
                            : '/planning/recurring'
                        )
                      }
                      className='min-w-[140px] rounded-2xl px-3 py-3'
                      style={{ backgroundColor: c.surfaceRaised }}
                    >
                      <AppText size='xs' muted>
                        {isToday(u.dueAt)
                          ? 'Due today'
                          : format(u.dueAt, 'MMM d')}{' '}
                        · {u.kind === 'subscription' ? 'Sub' : 'Recurring'}
                      </AppText>
                      <AppText weight='semibold'>
                        {u.title.length > 18
                          ? `${u.title.slice(0, 18)}…`
                          : u.title}
                      </AppText>
                      <AppText
                        size='sm'
                        style={{
                          color: u.type === 'expense' ? c.expense : c.income,
                        }}
                      >
                        {formatMoney(
                          u.type === 'expense' ? -u.amountMinor : u.amountMinor,
                          u.currencyCode,
                          { sign: true }
                        )}
                      </AppText>
                    </Pressable>
                  ))}
                </View>
              </ScrollView>
            )}
          </View>
        );
      }

      if (item.kind === 'summary') {
        return (
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
        );
      }

      if (item.kind === 'goals') {
        if (goals.length === 0) {
          return (
            <Pressable
              onPress={() => router.push('/planning/goals')}
              className='mt-4 rounded-2xl px-4 py-3'
              style={{ backgroundColor: c.surfaceRaised }}
            >
              <AppText size='sm' muted weight='semibold' className='mb-1'>
                GOALS
              </AppText>
              <AppText size='sm'>
                Set a savings goal to track progress on Home.
              </AppText>
            </Pressable>
          );
        }
        return (
          <Pressable
            onPress={() => router.push('/planning/goals')}
            className='mt-4'
          >
            <AppText size='sm' muted weight='semibold' className='mb-2'>
              GOALS
            </AppText>
            <View className='flex-row flex-wrap gap-3'>
              {goals.slice(0, 4).map((g) => {
                const pct = Math.min(
                  1,
                  g.currentMinor / Math.max(g.targetMinor, 1)
                );
                return (
                  <View key={g.id} className='items-center gap-1'>
                    <GoalRing
                      progress={pct}
                      size={52}
                      label={`${Math.round(pct * 100)}%`}
                    />
                    <AppText size='xs' muted>
                      {g.name.length > 10 ? `${g.name.slice(0, 10)}…` : g.name}
                    </AppText>
                  </View>
                );
              })}
            </View>
          </Pressable>
        );
      }

      if (item.kind === 'chart') {
        return (
          <View>
            <View className='mt-4'>
              <RangeFilters value={chartRange} onChange={setChartRange} />
            </View>
            <View className='mt-3'>
              <SpendAreaChart points={chartPoints} title='Spending trend' />
            </View>
          </View>
        );
      }

      if (item.kind === 'activity') {
        return (
          <View className='mt-3'>
            <ActivityDots amountsByDay={activityMap} />
          </View>
        );
      }

      if (item.kind === 'txnFilters') {
        return (
          <View>
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
        );
      }

      if (item.kind === 'txnEmpty') {
        return (
          <EmptyState
            title='No transactions yet'
            subtitle='Tap + to add your first income or expense'
            character={characters.empty}
          />
        );
      }

      if (item.kind === 'txn') {
        const t = item.row.transaction;
        const isExpense = t.type === 'expense';
        const signed =
          t.type === 'transfer'
            ? t.amountMinor
            : isExpense
              ? -t.amountMinor
              : t.amountMinor;
        const sourceLabel =
          t.sourceType === 'subscription'
            ? ' · Subscription'
            : t.sourceType === 'recurring'
              ? ' · Recurring'
              : '';
        return (
          <TransactionCard
            title={t.title}
            subtitle={`${format(t.occurredAt, 'MMM d')} · ${item.row.account.name}${sourceLabel}`}
            amount={formatMoney(signed, t.currencyCode, { sign: true })}
            amountColor={isExpense ? c.expense : c.income}
            iconKey={item.row.category?.iconKey ?? 'other'}
            iconColor={item.row.category?.color ?? '#6B7280'}
            onPress={() => router.push(`/transaction/${t.id}`)}
          />
        );
      }

      return null;
    },
    [
      settings?.profileImagePath,
      scopeLabel,
      totalBalance,
      currency,
      upcoming,
      c.surfaceRaised,
      c.expense,
      c.income,
      summary,
      goals,
      chartRange,
      chartPoints,
      activityMap,
      query,
      typeFilter,
    ]
  );

  return (
    <Screen>
      <View className='flex-1' style={{ paddingHorizontal: layout.gutter }}>
        <FlashList
          data={listData}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          getItemType={(item) => item.kind}
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
          bumpData();
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
