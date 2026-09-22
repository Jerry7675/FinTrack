import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';

import { useApp } from '@/providers/app-provider';

/**
 * Reloads when the screen gains focus or when global dataRevision changes
 * after a mutation elsewhere in the app.
 */
export function useReloadOnFocus(load: () => void | Promise<void>) {
  const { dataRevision } = useApp();
  const loadRef = useRef(load);
  loadRef.current = load;

  useFocusEffect(
    useCallback(() => {
      void loadRef.current();
    }, [])
  );

  useEffect(() => {
    // Intentionally keyed on dataRevision so mutations elsewhere refetch this screen.
    if (dataRevision < 0) return;
    void loadRef.current();
  }, [dataRevision]);
}
