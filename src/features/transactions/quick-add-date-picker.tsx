import {
  Calendar,
  type CalendarTheme,
  toDateId,
} from '@marceloterreiro/flash-calendar';
import { useMemo } from 'react';
import { Modal, Pressable, View } from 'react-native';

import { AppText, Button, useThemeColors } from '@/components/ui/primitives';
import {
  defaultTransactionDateString,
  parseIsoLocalDate,
} from './submit-add-transaction';

export function QuickAddDatePicker({
  visible,
  value,
  now,
  onClose,
  onChange,
}: {
  visible: boolean;
  value: string;
  now: Date;
  onClose: () => void;
  onChange: (isoDate: string) => void;
}) {
  const c = useThemeColors();
  const todayId = toDateId(now);
  const theme = useMemo<CalendarTheme>(
    () => ({
      rowMonth: { content: { color: c.ink } },
      rowWeek: {
        container: { borderBottomWidth: 0 },
        content: { color: c.inkMuted },
      },
      itemDay: {
        idle: ({ isPressed, isDisabled }) => ({
          container: {
            backgroundColor: isPressed ? c.surfaceHigh : 'transparent',
            borderRadius: 8,
            opacity: isDisabled ? 0.35 : 1,
          },
          content: { color: c.ink },
        }),
        today: ({ isPressed }) => ({
          container: {
            borderWidth: 1,
            borderColor: c.accent,
            borderRadius: 8,
            backgroundColor: isPressed ? c.accentSoft : 'transparent',
          },
          content: { color: c.accent },
        }),
        active: ({ isPressed }) => ({
          container: {
            backgroundColor: isPressed ? c.accent : c.accent,
            borderRadius: 8,
          },
          content: { color: c.inkInverse },
        }),
      },
    }),
    [c]
  );

  const parsedValue = parseIsoLocalDate(value);
  const selectedId = parsedValue ? toDateId(parsedValue) : todayId;

  return (
    <Modal visible={visible} transparent animationType='fade'>
      <Pressable
        className='flex-1 justify-end bg-black/55'
        onPress={onClose}
        accessibilityLabel='Close date picker'
      >
        <Pressable
          className='rounded-t-3xl p-4'
          style={{ backgroundColor: c.surfaceRaised }}
          onPress={(e) => e.stopPropagation()}
        >
          <AppText size='lg' weight='semibold' className='mb-3'>
            Date
          </AppText>
          <Calendar
            calendarActiveDateRanges={[
              {
                startId: selectedId,
                endId: selectedId,
              },
            ]}
            calendarMonthId={selectedId.slice(0, 7)}
            calendarMaxDateId={todayId}
            calendarMinDateId='2000-01-01'
            onCalendarDayPress={(id) => {
              if (id > todayId) return;
              const parsed = parseIsoLocalDate(id);
              if (!parsed) return;
              onChange(defaultTransactionDateString(parsed));
              onClose();
            }}
            theme={theme}
          />
          <View className='mt-3'>
            <Button label='Done' variant='secondary' onPress={onClose} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
