import Constants from 'expo-constants';
import { Platform } from 'react-native';

type NotificationsModule = typeof import('expo-notifications');

const isExpoGo = Constants.appOwnership === 'expo';

let notificationsPromise: Promise<NotificationsModule | null> | null = null;

async function getNotifications(): Promise<NotificationsModule | null> {
  if (isExpoGo) return null;
  if (!notificationsPromise) {
    notificationsPromise = import('expo-notifications')
      .then((mod) => {
        mod.setNotificationHandler({
          handleNotification: async () => ({
            shouldShowAlert: true,
            shouldPlaySound: true,
            shouldSetBadge: false,
            shouldShowBanner: true,
            shouldShowList: true,
          }),
        });
        return mod;
      })
      .catch(() => null);
  }
  return notificationsPromise;
}

export async function ensureNotificationPermissions(): Promise<boolean> {
  const Notifications = await getNotifications();
  if (!Notifications) return false;
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const asked = await Notifications.requestPermissionsAsync();
  return asked.granted;
}

export async function scheduleReminder(input: {
  id?: string;
  title: string;
  body: string;
  when: Date;
}): Promise<string | null> {
  const Notifications = await getNotifications();
  if (!Notifications) return null;
  const ok = await ensureNotificationPermissions();
  if (!ok) return null;
  if (input.when.getTime() <= Date.now()) return null;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('reminders', {
      name: 'Reminders',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  return Notifications.scheduleNotificationAsync({
    identifier: input.id,
    content: {
      title: input.title,
      body: input.body,
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: input.when,
    },
  });
}

export async function cancelReminder(id: string) {
  const Notifications = await getNotifications();
  if (!Notifications) return;
  await Notifications.cancelScheduledNotificationAsync(id);
}

export async function cancelAllReminders() {
  const Notifications = await getNotifications();
  if (!Notifications) return;
  await Notifications.cancelAllScheduledNotificationsAsync();
}

/** Schedule due reminders for recurring / subscription / debt dates within 14 days. */
export async function syncPlanningReminders(
  items: {
    key: string;
    title: string;
    body: string;
    dueAt: Date;
  }[]
) {
  const Notifications = await getNotifications();
  if (!Notifications) return;

  const ok = await ensureNotificationPermissions();
  if (!ok) return;

  const upcoming = items.filter((i) => {
    const t = i.dueAt.getTime();
    return t > Date.now() && t < Date.now() + 14 * 24 * 60 * 60 * 1000;
  });

  for (const item of upcoming) {
    await scheduleReminder({
      id: `ft-${item.key}`,
      title: item.title,
      body: item.body,
      when: item.dueAt,
    });
  }
}

export function notificationsAvailable() {
  return !isExpoGo;
}
