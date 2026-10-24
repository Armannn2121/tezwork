import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { AuthShell } from '../../components/auth-shell';
import { OTP_LENGTH, OtpInput } from '../../components/otp-input';
import { humanError } from '../../lib/errors';
import { useFeedback } from '../../lib/feedback';
import { formatPhone } from '../../lib/format';
import { t } from '../../lib/i18n';
import { getDraft, publicMetadata } from '../../lib/registration';
import { supabase } from '../../lib/supabase';
import { colors } from '../../lib/theme';
import { Button, text } from '../../lib/ui';

const RESEND_SEC = 60;

export default function Verify() {
  const router = useRouter();
  const { toast } = useFeedback();
  const { phone, mode } = useLocalSearchParams<{ phone: string; mode?: 'login' | 'register' }>();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [left, setLeft] = useState(RESEND_SEC);

  useEffect(() => {
    if (left <= 0) return;
    const timer = setTimeout(() => setLeft(left - 1), 1000);
    return () => clearTimeout(timer);
  }, [left]);

  async function verify(token: string) {
    if (!phone || busy) return;
    setBusy(true); setError(null);
    const { error: e } = await supabase.auth.verifyOtp({ phone, token, type: 'sms' });
    setBusy(false);
    if (e) { setError(humanError(e)); setCode(''); return; }
    toast(mode === 'register' ? t('verify.registered') : t('verify.welcomeBack'), 'success');
    // Сессия пайда болғанда _layout.tsx-тегі Stack.Protected өзі басты бетке ауыстырады
  }

  function onChange(v: string) {
    setCode(v); setError(null);
    if (v.length === OTP_LENGTH) verify(v);
  }

  async function resend() {
    if (!phone) return;
    setLeft(RESEND_SEC);
    const draft = mode === 'register' ? getDraft() : null;
    const { error: e } = await supabase.auth.signInWithOtp({
      phone,
      options: mode === 'register' ? { data: draft ? publicMetadata(draft) : undefined } : { shouldCreateUser: false },
    });
    if (e) { setError(humanError(e)); setLeft(0); }
    else toast(t('verify.resent'), 'info');
  }

  return (
    <AuthShell
      title={t('verify.title')}
      subtitle={t('verify.subtitle', { phone: formatPhone(phone), n: OTP_LENGTH })}
      step={mode === 'register' ? { index: 2, total: 3 } : undefined}
      footer={<Button title={t('verify.confirm')} onPress={() => verify(code)} loading={busy} disabled={code.length < OTP_LENGTH} />}
    >
      <OtpInput value={code} onChange={onChange} error={!!error} />
      {error && <Text style={{ color: colors.danger, marginBottom: 12 }}>{error}</Text>}
      {busy && <ActivityIndicator color={colors.brand} style={{ marginBottom: 12 }} />}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        {left > 0
          ? <Text style={text.muted}>{t('verify.resendIn', { time: `0:${String(left).padStart(2, '0')}` })}</Text>
          : <Text style={{ color: colors.brand, fontWeight: '700' }} onPress={resend}>{t('verify.resend')}</Text>}
        <Text style={{ color: colors.muted, fontWeight: '600' }} onPress={() => router.back()}>{t('verify.changePhone')}</Text>
      </View>
    </AuthShell>
  );
}
