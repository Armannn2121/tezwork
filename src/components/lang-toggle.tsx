import { Pressable, Text, View } from 'react-native';
import { useAppSettings } from '../lib/app-settings';
import { haptic } from '../lib/haptics';
import { Lang } from '../lib/i18n';
import { colors, radius } from '../lib/theme';

const OPTIONS: { id: Lang; label: string }[] = [
  { id: 'kk', label: 'ҚАЗ' },
  { id: 'ru', label: 'РУС' },
];

// Кірмей тұрып тілді ауыстыру үшін (қарсы алу, кіру, тіркелу беттері)
export function LangToggle() {
  const { lang, update } = useAppSettings();
  return (
    <View style={{ flexDirection: 'row', backgroundColor: colors.cardAlt, borderRadius: radius.pill, padding: 3 }}>
      {OPTIONS.map((o) => {
        const active = o.id === lang;
        return (
          <Pressable
            key={o.id}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => { if (!active) { haptic.select(); update({ lang: o.id }); } }}
            style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill, backgroundColor: active ? colors.card : 'transparent' }}
          >
            <Text style={{ fontSize: 12, fontWeight: '800', color: active ? colors.text : colors.muted }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
