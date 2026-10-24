import { Text } from 'react-native';
import { formatDate } from '../lib/format';
import { t, TKey } from '../lib/i18n';
import { parseIin } from '../lib/kz-id';
import { colors } from '../lib/theme';
import { Role } from '../lib/types';
import { Field } from '../lib/ui';

// ЖСН өрісі: 12 цифр толғанда туған күні, жасы мен жынысын көрсетеді
export function IinField({ value, onChange, error, role }: {
  value: string; onChange: (v: string) => void; error?: string; role: Role;
}) {
  const info = value.length === 12 ? parseIin(value) : null;
  return (
    <>
      <Field
        label={t(role === 'business' ? 'iin.labelEmployer' : 'iin.label')}
        value={value}
        onChangeText={(v) => onChange(v.replace(/\D/g, '').slice(0, 12))}
        keyboardType="number-pad"
        maxLength={12}
        placeholder="000000000000"
        error={error ? t(error as TKey) : null}
        hint={info ? undefined : t(role === 'business' ? 'iin.hintEmployer' : 'iin.hint')}
      />
      {info && !error && (
        <Text style={{ color: colors.brand, fontSize: 13, fontWeight: '600', marginTop: -8, marginBottom: 14 }}>
          ✓ {t('iin.ok', { date: formatDate(info.birth), age: info.age, gender: t(info.gender === 'male' ? 'iin.male' : 'iin.female') })}
        </Text>
      )}
    </>
  );
}

export function BinField({ value, onChange, error }: { value: string; onChange: (v: string) => void; error?: string }) {
  return (
    <Field
      label={t('bin.label')}
      value={value}
      onChangeText={(v) => onChange(v.replace(/\D/g, '').slice(0, 12))}
      keyboardType="number-pad"
      maxLength={12}
      placeholder="000000000000"
      error={error ? t(error as TKey) : null}
      hint={t('bin.hint')}
    />
  );
}
