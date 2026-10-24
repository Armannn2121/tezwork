import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Text } from 'react-native';
import { AuthShell } from '../../components/auth-shell';
import { PhoneField } from '../../components/phone-field';
import { humanError, isUnregistered } from '../../lib/errors';
import { normalizePhone } from '../../lib/format';
import { setDraft } from '../../lib/registration';
import { supabase } from '../../lib/supabase';
import { colors } from '../../lib/theme';
import { Button, text } from '../../lib/ui';

export default function Login() {
  const router = useRouter();
  const [digits, setDigits] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [busy, setBusy] = useState(false);

  async function sendCode() {
    const phone = normalizePhone(digits);
    if (!phone) return setError('Нөмірді толық енгізіңіз: 10 цифр');
    setError(null); setNotFound(false); setBusy(true);
    setDraft(null);
    // Кіру — тек бар аккаунттарға. Жаңа нөмір болса, тіркелуге жібереміз
    const { error: e } = await supabase.auth.signInWithOtp({ phone, options: { shouldCreateUser: false } });
    setBusy(false);
    if (e) {
      setNotFound(isUnregistered(e));
      return setError(humanError(e));
    }
    router.push({ pathname: '/verify', params: { phone, mode: 'login' } });
  }

  return (
    <AuthShell
      title="Қош келдіңіз!"
      subtitle="Тіркелген телефон нөміріңізді енгізіңіз — SMS арқылы код жібереміз"
      footer={
        <>
          <Button title="Код алу" onPress={sendCode} loading={busy} disabled={digits.length < 10} />
          <Text style={[text.muted, { textAlign: 'center', marginTop: 16 }]}>
            Аккаунтыңыз жоқ па?{' '}
            <Text style={{ color: colors.brand, fontWeight: '700' }} onPress={() => router.replace('/register')}>Тіркелу</Text>
          </Text>
        </>
      }
    >
      <PhoneField digits={digits} onChange={(d) => { setDigits(d); setError(null); }} error={error} onSubmit={sendCode} />
      {notFound && (
        <Button title="Осы нөмірмен тіркелу" variant="secondary" icon="person-add-outline" onPress={() => router.replace('/register')} />
      )}
    </AuthShell>
  );
}
