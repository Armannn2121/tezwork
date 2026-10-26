import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';
import Animated, { SlideInUp, SlideOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DEMO_MODE, DEMO_OTPS } from '../lib/config';
import { formatPhone } from '../lib/format';
import { t } from '../lib/i18n';
import { colors, themed } from '../lib/theme';

// ДЕМО: SMS/мессенджер хабарламасына ұқсайтын баннер. Басқанда код өрісіне енгізіледі.
// Тақырыпқа тәуелсіз, жүйелік хабарлама сияқты көрінуі үшін түстері тұрақты.
export function DemoSmsBanner({ code, onPress }: { code: string; onPress: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <Animated.View
      entering={SlideInUp.springify().damping(16)}
      exiting={SlideOutUp.duration(250)}
      style={[s.wrap, { top: insets.top + 8 }]}
      pointerEvents="box-none"
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('demo.tapToFill')}
        onPress={onPress}
        style={({ pressed }) => [s.card, pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }]}
      >
        <View style={s.header}>
          <View style={s.appIcon}>
            <Ionicons name="chatbubble" size={13} color="#fff" />
          </View>
          <Text style={s.appName}>{t('demo.smsApp').toUpperCase()}</Text>
          <Text style={s.time}>{t('demo.now')}</Text>
        </View>
        <Text style={s.sender}>TezWork</Text>
        <Text style={s.body}>{t('demo.smsText', { code })}</Text>
        <Text style={s.hint}>{t('demo.tapToFill')}</Text>
      </Pressable>
    </Animated.View>
  );
}

// ДЕМО: тест нөмірлерін бір түртумен таңдау (кіру/тіркелу беттерінде)
export function DemoPhonePicker({ onPick, highlight }: { onPick: (digits: string) => void; highlight?: boolean }) {
  if (!DEMO_MODE) return null;
  const phones = Object.keys(DEMO_OTPS);
  return (
    <View style={{ marginTop: 4 }}>
      <Text style={{ color: highlight ? colors.warn : colors.muted, fontSize: 12, marginBottom: 8, lineHeight: 17 }}>
        {highlight ? t('demo.onlyTest') : t('demo.numbers')}
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {phones.map((p) => (
          <Pressable
            key={p}
            onPress={() => onPick(p.replace(/^\+7/, ''))}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: colors.cardAlt, borderWidth: 1, borderColor: colors.border }}
          >
            <Ionicons name="flask-outline" size={14} color={colors.info} />
            <Text style={{ color: colors.text, fontWeight: '600', fontSize: 13 }}>{formatPhone(p)}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const s = themed(() => ({
  wrap: { position: 'absolute', left: 10, right: 10, zIndex: 100, alignItems: 'center' },
  card: {
    width: '100%', maxWidth: 520, backgroundColor: 'rgba(248,248,250,0.98)', borderRadius: 20, padding: 14,
    shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 12,
    borderWidth: 1, borderColor: 'rgba(0,0,0,0.06)',
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  appIcon: { width: 22, height: 22, borderRadius: 6, backgroundColor: '#34C759', alignItems: 'center', justifyContent: 'center' },
  appName: { flex: 1, color: '#6B6B70', fontSize: 12, fontWeight: '600', letterSpacing: 0.4 },
  time: { color: '#8E8E93', fontSize: 12 },
  sender: { color: '#000', fontSize: 15, fontWeight: '700' },
  body: { color: '#1C1C1E', fontSize: 15, lineHeight: 20, marginTop: 2 },
  hint: { color: '#007AFF', fontSize: 12, fontWeight: '600', marginTop: 8 },
}));
