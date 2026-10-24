import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../lib/theme';
import { text } from '../lib/ui';

// Кіру/тіркелу экрандарының ортақ қаңқасы: артқа батырмасы, тақырып, төменгі әрекеттер
export function AuthShell({ title, subtitle, children, footer, onBack, step }: {
  title: string; subtitle?: string; children: ReactNode; footer?: ReactNode;
  onBack?: () => void; step?: { index: number; total: number };
}) {
  const router = useRouter();
  const back = onBack ?? (() => (router.canGoBack() ? router.back() : router.replace('/welcome')));
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={s.top}>
          <Pressable accessibilityLabel="Артқа" onPress={back} hitSlop={12} style={s.back}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </Pressable>
          {step && (
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {Array.from({ length: step.total }, (_, i) => (
                <View key={i} style={[s.dot, i <= step.index && { backgroundColor: colors.brand, width: 22 }]} />
              ))}
            </View>
          )}
          <View style={{ width: 40 }} />
        </View>
        <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
          <Text style={text.h1}>{title}</Text>
          {subtitle && <Text style={[text.muted, { fontSize: 15, marginBottom: 24, lineHeight: 21 }]}>{subtitle}</Text>}
          {children}
        </ScrollView>
        {footer && <View style={s.footer}>{footer}</View>}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, height: 52 },
  back: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.card },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.border },
  body: { padding: 20, paddingTop: 8, flexGrow: 1, maxWidth: 560, width: '100%', alignSelf: 'center' },
  footer: { padding: 20, paddingTop: 8, maxWidth: 560, width: '100%', alignSelf: 'center' },
});
