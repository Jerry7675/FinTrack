import * as Updates from 'expo-updates';
import { AppState, type AppStateStatus } from 'react-native';

/** Check, download, and apply an OTA update when available. No-ops in Expo Go / offline. */
export async function checkAndApplyUpdate(): Promise<void> {
  if (__DEV__ || !Updates.isEnabled) return;
  try {
    const result = await Updates.checkForUpdateAsync();
    if (!result.isAvailable) return;
    const fetched = await Updates.fetchUpdateAsync();
    if (fetched.isNew) {
      await Updates.reloadAsync();
    }
  } catch {
    // Offline or update service unavailable — keep running the embedded bundle.
  }
}

/** Run an update check on mount and whenever the app returns to the foreground. */
export function startUpdateChecks(): () => void {
  void checkAndApplyUpdate();

  const onChange = (state: AppStateStatus) => {
    if (state === 'active') {
      void checkAndApplyUpdate();
    }
  };
  const sub = AppState.addEventListener('change', onChange);
  return () => sub.remove();
}
