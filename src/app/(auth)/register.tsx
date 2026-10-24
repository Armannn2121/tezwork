import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { AuthShell } from '../../components/auth-shell';
import { ConsentCheckbox } from '../../components/consent';
import { PhoneField } from '../../components/phone-field';
import { ProfileFields, RolePicker } from '../../components/profile-form';
import { humanError } from '../../lib/errors';
import { normalizePhone } from '../../lib/format';
import { t, TKey } from '../../lib/i18n';
import { DraftErrors, emptyDraft, publicMetadata, RegistrationDraft, setDraft, validateDraft } from '../../lib/registration';
import { supabase } from '../../lib/supabase';
import { colors } from '../../lib/theme';
import { Button, text } from '../../lib/ui';

const STEPS: { title: TKey; subtitle: TKey }[] = [
  { title: 'reg.step1', subtitle: 'reg.step1sub' },
  { title: 'reg.step2', subtitle: 'reg.step2sub' },
  { title: 'reg.step3', subtitle: 'reg.step3sub' },
];

export default function Register() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<RegistrationDraft>(emptyDraft);
  const [errors, setErrors] = useState<DraftErrors>({});
  const [digits, setDigits] = useState('');
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [consentError, setConsentError] = useState(false);
  const [busy, setBusy] = useState(false);

  function next() {
    if (step === 1) {
      const e = validateDraft(form, { requireIin: true });
      setErrors(e);
      if (Object.keys(e).length) return;
    }
    setStep(step + 1);
  }

  async function sendCode() {
    const phone = normalizePhone(digits);
    if (!phone) return setPhoneError(t('err.phoneInvalid'));
    if (!agreed) return setConsentError(true);
    setPhoneError(null); setBusy(true);
    const data: RegistrationDraft = {
      ...form,
      full_name: form.full_name.trim(),
      company_name: form.role === 'business' ? form.company_name?.trim() || null : null,
    };
    setDraft(data);
    const { error } = await supabase.auth.signInWithOtp({ phone, options: { data: publicMetadata(data) } });
    setBusy(false);
    if (error) { setDraft(null); return setPhoneError(humanError(error)); }
    router.push({ pathname: '/verify', params: { phone, mode: 'register' } });
  }

  const { title, subtitle } = STEPS[step];
  return (
    <AuthShell
      title={t(title)}
      subtitle={t(subtitle)}
      step={{ index: step, total: STEPS.length }}
      onBack={step > 0 ? () => setStep(step - 1) : undefined}
      footer={
        <>
          {step < 2
            ? <Button title={t('common.continue')} icon="arrow-forward" onPress={next} />
            : <Button title={t('login.getCode')} onPress={sendCode} loading={busy} disabled={digits.length < 10} />}
          <Text style={[text.muted, { textAlign: 'center', marginTop: 16 }]}>
            {t('reg.haveAccount')}{' '}
            <Text style={{ color: colors.brand, fontWeight: '700' }} onPress={() => router.replace('/login')}>{t('welcome.login')}</Text>
          </Text>
        </>
      }
    >
      {step === 0 && <RolePicker value={form.role} onChange={(role) => setForm({ ...form, role })} />}
      {step === 1 && <ProfileFields value={form} onChange={(f) => { setForm(f); setErrors({}); }} errors={errors} />}
      {step === 2 && (
        <View>
          <PhoneField digits={digits} onChange={(d) => { setDigits(d); setPhoneError(null); }} error={phoneError} onSubmit={sendCode} />
          <ConsentCheckbox value={agreed} onChange={(v) => { setAgreed(v); setConsentError(false); }} error={consentError} />
        </View>
      )}
    </AuthShell>
  );
}
