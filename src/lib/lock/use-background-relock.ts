import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import {
  BACKGROUND_RELOCK_GRACE_MS,
  isRelockSuppressed,
  shouldRelockAfterBackground,
} from './relock';

export function useBackgroundRelock(
  enabled: boolean,
  onRelock: () => void
): void {
  const backgroundSinceRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const clearTimer = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };

    const scheduleRelockWhileBackgrounded = () => {
      clearTimer();
      timerRef.current = setTimeout(() => {
        if (isRelockSuppressed()) return;
        if (AppState.currentState !== 'background') return;
        onRelock();
      }, BACKGROUND_RELOCK_GRACE_MS);
    };

    const onChange = (nextState: AppStateStatus) => {
      if (nextState === 'background') {
        backgroundSinceRef.current = Date.now();
        scheduleRelockWhileBackgrounded();
        return;
      }

      if (nextState === 'active') {
        clearTimer();
        const since = backgroundSinceRef.current;
        backgroundSinceRef.current = null;
        if (since && !isRelockSuppressed()) {
          const elapsed = Date.now() - since;
          if (shouldRelockAfterBackground(elapsed)) {
            onRelock();
          }
        }
      }
    };

    const subscription = AppState.addEventListener('change', onChange);
    return () => {
      subscription.remove();
      clearTimer();
    };
  }, [enabled, onRelock]);
}
