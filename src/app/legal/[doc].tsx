import { Stack, useLocalSearchParams } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';
import { useAppSettings } from '../../lib/app-settings';
import { LEGAL_UPDATED } from '../../lib/config';
import { t } from '../../lib/i18n';
import { LegalDoc, legalSections } from '../../lib/legal';
import { colors } from '../../lib/theme';
import { text } from '../../lib/ui';

export default function LegalScreen() {
  const { doc } = useLocalSearchParams<{ doc: LegalDoc }>();
  const { lang } = useAppSettings();
  const kind: LegalDoc = doc === 'privacy' ? 'privacy' : 'terms';
  const title = kind === 'terms' ? t('legal.terms') : t('legal.privacy');
  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: 20, paddingBottom: 40, maxWidth: 720, width: '100%', alignSelf: 'center' }}>
      <Stack.Screen options={{ title }} />
      <Text style={text.h2}>{title}</Text>
      <Text style={[text.muted, { marginTop: 4, marginBottom: 18 }]}>{t('legal.updated', { date: LEGAL_UPDATED })}</Text>
      {legalSections(kind, lang).map((sec) => (
        <View key={sec.h} style={{ marginBottom: 16 }}>
          <Text style={[text.title, { fontSize: 16, marginBottom: 6 }]}>{sec.h}</Text>
          <Text style={{ color: colors.text, fontSize: 14, lineHeight: 21 }}>{sec.p}</Text>
        </View>
      ))}
    </ScrollView>
  );
}
