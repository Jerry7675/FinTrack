import {
  Calendar,
  type CalendarTheme,
  fromDateId,
  toDateId,
} from '@marceloterreiro/flash-calendar';
import { addMonths, format, parseISO, startOfMonth } from 'date-fns';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { AppText, Card, useThemeColors } from '@/components/ui/primitives';
import { scale } from '@/lib/layout';
import { useApp } from '@/providers/app-provider';

type Props = {
  markedAmounts: Map<string, number>;
  selected?: string;
  onSelect?: (date: string) => void;
  title?: string;
};

export function ActivityCalendar({
  markedAmounts,
  selected,
  onSelect,
  title = 'Calendar',
}: Props) {
  const c = useThemeColors();
  const { colorScheme } = useApp();
  const [monthId, setMonthId] = useState(() =>
    toDateId(startOfMonth(new Date()))
  );

  const max = useMemo(
    () => Math.max(1, ...markedAmounts.values()),
    [markedAmounts]
  );

  const theme = useMemo<CalendarTheme>(
    () => ({
      rowMonth: {
        content: {
          color: c.ink,
          fontWeight: '700',
          fontSize: 16,
          textAlign: 'center',
        },
      },
      itemWeekName: {
        content: {
          color: c.inkMuted,
          fontWeight: '600',
          fontSize: 12,
        },
      },
      itemDay: {
        base: ({ id }) => {
          const amount = markedAmounts.get(id) ?? 0;
          const intensity = amount <= 0 ? 0 : Math.min(1, amount / max);
          return {
            container: {
              backgroundColor:
                intensity === 0
                  ? 'transparent'
                  : intensity < 0.4
                    ? c.accentSoft
                    : `${c.chart}44`,
              borderRadius: 12,
            },
            content: {
              color: c.ink,
              fontWeight: intensity > 0 ? '600' : '400',
            },
          };
        },
        today: () => ({
          container: {
            borderWidth: 1.5,
            borderColor: c.accent,
            borderRadius: 12,
          },
          content: { color: c.accent, fontWeight: '700' },
        }),
        active: () => ({
          container: {
            backgroundColor: c.accent,
            borderRadius: 12,
          },
          content: {
            color: colorScheme === 'dark' ? '#0A0A0A' : '#FFFFFF',
            fontWeight: '700',
          },
        }),
      },
    }),
    [c, colorScheme, markedAmounts, max]
  );

  const activeRanges = selected ? [{ startId: selected, endId: selected }] : [];

  const shiftMonth = (delta: number) => {
    const next = addMonths(fromDateId(monthId), delta);
    setMonthId(toDateId(startOfMonth(next)));
  };

  return (
    <Card className='overflow-hidden'>
      <View className='mb-2 flex-row items-center justify-between px-1'>
        <AppText size='sm' muted weight='semibold'>
          {title.toUpperCase()}
        </AppText>
        <View className='flex-row items-center gap-3'>
          <Pressable onPress={() => shiftMonth(-1)} hitSlop={8}>
            <AppText weight='semibold' style={{ color: c.accent }}>
              ‹
            </AppText>
          </Pressable>
          <Pressable onPress={() => shiftMonth(1)} hitSlop={8}>
            <AppText weight='semibold' style={{ color: c.accent }}>
              ›
            </AppText>
          </Pressable>
        </View>
      </View>

      <Calendar
        calendarInstanceId='fintrack-activity'
        calendarMonthId={monthId}
        calendarColorScheme={colorScheme}
        calendarActiveDateRanges={activeRanges}
        calendarDayHeight={scale(40)}
        calendarRowHorizontalSpacing={4}
        calendarRowVerticalSpacing={8}
        onCalendarDayPress={(id) => onSelect?.(id)}
        theme={theme}
      />

      {selected && markedAmounts.has(selected) ? (
        <View className='mt-2 px-1'>
          <AppText size='sm' muted>
            {format(parseISO(selected), 'MMM d, yyyy')} · spend{' '}
            {((markedAmounts.get(selected) ?? 0) / 100).toFixed(2)}
          </AppText>
        </View>
      ) : selected ? (
        <View className='mt-2 px-1'>
          <AppText size='sm' muted>
            {format(parseISO(selected), 'MMM d, yyyy')} · no spend
          </AppText>
        </View>
      ) : null}
    </Card>
  );
}
