import { maskLocalPhone } from '../lib/format';
import { t } from '../lib/i18n';
import { Field } from '../lib/ui';

// Пайдаланушы тек 10 цифрды енгізеді, «+7» алдын ала тұрады
export function PhoneField({ digits, onChange, error, onSubmit, label, hint, autoFocus = true }: {
  digits: string; onChange: (d: string) => void; error?: string | null; onSubmit?: () => void;
  label?: string; hint?: string; autoFocus?: boolean;
}) {
  return (
    <Field
      label={label ?? t('phone.label')}
      hint={hint}
      prefix="+7"
      value={maskLocalPhone(digits)}
      onChangeText={(v) => {
        let d = v.replace(/\D/g, '');
        // «8 777...» деп теріп бастаса: «+7» тұрғандықтан 8 артық (қазақстандық нөмір +7-ден кейін 7-ден басталады)
        if (d.startsWith('8')) d = d.slice(1);
        // «7 777...» деп толық қойса — бас цифрды алып тастаймыз
        if (d.length === 11 && d.startsWith('7')) d = d.slice(1);
        onChange(d.slice(0, 10));
      }}
      keyboardType="phone-pad"
      textContentType="telephoneNumber"
      autoComplete="tel"
      placeholder="777 123 45 67"
      maxLength={13}
      error={error}
      returnKeyType="done"
      onSubmitEditing={onSubmit}
      autoFocus={autoFocus}
    />
  );
}
