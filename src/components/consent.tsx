import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { haptic } from '../lib/haptics';
import { t } from '../lib/i18n';
import { colors } from '../lib/theme';

// «Келісемін» белгісі: мәтіндегі сілтемелер құжат беттерін ашады
export function ConsentCheckbox({ value, onChange, error }: { value: boolean; onChange: (v: boolean) => void; error?: boolean }) {
  const router = useRouter();
  const [before, rest] = t('consent.text').split('{terms}');
  const [middle, after] = (rest ?? '').split('{privacy}');
  const link = (doc: 'terms' | 'privacy', label: string) => (
    <Text style={{ color: colors.brand, fontWeight: '600' }} onPress={() => router.push({ pathname: '/legal/[doc]', params: { doc } })}>
      {label}
    </Text>
  );
  return (
    <View>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: value }}
        onPress={() => { haptic.select(); onChange(!value); }}
        style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start', paddingVertical: 6 }}
      >
        <Ionicons
          name={value ? 'checkbox' : 'square-outline'}
          size={22}
          color={value ? colors.brand : error ? colors.danger : colors.faint}
        />
        <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 19, flex: 1 }}>
          {before}{link('terms', t('consent.terms'))}{middle}{link('privacy', t('consent.privacy'))}{after}
        </Text>
      </Pressable>
      {error && <Text style={{ color: colors.danger, fontSize: 12, marginLeft: 32 }}>{t('consent.required')}</Text>}
    </View>
  );
}
