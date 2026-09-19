import { LinearGradient, Path, vec } from '@shopify/react-native-skia';
import { format, startOfDay, subDays } from 'date-fns';
import { useMemo } from 'react';
import { View } from 'react-native';
import {
  CartesianChart,
  type ChartBounds,
  Line,
  Pie,
  type PointsArray,
  PolarChart,
  useAreaPath,
  useBarPath,
} from 'victory-native';

import {
  AppText,
  Card,
  Chip,
  useThemeColors,
} from '@/components/ui/primitives';
import { layout, scale, vs } from '@/lib/layout';

export type ChartRange = '7d' | '14d' | '30d' | '90d' | '1y';

export const CHART_RANGES: { key: ChartRange; label: string; days: number }[] =
  [
    { key: '7d', label: '1W', days: 7 },
    { key: '14d', label: '2W', days: 14 },
    { key: '30d', label: '1M', days: 30 },
    { key: '90d', label: '3M', days: 90 },
    { key: '1y', label: '1Y', days: 365 },
  ];

export function RangeFilters({
  value,
  onChange,
  ranges = CHART_RANGES,
}: {
  value: ChartRange;
  onChange: (v: ChartRange) => void;
  ranges?: { key: ChartRange; label: string; days: number }[];
}) {
  return (
    <View className='flex-row flex-wrap gap-2'>
      {ranges.map((r) => (
        <Chip
          key={r.key}
          label={r.label}
          active={value === r.key}
          onPress={() => onChange(r.key)}
        />
      ))}
    </View>
  );
}

function chartHeight(base: number) {
  return vs(base);
}

function GradientArea({
  points,
  chartBounds,
  color,
}: {
  points: PointsArray;
  chartBounds: ChartBounds;
  color: string;
}) {
  const { path } = useAreaPath(points, chartBounds.bottom, {
    curveType: 'natural',
  });
  return (
    <Path path={path} style='fill'>
      <LinearGradient
        start={vec(0, chartBounds.top)}
        end={vec(0, chartBounds.bottom)}
        colors={[`${color}AA`, `${color}00`]}
      />
    </Path>
  );
}

function GradientBars({
  points,
  chartBounds,
  color,
}: {
  points: PointsArray;
  chartBounds: ChartBounds;
  color: string;
}) {
  const { path } = useBarPath(points, chartBounds, 0.28, {
    topLeft: 6,
    topRight: 6,
  });
  return (
    <Path path={path} style='fill'>
      <LinearGradient
        start={vec(0, chartBounds.top)}
        end={vec(0, chartBounds.bottom)}
        colors={[color, `${color}66`]}
      />
    </Path>
  );
}

export function SpendAreaChart({
  points,
  title = 'Spending',
}: {
  points: { date: Date; value: number }[];
  title?: string;
}) {
  const c = useThemeColors();
  const data = useMemo(
    () =>
      points.map((p, i) => ({
        x: i,
        value: Math.max(0, p.value),
        label: format(p.date, 'd MMM'),
      })),
    [points]
  );

  if (!points.length) {
    return (
      <Card>
        <AppText muted>No data for this range</AppText>
      </Card>
    );
  }

  const first = points[0]?.date;
  const last = points[points.length - 1]?.date;

  return (
    <Card>
      <View className='mb-3 flex-row items-end justify-between'>
        <AppText size='sm' muted weight='semibold'>
          {title.toUpperCase()}
        </AppText>
        {first && last ? (
          <AppText size='xs' muted>
            {format(first, 'MMM d')} – {format(last, 'MMM d')}
          </AppText>
        ) : null}
      </View>
      <View style={{ height: chartHeight(180), width: '100%' }}>
        <CartesianChart
          data={data}
          xKey='x'
          yKeys={['value']}
          domainPadding={{ top: 24, bottom: 4 }}
          padding={{ left: 4, right: 4, top: 8, bottom: 4 }}
          axisOptions={{
            tickCount: { x: 0, y: 4 },
            lineWidth: { grid: { x: 0, y: 1 }, frame: 0 },
            lineColor: {
              grid: { x: 'transparent', y: c.line },
              frame: 'transparent',
            },
          }}
        >
          {({ points: pts, chartBounds }) => (
            <>
              <GradientArea
                points={pts.value}
                chartBounds={chartBounds}
                color={c.chart}
              />
              <Line
                points={pts.value}
                color={c.chart}
                strokeWidth={3}
                curveType='natural'
                animate={{ type: 'timing', duration: 450 }}
              />
            </>
          )}
        </CartesianChart>
      </View>
    </Card>
  );
}

export function SpendBarChart({
  points,
}: {
  points: { date: Date; value: number }[];
}) {
  const c = useThemeColors();
  const data = useMemo(
    () =>
      points.map((p, i) => ({
        x: i,
        value: Math.max(0, p.value),
      })),
    [points]
  );

  if (!data.length) return null;

  return (
    <Card>
      <AppText size='sm' muted weight='semibold' className='mb-3'>
        DAY BY DAY
      </AppText>
      <View style={{ height: chartHeight(140), width: '100%' }}>
        <CartesianChart
          data={data}
          xKey='x'
          yKeys={['value']}
          domainPadding={{ top: 16, left: 8, right: 8 }}
          padding={{ left: 4, right: 4, top: 4, bottom: 4 }}
          axisOptions={{
            tickCount: { x: 0, y: 3 },
            lineWidth: { grid: { x: 0, y: 1 }, frame: 0 },
            lineColor: {
              grid: { x: 'transparent', y: c.line },
              frame: 'transparent',
            },
          }}
        >
          {({ points: pts, chartBounds }) => (
            <GradientBars
              points={pts.value}
              chartBounds={chartBounds}
              color={c.chart}
            />
          )}
        </CartesianChart>
      </View>
    </Card>
  );
}

export function CategoryDonut({
  slices,
}: {
  slices: { label: string; value: number; color: string }[];
}) {
  const c = useThemeColors();
  const data = useMemo(
    () =>
      slices
        .filter((s) => s.value > 0)
        .map((s) => ({
          label: s.label,
          value: s.value,
          color: s.color,
        })),
    [slices]
  );

  if (!data.length) {
    return <AppText muted>No categories yet</AppText>;
  }

  return (
    <View style={{ height: scale(220), width: '100%' }}>
      <PolarChart
        data={data}
        labelKey='label'
        valueKey='value'
        colorKey='color'
      >
        <Pie.Chart innerRadius='58%'>
          {() => (
            <>
              <Pie.Slice animate={{ type: 'spring' }} />
              <Pie.SliceAngularInset
                animate={{ type: 'spring' }}
                angularInset={{
                  angularStrokeWidth: 3,
                  angularStrokeColor: c.surfaceRaised,
                }}
              />
            </>
          )}
        </Pie.Chart>
      </PolarChart>
    </View>
  );
}

/** Dot-matrix style activity heatmap for the current month window. */
export function ActivityDots({
  amountsByDay,
  days = 35,
}: {
  amountsByDay: Map<string, number>;
  days?: number;
}) {
  const c = useThemeColors();
  const cells = useMemo(() => {
    const max = Math.max(1, ...amountsByDay.values());
    return Array.from({ length: days }, (_, i) => {
      const day = startOfDay(subDays(new Date(), days - 1 - i));
      const key = format(day, 'yyyy-MM-dd');
      const amount = amountsByDay.get(key) ?? 0;
      const intensity = amount <= 0 ? 0 : Math.min(1, amount / max);
      return { key, intensity, amount };
    });
  }, [amountsByDay, days]);

  return (
    <Card>
      <AppText size='sm' muted weight='semibold' className='mb-3'>
        THIS MONTH ACTIVITY
      </AppText>
      <View className='flex-row flex-wrap gap-1.5'>
        {cells.map((cell) => (
          <View
            key={cell.key}
            style={{
              width: scale(10),
              height: scale(10),
              borderRadius: scale(5),
              backgroundColor:
                cell.intensity === 0
                  ? c.line
                  : cell.intensity < 0.33
                    ? `${c.chart}55`
                    : cell.intensity < 0.66
                      ? `${c.chart}99`
                      : c.chart,
            }}
          />
        ))}
      </View>
    </Card>
  );
}

export function buildDailySeries(
  rows: { occurredAt: Date; amountMinor: number }[],
  days: number
): { date: Date; value: number }[] {
  return Array.from({ length: days }, (_, i) => {
    const day = startOfDay(subDays(new Date(), days - 1 - i));
    const next = new Date(day);
    next.setDate(next.getDate() + 1);
    const value =
      rows
        .filter((t) => t.occurredAt >= day && t.occurredAt < next)
        .reduce((s, t) => s + Math.abs(t.amountMinor), 0) / 100;
    return { date: day, value };
  });
}

export const chartContentWidth = () =>
  layout.screenWidth - layout.gutter * 2 - scale(40);
