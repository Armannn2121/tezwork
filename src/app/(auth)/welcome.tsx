import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius } from '../../lib/theme';
import { IconName } from '../../lib/types';
import { Button, text } from '../../lib/ui';

const FEATURES: { icon: IconName; title: string; sub: string }[] = [
  { icon: 'flash-outline', title: 'Бір түртумен жазылу', sub: 'Ыңғайлы ауысымды таңда — сол күні жұмыс істе' },
  { icon: 'wallet-outline', title: 'Ашық төлем', sub: 'Төлем мен сағаттық мөлшерлеме алдын ала көрінеді' },
  { icon: 'people-outline', title: 'Бизнеске — жылдам жұмысшы', sub: 'Ауысымды жариялап, жазылғандарды басқар' },
];

export default function Welcome() {
  const router = useRouter();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={s.body}>
        <Animated.View entering={FadeInDown.duration(500)} style={s.logoBox}>
          <Image source={require('../../../assets/images/tezwork-logo.png')} style={{ width: 220, height: 78 }} resizeMode="contain" />
        </Animated.View>
        <Animated.Text entering={FadeInDown.delay(100).duration(500)} style={[text.h1, { textAlign: 'center', marginTop: 24 }]}>
          Сағаттық жұмыс — оңай әрі жылдам
        </Animated.Text>
        <Animated.Text entering={FadeInDown.delay(150).duration(500)} style={[text.muted, { textAlign: 'center', fontSize: 15, lineHeight: 21 }]}>
          Қазақстандағы ауысымдық жұмыс платформасы
        </Animated.Text>

        <View style={{ gap: 12, marginTop: 28 }}>
          {FEATURES.map((f, i) => (
            <Animated.View key={f.title} entering={FadeInDown.delay(200 + i * 80).duration(500)} style={s.feature}>
              <View style={s.featureIcon}><Ionicons name={f.icon} size={20} color={colors.brand} /></View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: '700', fontSize: 15 }}>{f.title}</Text>
                <Text style={[text.muted, { marginTop: 2 }]}>{f.sub}</Text>
              </View>
            </Animated.View>
          ))}
        </View>
      </ScrollView>

      <Animated.View entering={FadeInDown.delay(450).duration(500)} style={s.footer}>
        <Button title="Тіркелу" icon="person-add-outline" onPress={() => router.push('/register')} />
        <Button title="Кіру" variant="secondary" icon="log-in-outline" onPress={() => router.push('/login')} style={{ marginTop: 10 }} />
        <Text style={s.legal}>Жалғастыру арқылы сіз қызмет көрсету шарттарымен келісесіз</Text>
      </Animated.View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  body: { padding: 20, paddingTop: 32, maxWidth: 560, width: '100%', alignSelf: 'center' },
  logoBox: { backgroundColor: '#fff', borderRadius: radius.lg, paddingVertical: 14, alignItems: 'center' },
  feature: { flexDirection: 'row', gap: 14, alignItems: 'center', backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: radius.lg, padding: 14 },
  featureIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' },
  footer: { padding: 20, paddingTop: 8, maxWidth: 560, width: '100%', alignSelf: 'center' },
  legal: { color: colors.faint, fontSize: 12, textAlign: 'center', marginTop: 14 },
});
