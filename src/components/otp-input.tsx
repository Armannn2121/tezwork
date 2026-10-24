import { useRef } from 'react';
import { Pressable, StyleSheet, Text, TextInput, TextInputInstance, View } from 'react-native';
import { colors, radius } from '../lib/theme';

export const OTP_LENGTH = 6;

// Бір жасырын TextInput + 6 ұяшық: SMS автотолтыру екі платформада да жұмыс істейді
export function OtpInput({ value, onChange, error }: { value: string; onChange: (v: string) => void; error?: boolean }) {
  const ref = useRef<TextInputInstance>(null);
  return (
    <Pressable onPress={() => ref.current?.focus()} style={s.row}>
      {Array.from({ length: OTP_LENGTH }, (_, i) => {
        const active = i === Math.min(value.length, OTP_LENGTH - 1);
        return (
          <View key={i} style={[s.cell, active && { borderColor: colors.brand }, error && { borderColor: colors.danger }]}>
            <Text style={s.digit}>{value[i] ?? ''}</Text>
          </View>
        );
      })}
      <TextInput
        ref={ref}
        value={value}
        onChangeText={(t) => onChange(t.replace(/\D/g, '').slice(0, OTP_LENGTH))}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
        maxLength={OTP_LENGTH}
        autoFocus
        caretHidden
        style={s.hidden}
      />
    </Pressable>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, marginBottom: 16 },
  cell: {
    flex: 1, maxWidth: 56, aspectRatio: 0.85, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border,
    backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center',
  },
  digit: { color: colors.text, fontSize: 24, fontWeight: '800' },
  hidden: { position: 'absolute', opacity: 0, width: '100%', height: '100%' },
});
