import * as Haptics from 'expo-haptics';

// Діріл барлық құрылғыда жұмыс істемейді — қатесін елемейміз
const safe = (p: Promise<void>) => { p.catch(() => {}); };

export const haptic = {
  select: () => safe(Haptics.selectionAsync()),
  tap: () => safe(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  success: () => safe(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  error: () => safe(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),
  warn: () => safe(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
};
