import { maskLocalPhone } from '../lib/format';
import { Field } from '../lib/ui';

// Пайдаланушы тек 10 цифрды енгізеді, «+7» алдын ала тұрады
export function PhoneField({ digits, onChange, error, onSubmit }: {
  digits: string; onChange: (d: string) => void; error?: string | null; onSubmit?: () => void;
}) {
  return (
    <Field
      label="Телефон нөмірі"
      prefix="+7"
      value={maskLocalPhone(digits)}
      onChangeText={(t) => {
        let d = t.replace(/\D/g, '');
        // «8 777...» немесе «7 777...» деп қойса — бас цифрды алып тастаймыз
        if (d.length === 11 && (d.startsWith('8') || d.startsWith('7'))) d = d.slice(1);
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
      autoFocus
    />
  );
}
