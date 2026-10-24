import { Ionicons } from '@expo/vector-icons';
import { createContext, ReactNode, useCallback, useContext, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { haptic } from './haptics';
import { t } from './i18n';
import { colors, radius, themed } from './theme';
import { Button } from './ui';

// Alert.alert вебте жұмыс істемейді, сондықтан toast пен растау терезесі өзіміздікі

type ToastType = 'success' | 'error' | 'info';
type Toast = { id: number; type: ToastType; message: string };

type ConfirmOptions = { title: string; message?: string; confirm?: string; cancel?: string; destructive?: boolean };
type ConfirmState = ConfirmOptions & { resolve: (ok: boolean) => void };

type FeedbackApi = {
  toast: (message: string, type?: ToastType) => void;
  confirm: (o: ConfirmOptions) => Promise<boolean>;
};

const Ctx = createContext<FeedbackApi>({ toast: () => {}, confirm: async () => false });

export const useFeedback = () => useContext(Ctx);

const ICON = { success: 'checkmark-circle', error: 'alert-circle', info: 'information-circle' } as const;
const tint = (type: ToastType) => ({ success: colors.brand, error: colors.danger, info: colors.info }[type]);

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [dialog, setDialog] = useState<ConfirmState | null>(null);
  const seq = useRef(0);

  const toast = useCallback((message: string, type: ToastType = 'info') => {
    const id = ++seq.current;
    if (type === 'success') haptic.success();
    if (type === 'error') haptic.error();
    setToasts((t) => [...t.slice(-2), { id, type, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);

  const confirm = useCallback((o: ConfirmOptions) => {
    if (o.destructive) haptic.warn();
    return new Promise<boolean>((resolve) => setDialog({ ...o, resolve }));
  }, []);

  const close = (ok: boolean) => {
    dialog?.resolve(ok);
    setDialog(null);
  };

  return (
    <Ctx.Provider value={{ toast, confirm }}>
      {children}
      <View pointerEvents="box-none" style={[StyleSheet.absoluteFill, { paddingTop: insets.top + 8 }]}>
        {toasts.map((x) => (
          <Animated.View key={x.id} entering={FadeInUp} exiting={FadeOutUp} style={st.toast}>
            <Ionicons name={ICON[x.type]} size={20} color={tint(x.type)} />
            <Text style={st.toastText}>{x.message}</Text>
          </Animated.View>
        ))}
      </View>
      <Modal transparent visible={!!dialog} animationType="fade" onRequestClose={() => close(false)}>
        <Pressable style={st.backdrop} onPress={() => close(false)}>
          <Pressable style={st.dialog} onPress={() => {}}>
            <Text style={st.title}>{dialog?.title}</Text>
            {dialog?.message && <Text style={st.message}>{dialog.message}</Text>}
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
              <Button title={dialog?.cancel ?? t('common.no')} variant="ghost" onPress={() => close(false)} style={{ flex: 1 }} />
              <Button
                title={dialog?.confirm ?? t('common.yes')}
                variant={dialog?.destructive ? 'danger' : 'primary'}
                onPress={() => close(true)}
                style={{ flex: 1 }}
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </Ctx.Provider>
  );
}

const st = themed((colors) => ({
  toast: {
    flexDirection: 'row', alignItems: 'center', gap: 10, alignSelf: 'center', maxWidth: 520, width: '92%',
    backgroundColor: colors.cardAlt, borderColor: colors.border, borderWidth: 1, borderRadius: radius.md,
    paddingHorizontal: 14, paddingVertical: 12, marginBottom: 8,
    shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 8,
  },
  toastText: { color: colors.text, fontSize: 14, fontWeight: '600', flex: 1 },
  backdrop: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', padding: 24 },
  dialog: { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: radius.lg, padding: 20, maxWidth: 440, width: '100%', alignSelf: 'center' },
  title: { color: colors.text, fontSize: 18, fontWeight: '800' },
  message: { color: colors.muted, fontSize: 14, marginTop: 8, lineHeight: 20 },
}));
