import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Text } from 'react-native';
import { AuthShell } from '../../components/auth-shell';
import { PhoneField } from '../../components/phone-field';
import { ProfileFields, RolePicker } from '../../components/profile-form';
import { humanError } from '../../lib/errors';
import { normalizePhone } from '../../lib/format';
import { RegistrationDraft, setDraft, validateDraft } from '../../lib/registration';
import { supabase } from '../../lib/supabase';
import { colors } from '../../lib/theme';
import { CITIES } from '../../lib/types';
import { Button, text } from '../../lib/ui';

const STEPS = [
  { title: 'Сіз кімсіз?', subtitle: 'Рөлді таңдаңыз — қосымша соған бейімделеді' },
  { title: 'Өзіңіз туралы', subtitle: 'Бұл деректерді кейін профильден өзгертуге болады' },
  { title: 'Телефон нөміріңіз', subtitle: 'Нөміріңізді растау үшін SMS-код жібереміз' },
];

export default function Register() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<RegistrationDraft>({ role: 'worker', full_name: '', company_name: '', city: CITIES[0] });
  const [errors, setErrors] = useState<ReturnType<typeof validateDraft>>({});
  const [digits, setDigits] = useState('');
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function next() {
    if (step === 1) {
      const e = validateDraft(form);
      setErrors(e);
      if (Object.keys(e).length) return;
    }
    setStep(step + 1);
  }

  async function sendCode() {
    const phone = normalizePhone(digits);
    if (!phone) return setPhoneError('Нөмірді толық енгізіңіз: 10 цифр');
    setPhoneError(null); setBusy(true);
    const data: RegistrationDraft = {
      ...form,
      full_name: form.full_name.trim(),
      company_name: form.role === 'business' ? form.company_name?.trim() || null : null,
    };
    setDraft(data);
    const { error } = await supabase.auth.signInWithOtp({ phone, options: { data } });
    setBusy(false);
    if (error) { setDraft(null); return setPhoneError(humanError(error)); }
    router.push({ pathname: '/verify', params: { phone, mode: 'register' } });
  }

  const { title, subtitle } = STEPS[step];
  return (
    <AuthShell
      title={title}
      subtitle={subtitle}
      step={{ index: step, total: STEPS.length }}
      onBack={step > 0 ? () => setStep(step - 1) : undefined}
      footer={
        <>
          {step < 2
            ? <Button title="Жалғастыру" icon="arrow-forward" onPress={next} />
            : <Button title="Код алу" onPress={sendCode} loading={busy} disabled={digits.length < 10} />}
          <Text style={[text.muted, { textAlign: 'center', marginTop: 16 }]}>
            Аккаунтыңыз бар ма?{' '}
            <Text style={{ color: colors.brand, fontWeight: '700' }} onPress={() => router.replace('/login')}>Кіру</Text>
          </Text>
        </>
      }
    >
      {step === 0 && <RolePicker value={form.role} onChange={(role) => setForm({ ...form, role })} />}
      {step === 1 && <ProfileFields value={form} onChange={(f) => { setForm(f); setErrors({}); }} errors={errors} />}
      {step === 2 && <PhoneField digits={digits} onChange={(d) => { setDigits(d); setPhoneError(null); }} error={phoneError} onSubmit={sendCode} />}
    </AuthShell>
  );
}
