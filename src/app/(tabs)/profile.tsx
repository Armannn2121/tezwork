import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { MenuGroup, MenuRow } from '../../components/menu-row';
import { cityName } from '../../lib/cities';
import { useFeedback } from '../../lib/feedback';
import { formatPhone, initials } from '../../lib/format';
import { t } from '../../lib/i18n';
import { maskIin } from '../../lib/kz-id';
import { useSession } from '../../lib/session';
import { colors, radius, themed } from '../../lib/theme';
import { Badge, text } from '../../lib/ui';

export default function Profile() {
  const router = useRouter();
  const { profile, session, iin, signOut } = useSession();
  const { confirm } = useFeedback();
  const isBiz = profile?.role === 'business';

  async function logout() {
    if (await confirm({ title: t('settings.logout'), message: t('settings.logoutMsg'), confirm: t('settings.logout'), cancel: t('common.cancel') })) {
      await signOut();
    }
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16, maxWidth: 720, width: '100%', alignSelf: 'center' }}>
      <View style={s.hero}>
        <View style={s.avatar}><Text style={s.avatarText}>{initials(profile?.full_name)}</Text></View>
        <Text style={[text.h2, { marginTop: 12, textAlign: 'center' }]}>{profile?.full_name}</Text>
        {isBiz && !!profile?.company_name && <Text style={[text.muted, { fontSize: 15 }]}>{profile.company_name}</Text>}
        <View style={{ flexDirection: 'row', gap: 6, marginTop: 10 }}>
          <Badge label={isBiz ? t('role.business') : t('role.worker')} icon={isBiz ? 'business' : 'person'} tone="brand" />
          <Badge label={cityName(profile?.city ?? '')} icon="location" tone="neutral" />
        </View>
      </View>

      {!iin && (
        <Pressable onPress={() => router.push('/profile-edit')} style={s.warn}>
          <Ionicons name="alert-circle" size={20} color={colors.warn} />
          <Text style={{ color: colors.text, flex: 1, fontWeight: '600' }}>{t(isBiz ? 'profile.iinWarnEmployer' : 'profile.iinWarn')}</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.warn} />
        </Pressable>
      )}

      <MenuGroup>
        <MenuRow icon="create-outline" label={t('profile.edit')} onPress={() => router.push('/profile-edit')} />
        <MenuRow icon="call-outline" label={t('profile.phone')} value={formatPhone(session?.user.phone)} />
        <MenuRow icon="card-outline" label={t('profile.iin')} value={iin ? maskIin(iin) : t('profile.iinMissing')} onPress={iin ? undefined : () => router.push('/profile-edit')} last={!isBiz} />
        {isBiz && <MenuRow icon="add-circle-outline" label={t('profile.newShift')} onPress={() => router.navigate('/create')} last />}
      </MenuGroup>

      <MenuGroup>
        <MenuRow icon="settings-outline" label={t('profile.settings')} onPress={() => router.push('/settings')} />
        <MenuRow icon="log-out-outline" label={t('settings.logout')} onPress={logout} last />
      </MenuGroup>
    </ScrollView>
  );
}

const s = themed((c) => ({
  hero: { alignItems: 'center', paddingVertical: 20 },
  avatar: { width: 84, height: 84, borderRadius: 42, backgroundColor: c.brandSoft, borderWidth: 2, borderColor: c.brand, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: c.brand, fontSize: 30, fontWeight: '800' },
  warn: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: c.warnSoft, borderRadius: radius.md, padding: 14, marginBottom: 14 },
}));
