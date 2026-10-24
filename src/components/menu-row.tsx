import { Ionicons } from '@expo/vector-icons';
import { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { colors, radius, themed } from '../lib/theme';
import { IconName } from '../lib/types';
import { text } from '../lib/ui';

export function MenuGroup({ children, title }: { children: ReactNode; title?: string }) {
  return (
    <View style={{ marginBottom: 14 }}>
      {title && <Text style={s.title}>{title}</Text>}
      <View style={s.group}>{children}</View>
    </View>
  );
}

export function MenuRow({ icon, label, onPress, danger, value, last, right }: {
  icon: IconName; label: string; onPress?: () => void; danger?: boolean; value?: string; last?: boolean; right?: ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [s.row, last && { borderBottomWidth: 0 }, pressed && { backgroundColor: colors.cardAlt }]}
    >
      <Ionicons name={icon} size={20} color={danger ? colors.danger : colors.muted} />
      <Text style={{ color: danger ? colors.danger : colors.text, fontSize: 15, fontWeight: '600', flex: 1 }}>{label}</Text>
      {!!value && <Text style={[text.muted, { maxWidth: '50%' }]} numberOfLines={1}>{value}</Text>}
      {right}
      {!danger && onPress && !right && <Ionicons name="chevron-forward" size={18} color={colors.faint} />}
    </Pressable>
  );
}

const s = themed((c) => ({
  title: { color: c.muted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8, marginLeft: 4 },
  group: { backgroundColor: c.card, borderColor: c.border, borderWidth: 1, borderRadius: radius.lg, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: c.border },
}));
