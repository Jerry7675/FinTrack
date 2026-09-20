export type DashboardCardId =
  | 'balance'
  | 'actions'
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
  { id: 'summary', visible: true },
  { id: 'goals', visible: true },
  { id: 'chart', visible: true },
  { id: 'activity', visible: true },
  { id: 'transactions', visible: true },
];

export const DASHBOARD_CARD_LABELS: Record<DashboardCardId, string> = {
  balance: 'Balance',
  actions: 'Quick actions',
  summary: 'Spent / income / transfers',
  goals: 'Goals',
  chart: 'Spending chart',
  activity: 'Activity dots',
  transactions: 'Recent transactions',
};

export function parseDashboardLayout(
  raw: string | null | undefined
): DashboardCardConfig[] {
  if (!raw) return DEFAULT_DASHBOARD_LAYOUT.map((c) => ({ ...c }));
  try {
    const parsed = JSON.parse(raw) as DashboardCardConfig[];
    if (!Array.isArray(parsed) || !parsed.length) {
      return DEFAULT_DASHBOARD_LAYOUT.map((c) => ({ ...c }));
    }
    const byId = new Map(parsed.map((c) => [c.id, c]));
    return DEFAULT_DASHBOARD_LAYOUT.map((def) => {
      const hit = byId.get(def.id);
      return hit ? { id: def.id, visible: Boolean(hit.visible) } : { ...def };
    });
  } catch {
    return DEFAULT_DASHBOARD_LAYOUT.map((c) => ({ ...c }));
  }
}

export function serializeDashboardLayout(
  layout: DashboardCardConfig[]
): string {
  return JSON.stringify(layout);
}
