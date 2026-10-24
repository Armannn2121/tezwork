import Constants from 'expo-constants';
import { Linking, ScrollView, Switch, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { MenuGroup, MenuRow } from '../components/menu-row';
import { ThemeMode, useAppSettings } from '../lib/app-settings';
import { SUPPORT_EMAIL, SUPPORT_TELEGRAM } from '../lib/config';
import { humanError } from '../lib/errors';
import { useFeedback } from '../lib/feedback';
import { LANGS, t } from '../lib/i18n';
import { cancelAllReminders } from '../lib/reminders';
import { useSession } from '../lib/session';
import { supabase } from '../lib/supabase';
import { colors } from '../lib/theme';
import { Segmented, text } from '../lib/ui';

export default function Settings() {
  const router = useRouter();
  const { lang, theme, haptics, reminders, update } = useAppSettings();
  const { signOut } = useSession();
  const { toast, confirm } = useFeedback();

  async function logout() {
    if (await confirm({ title: t('settings.logout'), message: t('settings.logoutMsg'), confirm: t('settings.logout'), cancel: t('common.cancel') })) {
      await signOut();
    }
  }

  async function deleteAccount() {
    const ok = await confirm({
      title: t('settings.delete'), message: t('settings.deleteMsg'),
      confirm: t('settings.deleteConfirm'), cancel: t('common.cancel'), destructive: true,
    });
    if (!ok) return;
    const { error } = await supabase.rpc('delete_my_account');
    if (error) return toast(humanError(error), 'error');
    await signOut();
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16, paddingBottom: 40, maxWidth: 720, width: '100%', alignSelf: 'center' }}>
      <Text style={[text.muted, { fontWeight: '700', marginBottom: 8, marginLeft: 4 }]}>{t('settings.language').toUpperCase()}</Text>
      <Segmented options={LANGS} value={lang} onChange={(l) => update({ lang: l }, '/settings')} />

      <Text style={[text.muted, { fontWeight: '700', marginBottom: 8, marginLeft: 4 }]}>{t('settings.theme').toUpperCase()}</Text>
      <Segmented<ThemeMode>
        options={[
          { id: 'light', label: t('settings.themeLight') },
          { id: 'dark', label: t('settings.themeDark') },
          { id: 'system', label: t('settings.themeSystem') },
        ]}
        value={theme}
        onChange={(m) => update({ theme: m }, '/settings')}
      />

      <MenuGroup>
        <MenuRow
          icon="notifications-outline"
          label={t('settings.reminders')}
          right={<Switch value={reminders} onValueChange={(v) => { update({ reminders: v }); if (!v) cancelAllReminders(); }} trackColor={{ true: colors.brand, false: colors.border }} thumbColor="#fff" />}
        />
        <MenuRow
          icon="phone-portrait-outline"
          label={t('settings.haptics')}
          last
          right={<Switch value={haptics} onValueChange={(v) => update({ haptics: v })} trackColor={{ true: colors.brand, false: colors.border }} thumbColor="#fff" />}
        />
      </MenuGroup>

      <MenuGroup title={t('settings.docs')}>
        <MenuRow icon="document-text-outline" label={t('legal.terms')} onPress={() => router.push({ pathname: '/legal/[doc]', params: { doc: 'terms' } })} />
        <MenuRow icon="shield-checkmark-outline" label={t('legal.privacy')} onPress={() => router.push({ pathname: '/legal/[doc]', params: { doc: 'privacy' } })} last />
      </MenuGroup>

      {(!!SUPPORT_TELEGRAM || !!SUPPORT_EMAIL) && (
        <MenuGroup title={t('settings.support')}>
          {!!SUPPORT_TELEGRAM && (
            <MenuRow icon="paper-plane-outline" label={t('settings.writeTelegram')} onPress={() => Linking.openURL(`https://t.me/${SUPPORT_TELEGRAM}`)} last={!SUPPORT_EMAIL} />
          )}
          {!!SUPPORT_EMAIL && <MenuRow icon="mail-outline" label={t('settings.writeEmail')} onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)} last />}
        </MenuGroup>
      )}

      <MenuGroup title={t('settings.account')}>
        <MenuRow icon="log-out-outline" label={t('settings.logout')} onPress={logout} />
        <MenuRow icon="trash-outline" label={t('settings.delete')} danger onPress={deleteAccount} last />
      </MenuGroup>

      <Text style={[text.muted, { textAlign: 'center', fontSize: 12 }]}>
        TezWork · {t('settings.version', { v: Constants.expoConfig?.version ?? '1.0.0' })}
      </Text>
    </ScrollView>
  );
}
