import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';
import { haptic } from '../lib/haptics';
import { t, TKey } from '../lib/i18n';
import { DraftErrors, RegistrationDraft } from '../lib/registration';
import { colors, radius, themed } from '../lib/theme';
import { IconName, Role } from '../lib/types';
import { Field } from '../lib/ui';
import { CityField } from './city-picker';
import { BinField, IinField } from './iin-field';

const ROLES: { id: Role; title: TKey; sub: TKey; icon: IconName }[] = [
  { id: 'worker', title: 'role.workerTitle', sub: 'role.workerSub', icon: 'person-outline' },
  { id: 'business', title: 'role.businessTitle', sub: 'role.businessSub', icon: 'business-outline' },
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
              <Text style={s.roleTitle}>{t(r.title)}</Text>
              <Text style={s.roleSub}>{t(r.sub)}</Text>
            </View>
            <Ionicons name={active ? 'radio-button-on' : 'radio-button-off'} size={22} color={active ? colors.brand : colors.faint} />
          </Pressable>
        );
      })}
    </View>
  );
}

// Профиль өрістері. iinLocked — ЖСН бұрын сақталған болса өрісті көрсетпейміз
export function ProfileFields({ value, onChange, errors, iinLocked }: {
  value: RegistrationDraft; onChange: (d: RegistrationDraft) => void; errors?: DraftErrors; iinLocked?: boolean;
}) {
  const err = (k: keyof DraftErrors) => (errors?.[k] ? t(errors[k] as TKey) : null);
  return (
    <View>
      <Field
        label={t('form.fullName')}
        value={value.full_name}
        onChangeText={(v) => onChange({ ...value, full_name: v })}
        placeholder={t('form.fullNamePh')}
        textContentType="name"
        autoComplete="name"
        error={err('full_name')}
      />
      {value.role === 'business' ? (
        <>
          <Field
            label={t('form.company')}
            value={value.company_name ?? ''}
            onChangeText={(v) => onChange({ ...value, company_name: v })}
            placeholder={t('form.companyPh')}
            error={err('company_name')}
          />
          <BinField value={value.company_bin} onChange={(v) => onChange({ ...value, company_bin: v })} error={errors?.company_bin} />
        </>
      ) : !iinLocked ? (
        <IinField value={value.iin} onChange={(v) => onChange({ ...value, iin: v })} error={errors?.iin} />
      ) : null}
      <CityField value={value.city} onChange={(c) => onChange({ ...value, city: c })} />
    </View>
  );
}

const s = themed((c) => ({
  role: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: radius.lg, borderWidth: 1.5, borderColor: c.border, backgroundColor: c.card },
  roleIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: c.brandSoft, alignItems: 'center', justifyContent: 'center' },
  roleTitle: { color: c.text, fontSize: 16, fontWeight: '700' },
  roleSub: { color: c.muted, fontSize: 13, marginTop: 2, lineHeight: 18 },
}));
