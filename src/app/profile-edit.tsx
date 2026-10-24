import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { ProfileFields } from '../components/profile-form';
import { humanError } from '../lib/errors';
import { useFeedback } from '../lib/feedback';
import { RegistrationDraft, validateDraft } from '../lib/registration';
import { useSession } from '../lib/session';
import { supabase } from '../lib/supabase';
import { CITIES } from '../lib/types';
import { Button, colors } from '../lib/ui';

export default function ProfileEdit() {
  const router = useRouter();
  const { profile, refreshProfile } = useSession();
  const { toast } = useFeedback();
  const [form, setForm] = useState<RegistrationDraft>({
    role: profile?.role ?? 'worker',
    full_name: profile?.full_name ?? '',
    company_name: profile?.company_name ?? '',
    city: profile?.city ?? CITIES[0],
  });
  const [errors, setErrors] = useState<ReturnType<typeof validateDraft>>({});
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!profile) return;
    const e = validateDraft(form);
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    const { error } = await supabase.from('profiles').update({
      full_name: form.full_name.trim(),
      company_name: profile.role === 'business' ? form.company_name?.trim() || null : null,
      city: form.city,
    }).eq('id', profile.id);
    if (error) { setBusy(false); return toast(humanError(error), 'error'); }
    await refreshProfile();
    setBusy(false);
    toast('Профиль сақталды', 'success');
    router.back();
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.bg }}
        contentContainerStyle={{ padding: 16, maxWidth: 560, width: '100%', alignSelf: 'center' }}
        keyboardShouldPersistTaps="handled"
      >
        <ProfileFields value={form} onChange={(f) => { setForm(f); setErrors({}); }} errors={errors} />
        <Button title="Сақтау" icon="checkmark" onPress={save} loading={busy} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
