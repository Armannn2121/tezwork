import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { humanError } from '../../lib/errors';
import { useFeedback } from '../../lib/feedback';
import { formatPhone, initials } from '../../lib/format';
import { useSession } from '../../lib/session';
import { supabase } from '../../lib/supabase';
import { colors, radius } from '../../lib/theme';
import { IconName } from '../../lib/types';
import { Badge, text } from '../../lib/ui';

function Row({ icon, label, onPress, danger, value }: { icon: IconName; label: string; onPress?: () => void; danger?: boolean; value?: string }) {
  const c = danger ? colors.danger : colors.text;
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={({ pressed }) => [s.row, pressed && { backgroundColor: colors.cardAlt }]}>
      <Ionicons name={icon} size={20} color={danger ? colors.danger : colors.muted} />
      <Text style={{ color: c, fontSize: 15, fontWeight: '600', flex: 1 }}>{label}</Text>
      {value && <Text style={text.muted}>{value}</Text>}
      {!danger && onPress && <Ionicons name="chevron-forward" size={18} color={colors.faint} />}
    </Pressable>
  );
}

export default function Profile() {
  const router = useRouter();
  const { profile, session, signOut } = useSession();
  const { toast, confirm } = useFeedback();
  const isBiz = profile?.role === 'business';

  async function logout() {
    if (await confirm({ title: 'Шығу', message: 'Аккаунттан шығасыз ба?', confirm: 'Шығу' })) await signOut();
  }

  async function deleteAccount() {
    const ok = await confirm({
      title: 'Аккаунтты жою',
      message: 'Барлық деректеріңіз біржола жойылады. Бұл әрекетті қайтару мүмкін емес.',
      confirm: 'Жою', destructive: true,
    });
    if (!ok) return;
    const { error } = await supabase.rpc('delete_my_account');
    if (error) return toast(humanError(error), 'error');
    await signOut();
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16, maxWidth: 720, width: '100%', alignSelf: 'center' }}>
      <View style={s.hero}>
        <View style={s.avatar}><Text style={s.avatarText}>{initials(profile?.full_name)}</Text></View>
        <Text style={[text.h2, { marginTop: 12 }]}>{profile?.full_name}</Text>
        {isBiz && !!profile?.company_name && <Text style={[text.muted, { fontSize: 15 }]}>{profile.company_name}</Text>}
        <View style={{ flexDirection: 'row', gap: 6, marginTop: 10 }}>
          <Badge label={isBiz ? 'Бизнес' : 'Орындаушы'} icon={isBiz ? 'business' : 'person'} tone="brand" />
          <Badge label={profile?.city ?? ''} icon="location" tone="neutral" />
        </View>
      </View>

      <View style={s.group}>
        <Row icon="create-outline" label="Профильді өңдеу" onPress={() => router.push('/profile-edit')} />
        <Row icon="call-outline" label="Телефон" value={formatPhone(session?.user.phone)} />
        {isBiz
          ? <Row icon="add-circle-outline" label="Жаңа ауысым" onPress={() => router.navigate('/create')} />
          : <Row icon="calendar-outline" label="Жазылымдарым" onPress={() => router.navigate('/my')} />}
      </View>

      <View style={s.group}>
        <Row icon="log-out-outline" label="Шығу" onPress={logout} />
        <Row icon="trash-outline" label="Аккаунтты жою" danger onPress={deleteAccount} />
      </View>

      <Text style={[text.muted, { textAlign: 'center', marginTop: 8, fontSize: 12 }]}>TezWork v{Constants.expoConfig?.version ?? '1.0.0'}</Text>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  hero: { alignItems: 'center', paddingVertical: 20 },
  avatar: { width: 84, height: 84, borderRadius: 42, backgroundColor: colors.brandSoft, borderWidth: 2, borderColor: colors.brand, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.brand, fontSize: 30, fontWeight: '800' },
  group: { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: radius.lg, overflow: 'hidden', marginBottom: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 15, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
});
