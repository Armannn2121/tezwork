import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { haptic } from '../lib/haptics';
import { RegistrationDraft } from '../lib/registration';
import { colors, radius } from '../lib/theme';
import { CITIES, IconName, Role } from '../lib/types';
import { Chips, Field } from '../lib/ui';

const ROLES: { id: Role; title: string; sub: string; icon: IconName }[] = [
  { id: 'worker', title: 'Жұмыс іздеймін', sub: 'Ыңғайлы ауысымдарды тауып, сағатына табыс тап', icon: 'person-outline' },
  { id: 'business', title: 'Жұмысшы іздеймін', sub: 'Компанияңа уақытша қызметкерлерді тез тап', icon: 'business-outline' },
];

export function RolePicker({ value, onChange }: { value: Role; onChange: (r: Role) => void }) {
  return (
    <View style={{ gap: 12, marginBottom: 8 }}>
      {ROLES.map((r) => {
        const active = r.id === value;
        return (
          <Pressable
            key={r.id}
            accessibilityRole="radio"
            accessibilityState={{ checked: active }}
            onPress={() => { haptic.select(); onChange(r.id); }}
            style={[s.role, active && { borderColor: colors.brand, backgroundColor: colors.brandSoft }]}
          >
            <View style={[s.roleIcon, active && { backgroundColor: colors.brand }]}>
              <Ionicons name={r.icon} size={22} color={active ? colors.brandInk : colors.brand} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.roleTitle}>{r.title}</Text>
              <Text style={s.roleSub}>{r.sub}</Text>
            </View>
            <Ionicons name={active ? 'radio-button-on' : 'radio-button-off'} size={22} color={active ? colors.brand : colors.faint} />
          </Pressable>
        );
      })}
    </View>
  );
}

export function ProfileFields({ value, onChange, errors }: {
  value: RegistrationDraft; onChange: (d: RegistrationDraft) => void;
  errors?: Partial<Record<'full_name' | 'company_name', string>>;
}) {
  return (
    <View>
      <Field
        label="Аты-жөніңіз"
        value={value.full_name}
        onChangeText={(t) => onChange({ ...value, full_name: t })}
        placeholder="Айдана Серікқызы"
        textContentType="name"
        autoComplete="name"
        error={errors?.full_name}
      />
      {value.role === 'business' && (
        <Field
          label="Компания атауы"
          value={value.company_name ?? ''}
          onChangeText={(t) => onChange({ ...value, company_name: t })}
          placeholder="ЖШС «Мысал»"
          error={errors?.company_name}
        />
      )}
      <Chips label="Қала" options={CITIES.map((c) => ({ id: c, label: c }))} value={value.city} onChange={(c) => onChange({ ...value, city: c })} />
    </View>
  );
}

const s = StyleSheet.create({
  role: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: radius.lg, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.card },
  roleIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' },
  roleTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  roleSub: { color: colors.muted, fontSize: 13, marginTop: 2, lineHeight: 18 },
});
