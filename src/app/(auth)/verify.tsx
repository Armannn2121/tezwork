import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { AuthShell } from '../../components/auth-shell';
import { DemoSmsBanner } from '../../components/demo-sms-banner';
import { OTP_LENGTH, OtpInput } from '../../components/otp-input';
import { humanError } from '../../lib/errors';
import { demoOtpFor } from '../../lib/config';
import { useFeedback } from '../../lib/feedback';
import { formatPhone } from '../../lib/format';
import { haptic } from '../../lib/haptics';
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
  // ДЕМО: SMS орнына қосымшаның үстінде шығатын хабарлама
  const [demoSms, setDemoSms] = useState<string | null>(null);
  const [demoRound, setDemoRound] = useState(0);

  useEffect(() => {
    const demo = demoOtpFor(phone);
    if (!demo) return;
    // Басқанша немесе код енгізілгенше экранда қалады (демо кезінде көрсетуге ыңғайлы)
    const show = setTimeout(() => { setDemoSms(demo); haptic.success(); }, 1500);
    return () => clearTimeout(show);
  }, [phone, demoRound]);

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
    if (v.length === OTP_LENGTH) setDemoSms(null);
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
    else {
      toast(t('verify.resent'), 'info');
      setDemoRound((n) => n + 1);
    }
  }

  return (
    <View style={{ flex: 1 }}>
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
          : <Text accessibilityRole="button" style={{ color: colors.brand, fontWeight: '700' }} onPress={resend}>{t('verify.resend')}</Text>}
        <Text accessibilityRole="button" style={{ color: colors.muted, fontWeight: '600' }} onPress={() => router.back()}>{t('verify.changePhone')}</Text>
      </View>
    </AuthShell>
      {demoSms && <DemoSmsBanner code={demoSms} onPress={() => { setDemoSms(null); onChange(demoSms); }} />}
    </View>
  );
}
