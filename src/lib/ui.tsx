import { Ionicons } from '@expo/vector-icons';
import { ReactNode, useEffect, useState } from 'react';
import {
  ActivityIndicator, Pressable, ScrollView, StyleProp, Text, TextInput, TextInputProps, View, ViewStyle,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { haptic } from './haptics';
import { t } from './i18n';
import { colors, radius, themed, Tone, toneColor } from './theme';
import { IconName } from './types';

export { colors } from './theme';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export function Button({ title, onPress, loading, disabled, variant = 'primary', icon, size = 'md', style }: {
  title: string; onPress: () => void; loading?: boolean; disabled?: boolean;
  variant?: ButtonVariant; icon?: IconName; size?: 'md' | 'sm'; style?: StyleProp<ViewStyle>;
}) {
  const bg = { primary: colors.brand, secondary: colors.cardAlt, ghost: 'transparent', danger: colors.dangerSoft }[variant];
  const fg = { primary: colors.brandInk, secondary: colors.text, ghost: colors.text, danger: colors.danger }[variant];
  const border = variant === 'ghost' ? colors.border : variant === 'secondary' ? colors.border : bg;
  const off = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!off, busy: !!loading }}
      onPress={() => { if (variant === 'primary') haptic.tap(); onPress(); }}
      disabled={off}
      style={({ pressed }) => [
        s.btn, size === 'sm' && s.btnSm,
        { backgroundColor: bg, borderColor: border, opacity: disabled ? 0.45 : pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={fg} /> : (
        <View style={s.btnRow}>
          {icon && <Ionicons name={icon} size={size === 'sm' ? 16 : 18} color={fg} />}
          <Text style={[s.btnText, size === 'sm' && { fontSize: 13 }, { color: fg }]}>{title}</Text>
        </View>
      )}
    </Pressable>
  );
}

export function Field({ label, error, hint, prefix, style, ...props }: TextInputProps & {
  label: string; error?: string | null; hint?: string; prefix?: string;
}) {
  const [focused, setFocused] = useState(false);
  const borderColor = error ? colors.danger : focused ? colors.brand : colors.border;
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={s.label}>{label}</Text>
      <View style={[s.inputWrap, { borderColor }]}>
        {prefix && <Text style={s.prefix}>{prefix}</Text>}
        <TextInput
          placeholderTextColor={colors.faint}
          // Сырттан келген стиль негізгісін алмастырмайды, толықтырады (әйтпесе көпжолды өріс тарылады)
          style={[s.input, style]}
          onFocus={(e) => { setFocused(true); props.onFocus?.(e); }}
          onBlur={(e) => { setFocused(false); props.onBlur?.(e); }}
          {...props}
        />
      </View>
      {error ? <Text style={s.error}>{error}</Text> : hint ? <Text style={s.hint}>{hint}</Text> : null}
    </View>
  );
}

export function Chips<T extends string>({ options, value, onChange, scroll, label }: {
  options: { id: T; label: string; icon?: IconName }[]; value: T; onChange: (v: T) => void;
  scroll?: boolean; label?: string;
}) {
  const items = options.map((o) => {
    const active = value === o.id;
    return (
      <Pressable
        key={o.id}
        accessibilityRole="button"
        accessibilityState={{ selected: active }}
        onPress={() => { haptic.select(); onChange(o.id); }}
        style={[s.chip, active && { backgroundColor: colors.brand, borderColor: colors.brand }]}
      >
        {o.icon && <Ionicons name={o.icon} size={15} color={active ? colors.brandInk : colors.muted} />}
        <Text style={{ color: active ? colors.brandInk : colors.text, fontWeight: '600', fontSize: 13 }}>{o.label}</Text>
      </Pressable>
    );
  });
  return (
    <View style={{ marginBottom: 14 }}>
      {label && <Text style={s.label}>{label}</Text>}
      {scroll ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>{items}</ScrollView>
      ) : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{items}</View>
      )}
    </View>
  );
}

export function Segmented<T extends string>({ options, value, onChange }: {
  options: { id: T; label: string }[]; value: T; onChange: (v: T) => void;
}) {
  return (
    <View style={s.seg}>
      {options.map((o) => {
        const active = o.id === value;
        return (
          <Pressable
            key={o.id}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => { haptic.select(); onChange(o.id); }}
            style={[s.segItem, active && { backgroundColor: colors.card }]}
          >
            <Text style={{ color: active ? colors.text : colors.muted, fontWeight: '700', fontSize: 13 }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Card({ children, style, onPress }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void }) {
  if (!onPress) return <View style={[s.card, style]}>{children}</View>;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [s.card, style, pressed && { backgroundColor: colors.cardAlt }]}>
      {children}
    </Pressable>
  );
}

export function Badge({ label, tone = 'neutral', icon }: { label: string; tone?: Tone; icon?: IconName }) {
  const c = toneColor(tone);
  return (
    <View style={[s.badge, { backgroundColor: c.bg }]}>
      {icon && <Ionicons name={icon} size={12} color={c.fg} />}
      <Text style={{ color: c.fg, fontSize: 12, fontWeight: '700' }}>{label}</Text>
    </View>
  );
}

export function IconText({ icon, children, color = colors.muted }: { icon: IconName; children: ReactNode; color?: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
      <Ionicons name={icon} size={14} color={color} />
      <Text style={{ color, fontSize: 13, flexShrink: 1 }}>{children}</Text>
    </View>
  );
}

export function Progress({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(1, value));
  return (
    <View style={s.progress}>
      <View style={{ width: `${pct * 100}%`, height: '100%', backgroundColor: pct >= 1 ? colors.muted : colors.brand, borderRadius: 3 }} />
    </View>
  );
}

export function Stat({ label, value, icon }: { label: string; value: string; icon: IconName }) {
  return (
    <View style={s.stat}>
      <Ionicons name={icon} size={18} color={colors.brand} />
      <Text style={{ color: colors.text, fontSize: 18, fontWeight: '800', marginTop: 6 }} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      <Text style={{ color: colors.muted, fontSize: 12 }} numberOfLines={1}>{label}</Text>
    </View>
  );
}

export function EmptyState({ icon, title, subtitle, action }: {
  icon: IconName; title: string; subtitle?: string; action?: { title: string; onPress: () => void };
}) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: 48, paddingHorizontal: 24 }}>
      <View style={s.emptyIcon}><Ionicons name={icon} size={30} color={colors.brand} /></View>
      <Text style={[text.title, { textAlign: 'center', marginTop: 14 }]}>{title}</Text>
      {subtitle && <Text style={[text.muted, { textAlign: 'center', marginTop: 6, lineHeight: 19 }]}>{subtitle}</Text>}
      {action && <Button title={action.title} variant="secondary" size="sm" onPress={action.onPress} style={{ marginTop: 16, paddingHorizontal: 18 }} />}
    </View>
  );
}

export function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={s.errorBanner}>
      <Ionicons name="alert-circle" size={18} color={colors.danger} />
      <Text style={{ color: colors.text, flex: 1, fontSize: 13 }}>{message}</Text>
      {onRetry && <Text onPress={onRetry} style={{ color: colors.brand, fontWeight: '700' }}>{t('common.retry')}</Text>}
    </View>
  );
}

export function Skeleton({ height = 16, width = '100%', style }: { height?: number; width?: number | `${number}%`; style?: StyleProp<ViewStyle> }) {
  const o = useSharedValue(0.5);
  useEffect(() => { o.value = withRepeat(withTiming(1, { duration: 700 }), -1, true); }, [o]);
  const anim = useAnimatedStyle(() => ({ opacity: o.value }));
  return <Animated.View style={[{ height, width, borderRadius: 8, backgroundColor: colors.cardAlt }, anim, style]} />;
}

export function CardSkeletons({ count = 3 }: { count?: number }) {
  return (
    <View style={{ padding: 16 }}>
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={[s.card, { gap: 10 }]}>
          <Skeleton height={18} width="60%" />
          <Skeleton height={13} width="40%" />
          <Skeleton height={13} width="80%" />
          <Skeleton height={42} style={{ marginTop: 6 }} />
        </View>
      ))}
    </View>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <Text style={s.section}>{children}</Text>;
}

export const text = themed((colors) => ({
  title: { color: colors.text, fontSize: 17, fontWeight: '700' },
  body: { color: colors.text, fontSize: 14 },
  muted: { color: colors.muted, fontSize: 13 },
  price: { color: colors.brand, fontSize: 18, fontWeight: '800' },
  h1: { color: colors.text, fontSize: 28, fontWeight: '800', marginBottom: 6 },
  h2: { color: colors.text, fontSize: 21, fontWeight: '800' },
}));

const s = themed((colors) => ({
  btn: { borderRadius: radius.md, borderWidth: 1, paddingVertical: 14, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center', marginTop: 6, minHeight: 50 },
  btnSm: { paddingVertical: 9, minHeight: 38, borderRadius: radius.sm },
  btnRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  btnText: { fontSize: 15, fontWeight: '700' },
  label: { color: colors.muted, fontSize: 12, fontWeight: '600', marginBottom: 6, letterSpacing: 0.2 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: 14 },
  prefix: { color: colors.text, fontSize: 16, fontWeight: '600', marginRight: 8 },
  input: { flex: 1, color: colors.text, paddingVertical: 13, fontSize: 16, outlineStyle: 'none' } as never,
  error: { color: colors.danger, fontSize: 12, marginTop: 6 },
  hint: { color: colors.faint, fontSize: 12, marginTop: 6 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 9, backgroundColor: colors.card },
  seg: { flexDirection: 'row', backgroundColor: colors.cardAlt, borderRadius: radius.md, padding: 4, marginBottom: 14 },
  segItem: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: radius.sm },
  card: { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: radius.lg, padding: 16, marginBottom: 12 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill },
  progress: { height: 6, backgroundColor: colors.cardAlt, borderRadius: 3, overflow: 'hidden', marginTop: 10 },
  stat: { flex: 1, backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: radius.lg, padding: 14 },
  emptyIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' },
  errorBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.dangerSoft, borderRadius: radius.md, padding: 12, marginBottom: 12 },
  section: { color: colors.muted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 8, marginBottom: 10 },
}));
