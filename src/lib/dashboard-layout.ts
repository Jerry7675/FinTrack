export type DashboardCardId =
  | 'balance'
  | 'actions'
  | 'planning'
  | 'summary'
  | 'goals'
  | 'chart'
  | 'activity'
  | 'transactions';

export type DashboardCardConfig = {
  id: DashboardCardId;
  visible: boolean;
};

export const DEFAULT_DASHBOARD_LAYOUT: DashboardCardConfig[] = [
  { id: 'balance', visible: true },
  { id: 'actions', visible: true },
  { id: 'planning', visible: true },
  { id: 'summary', visible: true },
  { id: 'goals', visible: true },
  { id: 'chart', visible: true },
  { id: 'activity', visible: true },
  { id: 'transactions', visible: true },
];

export const DASHBOARD_CARD_LABELS: Record<DashboardCardId, string> = {
  balance: 'Balance',
  actions: 'Quick actions',
  planning: 'Money moving',
  summary: 'Spent / income / transfers',
  goals: 'Goals',
  chart: 'Spending chart',
  activity: 'Activity dots',
  transactions: 'Recent transactions',
};

const VALID_IDS = new Set<DashboardCardId>(
  DEFAULT_DASHBOARD_LAYOUT.map((c) => c.id)
);

export function parseDashboardLayout(
  raw: string | null | undefined
): DashboardCardConfig[] {
  if (!raw) return DEFAULT_DASHBOARD_LAYOUT.map((c) => ({ ...c }));
  try {
    const parsed = JSON.parse(raw) as DashboardCardConfig[];
    if (!Array.isArray(parsed) || !parsed.length) {
      return DEFAULT_DASHBOARD_LAYOUT.map((c) => ({ ...c }));
    }

    const seen = new Set<DashboardCardId>();
    const ordered: DashboardCardConfig[] = [];

    for (const item of parsed) {
      if (!item || !VALID_IDS.has(item.id) || seen.has(item.id)) continue;
      seen.add(item.id);
      ordered.push({ id: item.id, visible: Boolean(item.visible) });
    }

    for (const def of DEFAULT_DASHBOARD_LAYOUT) {
      if (!seen.has(def.id)) {
        ordered.push({ ...def });
      }
    }

    return ordered;
  } catch {
    return DEFAULT_DASHBOARD_LAYOUT.map((c) => ({ ...c }));
  }
}

export function serializeDashboardLayout(
  layout: DashboardCardConfig[]
): string {
  return JSON.stringify(layout);
}
