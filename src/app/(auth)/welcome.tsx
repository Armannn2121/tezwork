import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Image, ScrollView, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LangToggle } from '../../components/lang-toggle';
import { t, TKey } from '../../lib/i18n';
import { colors, radius, themed } from '../../lib/theme';
import { IconName } from '../../lib/types';
import { Button, text } from '../../lib/ui';

const FEATURES: { icon: IconName; title: TKey; sub: TKey }[] = [
  { icon: 'flash-outline', title: 'welcome.f1', sub: 'welcome.f1sub' },
  { icon: 'wallet-outline', title: 'welcome.f2', sub: 'welcome.f2sub' },
  { icon: 'people-outline', title: 'welcome.f3', sub: 'welcome.f3sub' },
];

export default function Welcome() {
  const router = useRouter();
  const [before, after] = t('welcome.legal').split('{terms}');
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={s.top}><LangToggle /></View>
      <ScrollView contentContainerStyle={s.body}>
        <Animated.View entering={FadeInDown.duration(500)} style={s.logoBox}>
          <Image source={require('../../../assets/images/tezwork-logo.png')} style={{ width: 220, height: 78 }} resizeMode="contain" />
        </Animated.View>
        <Animated.Text entering={FadeInDown.delay(100).duration(500)} style={[text.h1, { textAlign: 'center', marginTop: 24 }]}>
          {t('welcome.title')}
        </Animated.Text>
        <Animated.Text entering={FadeInDown.delay(150).duration(500)} style={[text.muted, { textAlign: 'center', fontSize: 15, lineHeight: 21 }]}>
          {t('welcome.subtitle')}
        </Animated.Text>

        <View style={{ gap: 12, marginTop: 28 }}>
          {FEATURES.map((f, i) => (
            <Animated.View key={f.title} entering={FadeInDown.delay(200 + i * 80).duration(500)} style={s.feature}>
              <View style={s.featureIcon}><Ionicons name={f.icon} size={20} color={colors.brand} /></View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: '700', fontSize: 15 }}>{t(f.title)}</Text>
                <Text style={[text.muted, { marginTop: 2 }]}>{t(f.sub)}</Text>
              </View>
            </Animated.View>
          ))}
        </View>
      </ScrollView>

      <Animated.View entering={FadeInDown.delay(450).duration(500)} style={s.footer}>
        <Button title={t('welcome.register')} icon="person-add-outline" onPress={() => router.push('/register')} />
        <Button title={t('welcome.login')} variant="secondary" icon="log-in-outline" onPress={() => router.push('/login')} style={{ marginTop: 10 }} />
        <Text style={s.legal}>
          {before}
          <Text style={{ color: colors.brand }} onPress={() => router.push({ pathname: '/legal/[doc]', params: { doc: 'terms' } })}>
            {t('consent.terms')}
          </Text>
          {after}
        </Text>
      </Animated.View>
    </SafeAreaView>
  );
}

const s = themed((c) => ({
  top: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 16, paddingTop: 8 },
  body: { padding: 20, paddingTop: 12, maxWidth: 560, width: '100%', alignSelf: 'center' },
  logoBox: { backgroundColor: c.logoBg, borderRadius: radius.lg, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: c.border },
  feature: { flexDirection: 'row', gap: 14, alignItems: 'center', backgroundColor: c.card, borderColor: c.border, borderWidth: 1, borderRadius: radius.lg, padding: 14 },
  featureIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: c.brandSoft, alignItems: 'center', justifyContent: 'center' },
  footer: { padding: 20, paddingTop: 8, maxWidth: 560, width: '100%', alignSelf: 'center' },
  legal: { color: c.faint, fontSize: 12, textAlign: 'center', marginTop: 14 },
}));
