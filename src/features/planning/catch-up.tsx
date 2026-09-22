import { useCallback, useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { useToast } from '@/components/ui/toast';
import { db } from '@/lib/db/client';
import { materializeDuePlanning } from '@/lib/planning/materialize';
import { useApp } from '@/providers/app-provider';

/**
 * Runs planning auto-post catch-up when the app is ready / returns to
 * foreground, then surfaces toast + budget pulse + dataRevision bump.
 */
export function PlanningCatchUp() {
  const { ready, bumpData } = useApp();
  const { showToast } = useToast();
  const running = useRef(false);

  const run = useCallback(async () => {
    if (!ready || running.current) return;
    running.current = true;
    try {
      const result = await materializeDuePlanning(db);
      if (result.posted.length) {
        bumpData();
        const n = result.posted.length;
        for (const alert of result.budgetAlerts.slice(0, 1)) {
          const pct = Math.round(alert.ratio * 100);
          const budgetMsg =
            alert.status === 'exceeded'
              ? `${alert.name} budget exceeded (${pct}%)`
              : `${alert.name} budget ${pct}% used`;
          showToast(
            `${n === 1 ? `Posted ${result.posted[0].title}` : `Posted ${n} planned payments`} · ${budgetMsg}`,
            alert.status === 'exceeded' ? 'error' : 'success'
          );
          return;
        }
        showToast(
          n === 1
            ? `Posted ${result.posted[0].title}`
            : `Posted ${n} planned payments`,
          'success'
        );
      }
    } catch (e) {
      console.warn('Planning catch-up failed', e);
    } finally {
      running.current = false;
    }
  }, [ready, bumpData, showToast]);

  useEffect(() => {
    void run();
  }, [run]);

  useEffect(() => {
    const onChange = (state: AppStateStatus) => {
      if (state === 'active') void run();
    };
    const sub = AppState.addEventListener('change', onChange);
    return () => sub.remove();
  }, [run]);

  return null;
}
