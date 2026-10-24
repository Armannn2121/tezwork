import { useState } from 'react';
import { View } from 'react-native';
import { AuthShell } from '../components/auth-shell';
import { ConsentCheckbox } from '../components/consent';
import { ProfileFields, RolePicker } from '../components/profile-form';
import { humanError } from '../lib/errors';
import { useFeedback } from '../lib/feedback';
import { t } from '../lib/i18n';
import { DraftErrors, emptyDraft, RegistrationDraft, validateDraft } from '../lib/registration';
import { insertProfile, useSession } from '../lib/session';
import { Button, SectionTitle } from '../lib/ui';

// Сессия бар, бірақ профиль жоқ болған жағдайда (мысалы, тіркелу аяқталмай қалса)
export default function Onboarding() {
  const { session, refreshProfile, signOut } = useSession();
  const { toast } = useFeedback();
  const [form, setForm] = useState<RegistrationDraft>(emptyDraft);
  const [errors, setErrors] = useState<DraftErrors>({});
  const [agreed, setAgreed] = useState(false);
  const [consentError, setConsentError] = useState(false);
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!session) return;
    const e = validateDraft(form, { requireIin: true });
    setErrors(e);
    if (Object.keys(e).length) return;
    if (!agreed) return setConsentError(true);
    setBusy(true);
    const { error } = await insertProfile(session.user.id, form);
    if (error) { setBusy(false); return toast(humanError(error), 'error'); }
    await refreshProfile();
    setBusy(false);
  }

  return (
    <AuthShell
      title={t('onb.title')}
      subtitle={t('onb.subtitle')}
      onBack={signOut}
      footer={<Button title={t('common.done')} icon="checkmark" onPress={save} loading={busy} />}
    >
      <RolePicker value={form.role} onChange={(role) => setForm({ ...form, role })} />
      <SectionTitle>{t('onb.data')}</SectionTitle>
      <ProfileFields value={form} onChange={(f) => { setForm(f); setErrors({}); }} errors={errors} />
      <View style={{ marginTop: 4 }}>
        <ConsentCheckbox value={agreed} onChange={(v) => { setAgreed(v); setConsentError(false); }} error={consentError} />
      </View>
    </AuthShell>
  );
}
