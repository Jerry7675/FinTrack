import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useColorScheme as useSystemScheme } from 'react-native';

import { db } from '@/lib/db/client';
import migrations from '@/lib/db/migrations/migrations';
import { listAccounts, listGroups, updateSettings } from '@/lib/db/queries';
import type { Account, AccountGroup, Settings } from '@/lib/db/schema';
import { ensureSeedData, getSettings } from '@/lib/db/seed';

type ThemePreference = 'system' | 'light' | 'dark';

type AppContextValue = {
  ready: boolean;
  migrationError?: Error;
  settings: Settings | null;
  groups: AccountGroup[];
  accounts: Account[];
  colorScheme: 'light' | 'dark';
  unlocked: boolean;
  setUnlocked: (value: boolean) => void;
  refresh: () => Promise<void>;
  setTheme: (theme: ThemePreference) => Promise<void>;
  setActiveScope: (input: {
    groupId?: string | null;
    accountId?: string | null;
  }) => Promise<void>;
  completeOnboarding: () => Promise<void>;
  setLockEnabled: (enabled: boolean) => Promise<void>;
};

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const { success, error } = useMigrations(db, migrations);
  const systemScheme = useSystemScheme();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [groups, setGroups] = useState<AccountGroup[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [seeded, setSeeded] = useState(false);
  const [unlocked, setUnlocked] = useState(false);

  const refresh = useCallback(async () => {
    const [nextSettings, nextGroups, nextAccounts] = await Promise.all([
      getSettings(db),
      listGroups(db),
      listAccounts(db),
    ]);
    setSettings(nextSettings);
    setGroups(nextGroups);
    setAccounts(nextAccounts);
  }, []);

  useEffect(() => {
    if (!success) return;
    let cancelled = false;
    (async () => {
      await ensureSeedData(db);
      if (cancelled) return;
      setSeeded(true);
      await refresh();
    })();
    return () => {
      cancelled = true;
    };
  }, [success, refresh]);

  useEffect(() => {
    if (settings && !settings.lockEnabled) {
      setUnlocked(true);
    }
  }, [settings]);

  const colorScheme: 'light' | 'dark' = useMemo(() => {
    const pref = settings?.theme ?? 'system';
    if (pref === 'light' || pref === 'dark') return pref;
    return systemScheme === 'dark' ? 'dark' : 'light';
  }, [settings?.theme, systemScheme]);

  const setTheme = useCallback(
    async (theme: ThemePreference) => {
      await updateSettings(db, { theme });
      await refresh();
    },
    [refresh]
  );

  const setActiveScope = useCallback(
    async (input: { groupId?: string | null; accountId?: string | null }) => {
      const patch: Parameters<typeof updateSettings>[1] = {};
      if (input.groupId !== undefined) patch.activeGroupId = input.groupId;
      if (input.accountId !== undefined)
        patch.activeAccountId = input.accountId;
      await updateSettings(db, patch);
      await refresh();
    },
    [refresh]
  );

  const completeOnboarding = useCallback(async () => {
    await updateSettings(db, { onboardingDone: true });
    await refresh();
  }, [refresh]);

  const setLockEnabled = useCallback(
    async (enabled: boolean) => {
      await updateSettings(db, { lockEnabled: enabled });
      if (!enabled) setUnlocked(true);
      else setUnlocked(false);
      await refresh();
    },
    [refresh]
  );

  const value: AppContextValue = {
    ready: Boolean(success && seeded && settings),
    migrationError: error,
    settings,
    groups,
    accounts,
    colorScheme,
    unlocked,
    setUnlocked,
    refresh,
    setTheme,
    setActiveScope,
    completeOnboarding,
    setLockEnabled,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
