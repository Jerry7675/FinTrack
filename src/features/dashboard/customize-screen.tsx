import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import {
  AppText,
  Button,
  FormScroll,
  Screen,
  ScreenHeader,
  useThemeColors,
} from '@/components/ui/primitives';
import {
  DASHBOARD_CARD_LABELS,
  type DashboardCardConfig,
  parseDashboardLayout,
  serializeDashboardLayout,
} from '@/lib/dashboard-layout';
import { db } from '@/lib/db/client';
import { updateSettings } from '@/lib/db/queries';
import { layout } from '@/lib/layout';
import { useApp } from '@/providers/app-provider';

export function DashboardCustomizeScreen() {
  const { settings, refresh } = useApp();
  const c = useThemeColors();
  const [cards, setCards] = useState<DashboardCardConfig[]>(() =>
    parseDashboardLayout(settings?.dashboardLayout)
  );
  const [saving, setSaving] = useState(false);

  const visibleCount = useMemo(
    () => cards.filter((card) => card.visible).length,
    [cards]
  );

  const toggle = (id: DashboardCardConfig['id']) => {
    setCards((prev) =>
      prev.map((card) =>
        card.id === id ? { ...card, visible: !card.visible } : card
      )
    );
  };

  const move = (index: number, dir: -1 | 1) => {
    setCards((prev) => {
      const next = [...prev];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      const tmp = next[index];
      next[index] = next[target];
      next[target] = tmp;
      return next;
    });
  };

  const save = async () => {
    setSaving(true);
    try {
      await updateSettings(db, {
        dashboardLayout: serializeDashboardLayout(cards),
      });
      await refresh();
    } finally {
      setSaving(false);
    }
  };

  const reset = async () => {
    const def = parseDashboardLayout(null);
    setCards(def);
    await updateSettings(db, {
      dashboardLayout: serializeDashboardLayout(def),
    });
    await refresh();
  };

  return (
    <Screen>
      <FormScroll contentContainerStyle={{ paddingHorizontal: layout.gutter }}>
        <ScreenHeader title='Customize home' />
        <AppText muted className='mt-1'>
          Show, hide, and reorder dashboard sections. {visibleCount} visible.
        </AppText>

        <View className='mt-4'>
          {cards.map((card, index) => (
            <View
              key={card.id}
              className='mb-2 flex-row items-center gap-2 rounded-2xl px-3 py-3'
              style={{
                backgroundColor: c.surfaceRaised,
                borderWidth: 1,
                borderColor: c.line,
              }}
            >
              <Pressable
                onPress={() => toggle(card.id)}
                className='h-6 w-6 items-center justify-center rounded'
                style={{
                  backgroundColor: card.visible ? c.accent : c.surfaceSunken,
                }}
              >
                <AppText
                  size='xs'
                  style={{ color: card.visible ? '#fff' : c.inkMuted }}
                >
                  {card.visible ? '✓' : ''}
                </AppText>
              </Pressable>
              <AppText className='flex-1' weight='medium'>
                {DASHBOARD_CARD_LABELS[card.id]}
              </AppText>
              <Pressable onPress={() => move(index, -1)} hitSlop={8}>
                <AppText muted>↑</AppText>
              </Pressable>
              <Pressable onPress={() => move(index, 1)} hitSlop={8}>
                <AppText muted>↓</AppText>
              </Pressable>
            </View>
          ))}
        </View>

        <View className='mt-4 gap-2'>
          <Button label='Save layout' onPress={save} loading={saving} />
          <Button
            label='Reset to default'
            variant='secondary'
            onPress={reset}
          />
        </View>
      </FormScroll>
    </Screen>
  );
}
