import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { humanError } from '../lib/errors';
import { useFeedback } from '../lib/feedback';
import { t } from '../lib/i18n';
import { useSession } from '../lib/session';
import { supabase } from '../lib/supabase';
import { radius, themed } from '../lib/theme';
import { Button, Field } from '../lib/ui';
import { MenuRow } from './menu-row';

// «Баптаулар» ішіндегі жол: жұмыс беруші ↔ орындаушы.
// Тексерістер серверде (switch_role): 18+, компания атауы, белсенді ауысым/жазылым жоқ.
export function RoleSwitchRow() {
  const router = useRouter();
  const { profile, refreshProfile } = useSession();
  const { toast } = useFeedback();
  const [open, setOpen] = useState(false);
  const [company, setCompany] = useState(profile?.company_name ?? '');
  const [busy, setBusy] = useState(false);
  const toBiz = profile?.role !== 'business';

  async function submit() {
    setBusy(true);
    const { error } = await supabase.rpc('switch_role', {
      p_role: toBiz ? 'business' : 'worker',
      p_company_name: toBiz ? company.trim() || null : null,
    });
    setBusy(false);
    if (error) return toast(humanError(error), 'error');
    await refreshProfile();
    setOpen(false);
    toast(t('role.switched'), 'success');
    router.replace('/');
  }

  return (
    <>
      <MenuRow
        icon="swap-horizontal-outline"
        label={toBiz ? t('settings.switchToBiz') : t('settings.switchToWorker')}
        value={t(toBiz ? 'role.worker' : 'role.business')}
        onPress={() => setOpen(true)}
        last
      />
      <Modal transparent visible={open} animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={s.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={s.sheet} onPress={() => {}}>
            <Text style={s.title}>{t('role.switchTitle')}</Text>
            <Text style={s.msg}>{toBiz ? t('role.switchMsgBiz') : t('role.switchMsgWorker')}</Text>
            {toBiz && (
              <View style={{ marginTop: 14 }}>
                <Field label={t('form.company')} value={company} onChangeText={setCompany} placeholder={t('form.companyPh')} />
              </View>
            )}
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
              <Button title={t('common.cancel')} variant="ghost" onPress={() => setOpen(false)} style={{ flex: 1 }} />
              <Button
                title={toBiz ? t('settings.switchToBiz') : t('settings.switchToWorker')}
                onPress={submit}
                loading={busy}
                disabled={toBiz && company.trim().length < 2}
                style={{ flex: 1 }}
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const s = themed((c) => ({
  backdrop: { flex: 1, backgroundColor: c.overlay, justifyContent: 'center', padding: 20 },
  sheet: { backgroundColor: c.card, borderRadius: radius.lg, padding: 20, borderWidth: 1, borderColor: c.border, maxWidth: 460, width: '100%', alignSelf: 'center' },
  title: { color: c.text, fontSize: 19, fontWeight: '800' },
  msg: { color: c.muted, fontSize: 14, marginTop: 8, lineHeight: 20 },
}));
