import { useCallback, useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';

import {
  AppText,
  Card,
  EmptyState,
  FormScroll,
  Screen,
  ScreenHeader,
  useThemeColors,
} from '@/components/ui/primitives';
import { characters } from '@/constants/characters';
import { db } from '@/lib/db/client';
import { getNetWorthSnapshot } from '@/lib/db/queries';
import { layout } from '@/lib/layout';
import { formatMoney } from '@/lib/money';
import { useApp } from '@/providers/app-provider';

export function NetWorthScreen() {
  const { settings } = useApp();
  const c = useThemeColors();
  const [snap, setSnap] = useState<Awaited<
    ReturnType<typeof getNetWorthSnapshot>
  > | null>(null);

  const load = useCallback(async () => {
    setSnap(await getNetWorthSnapshot(db));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const defaultCurrency = settings?.defaultCurrency ?? 'USD';

  const totals = useMemo(() => {
    if (!snap) return { assets: 0, liabilities: 0, receivables: 0, net: 0 };
    // Only sum lines matching default currency to avoid silent multi-currency mix
    const assets = snap.assetLines
      .filter((l) => l.currencyCode === defaultCurrency)
      .reduce((s, l) => s + l.amountMinor, 0);
    const liabilities = snap.liabilityLines
      .filter((l) => l.currencyCode === defaultCurrency)
      .reduce((s, l) => s + l.amountMinor, 0);
    const receivables = snap.receivableLines
      .filter((l) => l.currencyCode === defaultCurrency)
      .reduce((s, l) => s + l.amountMinor, 0);
    return {
      assets,
      liabilities,
      receivables,
      net: assets + receivables - liabilities,
    };
  }, [snap, defaultCurrency]);

  if (!snap) {
    return (
      <Screen>
        <FormScroll
          contentContainerStyle={{ paddingHorizontal: layout.gutter }}
        >
          <ScreenHeader title='Net worth' />
          <AppText muted className='mt-4'>
            Loading…
          </AppText>
        </FormScroll>
      </Screen>
    );
  }

  const empty =
    !snap.assetLines.length &&
    !snap.liabilityLines.length &&
    !snap.receivableLines.length;

  return (
    <Screen>
      <FormScroll contentContainerStyle={{ paddingHorizontal: layout.gutter }}>
        <ScreenHeader title='Net worth' />
        <AppText muted className='mt-1'>
          Assets and liabilities in {defaultCurrency}. Other currencies are
          listed separately and not combined.
        </AppText>

        <Card className='mt-4'>
          <AppText size='sm' muted>
            Net worth ({defaultCurrency})
          </AppText>
          <AppText size='xl' weight='bold' className='mt-1'>
            {formatMoney(totals.net, defaultCurrency)}
          </AppText>
          <AppText size='sm' muted className='mt-2'>
            Assets {formatMoney(totals.assets, defaultCurrency)} · Owed to you{' '}
            {formatMoney(totals.receivables, defaultCurrency)} · You owe{' '}
            {formatMoney(totals.liabilities, defaultCurrency)}
          </AppText>
        </Card>

        {empty ? (
          <EmptyState
            title='No balances yet'
            subtitle='Add accounts and debts to see your net worth.'
            character={characters.empty}
          />
        ) : null}

        <AppText size='sm' muted weight='semibold' className='mt-6 mb-2'>
          ASSETS
        </AppText>
        {snap.assetLines.map((l) => (
          <View
            key={l.id}
            className='flex-row justify-between py-3'
            style={{ borderBottomWidth: 1, borderBottomColor: c.line }}
          >
            <AppText weight='medium'>{l.name}</AppText>
            <AppText>{formatMoney(l.amountMinor, l.currencyCode)}</AppText>
          </View>
        ))}

        <AppText size='sm' muted weight='semibold' className='mt-6 mb-2'>
          OWED TO YOU
        </AppText>
        {snap.receivableLines.length === 0 ? (
          <AppText muted size='sm'>
            None
          </AppText>
        ) : (
          snap.receivableLines.map((l) => (
            <View
              key={l.id}
              className='flex-row justify-between py-3'
              style={{ borderBottomWidth: 1, borderBottomColor: c.line }}
            >
              <AppText weight='medium'>{l.name}</AppText>
              <AppText style={{ color: c.income }}>
                {formatMoney(l.amountMinor, l.currencyCode)}
              </AppText>
            </View>
          ))
        )}

        <AppText size='sm' muted weight='semibold' className='mt-6 mb-2'>
          LIABILITIES
        </AppText>
        {snap.liabilityLines.length === 0 ? (
          <AppText muted size='sm'>
            None
          </AppText>
        ) : (
          snap.liabilityLines.map((l) => (
            <View
              key={l.id}
              className='flex-row justify-between py-3'
              style={{ borderBottomWidth: 1, borderBottomColor: c.line }}
            >
              <AppText weight='medium'>{l.name}</AppText>
              <AppText style={{ color: c.expense }}>
                {formatMoney(l.amountMinor, l.currencyCode)}
              </AppText>
            </View>
          ))
        )}
      </FormScroll>
    </Screen>
  );
}
