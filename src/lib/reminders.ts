import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { cityName } from './cities';
import { formatTime } from './format';
import { t } from './i18n';
import { ShiftView } from './types';

// Ауысымнан 1 сағат бұрын телефонның өзінде жоспарланатын хабарлама.
// Серверсіз жұмыс істейді, сондықтан Expo Go-да да көрінеді.
const BEFORE_MS = 60 * 60 * 1000;

let enabled = true;
export const setRemindersEnabled = (v: boolean) => { enabled = v; };

const supported = Platform.OS !== 'web';
const idFor = (shiftId: string) => `shift-${shiftId}`;

if (supported) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
  });
}

async function ensurePermission() {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  return (await Notifications.requestPermissionsAsync()).granted;
}

export async function scheduleShiftReminder(s: Pick<ShiftView, 'id' | 'title' | 'starts_at' | 'city' | 'address'>) {
  if (!supported || !enabled) return;
  const at = new Date(new Date(s.starts_at).getTime() - BEFORE_MS);
  if (at.getTime() <= Date.now()) return;
  try {
    if (!(await ensurePermission())) return;
    await Notifications.cancelScheduledNotificationAsync(idFor(s.id)).catch(() => {});
    await Notifications.scheduleNotificationAsync({
      identifier: idFor(s.id),
      content: {
        title: t('reminder.title'),
        body: t('reminder.body', { title: s.title, time: formatTime(s.starts_at), place: s.address || cityName(s.city) }),
        data: { shiftId: s.id },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at },
    });
  } catch {
    // Хабарлама міндетті емес — қате болса, жазылуға кедергі келтірмейміз
  }
}

export async function cancelShiftReminder(shiftId: string) {
  if (!supported) return;
  await Notifications.cancelScheduledNotificationAsync(idFor(shiftId)).catch(() => {});
}

export async function cancelAllReminders() {
  if (!supported) return;
  await Notifications.cancelAllScheduledNotificationsAsync().catch(() => {});
}

// Қосымша ашылғанда: алдағы жазылымдарға еске салғыштарды қалпына келтіру
export async function syncShiftReminders(shifts: Pick<ShiftView, 'id' | 'title' | 'starts_at' | 'city' | 'address'>[]) {
  if (!supported) return;
  if (!enabled) return cancelAllReminders();
  for (const s of shifts) await scheduleShiftReminder(s);
}
