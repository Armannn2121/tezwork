import * as Haptics from 'expo-haptics';

let enabled = true;
export const setHapticsEnabled = (v: boolean) => { enabled = v; };

// Діріл барлық құрылғыда жұмыс істемейді — қатесін елемейміз
const safe = (fn: () => Promise<void>) => { if (enabled) fn().catch(() => {}); };

export const haptic = {
  select: () => safe(() => Haptics.selectionAsync()),
  tap: () => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  success: () => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  error: () => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),
  warn: () => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
};
