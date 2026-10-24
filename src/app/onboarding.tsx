import { useState } from 'react';
import { AuthShell } from '../components/auth-shell';
import { ProfileFields, RolePicker } from '../components/profile-form';
import { humanError } from '../lib/errors';
import { useFeedback } from '../lib/feedback';
import { RegistrationDraft, validateDraft } from '../lib/registration';
import { useSession } from '../lib/session';
import { supabase } from '../lib/supabase';
import { CITIES } from '../lib/types';
import { Button, SectionTitle } from '../lib/ui';

// Сессия бар, бірақ профиль жоқ болған жағдайда (мысалы, тіркелу аяқталмай қалса)
export default function Onboarding() {
  const { session, refreshProfile, signOut } = useSession();
  const { toast } = useFeedback();
  const [form, setForm] = useState<RegistrationDraft>({ role: 'worker', full_name: '', company_name: '', city: CITIES[0] });
  const [errors, setErrors] = useState<ReturnType<typeof validateDraft>>({});
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!session) return;
    const e = validateDraft(form);
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    const { error } = await supabase.from('profiles').insert({
      id: session.user.id,
      role: form.role,
      full_name: form.full_name.trim(),
      company_name: form.role === 'business' ? form.company_name?.trim() || null : null,
      city: form.city,
    });
    if (error) { setBusy(false); return toast(humanError(error), 'error'); }
    await refreshProfile();
    setBusy(false);
  }

  return (
    <AuthShell
      title="Профильді аяқтаңыз"
      subtitle="Бірнеше дерек қалды — сосын жұмысты бастай аласыз"
      onBack={signOut}
      footer={<Button title="Дайын" icon="checkmark" onPress={save} loading={busy} />}
    >
      <RolePicker value={form.role} onChange={(role) => setForm({ ...form, role })} />
      <SectionTitle>Деректер</SectionTitle>
      <ProfileFields value={form} onChange={(f) => { setForm(f); setErrors({}); }} errors={errors} />
    </AuthShell>
  );
}
