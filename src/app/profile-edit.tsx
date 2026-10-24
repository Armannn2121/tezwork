import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text } from 'react-native';
import { ProfileFields } from '../components/profile-form';
import { DEFAULT_CITY } from '../lib/cities';
import { humanError } from '../lib/errors';
import { useFeedback } from '../lib/feedback';
import { t } from '../lib/i18n';
import { maskIin } from '../lib/kz-id';
import { DraftErrors, RegistrationDraft, validateDraft } from '../lib/registration';
import { useSession } from '../lib/session';
import { supabase } from '../lib/supabase';
import { colors } from '../lib/theme';
import { Button, Field } from '../lib/ui';

export default function ProfileEdit() {
  const router = useRouter();
  const { profile, iin, refreshProfile, saveIin } = useSession();
  const { toast } = useFeedback();
  const [form, setForm] = useState<RegistrationDraft>({
    role: profile?.role ?? 'worker',
    full_name: profile?.full_name ?? '',
    company_name: profile?.company_name ?? '',
    company_bin: profile?.company_bin ?? '',
    city: profile?.city ?? DEFAULT_CITY,
    iin: '',
  });
  const [errors, setErrors] = useState<DraftErrors>({});
  const [busy, setBusy] = useState(false);
  const isBiz = profile?.role === 'business';

  async function save() {
    if (!profile) return;
    const e = validateDraft(form, { requireIin: false });
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    const patch: Record<string, string | null> = {
      full_name: form.full_name.trim(),
      company_name: isBiz ? form.company_name?.trim() || null : null,
      city: form.city,
    };
    if (isBiz) patch.company_bin = form.company_bin || null;
    const { error } = await supabase.from('profiles').update(patch).eq('id', profile.id);
    if (error) { setBusy(false); return toast(humanError(error), 'error'); }
    // ЖСН бір рет сақталады
    if (!isBiz && !iin && form.iin) {
      const { error: iinErr } = await saveIin(form.iin);
      if (iinErr) { setBusy(false); return toast(humanError(iinErr), 'error'); }
    }
    await refreshProfile();
    setBusy(false);
    toast(t('profile.saved'), 'success');
    router.back();
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.bg }}
        contentContainerStyle={{ padding: 16, maxWidth: 560, width: '100%', alignSelf: 'center' }}
        keyboardShouldPersistTaps="handled"
      >
        <ProfileFields value={form} onChange={(f) => { setForm(f); setErrors({}); }} errors={errors} iinLocked={!!iin} />
        {!isBiz && !!iin && (
          <>
            <Field label={t('profile.iin')} value={maskIin(iin)} editable={false} />
            <Text style={{ color: colors.faint, fontSize: 12, marginTop: -8, marginBottom: 14 }}>{t('iin.locked')}</Text>
          </>
        )}
        <Button title={t('common.save')} icon="checkmark" onPress={save} loading={busy} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
